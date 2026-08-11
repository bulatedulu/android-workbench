import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { registerPiPanel, openPiPanel, openNewSession, openLatestSession, pickAndOpenSession } from './piPanel';
import { WorkbenchService } from '../domain/workbench';
import { AgentProvider } from '../agent/provider';
import { PiRpcClient } from '../agent/piRpcClient';
import { Session } from '../domain/session';

const mocks = vi.hoisted(() => ({
    registerWebviewViewProvider: vi.fn(
        (_id: string, _provider: unknown, _options: unknown) => undefined
    ),
    showQuickPick: vi.fn(),
    executeCommand: vi.fn((_cmd: string) => Promise.resolve())
}));

vi.mock('vscode', () => ({
    window: {
        registerWebviewViewProvider: mocks.registerWebviewViewProvider,
        showQuickPick: mocks.showQuickPick
    },
    commands: { executeCommand: mocks.executeCommand }
}));

function makeSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 's1',
        agent: 'pi',
        path: 'C:/pi/s1.jsonl',
        cwd: 'C:/bug1',
        title: '修复登录',
        model: 'gpt-4.1',
        createdAt: 1000,
        updatedAt: 2000,
        ...overrides
    };
}

function makeContext(): vscode.ExtensionContext {
    return { subscriptions: [] as { dispose(): void }[] } as unknown as vscode.ExtensionContext;
}

function makeProvider(): { provider: AgentProvider; readSessionContent: ReturnType<typeof vi.fn> } {
    const readSessionContent = vi.fn(() => ({ messages: [] }));
    return { provider: { readSessionContent } as unknown as AgentProvider, readSessionContent };
}

function makeRpc(): { rpc: PiRpcClient; prompt: ReturnType<typeof vi.fn> } {
    const prompt = vi.fn();
    return { rpc: { prompt } as unknown as PiRpcClient, prompt };
}

function captureView(): {
    view: {
        webview: {
            options: Record<string, unknown>;
            html: string;
            postMessage: ReturnType<typeof vi.fn>;
            onDidReceiveMessage: ReturnType<typeof vi.fn>;
        };
        onDidDispose: (fn: () => void) => void;
    };
} {
    const provider = mocks.registerWebviewViewProvider.mock.calls[0][1] as {
        resolveWebviewView(v: unknown): void;
    };
    const webview = {
        options: {} as Record<string, unknown>,
        html: '',
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn()
    };
    const view = { webview, onDidDispose: () => { } };
    provider.resolveWebviewView(view);
    return {
        view: view as unknown as {
            webview: {
                options: Record<string, unknown>;
                html: string;
                postMessage: ReturnType<typeof vi.fn>;
                onDidReceiveMessage: ReturnType<typeof vi.fn>;
            };
            onDidDispose: (fn: () => void) => void;
        }
    };
}

describe('registerPiPanel', () => {
    beforeEach(() => {
        mocks.registerWebviewViewProvider.mockClear();
        mocks.showQuickPick.mockClear();
        mocks.executeCommand.mockClear();
    });

    it('以 Pi 视图 id 注册 WebviewViewProvider，resolve 时渲染欢迎 HTML 并启用脚本', () => {
        const { provider } = makeProvider();
        const { rpc } = makeRpc();
        registerPiPanel(makeContext(), provider, rpc);
        expect(mocks.registerWebviewViewProvider).toHaveBeenCalledWith(
            'aiWorkbench.piPanel',
            expect.any(Object),
            expect.anything()
        );
        const { view } = captureView();
        expect(view.webview.options).toEqual({ enableScripts: true });
        expect(view.webview.html).toContain('Pi 面板');
        expect(view.webview.html).toContain('会话列表');
    });

    it('resolve 后注册消息监听，webview 消息转发给控制器（无会话时发提示）', () => {
        const { provider } = makeProvider();
        const { rpc, prompt } = makeRpc();
        registerPiPanel(makeContext(), provider, rpc);
        const { view } = captureView();

        const handler = view.webview.onDidReceiveMessage.mock.calls[0][0] as (raw: unknown) => void;
        handler({ type: 'send', text: '你好' });

        expect(prompt).not.toHaveBeenCalled(); // 无会话上下文
        expect(view.webview.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'chat', role: 'system' })
        );
    });
});

describe('openPiPanel', () => {
    beforeEach(() => {
        mocks.executeCommand.mockClear();
    });

    it('执行视图 focus 命令', async () => {
        await openPiPanel();
        expect(mocks.executeCommand).toHaveBeenCalledWith('aiWorkbench.piPanel.focus');
    });
});

describe('openNewSession', () => {
    beforeEach(() => {
        mocks.executeCommand.mockClear();
        mocks.registerWebviewViewProvider.mockClear();
    });

    it('聚焦面板并显示该目录的空会话', async () => {
        const { provider } = makeProvider();
        const { rpc } = makeRpc();
        registerPiPanel(makeContext(), provider, rpc);
        const { view } = captureView();

        await openNewSession('C:/bug1');

        expect(mocks.executeCommand).toHaveBeenCalledWith('aiWorkbench.piPanel.focus');
        expect(view.webview.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'session', messages: [] })
        );
    });
});

describe('openLatestSession', () => {
    beforeEach(() => {
        mocks.executeCommand.mockClear();
        mocks.registerWebviewViewProvider.mockClear();
    });

    it('有历史会话时 resume 最新一个', async () => {
        const { provider } = makeProvider();
        const { rpc } = makeRpc();
        registerPiPanel(makeContext(), provider, rpc);
        const { view } = captureView();
        const sessions = [
            makeSession({ title: '旧', updatedAt: 100 }),
            makeSession({ title: '新', updatedAt: 300 })
        ];
        const service = { listSessionsUnderFolder: vi.fn(() => sessions) } as unknown as WorkbenchService;

        await openLatestSession('C:/bug1', service);

        expect(view.webview.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'session', title: '新' })
        );
    });

    it('无历史会话时开启新会话', async () => {
        const { provider } = makeProvider();
        const { rpc } = makeRpc();
        registerPiPanel(makeContext(), provider, rpc);
        const { view } = captureView();
        const service = { listSessionsUnderFolder: vi.fn(() => []) } as unknown as WorkbenchService;

        await openLatestSession('C:/bug1', service);

        expect(view.webview.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'session', messages: [] })
        );
    });
});

describe('pickAndOpenSession', () => {
    beforeEach(() => {
        mocks.registerWebviewViewProvider.mockClear();
        mocks.showQuickPick.mockClear();
        mocks.executeCommand.mockClear();
    });

    it('聚焦面板 → 列出目录会话 → 选中历史会话后加载到面板', async () => {
        const { provider } = makeProvider();
        const { rpc } = makeRpc();
        registerPiPanel(makeContext(), provider, rpc);
        const { view } = captureView();

        const sessions = [makeSession()];
        const service = { listSessionsUnderFolder: vi.fn(() => sessions) } as unknown as WorkbenchService;
        mocks.showQuickPick.mockResolvedValue({ label: '修复登录', action: 'session', session: sessions[0] });

        await pickAndOpenSession('C:/bug1', service);

        expect(mocks.executeCommand).toHaveBeenCalledWith('aiWorkbench.piPanel.focus');
        expect(service.listSessionsUnderFolder).toHaveBeenCalledWith('C:/bug1');
        const items = (mocks.showQuickPick.mock.calls[0] as unknown[])[0] as unknown[];
        expect(items[0]).toMatchObject({ action: 'new', label: expect.stringContaining('开启新会话') });
        expect(items[1]).toMatchObject({ action: 'session', label: '修复登录' });
        // 选中历史会话 → 面板收到 session 消息
        expect(view.webview.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'session', title: '修复登录' })
        );
    });

    it('QuickPick 标题显示目录名，避免选错目录', async () => {
        const { provider } = makeProvider();
        const { rpc } = makeRpc();
        registerPiPanel(makeContext(), provider, rpc);
        captureView();
        const service = { listSessionsUnderFolder: vi.fn(() => []) } as unknown as WorkbenchService;
        mocks.showQuickPick.mockResolvedValue(undefined);

        await pickAndOpenSession('C:/bug1', service);

        const options = (mocks.showQuickPick.mock.calls[0] as unknown[])[1] as { title: string };
        expect(options.title).toContain('C:/bug1');
    });

    it('选中「开启新会话」→ 面板收到空会话消息', async () => {
        const { provider } = makeProvider();
        const { rpc } = makeRpc();
        registerPiPanel(makeContext(), provider, rpc);
        const { view } = captureView();
        const service = { listSessionsUnderFolder: vi.fn(() => []) } as unknown as WorkbenchService;
        mocks.showQuickPick.mockResolvedValue({ label: '开启新会话', action: 'new' });

        await pickAndOpenSession('C:/bug1', service);

        expect(view.webview.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'session', messages: [] })
        );
    });

    it('取消选择时不加载会话', async () => {
        const { provider } = makeProvider();
        const { rpc } = makeRpc();
        registerPiPanel(makeContext(), provider, rpc);
        const { view } = captureView();
        const service = { listSessionsUnderFolder: vi.fn(() => [makeSession()]) } as unknown as WorkbenchService;
        mocks.showQuickPick.mockResolvedValue(undefined);

        await pickAndOpenSession('C:/bug1', service);

        expect(view.webview.postMessage).not.toHaveBeenCalled();
    });
});

