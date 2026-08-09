import * as fs from 'node:fs';
import * as path from 'node:path';

/** 生成 .code-workspace 文件内容（绝对路径列表）。 */
export function buildWorkspaceFileContent(folderPaths: string[]): string {
    return JSON.stringify({ folders: folderPaths.map((p) => ({ path: p })) }, null, 4);
}

/** 默认工作区文件名：父目录名 + .code-workspace。 */
export function defaultWorkspaceFileName(parentDir: string): string {
    const base = path.basename(parentDir) || 'workspace';
    return `${base}.code-workspace`;
}

/** 确保文件名以 .code-workspace 结尾。 */
export function ensureWorkspaceExtension(name: string): string {
    return name.toLowerCase().endsWith('.code-workspace') ? name : `${name}.code-workspace`;
}

/** 列出某目录下的直接子文件夹（绝对路径，按名排序）；目录不存在返回空数组。 */
export function listSubdirectories(dir: string): string[] {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((e) => e.isDirectory())
        .map((e) => path.join(dir, e.name))
        .sort();
}
