import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PiRpcClient, CancellationToken, SpawnFn } from './piRpcClient';

/** 构造假子进程：stdin/stdout/stderr 为可编程 EventEmitter。 */
function makeChild(): any {
    const child: any = new EventEmitter();
    child.stdin = new EventEmitter() as any;
    child.stdin.write = vi.fn();
    child.stdin.end = vi.fn();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    return child;
}

function makeSpawn(child: any = makeChild()): { spawn: SpawnFn; spawnMock: ReturnType<typeof vi.fn>; child: any } {
    const spawnMock = vi.fn(() => child);
    const spawn = spawnMock as unknown as SpawnFn;
    return { spawn, spawnMock, child };
}

function makeToken(): CancellationToken & { cancel(): void } {
    let cancelled = false;
    const listeners: (() => void)[] = [];
    return {
        get isCancellationRequested(): boolean {
            return cancelled;
        },
        onCancellationRequested(listener: () => void): { dispose(): void } {
            listeners.push(listener);
            return { dispose: () => { } };
        },
        cancel() {
            cancelled = true;
            for (const l of listeners) {
                l();
            }
        }
    };
}

function makeCallbacks() {
    return {
        onDelta: vi.fn(),
        onError: vi.fn(),
        onEnd: vi.fn()
    };
}

/** 便捷：创建已配置 client + 发出一次 prompt，返回可操作的句柄。 */
function setup(overrides: { sessionFile?: string; sessionId?: string; noTools?: boolean; cwd?: string; killDelayMs?: number } = {}) {
    const { spawn, spawnMock, child } = makeSpawn();
    const client = new PiRpcClient(spawn, overrides.killDelayMs ?? 300);
    const callbacks = makeCallbacks();
    client.prompt({
        message: '你好',
        sessionFile: overrides.sessionFile,
        sessionId: overrides.sessionId,
        noTools: overrides.noTools,
        cwd: overrides.cwd,
        callbacks
    });
    return { client, child, callbacks, spawn, spawnMock };
}

/** 向假子进程 stdout 写一行 JSON 事件。 */
function emitJson(child: any, obj: unknown): void {
    child.stdout.emit('data', Buffer.from(`${JSON.stringify(obj)}\n`));
}

describe('PiRpcClient 启动参数', () => {
    it('带 --session 会话文件与项目 cwd、stdio 管道启动', () => {
        const { spawn } = setup({ sessionFile: '/s/bug1.jsonl', cwd: '/s/bug1' });
        expect(spawn).toHaveBeenCalledWith(
            'pi',
            ['--mode', 'rpc', '--session', '/s/bug1.jsonl'],
            expect.objectContaining({ cwd: '/s/bug1', stdio: ['pipe', 'pipe', 'pipe'] })
        );
    });

    it('无会话文件时用 --session-id 固定会话 id', () => {
        const { spawn } = setup({ sessionId: 'proj-fixed-id' });
        expect(spawn).toHaveBeenCalledWith(
            'pi',
            ['--mode', 'rpc', '--session-id', 'proj-fixed-id'],
            expect.anything()
        );
    });

    it('noTools 时追加 --no-tools', () => {
        const { spawn } = setup({ noTools: true, sessionFile: '/s/a.jsonl' });
        expect(spawn).toHaveBeenCalledWith(
            'pi',
            ['--mode', 'rpc', '--session', '/s/a.jsonl', '--no-tools'],
            expect.anything()
        );
    });

    it('Windows 下以 shell 启动（兼容 npm shim）', () => {
        const { spawnMock } = setup({ sessionFile: '/s/a.jsonl' });
        const options = spawnMock.mock.calls[0][2] as { shell: boolean };
        expect(options.shell).toBe(process.platform === 'win32');
    });
});

describe('PiRpcClient 对话协议', () => {
    it('发送 prompt JSON 到 stdin', () => {
        const { child } = setup();
        const writes = child.stdin.write.mock.calls.map((c: unknown[]) => String(c[0]));
        expect(writes.some((w: string) => w.includes('"type":"prompt"') && w.includes('你好'))).toBe(true);
    });

    it('text_delta 事件流式回调 onDelta', () => {
        const { child, callbacks } = setup();
        emitJson(child, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: '你' } });
        emitJson(child, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: '好' } });
        expect(callbacks.onDelta).toHaveBeenNthCalledWith(1, '你');
        expect(callbacks.onDelta).toHaveBeenNthCalledWith(2, '好');
    });

    it('response success=false 时报错', () => {
        const { child, callbacks } = setup();
        emitJson(child, { id: 'prompt-1', type: 'response', command: 'prompt', success: false });
        expect(callbacks.onError).toHaveBeenCalledWith(expect.any(String));
        expect(callbacks.onEnd).not.toHaveBeenCalled();
    });

    it('agent_end 后进程正常退出（close 0）触发 onEnd', () => {
        const { child, callbacks } = setup();
        emitJson(child, { type: 'agent_end', messages: [] });
        child.emit('close', 0, null);
        expect(callbacks.onEnd).toHaveBeenCalledTimes(1);
        expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('agent_settled 后即便非零退出也视为正常结束（避免误报）', () => {
        const { child, callbacks } = setup();
        emitJson(child, { type: 'agent_settled' });
        child.emit('close', 1, null);
        expect(callbacks.onEnd).toHaveBeenCalledTimes(1);
        expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('extension_ui_request 自动应答 cancelled 且不阻塞', () => {
        const { child } = setup();
        emitJson(child, { type: 'extension_ui_request', id: 'req-1', method: 'confirm' });
        const writes = child.stdin.write.mock.calls.map((c: unknown[]) => String(c[0]));
        expect(writes.some((w: string) => w.includes('"type":"extension_ui_response"') && w.includes('"cancelled":true') && w.includes('req-1'))).toBe(true);
    });
});

describe('PiRpcClient 结束与错误', () => {
    it('进程非零退出且 stderr 有内容时报错', () => {
        const { child, callbacks } = setup();
        child.stderr.emit('data', Buffer.from('model unavailable'));
        child.emit('close', 1, null);
        expect(callbacks.onError).toHaveBeenCalledWith(expect.stringContaining('model unavailable'));
        expect(callbacks.onEnd).not.toHaveBeenCalled();
    });

    it('spawn 抛错（如 pi 未安装）时报错', () => {
        const spawn = vi.fn(() => {
            throw new Error('ENOENT');
        }) as unknown as SpawnFn;
        const client = new PiRpcClient(spawn);
        const callbacks = makeCallbacks();
        client.prompt({ message: 'x', callbacks });
        expect(callbacks.onError).toHaveBeenCalledWith(expect.stringContaining('ENOENT'));
    });

    it('进程 error 事件（spawn ENOENT）时报错', () => {
        const { child, callbacks } = setup();
        child.emit('error', new Error('spawn pi ENOENT'));
        expect(callbacks.onError).toHaveBeenCalled();
    });
});

describe('PiRpcClient 取消', () => {
    it('取消令牌触发 abort 并在延时后 kill', () => {
        vi.useFakeTimers();
        try {
            const token = makeToken();
            const { spawn, child } = makeSpawn();
            const client = new PiRpcClient(spawn, 300);
            const callbacks = makeCallbacks();
            client.prompt({ message: 'x', callbacks, token });
            token.cancel();
            const writes = child.stdin.write.mock.calls.map((c: unknown[]) => String(c[0]));
            expect(writes.some((w: string) => w.includes('"type":"abort"'))).toBe(true);
            vi.advanceTimersByTime(300);
            expect(child.kill).toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('取消后进程关闭视为正常结束，不报错', () => {
        const token = makeToken();
        const { child } = makeSpawn();
        const client = new PiRpcClient(() => child);
        const callbacks = makeCallbacks();
        client.prompt({ message: 'x', callbacks, token });
        token.cancel();
        child.emit('close', 130, 'SIGTERM');
        expect(callbacks.onEnd).toHaveBeenCalledTimes(1);
        expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('token 预先已取消：不启动进程直接结束', () => {
        const spawn = vi.fn();
        const client = new PiRpcClient(spawn as unknown as SpawnFn);
        const token = makeToken();
        token.cancel();
        const callbacks = makeCallbacks();
        client.prompt({ message: 'x', callbacks, token });
        expect(spawn).not.toHaveBeenCalled();
        expect(callbacks.onEnd).toHaveBeenCalledTimes(1);
    });
});
