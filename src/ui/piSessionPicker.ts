import { createHash } from 'node:crypto';
import { Session } from '../domain/session';
import { formatTime } from './format';

/** QuickPick 会话选择的一项。 */
export type SessionPickChoice =
    | { action: 'new'; label: string }
    | { action: 'session'; label: string; description: string; session: Session };

/** 组装会话选择项：第一项「开启新会话」，其后历史会话按更新时间最新优先。 */
export function buildSessionPickChoices(sessions: Session[]): SessionPickChoice[] {
    const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    return [
        { action: 'new', label: '开启新会话' },
        ...sorted.map((s) => ({
            action: 'session' as const,
            label: s.title,
            description: s.model ? `${s.model} · ${formatTime(s.updatedAt)}` : formatTime(s.updatedAt),
            session: s
        }))
    ];
}

/**
 * 由目录路径派生的固定会话 id（无历史会话时用于创建，pi --session-id）。
 * 确定性：同目录始终同 id，形成「每项目一个固定会话」。
 */
export function fixedSessionId(folderPath: string): string {
    return createHash('sha1').update(folderPath).digest('hex').slice(0, 16);
}
