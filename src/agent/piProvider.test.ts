import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PiProvider } from './piProvider';

let tmp: string | undefined;

function makeStore(): string {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-test-'));
    return path.join(tmp, 'sessions');
}

function writeSession(root: string, relDir: string, lines: string[]): string {
    const dir = path.join(root, relDir);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `2026-08-08T22-01-29-153Z_${Math.random().toString(36).slice(2)}.jsonl`);
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    return file;
}

/** 基于真实 pi v3 格式的 JSONL 行构造。 */
function realFormatLines(cwd: string, opts?: { title?: string; model?: string }): string[] {
    const model = opts?.model ?? 'gpt-4.1';
    return [
        JSON.stringify({ type: 'session', version: 3, id: 'sess-1', timestamp: '2026-08-08T22:01:29.153Z', cwd }),
        JSON.stringify({ type: 'model_change', id: 'm1', parentId: null, timestamp: '2026-08-08T22:01:29.334Z', provider: 'github-copilot', modelId: model }),
        JSON.stringify({ type: 'message', id: 'msg1', parentId: 'm1', timestamp: '2026-08-08T22:01:50.553Z', message: { role: 'user', content: [{ type: 'text', text: opts?.title ?? '你好' }], timestamp: 1786226510547 } }),
        JSON.stringify({ type: 'message', id: 'msg2', parentId: 'msg1', timestamp: '2026-08-08T22:01:51.933Z', message: { role: 'assistant', content: [], model, stopReason: 'end_turn', timestamp: 1786226510762 } })
    ];
}

afterEach(() => {
    if (tmp) {
        fs.rmSync(tmp, { recursive: true, force: true });
        tmp = undefined;
    }
});

describe('PiProvider', () => {
    it('发现并解析 pi 会话，得到 id/cwd/标题/模型/时间', () => {
        const root = makeStore();
        const file = writeSession(root, '--D--bug_list-BUG-1--', realFormatLines('D:\\bug_list\\BUG-1', { title: '你好', model: 'gpt-4.1' }));

        const sessions = new PiProvider(root).scanSessions();

        expect(sessions).toHaveLength(1);
        expect(sessions[0].id).toBe('sess-1');
        expect(sessions[0].agent).toBe('pi');
        expect(sessions[0].cwd).toBe('D:\\bug_list\\BUG-1');
        expect(sessions[0].title).toBe('你好');
        expect(sessions[0].model).toBe('gpt-4.1');
        expect(sessions[0].path).toBe(file);
        expect(sessions[0].createdAt).toBe(Date.parse('2026-08-08T22:01:29.153Z'));
    });

    it('跨多个子目录递归发现会话', () => {
        const root = makeStore();
        writeSession(root, '--A--', realFormatLines('D:\\a'));
        writeSession(root, '--B--sub--', realFormatLines('D:\\b\\sub'));

        const sessions = new PiProvider(root).scanSessions();

        expect(sessions).toHaveLength(2);
    });

    it('存储目录不存在时返回空数组', () => {
        const provider = new PiProvider(path.join(os.tmpdir(), 'no-such-pi-store-xyz'));
        expect(provider.scanSessions()).toEqual([]);
        expect(provider.discoverStore()).toBeUndefined();
    });

    it('跳过损坏的会话文件，不影响其他会话', () => {
        const root = makeStore();
        writeSession(root, '--A--', realFormatLines('D:\\a'));
        const brokenDir = path.join(root, '--B--');
        fs.mkdirSync(brokenDir, { recursive: true });
        fs.writeFileSync(path.join(brokenDir, 'broken.jsonl'), 'not json\n{"type":"session"', 'utf8');

        const sessions = new PiProvider(root).scanSessions();

        expect(sessions).toHaveLength(1);
    });

    it('容忍未知版本号（向前兼容）', () => {
        const root = makeStore();
        const lines = realFormatLines('D:\\a');
        lines[0] = JSON.stringify({ type: 'session', version: 99, id: 'future-sess', timestamp: '2026-08-08T22:01:29.153Z', cwd: 'D:\\a' });
        writeSession(root, '--A--', lines);

        const sessions = new PiProvider(root).scanSessions();

        expect(sessions).toHaveLength(1);
        expect(sessions[0].id).toBe('future-sess');
    });

    it('无用户消息时标题回退为「无标题会话」', () => {
        const root = makeStore();
        const lines = [JSON.stringify({ type: 'session', version: 3, id: 's', timestamp: '2026-08-08T22:01:29.153Z', cwd: 'D:\\a' })];
        writeSession(root, '--A--', lines);

        const sessions = new PiProvider(root).scanSessions();

        expect(sessions[0].title).toBe('无标题会话');
    });

    it('长标题被截断', () => {
        const root = makeStore();
        const long = '很长的消息内容'.repeat(30);
        writeSession(root, '--A--', realFormatLines('D:\\a', { title: long }));

        const sessions = new PiProvider(root).scanSessions();

        expect(sessions[0].title.length).toBeLessThan(60);
        expect(sessions[0].title.endsWith('…')).toBe(true);
    });

    it('readSessionText 返回全部消息文本', () => {
        const root = makeStore();
        const lines = realFormatLines('D:\\a', { title: '你好', model: 'gpt-4.1' });
        lines.push(
            JSON.stringify({
                type: 'message',
                id: 'msg3',
                parentId: 'msg2',
                timestamp: '2026-08-08T22:02:00.000Z',
                message: { role: 'assistant', content: [{ type: 'text', text: '这是回复内容' }], model: 'gpt-4.1', timestamp: 1786226520000 }
            })
        );
        writeSession(root, '--A--', lines);

        const provider = new PiProvider(root);
        const sessions = provider.scanSessions();

        expect(provider.readSessionText(sessions[0])).toContain('你好');
        expect(provider.readSessionText(sessions[0])).toContain('这是回复内容');
    });

    it('readSessionText 对不可读文件返回空字符串', () => {
        const provider = new PiProvider(makeStore());
        expect(provider.readSessionText({ id: 'x', agent: 'pi', path: path.join(os.tmpdir(), 'no-such.jsonl'), cwd: '', title: '', model: undefined, createdAt: 0 })).toBe('');
    });

    it('readSessionText 不截断长消息（后部关键词可命中）', () => {
        const root = makeStore();
        const lines = realFormatLines('D:\\a', { title: 't' });
        const long = '前缀' + '字'.repeat(80) + '关键目标词';
        lines.push(
            JSON.stringify({
                type: 'message',
                id: 'msg-late',
                parentId: 'x',
                timestamp: '2026-08-08T22:03:00.000Z',
                message: { role: 'user', content: [{ type: 'text', text: long }], timestamp: 1786226580000 }
            })
        );
        writeSession(root, '--A--', lines);

        const provider = new PiProvider(root);
        const sessions = provider.scanSessions();

        expect(provider.readSessionText(sessions[0])).toContain('关键目标词');
    });

    it('readSessionContent 返回结构化消息序列（角色/时间/文本，保持顺序）', () => {
        const root = makeStore();
        writeSession(root, '--A--', realFormatLines('D:\\a', { title: '你好', model: 'gpt-4.1' }));

        const provider = new PiProvider(root);
        const sessions = provider.scanSessions();
        const content = provider.readSessionContent(sessions[0]);

        expect(content.messages).toHaveLength(2);
        expect(content.messages[0].role).toBe('user');
        expect(content.messages[0].text).toBe('你好');
        expect(content.messages[0].timestamp).toBe(1786226510547);
        expect(content.messages[1].role).toBe('assistant');
        expect(content.messages[1].timestamp).toBe(1786226510762);
    });

    it('readSessionContent 对不可读文件返回空消息序列', () => {
        const provider = new PiProvider(makeStore());
        const content = provider.readSessionContent({ id: 'x', agent: 'pi', path: path.join(os.tmpdir(), 'no-such.jsonl'), cwd: '', title: '', model: undefined, createdAt: 0 });
        expect(content.messages).toEqual([]);
    });

    it('resumeSession 通过注入的 runner 执行 pi --resume 命令', () => {
        const root = makeStore();
        const file = writeSession(root, '--A--', realFormatLines('D:\\a'));
        const provider = new PiProvider(root);
        const session = provider.scanSessions()[0];

        let captured: string | undefined;
        provider.resumeSession(session, (cmd) => {
            captured = cmd;
        });

        expect(captured).toContain('pi --resume');
        expect(captured).toContain(file);
    });
});
