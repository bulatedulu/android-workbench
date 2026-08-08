import * as vscode from 'vscode';
import { Project } from '../domain/project';

/**
 * 项目树的 TreeDataProvider：展示已注册项目的列表。
 * 保持薄——只做映射，逻辑都在领域层。
 */
export class ProjectTreeProvider implements vscode.TreeDataProvider<Project> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<Project | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly listProjects: () => Project[]) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Project): vscode.TreeItem {
    const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
    item.description = element.path;
    item.tooltip = `${element.name}\n${element.path}`;
    item.contextValue = 'project';
    return item;
  }

  getChildren(): vscode.ProviderResult<Project[]> {
    return this.listProjects();
  }
}
