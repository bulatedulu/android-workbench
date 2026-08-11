import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { registerPiPanel, openPiPanel } from './piPanel';

vi.mock('vscode', () => ({
    window: { registerWebviewViewProvider: vi.fn() },
    commands: { executeCommand: vi.fn() }
}));

const registerWebviewViewProvider = vi.mocked(vscode.window.registerWebviewViewProvider);
const executeCommand = vi.mocked(vscode.commands.executeCommand);

/** 从注册调用中取出 provider，构造最小 WebviewView 并触发 resolve。 */
function captureProvider(): {
    provider: vscode.WebviewViewProvider;
    view: { webview: { options: Record<string, unknown>; html: string } };
} {
    const provider = registerWebviewViewProvider.mock.calls[0][1];
    const view = {
        webview: { options: {}, html: '' }
    };
    (provider as { resolveWebviewView(v: unknown): void }).resolveWebviewView(view);
    return { provider, view: view as unknown as { webview: { options: Record<string, unknown>; html: string } } };
}

describe('registerPiPanel', () => {
    beforeEach(() => {
        registerWebviewViewProvider.mockClear();
        executeCommand.mockClear();
    });

    it('以 Pi 视图 id 注册 WebviewViewProvider（辅助侧边栏视图）', () => {
        const context = { subscriptions: [] as { dispose(): void }[] } as unknown as vscode.ExtensionContext;
        registerPiPanel(context);
        expect(registerWebviewViewProvider).toHaveBeenCalledWith(
            'aiWorkbench.piPanel',
            expect.any(Object),
            expect.anything()
        );
        expect(context.subscriptions).toHaveLength(1);
    });

    it('resolve 时启用脚本并渲染欢迎 HTML', () => {
        const context = { subscriptions: [] as { dispose(): void }[] } as unknown as vscode.ExtensionContext;
        registerPiPanel(context);
        const { view } = captureProvider();
        expect(view.webview.options).toEqual({ enableScripts: true });
        expect(view.webview.html).toContain('Pi 面板');
        expect(view.webview.html).toContain('会话列表');
    });
});

describe('openPiPanel', () => {
    beforeEach(() => {
        executeCommand.mockClear();
    });

    it('执行视图 focus 命令以打开/聚焦 Pi 面板', () => {
        openPiPanel();
        expect(executeCommand).toHaveBeenCalledWith('aiWorkbench.piPanel.focus');
    });
});
