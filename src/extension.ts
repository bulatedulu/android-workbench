import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Project, ProjectRegistry, ProjectStore } from './domain/project';
import { WorkbenchService } from './domain/workbench';
import { PiProvider } from './agent/piProvider';
import { WorkbenchTreeProvider } from './ui/workbenchTree';
import { registerProjectCommands } from './ui/commands';
import { registerSearchCommands } from './ui/searchCommands';

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
    const service = new WorkbenchService(registry, new PiProvider());
    const tree = new WorkbenchTreeProvider(service);

    const view = vscode.window.createTreeView('aiWorkbench.projects', { treeDataProvider: tree });
    if (!service.hasStore()) {
        view.message = '未找到 pi 会话存储（~/.pi/agent/sessions）。请先安装并运行 pi。';
    }
    context.subscriptions.push(
        view,
        vscode.commands.registerCommand('aiWorkbench.openWorkbench', () => {
            void vscode.commands.executeCommand('aiWorkbench.projects.focus');
        })
    );

    registerProjectCommands(context, registry, tree);
    registerSearchCommands(context, service, tree);
}

export function deactivate(): void { }
