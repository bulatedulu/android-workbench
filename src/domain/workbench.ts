import { Project, ProjectRegistry } from './project';
import { Session, isUnderProject } from './session';
import { AgentProvider } from '../agent/provider';

/**
 * 工作台协调器：把项目注册表与 Agent 会话扫描组合起来。
 * 按需扫描 + 内存缓存（ADR-0001：v1 无持久化索引）；refresh() 清缓存触发重扫。
 */
export class WorkbenchService {
    private cachedSessions: Session[] | undefined;

    constructor(
        private readonly registry: ProjectRegistry,
        private readonly provider: AgentProvider
    ) {}

    get agentName(): string {
        return this.provider.agentName;
    }

    refresh(): void {
        this.cachedSessions = undefined;
    }

    listProjects(): Project[] {
        return this.registry.list();
    }

    /** 某项目下的会话（工作目录精确匹配或位于项目子目录）。 */
    listSessionsForProject(project: Project): Session[] {
        return this.sessions().filter((s) => isUnderProject(s.cwd, project.path));
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
