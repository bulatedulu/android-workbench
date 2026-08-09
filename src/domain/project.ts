import * as path from 'node:path';

export interface Project {
    /** 项目名称 = 文件夹名 */
    readonly name: string;
    /** 文件夹路径（也是项目标识） */
    readonly path: string;
    readonly tags: string[];
}

/** 由文件夹路径构造项目：名称取文件夹名。 */
export function projectFromPath(folderPath: string, tags: string[] = []): Project {
    return { name: path.basename(folderPath) || folderPath, path: folderPath, tags: [...tags] };
}

/**
 * 项目来源抽象：工作台通过它获取项目列表与标签。
 * 项目 = 当前 VS Code 工作区的文件夹（支持多根）；VS Code 实现读 workspace.workspaceFolders。
 */
export interface ProjectSource {
    listProjects(): Project[];
    saveTags(projectPath: string, tags: string[]): void;
}
