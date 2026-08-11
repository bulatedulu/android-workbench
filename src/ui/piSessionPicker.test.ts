import { describe, it, expect } from 'vitest';
import { buildSessionPickChoices, fixedSessionId } from './piSessionPicker';
import { Session } from '../domain/session';

function session(overrides: Partial<Session> = {}): Session {
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

describe('buildSessionPickChoices', () => {
    it('无历史会话时只有「开启新会话」', () => {
        const choices = buildSessionPickChoices([]);
        expect(choices).toHaveLength(1);
        expect(choices[0].action).toBe('new');
        expect(choices[0].label).toContain('开启新会话');
    });

    it('第一项永远是「开启新会话」', () => {
        const choices = buildSessionPickChoices([session()]);
        expect(choices[0].action).toBe('new');
        expect(choices[1].action).toBe('session');
    });

    it('历史会话按更新时间最新优先排列', () => {
        const older = session({ id: 'a', title: '旧', updatedAt: 100 });
        const newer = session({ id: 'b', title: '新', updatedAt: 300 });
        const mid = session({ id: 'c', title: '中', updatedAt: 200 });
        const choices = buildSessionPickChoices([older, mid, newer]);
        expect(choices.map((c) => (c.action === 'session' ? c.session.id : 'new'))).toEqual([
            'new',
            'b',
            'c',
            'a'
        ]);
    });

    it('会话项带标题与模型·时间描述', () => {
        const choices = buildSessionPickChoices([session({ title: '修复登录', model: 'gpt-4.1' })]);
        const item = choices[1];
        expect(item.action).toBe('session');
        if (item.action === 'session') {
            expect(item.label).toBe('修复登录');
            expect(item.description).toContain('gpt-4.1');
            expect(item.session.path).toContain('s1.jsonl');
        }
    });
});

describe('fixedSessionId', () => {
    it('同一目录路径生成相同 id（确定性）', () => {
        expect(fixedSessionId('C:/bug1')).toBe(fixedSessionId('C:/bug1'));
    });

    it('不同目录路径生成不同 id', () => {
        expect(fixedSessionId('C:/bug1')).not.toBe(fixedSessionId('C:/bug2'));
    });

    it('返回非空且不含路径分隔符（可作 pi session-id）', () => {
        const id = fixedSessionId('D:\\bug_list\\BUG-1');
        expect(id.length).toBeGreaterThan(0);
        expect(id).not.toMatch(/[\\/]/);
    });
});
