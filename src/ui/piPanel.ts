import * as vscode from 'vscode';
import { buildPiChatHtml } from './piChatHtml';

/** Pi 面板视图 id（辅助侧边栏 secondarySidebar 容器内，与 Copilot Chat 同级）。 */
export const PI_PANEL_VIEW_ID = 'aiWorkbench.piPanel';

/** 注册 Pi 辅助侧边栏面板（WebviewView）。薄壳：只注册视图 + 渲染欢迎 HTML。 */
export function registerPiPanel(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            PI_PANEL_VIEW_ID,
            {
                resolveWebviewView(webviewView: vscode.WebviewView): void {
                    webviewView.webview.options = { enableScripts: true };
                    webviewView.webview.html = buildPiChatHtml();
                }
            },
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );
}

/** 打开/聚焦右侧 Pi 面板（VS Code 为每个视图自动生成 `<viewId>.focus` 命令）。 */
export function openPiPanel(): void {
    void vscode.commands.executeCommand(`${PI_PANEL_VIEW_ID}.focus`);
}
