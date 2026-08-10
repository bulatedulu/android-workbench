import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    buildAssistantViewHtml,
    AssistantHostMessage,
    AssistantViewMessage,
    AssistantWizardState
} from './assistantViewHtml';
import { AssistantConfig, readAssistantConfig, writeAssistantConfig } from './assistantConfig';
import {
    buildWorkspaceFileContent,
    defaultWorkspaceFileName,
    listSubdirectories,
    resolveWorkspaceFile
} from '../domain/workspaceSetup';
import {
    bugDirectoryName,
    createBugDirectory,
    listBugDirectories,
    nextBugNumber,
    resolveProjectRoot
} from '../domain/issueSpace';
import { NEW_ISSUE_COMMAND } from './messages';

interface PendingChat {
    role: 'assistant' | 'system';
    text: string;
}

/** 注册侧边栏「助手」视图（引导 → 聊天两步式，替换原项目树）。 */
export function registerAssistantView(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'aiWorkbench.assistant',
            new AssistantViewProvider(context),
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );
}

class AssistantViewProvider implements vscode.WebviewViewProvider {
    private view: vscode.WebviewView | undefined;
    private ready = false;
    private pending: PendingChat[] = [];
    private parent: string | undefined;

    constructor(private readonly context: vscode.ExtensionContext) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        // 初始渲染引导（配置回填）；有工作区文件时 ready 后切聊天
        this.renderWizard();

        webviewView.webview.onDidReceiveMessage((raw) => {
            void this.handleMessage(raw as AssistantViewMessage);
        });
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.showInitialPhase();
            }
        });
    }

    private post(message: AssistantHostMessage): void {
        void this.view?.webview.postMessage(message);
    }

    private readConfig(): AssistantConfig {
        return readAssistantConfig(this.context.globalState);
    }

    private wizardState(config: AssistantConfig): AssistantWizardState {
        const parent = config.parent ?? this.parent;
        if (!parent) {
            return { parent: undefined, subdirs: [], selected: [], defaultName: '' };
        }
        const subdirs = listSubdirectories(parent);
        const saved = config.folders.filter((f) => subdirs.includes(f));
        const selected = saved.length > 0 ? saved : subdirs; // 旧目录回填已选，新目录默认全选
        const defaultName = config.name || defaultWorkspaceFileName(parent);
        return {
            parent,
            subdirs,
            selected,
            defaultName
        };
    }

    private renderWizard(): void {
        if (!this.view) {
            return;
        }
        const config = this.readConfig();
        this.parent = config.parent;
        this.view.webview.html = buildAssistantViewHtml(this.wizardState(config));
    }

    private showWizard(): void {
        this.post({ type: 'phase', phase: 'wizard' });
        this.post({ type: 'wizardState', state: this.wizardState(this.readConfig()) });
    }

    /** 有工作区文件时直接进聊天（openFolder 已重载，避免确认→重载→引导循环），否则回引导。 */
    private showInitialPhase(): void {
        if (vscode.workspace.workspaceFile) {
            this.showChat();
        } else {
            this.showWizard();
        }
    }

    private showChat(): void {
        this.post({ type: 'phase', phase: 'chat' });
    }

    private async handleMessage(message: AssistantViewMessage): Promise<void> {
        switch (message.type) {
            case 'ready': {
                this.ready = true;
                for (const m of this.pending) {
                    this.post({ type: 'chat', role: m.role, text: m.text });
                }
                this.pending = [];
                // openFolder 重载后已有工作区：直接切到聊天
                if (vscode.workspace.workspaceFile) {
                    this.showChat();
                }
                break;
            }
            case 'pickParent': {
                const folders = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: '选择工作目录'
                });
                if (!folders || folders.length === 0) {
                    this.post({ type: 'focusDir' });
                    break;
                }
                this.parent = folders[0].fsPath;
                // 重选同一父目录时回填已保存配置，否则全新选择
                const saved = this.readConfig();
                const config =
                    saved.parent === this.parent
                        ? saved
                        : { parent: this.parent, folders: [], name: '' };
                this.post({ type: 'wizardState', state: this.wizardState(config) });
                break;
            }
            case 'dirChanged': {
                const dir = (message.dir ?? '').trim();
                if (!dir) {
                    break;
                }
                if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
                    void vscode.window.showErrorMessage(`目录不存在：${dir}`);
                    break;
                }
                this.parent = dir;
                this.post({
                    type: 'wizardState',
                    state: this.wizardState({ parent: dir, folders: [], name: '' })
                });
                break;
            }
            case 'create': {
                if (!this.parent) {
                    break;
                }
                const folders = Array.isArray(message.folders) ? message.folders.map(String) : [];
                if (folders.length === 0) {
                    void vscode.window.showErrorMessage('请至少选择一个项目文件夹。');
                    break;
                }
                // 同名直接覆盖写入 .code-workspace，然后打开有名字的工作区（重载窗口）
                const file = resolveWorkspaceFile(this.parent, message.name);
                this.confirmAndOpen(file, folders);
                break;
            }
            case 'send': {
                const text = (message.text ?? '').trim();
                if (!text) {
                    break;
                }
                if (text.includes(NEW_ISSUE_COMMAND)) {
                    await this.handleNewIssue();
                } else {
                    this.postChat('assistant', `暂未接入 AI 模型。当前可用指令：「${NEW_ISSUE_COMMAND}」。`);
                }
                break;
            }
        }
    }

    /** 写 .code-workspace + 保存配置 + 打开有名字的工作区（重载窗口）。 */
    private confirmAndOpen(file: string, folders: string[]): void {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, buildWorkspaceFileContent(folders), 'utf8');
        const config: AssistantConfig = { parent: this.parent, folders, name: path.basename(file) };
        void writeAssistantConfig(this.context.globalState, config);
        void vscode.window.showInformationMessage('初始化已完成。');
        // 打开有名字的工作区；重载后 workspaceFile 存在，侧边栏直接进聊天
        void vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(file));
    }

    private postChat(role: 'assistant' | 'system', text: string): void {
        if (this.ready) {
            this.post({ type: 'chat', role, text });
        } else {
            this.pending.push({ role, text });
        }
    }

    private async handleNewIssue(): Promise<void> {
        const config = this.readConfig();
        const root = config.parent ?? resolveProjectRoot(vscode.workspace.workspaceFile?.fsPath);
        if (!root) {
            this.postChat('system', '未找到项目存放根目录，请先在引导中选择父目录。');
            return;
        }
        const next = nextBugNumber(listBugDirectories(root));
        const dirName = bugDirectoryName(next);
        const dirPath = path.join(root, dirName);
        try {
            createBugDirectory(root, dirName);
        } catch (err) {
            this.postChat('system', `创建目录失败：${err instanceof Error ? err.message : String(err)}`);
            return;
        }
        const added = vscode.workspace.updateWorkspaceFolders(
            vscode.workspace.workspaceFolders?.length ?? 0,
            0,
            { uri: vscode.Uri.file(dirPath) }
        );
        if (!added) {
            this.postChat('system', `已创建 ${dirName}，但加入工作区失败，已中止启动 pi。`);
            return;
        }
        const terminal = vscode.window.createTerminal({ name: `pi: ${dirName}`, cwd: dirPath });
        terminal.show();
        terminal.sendText('pi');
        this.postChat('assistant', `已创建 ${dirName} 并加入工作区，正在该目录启动 pi。`);
    }
}
