import * as vscode from 'vscode';
import * as path from 'node:path';
import { Session } from './domain/session';
import { WorkbenchService } from './domain/workbench';
import { PiProvider } from './agent/piProvider';
import { PiRpcClient } from './agent/piRpcClient';
import { FileTagsStore } from './storage/tagsStore';
import { WorkspaceProjectSource } from './ui/workspaceProjects';
import { showSessionViewer } from './ui/sessionViewer';
import { openWorkspaceWizard } from './ui/workspaceWizard';
import { openAssistantFullscreen, toggleAssistantFullscreen } from './ui/assistantPanel';
import { registerExplorerSessionList } from './ui/explorerSessions';
import { registerChatParticipant } from './ui/chatParticipant';
import { registerPiPanel, pickAndOpenSession } from './ui/piPanel';
export function activate(context: vscode.ExtensionContext): void {
    // 未信任工作区（受限模式）时自动打开官方信任管理窗口（onStartupFinished 保证受限模式也激活）
    if (!vscode.workspace.isTrusted) {
        void vscode.commands.executeCommand('workbench.trust.manage');
    }

    const tags = new FileTagsStore(path.join(context.globalStorageUri.fsPath, 'tags.json'));
    const projects = new WorkspaceProjectSource(tags);
    const provider = new PiProvider();
    const service = new WorkbenchService(projects, provider);
    const rpc = new PiRpcClient();

    registerExplorerSessionList(context, service, provider);
    registerChatParticipant(context, service, provider);
    registerPiPanel(context, provider, rpc);

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
        }),
        // 顶部标题栏图标按钮：点一下开全屏、再点一下关
        vscode.commands.registerCommand('aiWorkbench.toggleFullscreen', () => {
            toggleAssistantFullscreen(context);
        }),
        // 资源管理器右键「会话列表」→ 弹会话选择 → 加载到右侧 Pi 面板
        vscode.commands.registerCommand('aiWorkbench.openPiPanel', (uri?: vscode.Uri) => {
            if (uri) {
                void pickAndOpenSession(uri.fsPath, service);
            }
        })
    );
}

export function deactivate(): void { }
