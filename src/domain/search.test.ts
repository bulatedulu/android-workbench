import { describe, it, expect } from 'vitest';
import { SearchService } from './search';
import { Session } from './session';

function makeSession(id: string, opts?: { title?: string; agent?: string; createdAt?: number }): Session {
    return {
        id,
        agent: opts?.agent ?? 'pi',
        path: `/sessions/${id}.jsonl`,
        cwd: 'D:\\x',
        title: opts?.title ?? `会话${id}`,
        model: 'm',
        createdAt: opts?.createdAt ?? 1000
    };
}

function makeService(texts: Record<string, string>): SearchService {
    return new SearchService((s) => texts[s.id] ?? '');
}

const TEXTS: Record<string, string> = {
    a: '修复了登录 bug 的问题',
    b: '性能优化完成',
    c: '你好世界'
};

describe('SearchService', () => {
    it('按标题关键词匹配（大小写不敏感）', () => {
        const sessions = [makeSession('a', { title: 'Bug 修复' }), makeSession('b', { title: '性能优化' })];
        const result = makeService(TEXTS).search(sessions, 'bug');
        expect(result.map((s) => s.id)).toEqual(['a']);
    });

    it('按消息文本关键词匹配', () => {
        const sessions = [makeSession('a'), makeSession('b'), makeSession('c')];
        const result = makeService(TEXTS).search(sessions, '登录');
        expect(result.map((s) => s.id)).toEqual(['a']);
    });

    it('标题或文本任一命中即可', () => {
        const sessions = [makeSession('a', { title: 'Bug 修复' }), makeSession('b'), makeSession('c')];
        const result = makeService(TEXTS).search(sessions, '世界');
        expect(result.map((s) => s.id)).toEqual(['c']);
    });

    it('空查询返回全部', () => {
        const sessions = [makeSession('a'), makeSession('b')];
        expect(makeService(TEXTS).search(sessions, '')).toHaveLength(2);
        expect(makeService(TEXTS).search(sessions, '   ')).toHaveLength(2);
    });

    it('按 agent 过滤', () => {
        const sessions = [makeSession('a', { agent: 'pi' }), makeSession('b', { agent: 'omp' })];
        const result = makeService(TEXTS).search(sessions, '', { agent: 'pi' });
        expect(result.map((s) => s.id)).toEqual(['a']);
    });

    it('按时间范围过滤（from/to 含边界）', () => {
        const sessions = [
            makeSession('a', { createdAt: 100 }),
            makeSession('b', { createdAt: 200 }),
            makeSession('c', { createdAt: 300 })
        ];
        expect(makeService(TEXTS).search(sessions, '', { from: 200 }).map((s) => s.id)).toEqual(['b', 'c']);
        expect(makeService(TEXTS).search(sessions, '', { to: 200 }).map((s) => s.id)).toEqual(['a', 'b']);
        expect(makeService(TEXTS).search(sessions, '', { from: 150, to: 250 }).map((s) => s.id)).toEqual(['b']);
    });

    it('组合查询与过滤', () => {
        const sessions = [
            makeSession('a', { title: '登录修复', createdAt: 500 }),
            makeSession('b', { title: '登录修复', createdAt: 900 }),
            makeSession('c', { title: '其他', createdAt: 100 })
        ];
        const result = makeService(TEXTS).search(sessions, '登录', { from: 600 });
        expect(result.map((s) => s.id)).toEqual(['b']);
    });

    it('无匹配返回空数组', () => {
        const sessions = [makeSession('a'), makeSession('b')];
        expect(makeService(TEXTS).search(sessions, '不存在的关键词')).toEqual([]);
    });
});
