import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * 项目标签存储：按路径保存标签数组，文件为 JSON（path → tags）。
 * 无 VS Code 依赖，可用临时文件测试。
 */
export class FileTagsStore {
    private cache: Record<string, string[]> | undefined;

    constructor(private readonly filePath: string) {}

    get(projectPath: string): string[] {
        return [...(this.data()[projectPath] ?? [])];
    }

    set(projectPath: string, tags: string[]): void {
        const data = this.data();
        if (tags.length === 0) {
            delete data[projectPath];
        } else {
            data[projectPath] = [...tags];
        }
        this.persist();
    }

    private data(): Record<string, string[]> {
        if (!this.cache) {
            try {
                const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as unknown;
                this.cache =
                    parsed && typeof parsed === 'object' ? (parsed as Record<string, string[]>) : {};
            } catch {
                this.cache = {};
            }
        }
        return this.cache;
    }

    private persist(): void {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        fs.writeFileSync(this.filePath, JSON.stringify(this.cache ?? {}, null, 2), 'utf8');
    }
}
