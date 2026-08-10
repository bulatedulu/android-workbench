import * as vscode from 'vscode';

const HIDE_TABS_COMMAND = 'workbench.action.hideEditorTabs';
const SHOW_TABS_COMMAND = 'workbench.action.showMultipleEditorTabs';

export type CommandExecutor = (command: string, ...rest: unknown[]) => Thenable<unknown>;

/**
 * 面板打开期间隐藏编辑器标签栏（全屏面板无顶部标签，更像工作台），面板关闭时恢复显示。
 * 使用官方 hide/show 命令（直接设置，非切换，可靠）。
 * exec 可注入便于测试；默认走 vscode.commands.executeCommand。
 */
export function hideEditorTabsWhileOpen(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    exec: CommandExecutor = (cmd, ...rest) => vscode.commands.executeCommand(cmd, ...rest)
): void {
    void exec(HIDE_TABS_COMMAND);
    context.subscriptions.push(
        panel.onDidDispose(() => {
            void exec(SHOW_TABS_COMMAND);
        })
    );
}
