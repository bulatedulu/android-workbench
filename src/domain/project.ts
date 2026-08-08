import { randomUUID } from 'node:crypto';
import { normalizePathForMatch } from './paths';

export interface Project {
    readonly id: string;
    readonly name: string;
    readonly path: string;
    readonly tags: string[];
    readonly createdAt: number;
    readonly updatedAt: number;
}

export interface NewProject {
    name: string;
    path: string;
    tags?: string[];
}

export interface ProjectStore {
    load(): Project[];
    save(projects: Project[]): void;
}

function assertValidName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        throw new Error('项目名称不能为空');
    }
    return trimmed;
}

export class ProjectRegistry {
    private projects: Project[];

    constructor(private readonly store: ProjectStore) {
        this.projects = store.load();
    }

    list(): Project[] {
        return this.projects.map((p) => ({ ...p, tags: [...p.tags] }));
    }

    add(input: NewProject): Project {
        if (this.projects.some((p) => normalizePathForMatch(p.path) === normalizePathForMatch(input.path))) {
            throw new Error(`项目路径已注册：${input.path}`);
        }
        const now = Date.now();
        const project: Project = {
            id: randomUUID(),
            name: assertValidName(input.name),
            path: input.path,
            tags: [...(input.tags ?? [])],
            createdAt: now,
            updatedAt: now
        };
        this.projects.push(project);
        this.persist();
        return { ...project, tags: [...project.tags] };
    }

    update(id: string, patch: { name?: string; tags?: string[] }): Project | undefined {
        const index = this.projects.findIndex((p) => p.id === id);
        if (index === -1) {
            return undefined;
        }
        const current = this.projects[index];
        const updated: Project = {
            ...current,
            name: patch.name !== undefined ? assertValidName(patch.name) : current.name,
            tags: patch.tags !== undefined ? [...patch.tags] : [...current.tags],
            updatedAt: Date.now()
        };
        this.projects[index] = updated;
        this.persist();
        return { ...updated, tags: [...updated.tags] };
    }

    remove(id: string): boolean {
        const index = this.projects.findIndex((p) => p.id === id);
        if (index === -1) {
            return false;
        }
        this.projects.splice(index, 1);
        this.persist();
        return true;
    }

    private persist(): void {
        this.store.save(this.projects);
    }
}
