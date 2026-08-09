import * as vscode from 'vscode';
import { WorkbenchService } from '../domain/workbench';
import { AgentProvider } from '../agent/provider';
import { showSessionViewer } from './sessionViewer';
import { formatTime } from './format';

/**
 * Explorer 文件夹右键「查看会话列表」：QuickPick 列出该目录下的 AI 会话，
 * 选中后打开只读查看器（内含懒加载恢复入口）。
 */
export function registerExplorerSessionList(
    context: vscode.ExtensionContext,
    service: WorkbenchService,
    provider: AgentProvider
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('aiWorkbench.explorerSessionList', async (uri?: vscode.Uri) => {
            if (!uri) {
                return;
            }
            const folderPath = uri.fsPath;
            const sessions = service.listSessionsUnderFolder(folderPath);
            if (sessions.length === 0) {
                void vscode.window.showInformationMessage('该目录下没有 AI 会话。');
                return;
            }
            const items = sessions.map((s) => ({
                label: s.title,
                description: s.model
                    ? `${s.model} · ${formatTime(s.updatedAt)}`
                    : formatTime(s.updatedAt),
                detail: s.path,
                session: s
            }));
            const picked = await vscode.window.showQuickPick(items, { placeHolder: '选择会话' });
            if (picked) {
                showSessionViewer(context, picked.session, provider);
            }
        })
    );
}
