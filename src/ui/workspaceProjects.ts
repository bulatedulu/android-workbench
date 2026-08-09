import * as vscode from 'vscode';
import { Project, ProjectSource, projectFromPath } from '../domain/project';
import { FileTagsStore } from '../storage/tagsStore';

/**
 * 项目来源的 VS Code 实现：项目 = 当前工作区文件夹（支持 .code-workspace 多根）。
 * 名称取文件夹名；标签按路径存 FileTagsStore。
 */
export class WorkspaceProjectSource implements ProjectSource {
    constructor(private readonly tags: FileTagsStore) { }

    listProjects(): Project[] {
        return (vscode.workspace.workspaceFolders ?? []).map((f) => {
            const p = f.uri.fsPath;
            return projectFromPath(p, this.tags.get(p));
        });
    }

    saveTags(projectPath: string, tags: string[]): void {
        this.tags.set(projectPath, tags);
    }
}
