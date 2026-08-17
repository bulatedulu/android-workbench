import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { registerAgentPanel, openAgentPanel, openLatestSession } from './agentPanel';
import { WorkbenchService } from '../domain/workbench';
import { AgentProvider } from '../agent/provider';
import { PiRpcClient } from '../agent/piRpcClient';
import { Session } from '../domain/session';

const mocks = vi.hoisted(() => ({
    registerWebviewViewProvider: vi.fn(
        (_id: string, _provider: unknown, _options: unknown) => undefined
    ),
    executeCommand: vi.fn((_cmd: string) => Promise.resolve())
}));

vi.mock('vscode', () => ({
    window: {
        registerWebviewViewProvider: mocks.registerWebviewViewProvider
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

describe('registerAgentPanel', () => {
    beforeEach(() => {
        mocks.registerWebviewViewProvider.mockClear();
        mocks.executeCommand.mockClear();
    });

    it('以面板视图 id 注册 WebviewViewProvider，resolve 时渲染欢迎 HTML 并启用脚本', () => {
        const { provider } = makeProvider();
        const { rpc } = makeRpc();
        registerAgentPanel(makeContext(), provider, rpc);
        expect(mocks.registerWebviewViewProvider).toHaveBeenCalledWith(
            'aiWorkbench.agentPanel',
            expect.any(Object),
            expect.anything()
        );
        const { view } = captureView();
        expect(view.webview.options).toEqual({ enableScripts: true });
        expect(view.webview.html).toContain('面板');
        expect(view.webview.html).toContain('会话列表');
    });

    it('resolve 后注册消息监听，webview 消息转发给控制器（无会话时发提示）', () => {
        const { provider } = makeProvider();
        const { rpc, prompt } = makeRpc();
        registerAgentPanel(makeContext(), provider, rpc);
        const { view } = captureView();

        const handler = view.webview.onDidReceiveMessage.mock.calls[0][0] as (raw: unknown) => void;
        handler({ type: 'send', text: '你好' });

        expect(prompt).not.toHaveBeenCalled(); // 无会话上下文
        expect(view.webview.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'chat', role: 'system' })
        );
    });
});

describe('openAgentPanel', () => {
    beforeEach(() => {
        mocks.executeCommand.mockClear();
    });

    it('执行视图 focus 命令', async () => {
        await openAgentPanel();
        expect(mocks.executeCommand).toHaveBeenCalledWith('aiWorkbench.agentPanel.focus');
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
        registerAgentPanel(makeContext(), provider, rpc);
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
        registerAgentPanel(makeContext(), provider, rpc);
        const { view } = captureView();
        const service = { listSessionsUnderFolder: vi.fn(() => []) } as unknown as WorkbenchService;

        await openLatestSession('C:/bug1', service);

        expect(view.webview.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'session', messages: [] })
        );
    });
});

