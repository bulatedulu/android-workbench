import * as vscode from 'vscode';
import { Project } from '../domain/project';
import { Session } from '../domain/session';
import { WorkbenchService } from '../domain/workbench';
import { formatTime } from './format';

/** Agent 层级节点：持有其已归属会话（getChildren 需要上下文）。 */
export class AgentNode {
    constructor(readonly agent: string, readonly sessions: Session[]) { }
}

/** 空态占位节点。 */
export class PlaceholderNode {
    constructor(readonly label: string) { }
}

export type TreeNode = Project | AgentNode | Session | PlaceholderNode;

function isProject(e: TreeNode): e is Project {
    return 'tags' in e;
}

function isAgentNode(e: TreeNode): e is AgentNode {
    return e instanceof AgentNode;
}

function isPlaceholder(e: TreeNode): e is PlaceholderNode {
    return e instanceof PlaceholderNode;
}

/**
 * 工作台树：项目 → Agent → 会话 三级。
 * 保持薄——只做层级映射，数据来自 WorkbenchService。
 */
export class WorkbenchTreeProvider implements vscode.TreeDataProvider<TreeNode> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly service: WorkbenchService) { }

    refresh(): void {
        this.service.refresh();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        if (isProject(element)) {
            const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Collapsed);
            item.description = element.path;
            item.tooltip = `${element.name}\n${element.path}`;
            item.contextValue = 'project';
            return item;
        }
        if (isAgentNode(element)) {
            const item = new vscode.TreeItem(element.agent, vscode.TreeItemCollapsibleState.Collapsed);
            item.contextValue = 'agent';
            return item;
        }
        if (isPlaceholder(element)) {
            const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
            item.contextValue = 'placeholder';
            return item;
        }
        // Session
        const item = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
        item.description = element.model
            ? `${element.model} · ${formatTime(element.updatedAt)}`
            : formatTime(element.updatedAt);
        item.tooltip =
            `${element.title}\n${element.cwd}` +
            `\n创建：${formatTime(element.createdAt)}\n更新：${formatTime(element.updatedAt)}` +
            (element.model ? `\n模型：${element.model}` : '');
        item.contextValue = 'session';
        item.command = { command: 'aiWorkbench.openSession', title: '查看会话', arguments: [element] };
        return item;
    }

    getChildren(element?: TreeNode): TreeNode[] {
        if (!element) {
            return this.service.listProjects();
        }
        if (isProject(element)) {
            const all = this.service.listAllSessionsForProject(element);
            if (all.length === 0) {
                const label = this.service.hasStore() ? '无会话' : '未找到 pi 会话存储';
                return [new PlaceholderNode(label)];
            }
            const sessions = this.service.listSessionsForProject(element);
            if (sessions.length === 0) {
                return [new PlaceholderNode('无匹配会话')];
            }
            return [new AgentNode(this.service.agentName, sessions)];
        }
        if (isAgentNode(element)) {
            return element.sessions;
        }
        return [];
    }
}
