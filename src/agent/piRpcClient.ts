import { ChildProcess, SpawnOptions, spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

/** 最小取消令牌（与 vscode.CancellationToken 形状一致，但不依赖 vscode，便于纯 Node 测试）。 */
export interface CancellationToken {
    readonly isCancellationRequested: boolean;
    onCancellationRequested(listener: () => void): { dispose(): void };
}

export interface PiRpcCallbacks {
    /** 流式文本增量（text_delta）。 */
    onDelta(text: string): void;
    /** 出错（失败 / 非零退出 / 无法启动）。 */
    onError(message: string): void;
    /** 正常结束（含被取消）。 */
    onEnd(): void;
}

export interface PiRpcRequest {
    message: string;
    /** 有历史会话：续写该文件（--session <file>）。 */
    sessionFile?: string;
    /** 无历史会话：固定会话 id（--session-id <id>）。 */
    sessionId?: string;
    /** pi 的工作目录（项目目录）。 */
    cwd?: string;
    /** 关闭工具调用（--no-tools）。 */
    noTools?: boolean;
    callbacks: PiRpcCallbacks;
    token?: CancellationToken;
}

/** spawn 工厂注入点（测试用假子进程替换）。 */
export type SpawnFn = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

const ABORT_KILL_DELAY_MS = 300;
const PROMPT_ID = 'prompt-1';

/**
 * pi CLI 的 RPC 客户端：spawn `pi --mode rpc`，stdin 发 prompt JSON，
 * stdout 逐行解析事件（流式 text_delta / 错误 / 结束 / extension_ui_request 自动取消）。
 * 会话写入由 pi 自己完成，本客户端不直接编辑 store 文件（见 ADR-0002）。
 */
export class PiRpcClient {
    constructor(
        private readonly spawnFn: SpawnFn = spawn,
        private readonly abortKillDelayMs: number = ABORT_KILL_DELAY_MS
    ) { }

    prompt(request: PiRpcRequest): void {
        // 预先已取消：直接结束，不启动进程
        if (request.token?.isCancellationRequested) {
            request.callbacks.onEnd();
            return;
        }
        const args = this.buildArgs(request);

        let child: ChildProcess;
        try {
            child = this.spawnFn('pi', args, {
                cwd: request.cwd,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: process.platform === 'win32'
            });
        } catch (err) {
            request.callbacks.onError(err instanceof Error ? err.message : String(err));
            return;
        }

        const decoder = new StringDecoder('utf8');
        const stdin = child.stdin!;
        const stdout = child.stdout!;
        const stderr = child.stderr!;
        let stdoutBuffer = '';
        let stderrBuffer = '';
        let finished = false;
        let sawEnd = false; // 是否已收到对话结束事件（agent_end / agent_settled）

        const send = (obj: unknown): void => {
            try {
                stdin.write(`${JSON.stringify(obj)}\n`);
            } catch {
                // stdin 已关闭，忽略
            }
        };

        const finish = (error?: string): void => {
            if (finished) {
                return;
            }
            finished = true;
            try {
                stdin.end(); // 关闭输入，避免进程残留
            } catch {
                // 已关闭
            }
            if (error) {
                request.callbacks.onError(error);
            } else {
                request.callbacks.onEnd();
            }
        };

        const handleLine = (line: string): void => {
            let event: Record<string, unknown>;
            try {
                event = JSON.parse(line) as Record<string, unknown>;
            } catch {
                return; // 容忍非 JSON 行
            }

            if (event.type === 'message_update') {
                const assistantEvent = event.assistantMessageEvent as
                    | { type?: string; delta?: unknown }
                    | undefined;
                if (assistantEvent?.type === 'text_delta' && typeof assistantEvent.delta === 'string') {
                    request.callbacks.onDelta(assistantEvent.delta);
                }
                return;
            }
            if (event.type === 'response' && event.command === 'prompt' && event.success === false) {
                const detail = typeof event.error === 'string' ? event.error : 'pi 处理 prompt 失败';
                finish(detail);
                return;
            }
            if (event.type === 'extension_ui_request') {
                // pi 请求 UI（select/confirm/input/editor）：自动应答取消，避免阻塞
                const id = typeof event.id === 'string' ? event.id : undefined;
                if (id) {
                    send({ type: 'extension_ui_response', id, cancelled: true });
                }
                return;
            }
            if (event.type === 'agent_end' || event.type === 'agent_settled') {
                // 对话结束：标记完成并让 pi 退出（进程 close 时统一收尾）
                sawEnd = true;
                try {
                    stdin.end();
                } catch {
                    // 忽略
                }
            }
        };

        stdout.on('data', (chunk: Buffer) => {
            stdoutBuffer += decoder.write(chunk);
            let newlineIndex: number;
            while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
                const line = stdoutBuffer.slice(0, newlineIndex).replace(/\r$/, '');
                stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
                if (line) {
                    handleLine(line);
                }
            }
        });

        stderr.on('data', (chunk: Buffer) => {
            stderrBuffer += chunk.toString();
        });

        child.on('error', (err) => {
            finish(err.message);
        });

        child.on('close', (code, signal) => {
            decoder.end();
            if (finished) {
                return;
            }
            // 取消 / 已正常结束 / 退出码 0 均视为正常结束
            if (request.token?.isCancellationRequested || sawEnd || code === 0) {
                finish();
                return;
            }
            const detail =
                stderrBuffer.trim() ||
                `pi 进程退出（code ${code ?? 'unknown'}${signal ? `, signal ${signal}` : ''}）`;
            finish(detail);
        });

        if (request.token) {
            request.token.onCancellationRequested(() => {
                send({ type: 'abort' });
                setTimeout(() => {
                    try {
                        child.kill();
                    } catch {
                        // 进程已退出
                    }
                }, this.abortKillDelayMs);
            });
        }

        send({ id: PROMPT_ID, type: 'prompt', message: request.message });
    }

    private buildArgs(request: PiRpcRequest): string[] {
        const args = ['--mode', 'rpc'];
        if (request.sessionFile) {
            args.push('--session', request.sessionFile);
        } else if (request.sessionId) {
            args.push('--session-id', request.sessionId);
        }
        if (request.noTools) {
            args.push('--no-tools');
        }
        return args;
    }
}
