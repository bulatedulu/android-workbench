import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { hideEditorTabsWhileOpen, CommandExecutor } from './editorTabs';

vi.mock('vscode', () => ({
    commands: { executeCommand: vi.fn() }
}));

const HIDE_TABS_COMMAND = 'workbench.action.toggleTabsVisibility';

function makePanel(): {
    panel: { onDidDispose: (fn: () => void) => { dispose: () => void } };
    fireDispose: () => void;
} {
    let handler: (() => void) | undefined;
    const panel = {
        onDidDispose: (fn: () => void) => {
            handler = fn;
            return { dispose: () => { handler = undefined; } };
        }
    };
    return { panel, fireDispose: () => handler?.() };
}

describe('hideEditorTabsWhileOpen', () => {
    it('打开时执行隐藏命令，dispose 时执行恢复命令', () => {
        const { panel, fireDispose } = makePanel();
        const calls: string[] = [];
        const exec: CommandExecutor = (cmd) => {
            calls.push(cmd);
            return Promise.resolve(undefined);
        };
        const context = { subscriptions: [] as { dispose(): void }[] } as unknown as vscode.ExtensionContext;

        hideEditorTabsWhileOpen(panel as unknown as vscode.WebviewPanel, context, exec);
        expect(calls).toEqual([HIDE_TABS_COMMAND]);

        fireDispose();
        expect(calls).toEqual([HIDE_TABS_COMMAND, HIDE_TABS_COMMAND]);
    });

    it('dispose 监听注册进 subscriptions', () => {
        const { panel } = makePanel();
        const context = { subscriptions: [] as { dispose(): void }[] } as unknown as vscode.ExtensionContext;
        hideEditorTabsWhileOpen(panel as unknown as vscode.WebviewPanel, context, vi.fn());
        expect(context.subscriptions).toHaveLength(1);
        expect(typeof context.subscriptions[0].dispose).toBe('function');
    });
});
