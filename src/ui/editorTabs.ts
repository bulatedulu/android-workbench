import * as vscode from 'vscode';

const HIDE_TABS_COMMAND = 'workbench.action.toggleTabsVisibility';

export type CommandExecutor = (command: string, ...rest: unknown[]) => Thenable<unknown>;

/**
 * 面板打开期间隐藏编辑器标签栏（防止弹窗打开时切换编辑器），面板关闭时恢复。
 * 注意：这是成对切换命令，若用户中途手动改过标签栏可见性，恢复可能错位。
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
            void exec(HIDE_TABS_COMMAND);
        })
    );
}
