import * as fs from 'node:fs';
import * as path from 'node:path';

const BUG_RE = /^BUG-(\d+)$/i;

/** 下一个 BUG-N 编号：基于已有编号最大值 +1（无则从 1 开始）。 */
export function nextBugNumber(existingNames: string[]): number {
    let max = 0;
    for (const name of existingNames) {
        const m = BUG_RE.exec(name);
        if (m) {
            const n = Number(m[1]);
            if (n > max) {
                max = n;
            }
        }
    }
    return max + 1;
}

/** 生成 BUG-N 目录名。 */
export function bugDirectoryName(n: number): string {
    return `BUG-${n}`;
}

/** 项目存放根目录：工作区文件所在目录；无工作区文件时返回 undefined。 */
export function resolveProjectRoot(workspaceFilePath: string | undefined): string | undefined {
    return workspaceFilePath ? path.dirname(workspaceFilePath) : undefined;
}

/** 列出某目录下匹配 BUG-N 的目录名（含大小写，按名排序）。 */
export function listBugDirectories(root: string): string[] {
    let entries;
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((e) => e.isDirectory() && BUG_RE.test(e.name))
        .map((e) => e.name)
        .sort();
}

/** 在根目录下创建 BUG-N 目录（若不存在），返回其完整路径。 */
export function createBugDirectory(root: string, dirName: string): string {
    const dirPath = path.join(root, dirName);
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}
