import * as vscode from 'vscode';
import { Session } from '../domain/session';
import { AgentProvider } from '../agent/provider';
import { buildHtml, handleViewerMessage } from './sessionViewerHtml';

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
            const handled = handleViewerMessage(message, session, provider, (command) => {
                const terminal = vscode.window.createTerminal({ name: `pi: ${session.title}` });
                terminal.show();
                terminal.sendText(command);
            });
            if (handled) {
                resumed = true;
                void vscode.window.showInformationMessage('已在集成终端恢复该会话，请到终端继续对话。');
            }
        },
        undefined,
        context.subscriptions
    );
}
