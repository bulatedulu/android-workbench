import { basename } from 'node:path';
import { Session } from '../domain/session';
import { AgentProvider } from '../agent/provider';
import { PiRpcClient, CancellationToken } from '../agent/piRpcClient';
import { formatTime } from './format';
import { fixedSessionId } from './piSessionPicker';

/** Pi 面板宿主抽象：向 webview 发消息。 */
export interface PiChatHost {
    post(message: unknown): void;
}

/** 宿主 → Webview 的消息（判别联合）。 */
export type PiChatHostMessage =
    | { type: 'session'; title: string; messages: { role: string; text: string; time: string }[] }
    | { type: 'chat'; role: 'user' | 'assistant' | 'system'; text: string }
    | { type: 'chatEnd' };

/** Webview → 宿主的消息（判别联合）。 */
export type PiChatViewMessage = { type: 'send'; text: string } | { type: 'abort' } | { type: 'ready' };

/** 简单取消令牌（供 pi RPC 取消，形状与 CancellationToken 一致）。 */
class SimpleCancellationToken implements CancellationToken {
    private cancelled = false;
    private readonly listeners: (() => void)[] = [];

    get isCancellationRequested(): boolean {
        return this.cancelled;
    }

    onCancellationRequested(listener: () => void): { dispose(): void } {
        this.listeners.push(listener);
        return { dispose: () => { } };
    }

    cancel(): void {
        this.cancelled = true;
        for (const l of this.listeners) {
            l();
        }
    }
}

/**
 * Pi 面板控制器：加载会话历史 / 开启新会话，并通过 PiRpcClient 驱动 pi 对话
 * （流式增量转发、取消、错误提示）。
 */
export class PiChatController {
    private currentSession: Session | undefined;
    private pendingNewFolder: string | undefined;
    private pendingSessionId: string | undefined;
    private currentToken: SimpleCancellationToken | undefined;

    constructor(
        private readonly host: PiChatHost,
        private readonly provider: AgentProvider,
        private readonly rpc: PiRpcClient
    ) { }

    /** 加载并展示一个会话：读历史 → 通知 webview。 */
    showSession(session: Session): void {
        this.currentSession = session;
        this.pendingNewFolder = undefined;
        this.pendingSessionId = undefined;
        const content = this.provider.readSessionContent(session);
        const message: PiChatHostMessage = {
            type: 'session',
            title: session.title,
            messages: content.messages.map((m) => ({
                role: m.role,
                text: m.text,
                time: formatTime(m.timestamp)
            }))
        };
        this.host.post(message);
    }

    /** 开启新会话：空会话视图（标题=目录名），并记录待创建的固定会话 id。 */
    showNewSession(folderPath: string): void {
        this.currentSession = undefined;
        this.pendingNewFolder = folderPath;
        this.pendingSessionId = fixedSessionId(folderPath);
        const message: PiChatHostMessage = {
            type: 'session',
            title: basename(folderPath),
            messages: []
        };
        this.host.post(message);
    }

    /** 处理来自 webview 的消息。 */
    handleMessage(message: unknown): void {
        if (!message || typeof message !== 'object') {
            return;
        }
        const msg = message as PiChatViewMessage;
        switch (msg.type) {
            case 'send': {
                const text = (msg.text ?? '').trim();
                if (text) {
                    this.send(text);
                }
                break;
            }
            case 'abort':
                this.abort();
                break;
            case 'ready':
                break;
        }
    }

    /** 发起对话：确定会话参数 → 调 PiRpcClient → 流式转发。 */
    private send(text: string): void {
        if (this.currentToken) {
            this.host.post({ type: 'chat', role: 'system', text: '正在生成中，请先停止或等待完成。' });
            return;
        }
        const folder = this.currentSession?.cwd || this.pendingNewFolder;
        if (!folder) {
            this.host.post({ type: 'chat', role: 'system', text: '请先通过右键「会话列表」选择或开启一个会话。' });
            return;
        }
        // 用户消息由 webview 本地回显（避免双重渲染）
        const token = new SimpleCancellationToken();
        this.currentToken = token;
        this.rpc.prompt({
            message: text,
            sessionFile: this.currentSession?.path,
            sessionId: this.currentSession ? undefined : this.pendingSessionId,
            cwd: folder,
            callbacks: {
                onDelta: (delta) => {
                    this.host.post({ type: 'chat', role: 'assistant', text: delta });
                },
                onError: (err) => {
                    this.currentToken = undefined;
                    this.host.post({ type: 'chat', role: 'system', text: err });
                    this.host.post({ type: 'chatEnd' });
                },
                onEnd: () => {
                    this.currentToken = undefined;
                    this.host.post({ type: 'chatEnd' });
                }
            },
            token
        });
    }

    /** 取消当前生成。token 由 onEnd/onError 清除，避免取消后旧回调误清新请求。 */
    private abort(): void {
        if (this.currentToken) {
            this.currentToken.cancel();
        }
    }

    /** 当前加载的会话（历史会话）。 */
    getCurrentSession(): Session | undefined {
        return this.currentSession;
    }

    /** 待创建新会话的目录。 */
    getPendingNewFolder(): string | undefined {
        return this.pendingNewFolder;
    }

    /** 待创建新会话的固定会话 id（由目录派生）。 */
    getPendingSessionId(): string | undefined {
        return this.pendingSessionId;
    }
}
