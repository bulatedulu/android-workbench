import * as vscode from 'vscode';
import { AgentProvider } from '../agent/provider';
import { PiRpcClient } from '../agent/piRpcClient';
import { WorkbenchService } from '../domain/workbench';
import { buildPiChatHtml } from './piChatHtml';
import { PiChatController, PiChatHost } from './piChatController';

/** Pi 面板视图 id（辅助侧边栏 secondarySidebar 容器内，与 Copilot Chat 同级）。 */
export const PI_PANEL_VIEW_ID = 'aiWorkbench.piPanel';

let controller: PiChatController | undefined;
let currentView: vscode.WebviewView | undefined;

/** 注册 Pi 辅助侧边栏面板（WebviewView）。薄壳：注册视图 + 创建控制器渲染欢迎 HTML。 */
export function registerPiPanel(context: vscode.ExtensionContext, provider: AgentProvider, rpc: PiRpcClient): void {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            PI_PANEL_VIEW_ID,
            {
                resolveWebviewView(webviewView: vscode.WebviewView): void {
                    webviewView.webview.options = { enableScripts: true };
                    webviewView.webview.html = buildPiChatHtml();
                    const host: PiChatHost = {
                        post: (message) => void webviewView.webview.postMessage(message)
                    };
                    const instance = new PiChatController(host, provider, rpc);
                    controller = instance;
                    currentView = webviewView;
                    webviewView.webview.onDidReceiveMessage((raw) => {
                        instance.handleMessage(raw);
                    });
                    webviewView.onDidDispose(() => {
                        if (currentView === webviewView) {
                            currentView = undefined;
                        }
                        controller = undefined;
                    });
                }
            },
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );
}

/** 打开/聚焦右侧 Pi 面板（VS Code 为每个视图自动生成 `<viewId>.focus` 命令）。 */
export async function openPiPanel(): Promise<void> {
    await vscode.commands.executeCommand(`${PI_PANEL_VIEW_ID}.focus`);
}

/** 右键「打开最近会话」：聚焦面板，resume 该目录最新历史会话；无历史则打开面板空会话。 */
export async function openLatestSession(folderPath: string, service: WorkbenchService): Promise<void> {
    await openPiPanel();
    const sessions = service.listSessionsUnderFolder(folderPath);
    const latest = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (latest) {
        controller?.showSession(latest);
    } else {
        controller?.showNewSession(folderPath);
    }
}

