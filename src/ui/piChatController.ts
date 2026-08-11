import { basename } from 'node:path';
import { Session } from '../domain/session';
import { AgentProvider } from '../agent/provider';
import { formatTime } from './format';
import { fixedSessionId } from './piSessionPicker';

/** Pi 面板宿主抽象：向 webview 发消息。 */
export interface PiChatHost {
    post(message: unknown): void;
}

/** 宿主 → Webview 的消息（判别联合）。 */
export type PiChatHostMessage =
    | { type: 'session'; title: string; messages: { role: string; text: string; time: string }[] };

/**
 * Pi 面板控制器：加载会话历史 / 开启新会话并通知 webview 渲染。
 * 对话（send/abort/流式）在后续 ticket 接入。
 */
export class PiChatController {
    private currentSession: Session | undefined;
    private pendingNewFolder: string | undefined;
    private pendingSessionId: string | undefined;

    constructor(
        private readonly host: PiChatHost,
        private readonly provider: AgentProvider
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

    /** 开启新会话：空会话视图（标题=目录名），并记录待创建的固定会话 id（供对话接入）。 */
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
