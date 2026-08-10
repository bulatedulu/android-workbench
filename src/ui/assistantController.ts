import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    buildAssistantViewHtml,
    AssistantHostMessage,
    AssistantViewMessage,
    AssistantWizardState
} from './assistantViewHtml';
import { AssistantConfig, readAssistantConfig } from './assistantConfig';
import { defaultWorkspaceFileName, listSubdirectories } from '../domain/workspaceSetup';
import {
    bugDirectoryName,
    createBugDirectory,
    listBugDirectories,
    nextBugNumber,
    resolveProjectRoot
} from '../domain/issueSpace';
import { NEW_ISSUE_COMMAND } from './messages';
import { confirmWorkspace } from './workspaceActions';

interface PendingChat {
    role: 'assistant' | 'system';
    text: string;
}

/** 宿主抽象：侧边栏 WebviewView 与编辑器全屏 WebviewPanel 共用。 */
export interface AssistantHost {
    readonly context: vscode.ExtensionContext;
    post(message: AssistantHostMessage): void;
    /** 设置 webview 内容。 */
    setHtml(html: string): void;
}

/** 助手控制器：引导 + 聊天两步式，与具体 Webview 载体解耦。 */
export class AssistantController {
    private ready = false;
    private pending: PendingChat[] = [];
    private parent: string | undefined;

    constructor(private readonly host: AssistantHost) { }

    private readConfig(): AssistantConfig {
        return readAssistantConfig(this.host.context.globalState);
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
        return { parent, subdirs, selected, defaultName };
    }

    /** 初始渲染引导（配置回填）。 */
    renderWizard(): void {
        const config = this.readConfig();
        this.parent = config.parent;
        this.host.setHtml(buildAssistantViewHtml(this.wizardState(config)));
    }

    /** 有工作区文件时直接进聊天（避免确认→重载→引导循环），否则回引导。 */
    showInitialPhase(): void {
        if (vscode.workspace.workspaceFile) {
            this.showChat();
        } else {
            this.showWizard();
        }
    }

    showWizard(): void {
        this.host.post({ type: 'phase', phase: 'wizard' });
        this.host.post({ type: 'wizardState', state: this.wizardState(this.readConfig()) });
    }

    showChat(): void {
        this.host.post({ type: 'phase', phase: 'chat' });
    }

    async handleMessage(message: AssistantViewMessage): Promise<void> {
        switch (message.type) {
            case 'ready': {
                this.ready = true;
                for (const m of this.pending) {
                    this.host.post({ type: 'chat', role: m.role, text: m.text });
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
                    this.host.post({ type: 'focusDir' });
                    break;
                }
                this.parent = folders[0].fsPath;
                // 重选同一父目录时回填已保存配置，否则全新选择
                const saved = this.readConfig();
                const config =
                    saved.parent === this.parent
                        ? saved
                        : { parent: this.parent, folders: [], name: '' };
                this.host.post({ type: 'wizardState', state: this.wizardState(config) });
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
                this.host.post({
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
                confirmWorkspace(this.host.context, this.parent, folders, message.name);
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

    private postChat(role: 'assistant' | 'system', text: string): void {
        if (this.ready) {
            this.host.post({ type: 'chat', role, text });
        } else {
            this.pending.push({ role, text });
        }
    }

    private async handleNewIssue(): Promise<void> {
        const config = this.readConfig();
        const root = config.parent ?? resolveProjectRoot(vscode.workspace.workspaceFile?.fsPath);
        if (!root) {
            this.postChat('system', '未找到项目存放根目录，请先在引导中选择工作目录。');
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
