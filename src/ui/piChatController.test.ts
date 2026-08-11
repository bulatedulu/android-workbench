import { describe, it, expect, vi } from 'vitest';
import { basename } from 'node:path';
import { PiChatController } from './piChatController';
import { Session, SessionContent } from '../domain/session';
import { AgentProvider } from '../agent/provider';
import { PiRpcClient } from '../agent/piRpcClient';
import { fixedSessionId } from './piSessionPicker';

function makeSession(): Session {
    return {
        id: 's1',
        agent: 'pi',
        path: 'C:/pi/s1.jsonl',
        cwd: 'C:/bug1',
        title: '修复登录',
        model: 'gpt-4.1',
        createdAt: 1000,
        updatedAt: 2000
    };
}

function makeProvider(content: SessionContent): { provider: AgentProvider; readSessionContent: ReturnType<typeof vi.fn> } {
    const readSessionContent = vi.fn(() => content);
    return {
        provider: { readSessionContent } as unknown as AgentProvider,
        readSessionContent
    };
}

function makeHost(): { host: { post: ReturnType<typeof vi.fn> }; posted: unknown[] } {
    const posted: unknown[] = [];
    return {
        host: { post: vi.fn((m: unknown) => posted.push(m)) },
        posted
    };
}

function makeRpc(): { rpc: PiRpcClient; prompt: ReturnType<typeof vi.fn> } {
    const prompt = vi.fn();
    return { rpc: { prompt } as unknown as PiRpcClient, prompt };
}

function makeController() {
    const { provider } = makeProvider({ messages: [] });
    const { host, posted } = makeHost();
    const { rpc, prompt } = makeRpc();
    const controller = new PiChatController(host, provider, rpc);
    return { controller, host, posted, prompt };
}

describe('PiChatController.showSession', () => {
    it('读取会话历史并通过 host 发送 session 消息（含标题与消息映射）', () => {
        const session = makeSession();
        const { provider, readSessionContent } = makeProvider({
            messages: [
                { role: 'user', timestamp: 1000, text: '你好' },
                { role: 'assistant', timestamp: 2000, text: '有什么可以帮你' }
            ]
        });
        const { host, posted } = makeHost();
        const { rpc } = makeRpc();
        const controller = new PiChatController(host, provider, rpc);

        controller.showSession(session);

        expect(readSessionContent).toHaveBeenCalledWith(session);
        expect(posted).toHaveLength(1);
        const msg = posted[0] as { type: string; title: string; messages: unknown[] };
        expect(msg.type).toBe('session');
        expect(msg.title).toBe('修复登录');
        expect(msg.messages).toHaveLength(2);
        expect(msg.messages[0]).toMatchObject({ role: 'user', text: '你好' });
        expect(msg.messages[1]).toMatchObject({ role: 'assistant', text: '有什么可以帮你' });
    });

    it('记录当前会话', () => {
        const session = makeSession();
        const { provider } = makeProvider({ messages: [] });
        const { host } = makeHost();
        const { rpc } = makeRpc();
        const controller = new PiChatController(host, provider, rpc);

        controller.showSession(session);

        expect(controller.getCurrentSession()).toBe(session);
    });
});

describe('PiChatController.showNewSession', () => {
    it('开启新会话：空消息列表、标题为目录名，并记录固定会话 id', () => {
        const { provider } = makeProvider({ messages: [] });
        const { host, posted } = makeHost();
        const { rpc } = makeRpc();
        const controller = new PiChatController(host, provider, rpc);

        controller.showNewSession('C:/bug1');

        const msg = posted[0] as { type: string; title: string; messages: unknown[] };
        expect(msg.type).toBe('session');
        expect(msg.title).toBe(basename('C:/bug1'));
        expect(msg.messages).toHaveLength(0);
        expect(controller.getCurrentSession()).toBeUndefined();
        expect(controller.getPendingNewFolder()).toBe('C:/bug1');
        expect(controller.getPendingSessionId()).toBe(fixedSessionId('C:/bug1'));
    });
});

describe('PiChatController 对话', () => {
    it('发送消息：历史会话用 --session 续写，且不重复回显用户消息', () => {
        const session = makeSession();
        const { provider } = makeProvider({ messages: [] });
        const { host, posted } = makeHost();
        const { rpc, prompt } = makeRpc();
        const controller = new PiChatController(host, provider, rpc);
        controller.showSession(session);

        controller.handleMessage({ type: 'send', text: '帮我看看' });

        expect(prompt).toHaveBeenCalledWith(
            expect.objectContaining({
                message: '帮我看看',
                sessionFile: session.path,
                sessionId: undefined,
                cwd: session.cwd
            })
        );
        // 用户消息由 webview 本地回显，controller 不重复发（避免双重渲染）
        expect(
            posted.some(
                (m) =>
                    (m as { type: string }).type === 'chat' &&
                    (m as { role: string }).role === 'user'
            )
        ).toBe(false);
    });

    it('新会话上下文用固定 session-id 创建', () => {
        const { controller, prompt } = makeController();
        controller.showNewSession('C:/bug1');

        controller.handleMessage({ type: 'send', text: '开始' });

        expect(prompt).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionFile: undefined,
                sessionId: fixedSessionId('C:/bug1'),
                cwd: 'C:/bug1'
            })
        );
    });

    it('无会话上下文时提示，不启动 RPC', () => {
        const { controller, posted, prompt } = makeController();

        controller.handleMessage({ type: 'send', text: 'x' });

        expect(prompt).not.toHaveBeenCalled();
        expect(posted[0]).toMatchObject({ type: 'chat', role: 'system' });
    });

    it('onDelta 流式转发为 assistant 消息，onEnd 后状态清除', () => {
        const { controller, posted, prompt } = makeController();
        controller.showNewSession('C:/b');
        controller.handleMessage({ type: 'send', text: 'hi' });

        const args = prompt.mock.calls[0][0] as { callbacks: { onDelta(t: string): void; onEnd(): void } };
        args.callbacks.onDelta('你');
        args.callbacks.onDelta('好');
        expect(
            posted.filter((m) => (m as { type: string }).type === 'chat' && (m as { role: string }).role === 'assistant')
        ).toEqual([
            { type: 'chat', role: 'assistant', text: '你' },
            { type: 'chat', role: 'assistant', text: '好' }
        ]);

        args.callbacks.onEnd();
        args.callbacks.onEnd(); // 幂等
        controller.handleMessage({ type: 'send', text: 'again' });
        expect(prompt).toHaveBeenCalledTimes(2);
    });

    it('onError 转发为 system 消息并清除状态', () => {
        const { controller, posted, prompt } = makeController();
        controller.showNewSession('C:/b');
        controller.handleMessage({ type: 'send', text: 'hi' });

        const args = prompt.mock.calls[0][0] as { callbacks: { onError(e: string): void } };
        args.callbacks.onError('pi 未安装');

        expect(
            posted.some(
                (m) =>
                    (m as { type: string }).type === 'chat' &&
                    (m as { role: string }).role === 'system' &&
                    (m as { text: string }).text === 'pi 未安装'
            )
        ).toBe(true);
        controller.handleMessage({ type: 'send', text: 'again' });
        expect(prompt).toHaveBeenCalledTimes(2);
    });

    it('abort 取消当前生成的 token', () => {
        const { controller, prompt } = makeController();
        controller.showNewSession('C:/b');
        controller.handleMessage({ type: 'send', text: 'hi' });

        const token = (prompt.mock.calls[0][0] as { token: { isCancellationRequested: boolean } }).token;
        expect(token.isCancellationRequested).toBe(false);
        controller.handleMessage({ type: 'abort' });
        expect(token.isCancellationRequested).toBe(true);
    });

    it('abort 后（onEnd 前）不能立即再发，避免旧回调误清新请求', () => {
        const { controller, posted, prompt } = makeController();
        controller.showNewSession('C:/b');
        controller.handleMessage({ type: 'send', text: 'a' });
        controller.handleMessage({ type: 'abort' });
        controller.handleMessage({ type: 'send', text: 'b' });

        expect(prompt).toHaveBeenCalledTimes(1);
        expect(posted[posted.length - 1]).toMatchObject({ type: 'chat', role: 'system' });
    });

    it('生成中重复发送提示等待，不重复启动', () => {
        const { controller, posted, prompt } = makeController();
        controller.showNewSession('C:/b');
        controller.handleMessage({ type: 'send', text: 'a' });
        controller.handleMessage({ type: 'send', text: 'b' });

        expect(prompt).toHaveBeenCalledTimes(1);
        expect(posted[posted.length - 1]).toMatchObject({ type: 'chat', role: 'system' });
    });
});
