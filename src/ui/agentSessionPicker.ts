import { createHash } from 'node:crypto';

/**
 * 由目录路径派生的固定会话 id（无历史会话时用于创建，pi --session-id）。
 * 确定性：同目录始终同 id，形成「每项目一个固定会话」。
 */
export function fixedSessionId(folderPath: string): string {
    return createHash('sha1').update(folderPath).digest('hex').slice(0, 16);
}
