import { describe, it, expect, vi } from 'vitest';
import { basename } from 'node:path';
import { PiChatController } from './piChatController';
import { Session, SessionContent } from '../domain/session';
import { AgentProvider } from '../agent/provider';
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
        const controller = new PiChatController(host, provider);

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
        const controller = new PiChatController(host, provider);

        controller.showSession(session);

        expect(controller.getCurrentSession()).toBe(session);
    });
});

describe('PiChatController.showNewSession', () => {
    it('开启新会话：空消息列表、标题为目录名，并记录固定会话 id', () => {
        const { provider } = makeProvider({ messages: [] });
        const { host, posted } = makeHost();
        const controller = new PiChatController(host, provider);

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
