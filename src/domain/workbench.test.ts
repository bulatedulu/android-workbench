import { describe, it, expect } from 'vitest';
import { WorkbenchService } from './workbench';
import { ProjectRegistry, ProjectStore, Project } from './project';
import { Session, SessionContent } from './session';
import { AgentProvider } from '../agent/provider';

class MemoryStore implements ProjectStore {
    private data: Project[] = [];
    load(): Project[] {
        return this.data;
    }
    save(projects: Project[]): void {
        this.data = projects;
    }
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
    readSessionContent(session: Session): SessionContent {
        return { messages: [] };
    }
    resumeSession(_session: Session, _run: (command: string) => boolean): boolean {
        return true;
    }
    isAvailable(): boolean {
        return true;
    }
}

function makeSession(id: string, cwd: string): Session {
    return { id, agent: 'pi', path: `/sessions/${id}.jsonl`, cwd, title: id, model: 'gpt-4.1', createdAt: 1, updatedAt: 1 };
}

describe('WorkbenchService', () => {
    it('只返回与项目匹配（精确或子目录）的会话', () => {
        const registry = new ProjectRegistry(new MemoryStore());
        const project = registry.add({ name: 'BUG-1', path: 'D:\\bug_list\\BUG-1' });
        const sessions = [
            makeSession('a', 'D:\\bug_list\\BUG-1'),
            makeSession('b', 'D:\\bug_list\\BUG-1\\src'),
            makeSession('c', 'D:\\other\\project')
        ];
        const service = new WorkbenchService(registry, new FakeProvider(sessions));

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
        const registry = new ProjectRegistry(new MemoryStore());
        const project = registry.add({ name: 'BUG-1', path: 'D:\\bug_list\\BUG-1' });
        const service = new WorkbenchService(registry, provider);

        service.listSessionsForProject(project);
        service.listSessionsForProject(project);
        expect(scanCount).toBe(1);

        service.refresh();
        service.listSessionsForProject(project);
        expect(scanCount).toBe(2);
    });

    it('暴露 provider 的 agentName', () => {
        const registry = new ProjectRegistry(new MemoryStore());
        const service = new WorkbenchService(registry, new FakeProvider([]));
        expect(service.agentName).toBe('pi');
    });

    it('setSearch 后只返回匹配的会话，clearSearch 恢复全部', () => {
        const registry = new ProjectRegistry(new MemoryStore());
        const project = registry.add({ name: 'BUG-1', path: 'D:\\bug_list\\BUG-1' });
        const sessions = [makeSession('a', 'D:\\bug_list\\BUG-1'), makeSession('b', 'D:\\bug_list\\BUG-1')];
        const service = new WorkbenchService(registry, new FakeProvider(sessions));

        service.setSearch('text-a');
        expect(service.isSearching).toBe(true);
        expect(service.listSessionsForProject(project).map((s) => s.id)).toEqual(['a']);

        service.clearSearch();
        expect(service.isSearching).toBe(false);
        expect(service.listSessionsForProject(project)).toHaveLength(2);
    });

    it('listAllSessionsForProject 不受搜索影响', () => {
        const registry = new ProjectRegistry(new MemoryStore());
        const project = registry.add({ name: 'BUG-1', path: 'D:\\bug_list\\BUG-1' });
        const sessions = [makeSession('a', 'D:\\bug_list\\BUG-1'), makeSession('b', 'D:\\bug_list\\BUG-1')];
        const service = new WorkbenchService(registry, new FakeProvider(sessions));

        service.setSearch('text-a');
        expect(service.listAllSessionsForProject(project)).toHaveLength(2);
        expect(service.listSessionsForProject(project)).toHaveLength(1);
    });
});
