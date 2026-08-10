import * as vscode from 'vscode';
import * as path from 'node:path';
import { Session } from './domain/session';
import { WorkbenchService } from './domain/workbench';
import { PiProvider } from './agent/piProvider';
import { FileTagsStore } from './storage/tagsStore';
import { WorkspaceProjectSource } from './ui/workspaceProjects';
import { showSessionViewer } from './ui/sessionViewer';
import { openWorkspaceWizard } from './ui/workspaceWizard';
import { registerAssistantView } from './ui/assistantView';
import { openAssistantFullscreen } from './ui/assistantPanel';
import { registerExplorerSessionList } from './ui/explorerSessions';
import { registerChatParticipant } from './ui/chatParticipant';

export function activate(context: vscode.ExtensionContext): void {
    // 未信任工作区（受限模式）时自动打开官方信任管理窗口（onStartupFinished 保证受限模式也激活）
    if (!vscode.workspace.isTrusted) {
        void vscode.commands.executeCommand('workbench.trust.manage');
    }

    const tags = new FileTagsStore(path.join(context.globalStorageUri.fsPath, 'tags.json'));
    const projects = new WorkspaceProjectSource(tags);
    const provider = new PiProvider();
    const service = new WorkbenchService(projects, provider);

    // 侧边栏助手（引导 → 聊天两步式，替换原项目树）
    registerAssistantView(context);
    registerExplorerSessionList(context, service, provider);
    registerChatParticipant(context, service, provider);

    context.subscriptions.push(
        vscode.commands.registerCommand('aiWorkbench.openSession', (session: Session) => {
            showSessionViewer(context, session, provider);
        }),
        vscode.commands.registerCommand('aiWorkbench.createWorkspace', () => {
            openWorkspaceWizard(context);
        }),
        vscode.commands.registerCommand('aiWorkbench.openAssistant', () => {
            openAssistantFullscreen(context);
        }),
        vscode.commands.registerCommand('aiWorkbench.openAssistantFullscreen', () => {
            openAssistantFullscreen(context);
        })
    );
}

export function deactivate(): void { }
