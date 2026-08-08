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
}

/** 会话工作目录是否属于某项目（精确或子目录匹配）。 */
export function isUnderProject(cwd: string, projectPath: string): boolean {
    const c = normalizePathForMatch(cwd);
    const p = normalizePathForMatch(projectPath);
    return c === p || c.startsWith(p + '/');
}
