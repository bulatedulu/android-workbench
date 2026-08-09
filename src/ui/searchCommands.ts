import * as vscode from 'vscode';
import { SearchFilters } from '../domain/search';
import { WorkbenchService } from '../domain/workbench';
import { WorkbenchTreeProvider } from './workbenchTree';

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/** 弹出时间范围选择，返回对应的过滤条件（默认全部时间）。 */
async function pickTimeRange(): Promise<SearchFilters> {
    const items = [
        { label: '全部时间', from: undefined },
        { label: '今天', from: startOfDay(Date.now()) },
        { label: '近 7 天', from: Date.now() - 7 * DAY },
        { label: '近 30 天', from: Date.now() - 30 * DAY }
    ];
    const picked = await vscode.window.showQuickPick(items.map((i) => ({ label: i.label })), {
        placeHolder: '时间范围'
    });
    const range = items.find((i) => i.label === picked?.label);
    return range && range.from !== undefined ? { from: range.from } : {};
}

/**
 * 搜索命令：搜索会话（标题 + 消息文本，可带时间过滤）、清除搜索。
 * 保持薄——只做交互，逻辑在 SearchService / WorkbenchService。
 */
export function registerSearchCommands(
    context: vscode.ExtensionContext,
    service: WorkbenchService,
    tree: WorkbenchTreeProvider
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('aiWorkbench.searchSessions', async () => {
            const query = await vscode.window.showInputBox({
                prompt: '搜索会话（标题或消息内容）',
                placeHolder: '输入关键词…',
                value: service.currentQuery
            });
            if (query === undefined) {
                return;
            }
            const filters = await pickTimeRange();
            service.setSearch(query, filters);
            tree.refresh();
        }),

        vscode.commands.registerCommand('aiWorkbench.clearSearch', () => {
            service.clearSearch();
            tree.refresh();
        })
    );
}
