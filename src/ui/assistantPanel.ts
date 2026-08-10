import * as vscode from 'vscode';
import { AssistantController, AssistantHost } from './assistantController';
import { AssistantViewMessage } from './assistantViewHtml';
import { hideEditorTabsWhileOpen } from './editorTabs';

/** 打开编辑器区域全屏「工作台」面板：占满编辑区、隐藏标签栏（无顶部标签）、不影响辅助侧边栏。 */
export function openAssistantFullscreen(context: vscode.ExtensionContext): void {
    const panel = vscode.window.createWebviewPanel(
        'aiWorkbench.assistantFullscreen',
        'AI 工作台助手',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    // 打开期间隐藏编辑器标签栏（无顶部标签）；关闭时自动恢复
    hideEditorTabsWhileOpen(panel, context);

    const host: AssistantHost = {
        context,
        post: (message) => void panel.webview.postMessage(message),
        setHtml: (html) => {
            panel.webview.html = html;
        }
    };
    const controller = new AssistantController(host);
    controller.renderWizard();

    panel.webview.onDidReceiveMessage(
        (raw) => {
            void controller.handleMessage(raw as AssistantViewMessage);
        },
        undefined,
        context.subscriptions
    );
}
