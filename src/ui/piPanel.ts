import * as vscode from 'vscode';
import { AgentProvider } from '../agent/provider';
import { PiRpcClient } from '../agent/piRpcClient';
import { WorkbenchService } from '../domain/workbench';
import { Session } from '../domain/session';
import { buildPiChatHtml } from './piChatHtml';
import { PiChatController, PiChatHost } from './piChatController';
import { buildSessionPickChoices } from './piSessionPicker';

/** Pi 面板视图 id（辅助侧边栏 secondarySidebar 容器内，与 Copilot Chat 同级）。 */
export const PI_PANEL_VIEW_ID = 'aiWorkbench.piPanel';

/** QuickPick 项：携带选中动作（开启新会话 / 历史会话）。 */
interface PiPickItem extends vscode.QuickPickItem {
    action: 'new' | 'session';
    session?: Session;
}

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

/**
 * 右键入口：聚焦 Pi 面板 → 弹 QuickPick（开启新会话 + 该目录历史会话）→
 * 选中历史会话加载到面板；选「开启新会话」显示空会话（对话在后续 ticket）。
 */
export async function pickAndOpenSession(folderPath: string, service: WorkbenchService): Promise<void> {
    await openPiPanel();
    const sessions = service.listSessionsUnderFolder(folderPath);
    const choices = buildSessionPickChoices(sessions);
    const items: PiPickItem[] = choices.map((c) =>
        c.action === 'new'
            ? { label: c.label, action: 'new' as const }
            : { label: c.label, description: c.description, action: 'session' as const, session: c.session }
    );
    const picked = await vscode.window.showQuickPick(items, {
        title: `选择会话（${folderPath}）`,
        placeHolder: '开启新会话，或选择历史会话'
    });
    if (!picked) {
        return;
    }
    if (!controller) {
        return; // 面板未就绪（防御）
    }
    if (picked.action === 'session' && picked.session) {
        controller.showSession(picked.session);
    } else if (picked.action === 'new') {
        controller.showNewSession(folderPath);
    }
}

