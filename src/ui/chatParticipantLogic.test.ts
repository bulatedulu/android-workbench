import { describe, it, expect } from 'vitest';
import {
    parseIntent,
    findSessionByKeyword,
    buildSessionListMarkdown,
    buildSessionContentMarkdown
} from './chatParticipantLogic';
import { Session, SessionContent } from '../domain/session';

function makeSession(id: string, title: string, createdAt = 1000): Session {
    return { id, agent: 'pi', path: `/s/${id}.jsonl`, cwd: 'D:\\x', title, model: 'gpt-4.1', createdAt, updatedAt: createdAt };
}

describe('parseIntent', () => {
    it('识别列表指令', () => {
        expect(parseIntent('列出会话').type).toBe('list');
        expect(parseIntent('有哪些会话').type).toBe('list');
        expect(parseIntent('全部会话').type).toBe('list');
    });

    it('识别显示指令并提取关键词', () => {
        const intent = parseIntent('显示 你好');
        expect(intent.type).toBe('show');
        if (intent.type === 'show') {
            expect(intent.keyword).toBe('你好');
        }
    });

    it('识别继续指令并提取关键词与问题', () => {
        const intent = parseIntent('继续 你好 帮我总结');
        expect(intent.type).toBe('continue');
        if (intent.type === 'continue') {
            expect(intent.keyword).toBe('你好');
            expect(intent.question).toBe('帮我总结');
        }
    });

    it('继续指令缺问题时回退为「请继续」', () => {
        const intent = parseIntent('继续 你好');
        expect(intent.type).toBe('continue');
        if (intent.type === 'continue') {
            expect(intent.question).toBe('请继续');
        }
    });

    it('无法识别时返回 help', () => {
        expect(parseIntent('随便说点什么').type).toBe('help');
        expect(parseIntent('').type).toBe('help');
    });

    it('「显示 会话列表」不被误判为列表', () => {
        const intent = parseIntent('显示 会话列表');
        expect(intent.type).toBe('show');
    });

    it('「继续 全部会话 帮我」不被误判为列表', () => {
        const intent = parseIntent('继续 全部会话 帮我');
        expect(intent.type).toBe('continue');
        if (intent.type === 'continue') {
            expect(intent.keyword).toBe('全部会话');
        }
    });
});

describe('findSessionByKeyword', () => {
    const groups = [
        { name: 'BUG-1', sessions: [makeSession('sess-a', '你好世界')] },
        { name: 'BUG-2', sessions: [makeSession('sess-b', '其他')] }
    ];

    it('按标题模糊命中', () => {
        expect(findSessionByKeyword(groups, '你好')?.id).toBe('sess-a');
    });

    it('按 ID 命中', () => {
        expect(findSessionByKeyword(groups, 'SESS-B')?.id).toBe('sess-b');
    });

    it('未命中时返回 undefined', () => {
        expect(findSessionByKeyword(groups, '不存在')).toBeUndefined();
    });
});

describe('buildSessionListMarkdown', () => {
    it('按项目分组渲染会话列表', () => {
        const ts = new Date(2024, 0, 2, 3, 4).getTime(); // 本地时区无关
        const md = buildSessionListMarkdown([
            { name: 'BUG-1', sessions: [makeSession('a', '你好', ts)] },
            { name: 'BUG-2', sessions: [] }
        ]);
        expect(md).toContain('### BUG-1');
        expect(md).toContain('你好');
        expect(md).toContain('gpt-4.1');
        expect(md).toContain('pi');
        expect(md).toContain('2024-01-02 03:04');
        expect(md).toContain('### BUG-2');
        expect(md).toContain('（无会话）');
    });

    it('无项目时给出提示', () => {
        expect(buildSessionListMarkdown([])).toContain('当前工作区没有项目文件夹');
    });
});

describe('buildSessionContentMarkdown', () => {
    it('渲染消息的角色与文本', () => {
        const content: SessionContent = {
            messages: [
                { role: 'user', timestamp: 1000, text: '你好' },
                { role: 'assistant', timestamp: 2000, text: '回复' }
            ]
        };
        const md = buildSessionContentMarkdown('测试会话', content);
        expect(md).toContain('# 测试会话');
        expect(md).toContain('**user**');
        expect(md).toContain('你好');
        expect(md).toContain('**assistant**');
        expect(md).toContain('回复');
    });

    it('无消息时提示', () => {
        expect(buildSessionContentMarkdown('t', { messages: [] })).toContain('（无消息）');
    });
});
