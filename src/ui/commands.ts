import * as vscode from 'vscode';
import { Project } from '../domain/project';
import { WorkbenchService } from '../domain/workbench';
import { WorkbenchTreeProvider } from './workbenchTree';

/**
 * 项目管理命令：添加 / 编辑标签 / 移除（工作区驱动，均不重载窗口）。
 * 保持薄——只做交互（对话框、提示），工作区变更由 onDidChangeWorkspaceFolders 刷新树。
 */
export function registerProjectCommands(
    context: vscode.ExtensionContext,
    service: WorkbenchService,
    tree: WorkbenchTreeProvider
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('aiWorkbench.addProject', async () => {
            const folders = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: '选择项目目录'
            });
            if (!folders || folders.length === 0) {
                return;
            }
            const uri = folders[0];
            const alreadyOpen = vscode.workspace.workspaceFolders?.some(
                (f) => f.uri.fsPath === uri.fsPath
            );
            if (alreadyOpen) {
                void vscode.window.showInformationMessage('该项目已在当前工作区中。');
                return;
            }
            const added = vscode.workspace.updateWorkspaceFolders(
                vscode.workspace.workspaceFolders?.length ?? 0,
                0,
                { uri }
            );
            if (!added) {
                void vscode.window.showErrorMessage('添加项目失败：无法更新工作区。');
            }
        }),

        vscode.commands.registerCommand('aiWorkbench.editTags', async (project?: Project) => {
            if (!project) {
                return;
            }
            const tagsText = await vscode.window.showInputBox({
                prompt: '标签（逗号分隔）',
                value: project.tags.join(', ')
            });
            if (tagsText === undefined) {
                return;
            }
            const tags = tagsText
                .split(/[,，]/)
                .map((t) => t.trim())
                .filter(Boolean);
            service.updateTags(project.path, tags);
            tree.refreshView();
        }),

        vscode.commands.registerCommand('aiWorkbench.removeProject', async (project?: Project) => {
            if (!project) {
                return;
            }
            const answer = await vscode.window.showWarningMessage(
                `确定从当前工作区移除项目「${project.name}」？仅移除，不会删除磁盘或会话数据。`,
                { modal: true },
                '移除'
            );
            if (answer !== '移除') {
                return;
            }
            const index = vscode.workspace.workspaceFolders?.findIndex((f) => f.uri.fsPath === project.path) ?? -1;
            if (index === -1) {
                return;
            }
            vscode.workspace.updateWorkspaceFolders(index, 1);
        })
    );
}
