import { normalizePathForMatch } from './paths';

export interface Session {
    readonly id: string;
    /** Agent 名称，如 'pi' */
    readonly agent: string;
    /** 会话文件路径 */
    readonly path: string;
    /** 会话记录的工作目录（来自 JSONL 头部） */
    readonly cwd: string;
    readonly title: string;
    readonly model: string | undefined;
    readonly createdAt: number;
    /** 最后更新时间（来自最后一条消息时间戳，回退为 createdAt） */
    readonly updatedAt: number;
}

/** 会话中的一条消息（供查看器渲染）。 */
export interface SessionMessage {
    role: string;
    /** 纪元毫秒 */
    timestamp: number;
    text: string;
}

/** 会话的结构化内容：按序的消息序列。 */
export interface SessionContent {
    messages: SessionMessage[];
}

/** 会话工作目录是否属于某项目（精确或子目录匹配）。 */
export function isUnderProject(cwd: string, projectPath: string): boolean {
    const c = normalizePathForMatch(cwd);
    const p = normalizePathForMatch(projectPath);
    return c === p || c.startsWith(p + '/');
}
