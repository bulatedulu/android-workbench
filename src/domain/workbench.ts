import { Project, ProjectSource } from './project';
import { Session, isUnderProject } from './session';
import { SearchService, SearchFilters } from './search';
import { AgentProvider } from '../agent/provider';

/**
 * 工作台协调器：把项目来源（工作区文件夹）、Agent 会话扫描与搜索组合起来。
 * 按需扫描 + 内存缓存（ADR-0001：v1 无持久化索引）；refresh() 清缓存触发重扫。
 */
export class WorkbenchService {
    private cachedSessions: Session[] | undefined;
    private readonly searchService: SearchService;
    private query = '';
    private filters: SearchFilters = {};

    constructor(
        private readonly projects: ProjectSource,
        private readonly provider: AgentProvider
    ) {
        this.searchService = new SearchService((s) => provider.readSessionText(s));
    }

    get agentName(): string {
        return this.provider.agentName;
    }

    get agentAvailable(): boolean {
        return this.provider.isAvailable();
    }

    get isSearching(): boolean {
        return (
            this.query.trim() !== '' ||
            this.filters.from !== undefined ||
            this.filters.to !== undefined ||
            this.filters.agent !== undefined
        );
    }

    get currentQuery(): string {
        return this.query;
    }

    refresh(): void {
        this.cachedSessions = undefined;
    }

    setSearch(query: string, filters: SearchFilters = {}): void {
        this.query = query;
        this.filters = filters;
    }

    clearSearch(): void {
        this.query = '';
        this.filters = {};
    }

    listProjects(): Project[] {
        return this.projects.listProjects();
    }

    updateTags(projectPath: string, tags: string[]): void {
        this.projects.saveTags(projectPath, tags);
    }

    /** 某项目下的全部会话（不受搜索过滤影响）。 */
    listAllSessionsForProject(project: Project): Session[] {
        return this.sessions().filter((s) => isUnderProject(s.cwd, project.path));
    }

    /** 某项目下的会话（工作目录匹配 + 当前搜索条件）。 */
    listSessionsForProject(project: Project): Session[] {
        const matched = this.listAllSessionsForProject(project);
        if (!this.isSearching) {
            return matched;
        }
        return this.searchService.search(matched, this.query, this.filters);
    }

    /** Agent 存储是否可用（用于空态提示）。 */
    hasStore(): boolean {
        return this.provider.discoverStore() !== undefined;
    }

    private sessions(): Session[] {
        if (!this.cachedSessions) {
            this.cachedSessions = this.provider.scanSessions();
        }
        return this.cachedSessions;
    }
}
