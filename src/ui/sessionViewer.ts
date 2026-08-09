import * as vscode from 'vscode';
import { Session } from '../domain/session';
import { AgentProvider } from '../agent/provider';
import { buildHtml, handleViewerMessage } from './sessionViewerHtml';
import { NO_COMMAND_MESSAGE, RESUME_SUCCESS_MESSAGE } from './messages';

/**
 * 打开会话查看器（Webview）：
 * - 打开时只读渲染完整消息（不启动任何进程）
 * - 聚焦底部输入框触发「恢复会话」：在集成终端运行 pi，每个查看器只恢复一次
 */
export function showSessionViewer(
    context: vscode.ExtensionContext,
    session: Session,
    provider: AgentProvider
): void {
    const panel = vscode.window.createWebviewPanel(
        'aiWorkbench.sessionViewer',
        session.title,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    panel.webview.html = buildHtml(session.title, provider.readSessionContent(session));

    let resumed = false;
    panel.webview.onDidReceiveMessage(
        (message) => {
            if (resumed) {
                return;
            }
            const launched = handleViewerMessage(message, session, provider, (command) => {
                if (!provider.isAvailable()) {
                    void vscode.window.showErrorMessage(NO_COMMAND_MESSAGE);
                    return false;
                }
                const terminal = vscode.window.createTerminal({ name: `pi: ${session.title}` });
                terminal.show();
                terminal.sendText(command);
                return true;
            });
            if (launched) {
                resumed = true;
                void vscode.window.showInformationMessage(RESUME_SUCCESS_MESSAGE);
            }
        },
        undefined,
        context.subscriptions
    );
}
