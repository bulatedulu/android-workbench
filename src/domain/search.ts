import { Session } from './session';

export interface SearchFilters {
    agent?: string;
    /** 起止时间（epoch ms，含边界） */
    from?: number;
    to?: number;
}

/**
 * 会话搜索服务：按标题与消息文本匹配关键词，并按 agent / 时间范围过滤。
 * 消息文本通过注入的 readSessionText 获取（接缝，便于测试）。
 */
export class SearchService {
    constructor(private readonly readSessionText: (session: Session) => string) {}

    search(sessions: Session[], query: string, filters: SearchFilters = {}): Session[] {
        const q = query.trim().toLowerCase();
        return sessions.filter((s) => {
            if (filters.agent !== undefined && s.agent !== filters.agent) {
                return false;
            }
            if (filters.from !== undefined && s.createdAt < filters.from) {
                return false;
            }
            if (filters.to !== undefined && s.createdAt > filters.to) {
                return false;
            }
            if (q === '') {
                return true;
            }
            if (s.title.toLowerCase().includes(q)) {
                return true;
            }
            return this.readSessionText(s).toLowerCase().includes(q);
        });
    }
}
