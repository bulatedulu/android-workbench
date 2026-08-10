import * as vscode from 'vscode';
import { AssistantController, AssistantHost } from './assistantController';
import { AssistantViewMessage } from './assistantViewHtml';
import {
    openAssistantFullscreen,
    closeAssistantFullscreen,
    isAssistantFullscreenOpen
} from './assistantPanel';

/** 注册侧边栏「助手」入口视图：点活动栏图标 = 切换全屏工作台（开/关）。 */
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
    /** 主动收起侧边栏时置位，避免触发「用户收起 → 关全屏」。 */
    private autoClosingSidebar = false;

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
                // 点活动栏图标展开容器 → 切换全屏工作台，然后收起侧边栏（视觉上只开关全屏）
                this.toggleFullscreenAndCloseSidebar();
            } else {
                // 用户主动收起侧边栏 → 关闭全屏工作台
                if (!this.autoClosingSidebar) {
                    closeAssistantFullscreen();
                }
            }
        });
        if (webviewView.visible) {
            this.toggleFullscreenAndCloseSidebar();
        }
    }

    private toggleFullscreenAndCloseSidebar(): void {
        if (isAssistantFullscreenOpen()) {
            closeAssistantFullscreen();
        } else {
            openAssistantFullscreen(this.context);
        }
        // 收起侧边栏，让「点图标 = 全屏开关」的视觉成立（侧边栏只是瞬间载体）
        this.autoClosingSidebar = true;
        void vscode.commands
            .executeCommand('workbench.action.toggleSidebarVisibility')
            .then(() => {
                this.autoClosingSidebar = false;
            });
    }
}


