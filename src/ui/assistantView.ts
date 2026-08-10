import * as vscode from 'vscode';
import { AssistantController, AssistantHost } from './assistantController';
import { AssistantViewMessage } from './assistantViewHtml';

/** 注册侧边栏「助手」入口视图（活动栏图标 → 窄栏入口，可点标题栏按钮打开全屏工作台）。 */
export function registerAssistantView(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'aiWorkbench.assistant',
            new AssistantViewProvider(context),
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );
}

class AssistantViewProvider implements vscode.WebviewViewProvider {
    private controller: AssistantController | undefined;

    constructor(private readonly context: vscode.ExtensionContext) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        webviewView.webview.options = { enableScripts: true };
        const host: AssistantHost = {
            context: this.context,
            post: (message) => void webviewView.webview.postMessage(message),
            setHtml: (html) => {
                webviewView.webview.html = html;
            }
        };
        const controller = new AssistantController(host);
        this.controller = controller;
        controller.renderWizard();

        webviewView.webview.onDidReceiveMessage((raw) => {
            void controller.handleMessage(raw as AssistantViewMessage);
        });
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                controller.showInitialPhase();
            }
        });
    }
}


