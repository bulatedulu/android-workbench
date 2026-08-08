import * as vscode from 'vscode';
import { Project, ProjectRegistry } from '../domain/project';
import { ProjectTreeProvider } from './projectTree';

/**
 * 项目管理的命令：添加 / 编辑 / 删除。
 * 保持薄——只做交互（对话框、提示、刷新树），逻辑都在领域层。
 */
export function registerProjectCommands(
  context: vscode.ExtensionContext,
  registry: ProjectRegistry,
  tree: ProjectTreeProvider
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
      const path = folders[0].fsPath;
      const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
      try {
        registry.add({ name, path });
        tree.refresh();
      } catch (err) {
        vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));
      }
    }),

    vscode.commands.registerCommand('aiWorkbench.editProject', async (project?: Project) => {
      if (!project) {
        return;
      }
      const name = await vscode.window.showInputBox({ prompt: '项目名称', value: project.name });
      if (name === undefined) {
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
      try {
        registry.update(project.id, { name, tags });
        tree.refresh();
      } catch (err) {
        vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));
      }
    }),

    vscode.commands.registerCommand('aiWorkbench.removeProject', async (project?: Project) => {
      if (!project) {
        return;
      }
      const answer = await vscode.window.showWarningMessage(
        `确定删除项目「${project.name}」？删除只移除注册，不会删除任何会话数据。`,
        { modal: true },
        '删除'
      );
      if (answer !== '删除') {
        return;
      }
      registry.remove(project.id);
      tree.refresh();
    })
  );
}
