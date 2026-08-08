import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Project, ProjectRegistry, ProjectStore } from './domain/project';
import { ProjectTreeProvider } from './ui/projectTree';
import { registerProjectCommands } from './ui/commands';

/**
 * 以 globalStorage 下的 JSON 文件为后端的 ProjectStore 实现（符合规范决策）。
 * 领域层不感知 VS Code；此实现是接缝处唯一的 VS Code 依赖。
 */
class GlobalStorageProjectStore implements ProjectStore {
  private readonly filePath: string;

  constructor(context: vscode.ExtensionContext) {
    this.filePath = path.join(context.globalStorageUri.fsPath, 'projects.json');
  }

  load(): Project[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as unknown;
      return Array.isArray(parsed) ? (parsed as Project[]) : [];
    } catch {
      return [];
    }
  }

  save(projects: Project[]): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(projects, null, 2), 'utf8');
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const store = new GlobalStorageProjectStore(context);
  const registry = new ProjectRegistry(store);
  const tree = new ProjectTreeProvider(() => registry.list());

  const view = vscode.window.createTreeView('aiWorkbench.projects', { treeDataProvider: tree });
  context.subscriptions.push(
    view,
    vscode.commands.registerCommand('aiWorkbench.openWorkbench', () => {
      void vscode.commands.executeCommand('aiWorkbench.projects.focus');
    })
  );

  registerProjectCommands(context, registry, tree);
}

export function deactivate(): void {}
