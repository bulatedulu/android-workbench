import * as vscode from 'vscode';
import * as path from 'node:path';
import { Session } from './domain/session';
import { WorkbenchService } from './domain/workbench';
import { PiProvider } from './agent/piProvider';
import { FileTagsStore } from './storage/tagsStore';
import { WorkspaceProjectSource } from './ui/workspaceProjects';
import { WorkbenchTreeProvider } from './ui/workbenchTree';
import { registerProjectCommands } from './ui/commands';
import { registerSearchCommands } from './ui/searchCommands';
import { showSessionViewer } from './ui/sessionViewer';
import { openWorkspaceWizard } from './ui/workspaceWizard';
import { openAssistantHub } from './ui/assistantHub';
import { registerExplorerSessionList } from './ui/explorerSessions';
import { registerChatParticipant } from './ui/chatParticipant';
import { statusMessage } from './ui/messages';

/** 根据 pi 存储与命令可用性，设置树视图的空态消息。 */
function updateViewMessage(view: vscode.TreeView<unknown>, service: WorkbenchService): void {
    view.message = statusMessage(service.hasStore(), service.agentAvailable);
}

export function activate(context: vscode.ExtensionContext): void {
    const tags = new FileTagsStore(path.join(context.globalStorageUri.fsPath, 'tags.json'));
    const projects = new WorkspaceProjectSource(tags);
    const provider = new PiProvider();
    const service = new WorkbenchService(projects, provider);
    const tree = new WorkbenchTreeProvider(service);

    const view = vscode.window.createTreeView('aiWorkbench.projects', { treeDataProvider: tree });
    updateViewMessage(view, service);
    context.subscriptions.push(
        view,
        // 工作区文件夹增删（含 VS Code 原生操作）时自动刷新树
        vscode.workspace.onDidChangeWorkspaceFolders(() => tree.refresh()),
        vscode.commands.registerCommand('aiWorkbench.openWorkbench', () => {
            void vscode.commands.executeCommand('aiWorkbench.projects.focus');
        }),
        vscode.commands.registerCommand('aiWorkbench.openSession', (session: Session) => {
            showSessionViewer(context, session, provider);
        }),
        vscode.commands.registerCommand('aiWorkbench.createWorkspace', () => {
            openWorkspaceWizard(context);
        }),
        vscode.commands.registerCommand('aiWorkbench.openAssistant', () => {
            openAssistantHub(context);
        }),
        vscode.commands.registerCommand('aiWorkbench.refresh', () => {
            tree.refresh(); // WorkbenchTreeProvider.refresh 内部已清会话缓存
            updateViewMessage(view, service);
            const status = statusMessage(service.hasStore(), service.agentAvailable);
            if (status) {
                void vscode.window.showErrorMessage(status);
            } else {
                void vscode.window.showInformationMessage('已刷新');
            }
        })
    );

    registerProjectCommands(context, service, tree);
    registerSearchCommands(context, service, tree);
    registerExplorerSessionList(context, service, provider);
    registerChatParticipant(context, service, provider);
}

export function deactivate(): void { }
