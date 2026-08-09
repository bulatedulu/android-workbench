import { describe, it, expect } from 'vitest';
import { buildHtml, handleViewerMessage } from './sessionViewerHtml';
import { Session } from '../domain/session';
import { AgentProvider } from '../agent/provider';

const SESSION: Session = {
    id: 'a',
    agent: 'pi',
    path: 'C:\\sessions\\demo.jsonl',
    cwd: 'D:\\x',
    title: 't',
    model: 'm',
    createdAt: 1
};

function makeProvider(): AgentProvider {
    return {
        agentName: 'pi',
        discoverStore: () => '/fake',
        scanSessions: () => [],
        readSessionText: () => '',
        readSessionContent: () => ({ messages: [] }),
        resumeSession: (s, run) => run(`pi --resume "${s.path}"`)
    };
}

describe('handleViewerMessage', () => {
    it('收到 resume 消息时通过注入的 runner 恢复会话', () => {
        let captured: string | undefined;
        const handled = handleViewerMessage({ type: 'resume' }, SESSION, makeProvider(), (cmd) => {
            captured = cmd;
        });
        expect(handled).toBe(true);
        expect(captured).toContain('pi --resume');
        expect(captured).toContain('C:\\sessions\\demo.jsonl');
    });

    it('非 resume 消息被忽略并返回 false', () => {
        const handled = handleViewerMessage({ type: 'other' }, SESSION, makeProvider(), () => { });
        expect(handled).toBe(false);
    });
});

describe('buildHtml', () => {
    it('渲染消息的角色 / 时间 / 文本与标题', () => {
        const ts = Date.parse('2026-08-08T22:01:50.553Z');
        const d = new Date(ts);
        const pad = (n: number) => String(n).padStart(2, '0');
        const localDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        const html = buildHtml('测试会话', {
            messages: [
                { role: 'user', timestamp: ts, text: '你好' },
                { role: 'assistant', timestamp: Date.parse('2026-08-08T22:01:51.933Z'), text: '这是回复' }
            ]
        });
        expect(html).toContain('测试会话');
        expect(html).toContain('user');
        expect(html).toContain('你好');
        expect(html).toContain('assistant');
        expect(html).toContain('这是回复');
        expect(html).toContain(localDate);
    });

    it('对消息文本做 HTML 转义（防注入）', () => {
        const html = buildHtml('t', { messages: [{ role: 'user', timestamp: 0, text: '<script>alert(1)</script>' }] });
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('无消息时显示占位', () => {
        const html = buildHtml('t', { messages: [] });
        expect(html).toContain('无消息');
    });

    it('包含懒加载恢复输入框与占位提示', () => {
        const html = buildHtml('t', { messages: [] });
        expect(html).toContain('点击此处继续对话');
        expect(html).toContain("vscode.postMessage({ type: 'resume' })");
    });
});
