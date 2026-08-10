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
import { normalizePathForMatch } from '../domain/paths';
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
        // 开发阶段：每次出现都回到引导界面，配置自动回填
        this.renderWizard();

        webviewView.webview.onDidReceiveMessage((raw) => {
            void this.handleMessage(raw as AssistantViewMessage);
        });
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.showWizard();
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
            return { parent: undefined, subdirs: [], selected: [], defaultName: '', exists: false };
        }
        const subdirs = listSubdirectories(parent);
        const saved = config.folders.filter((f) => subdirs.includes(f));
        const selected = saved.length > 0 ? saved : subdirs; // 旧目录回填已选，新目录默认全选
        const defaultName = config.name || defaultWorkspaceFileName(parent);
        return {
            parent,
            subdirs,
            selected,
            defaultName,
            exists: fs.existsSync(resolveWorkspaceFile(parent, defaultName))
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
                break;
            }
            case 'pickParent': {
                const folders = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: '选择项目存放目录'
                });
                if (!folders || folders.length === 0) {
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
            case 'nameChanged': {
                if (!this.parent) {
                    break;
                }
                const exists = fs.existsSync(resolveWorkspaceFile(this.parent, message.name));
                this.post({ type: 'exists', exists });
                break;
            }
            case 'create':
            case 'overwrite': {
                if (!this.parent) {
                    break;
                }
                const folders = Array.isArray(message.folders) ? message.folders.map(String) : [];
                if (folders.length === 0) {
                    void vscode.window.showErrorMessage('请至少选择一个项目文件夹。');
                    break;
                }
                const file = resolveWorkspaceFile(this.parent, message.name);
                const exists = fs.existsSync(file);
                if (exists) {
                    if (message.type === 'create') {
                        const answer = await vscode.window.showWarningMessage(
                            `工作区文件已存在：${path.basename(file)}`,
                            { modal: true },
                            '直接加载',
                            '覆盖'
                        );
                        if (answer === '直接加载') {
                            this.enterChat(this.readFoldersFromFile(file), path.basename(file));
                            break;
                        }
                        if (answer !== '覆盖') {
                            break;
                        }
                    } else {
                        const answer = await vscode.window.showWarningMessage(
                            `确定覆盖重建 ${path.basename(file)}？将改写该工作区文件。`,
                            { modal: true },
                            '覆盖'
                        );
                        if (answer !== '覆盖') {
                            break;
                        }
                    }
                }
                this.writeAndEnter(file, folders);
                break;
            }
            case 'load': {
                if (!this.parent) {
                    break;
                }
                const file = resolveWorkspaceFile(this.parent, message.name);
                if (fs.existsSync(file)) {
                    this.enterChat(this.readFoldersFromFile(file), path.basename(file));
                }
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

    private writeAndEnter(file: string, folders: string[]): void {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, buildWorkspaceFileContent(folders), 'utf8');
        this.enterChat(folders, path.basename(file));
    }

    /** 读取 .code-workspace 里的文件夹列表（容错：解析失败返回空）。 */
    private readFoldersFromFile(file: string): string[] {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { folders?: { path?: string }[] };
            if (!Array.isArray(data.folders)) {
                return [];
            }
            return data.folders.map((f) => String(f?.path ?? '')).filter(Boolean);
        } catch {
            return [];
        }
    }

    private enterChat(folders: string[], name: string): void {
        const config: AssistantConfig = { parent: this.parent, folders, name };
        void writeAssistantConfig(this.context.globalState, config);
        this.addFoldersToWorkspace(folders);
        this.showChat();
        this.postChat('system', `已就绪。项目存放根目录：${this.parent ?? '（未设置）'}。输入「${NEW_ISSUE_COMMAND}」创建 BUG-N。`);
    }

    /** 把文件夹增量加入当前工作区（不重载窗口）。 */
    private addFoldersToWorkspace(folders: string[]): void {
        const existing = new Set(
            (vscode.workspace.workspaceFolders ?? []).map((f) => normalizePathForMatch(f.uri.fsPath))
        );
        const toAdd = folders.filter((f) => !existing.has(normalizePathForMatch(f)));
        let index = vscode.workspace.workspaceFolders?.length ?? 0;
        for (const f of toAdd) {
            vscode.workspace.updateWorkspaceFolders(index, 0, { uri: vscode.Uri.file(f) });
            index += 1;
        }
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
