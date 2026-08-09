import { describe, it, expect } from 'vitest';
import { WorkbenchService } from './workbench';
import { Project, ProjectSource, projectFromPath } from './project';
import { Session, SessionContent } from './session';
import { AgentProvider } from '../agent/provider';

class FakeProjects implements ProjectSource {
    private tagMap: Record<string, string[]> = {};

    constructor(private readonly projects: Project[]) { }

    listProjects(): Project[] {
        return this.projects.map((p) => ({ ...p, tags: [...(this.tagMap[p.path] ?? p.tags)] }));
    }

    saveTags(projectPath: string, tags: string[]): void {
        this.tagMap[projectPath] = [...tags];
    }
}

function makeProject(projectPath: string, name?: string): Project {
    const p = projectFromPath(projectPath);
    return name ? { ...p, name } : p;
}

function makeSession(id: string, cwd: string): Session {
    return { id, agent: 'pi', path: `/sessions/${id}.jsonl`, cwd, title: id, model: 'gpt-4.1', createdAt: 1, updatedAt: 1 };
}

class FakeProvider implements AgentProvider {
    readonly agentName = 'pi';
    constructor(private readonly sessions: Session[]) { }
    discoverStore(): string | undefined {
        return '/fake/store';
    }
    scanSessions(): Session[] {
        return this.sessions;
    }
    readSessionText(session: Session): string {
        return `text-${session.id}`;
    }
    readSessionContent(_session: Session): SessionContent {
        return { messages: [] };
    }
    resumeSession(_session: Session, _run: (command: string) => boolean): boolean {
        return true;
    }
    isAvailable(): boolean {
        return true;
    }
}

describe('WorkbenchService', () => {
    it('listProjects 来自项目来源', () => {
        const projects = new FakeProjects([makeProject('D:\\bug_list\\BUG-1', 'BUG-1')]);
        const service = new WorkbenchService(projects, new FakeProvider([]));

        expect(service.listProjects()).toHaveLength(1);
        expect(service.listProjects()[0].name).toBe('BUG-1');
    });

    it('只返回与项目匹配（精确或子目录）的会话', () => {
        const project = makeProject('D:\\bug_list\\BUG-1', 'BUG-1');
        const sessions = [
            makeSession('a', 'D:\\bug_list\\BUG-1'),
            makeSession('b', 'D:\\bug_list\\BUG-1\\src'),
            makeSession('c', 'D:\\other\\project')
        ];
        const service = new WorkbenchService(new FakeProjects([project]), new FakeProvider(sessions));

        const list = service.listSessionsForProject(project);

        expect(list.map((s) => s.id)).toEqual(['a', 'b']);
    });

    it('会话缓存：未刷新前只扫描一次，refresh 后重新扫描', () => {
        let scanCount = 0;
        const provider: AgentProvider = {
            agentName: 'pi',
            discoverStore: () => '/fake/store',
            scanSessions: () => {
                scanCount++;
                return [makeSession('a', 'D:\\bug_list\\BUG-1')];
            },
            readSessionText: () => '',
            readSessionContent: () => ({ messages: [] }),
            resumeSession: () => true,
            isAvailable: () => true
        };
        const project = makeProject('D:\\bug_list\\BUG-1', 'BUG-1');
        const service = new WorkbenchService(new FakeProjects([project]), provider);

        service.listSessionsForProject(project);
        service.listSessionsForProject(project);
        expect(scanCount).toBe(1);

        service.refresh();
        service.listSessionsForProject(project);
        expect(scanCount).toBe(2);
    });

    it('暴露 provider 的 agentName 与 agentAvailable', () => {
        const service = new WorkbenchService(new FakeProjects([]), new FakeProvider([]));
        expect(service.agentName).toBe('pi');
        expect(service.agentAvailable).toBe(true);
    });

    it('setSearch 后只返回匹配的会话，clearSearch 恢复全部', () => {
        const project = makeProject('D:\\bug_list\\BUG-1', 'BUG-1');
        const sessions = [makeSession('a', 'D:\\bug_list\\BUG-1'), makeSession('b', 'D:\\bug_list\\BUG-1')];
        const service = new WorkbenchService(new FakeProjects([project]), new FakeProvider(sessions));

        service.setSearch('text-a');
        expect(service.isSearching).toBe(true);
        expect(service.listSessionsForProject(project).map((s) => s.id)).toEqual(['a']);

        service.clearSearch();
        expect(service.isSearching).toBe(false);
        expect(service.listSessionsForProject(project)).toHaveLength(2);
    });

    it('listAllSessionsForProject 不受搜索影响', () => {
        const project = makeProject('D:\\bug_list\\BUG-1', 'BUG-1');
        const sessions = [makeSession('a', 'D:\\bug_list\\BUG-1'), makeSession('b', 'D:\\bug_list\\BUG-1')];
        const service = new WorkbenchService(new FakeProjects([project]), new FakeProvider(sessions));

        service.setSearch('text-a');
        expect(service.listAllSessionsForProject(project)).toHaveLength(2);
        expect(service.listSessionsForProject(project)).toHaveLength(1);
    });

    it('updateTags 保存到项目来源，并反映在 listProjects 中', () => {
        const projects = new FakeProjects([makeProject('D:\\bug_list\\BUG-1', 'BUG-1')]);
        const service = new WorkbenchService(projects, new FakeProvider([]));

        service.updateTags('D:\\bug_list\\BUG-1', ['bug', 'urgent']);

        expect(projects.listProjects()[0].tags).toEqual(['bug', 'urgent']);
        expect(projects.listProjects().find((p) => p.path === 'D:\\other')).toBeUndefined();
    });
});
