import { Session, SessionContent } from '../domain/session';
import { formatTime } from './format';

export type ChatIntent =
    | { type: 'list' }
    | { type: 'show'; keyword: string }
    | { type: 'continue'; keyword: string; question: string }
    | { type: 'help' };

/** 一个项目的会话分组（领域概念：项目 + 其会话列表）。 */
export interface ProjectSessions {
    name: string;
    sessions: Session[];
}

/** 解析参与者指令：显示 <关键词> / 继续 <关键词> [问题] / 列表 / 其他。 */
export function parseIntent(prompt: string): ChatIntent {
    const p = prompt.trim();
    // 具象指令先于列表检测，避免「显示 会话列表」被误判为列表
    const showMatch = /^显示\s+(.+)$/.exec(p);
    if (showMatch) {
        return { type: 'show', keyword: showMatch[1].trim() };
    }
    const continueMatch = /^继续\s+(\S+)\s*(.*)$/.exec(p);
    if (continueMatch) {
        return {
            type: 'continue',
            keyword: continueMatch[1],
            question: continueMatch[2].trim() || '请继续'
        };
    }
    if (/^(列表|列出|有哪些|全部会话)/.test(p)) {
        return { type: 'list' };
    }
    return { type: 'help' };
}

/** 在分组中按标题或 ID 模糊查找会话。 */
export function findSessionByKeyword(groups: ProjectSessions[], keyword: string): Session | undefined {
    const kw = keyword.toLowerCase();
    for (const g of groups) {
        const hit = g.sessions.find(
            (s) => s.title.toLowerCase().includes(kw) || s.id.toLowerCase().includes(kw)
        );
        if (hit) {
            return hit;
        }
    }
    return undefined;
}

/** 按项目分组渲染会话列表（Markdown）。 */
export function buildSessionListMarkdown(groups: ProjectSessions[]): string {
    if (groups.length === 0) {
        return '当前工作区没有项目文件夹。';
    }
    return groups
        .map((g) => {
            const rows =
                g.sessions.length === 0
                    ? '- （无会话）'
                    : g.sessions
                          .map(
                              (s) =>
                                  `- **${s.title}** · ${s.agent} · ${s.model ?? '未知模型'} · ${formatTime(s.createdAt)} ~ ${formatTime(s.updatedAt)}`
                          )
                          .join('\n');
            return `### ${g.name}\n${rows}`;
        })
        .join('\n\n');
}

/** 渲染会话内容（Markdown）。 */
export function buildSessionContentMarkdown(title: string, content: SessionContent): string {
    const body = content.messages
        .map((m) => `**${m.role}**（${formatTime(m.timestamp)}）：\n${m.text || '（空）'}`)
        .join('\n\n');
    return `# ${title}\n\n${body || '（无消息）'}`;
}
