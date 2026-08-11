import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

const mocks = vi.hoisted(() => ({
    registerCommand: vi.fn(
        (_id: string, _handler: (...args: unknown[]) => unknown) => ({ dispose: () => { } })
    ),
    registerExplorerSessionList: vi.fn(),
    registerChatParticipant: vi.fn(),
    registerPiPanel: vi.fn()
}));

vi.mock('vscode', () => ({
    workspace: { isTrusted: true },
    commands: { registerCommand: mocks.registerCommand }
}));

vi.mock('./domain/workbench', () => ({ WorkbenchService: vi.fn() }));
vi.mock('./agent/piProvider', () => ({ PiProvider: vi.fn() }));
vi.mock('./storage/tagsStore', () => ({ FileTagsStore: vi.fn() }));
vi.mock('./ui/workspaceProjects', () => ({ WorkspaceProjectSource: vi.fn() }));
vi.mock('./ui/sessionViewer', () => ({ showSessionViewer: vi.fn() }));
vi.mock('./ui/workspaceWizard', () => ({ openWorkspaceWizard: vi.fn() }));
vi.mock('./ui/assistantPanel', () => ({ openAssistantFullscreen: vi.fn(), toggleAssistantFullscreen: vi.fn() }));
vi.mock('./ui/explorerSessions', () => ({ registerExplorerSessionList: mocks.registerExplorerSessionList }));
vi.mock('./ui/chatParticipant', () => ({ registerChatParticipant: mocks.registerChatParticipant }));
vi.mock('./ui/piPanel', () => ({ registerPiPanel: mocks.registerPiPanel, pickAndOpenSession: vi.fn() }));

import { activate } from './extension';

function makeContext(): vscode.ExtensionContext {
    return {
        subscriptions: [],
        globalStorageUri: { fsPath: '/tmp' }
    } as unknown as vscode.ExtensionContext;
}

describe('activate', () => {
    beforeEach(() => {
        for (const fn of Object.values(mocks)) {
            fn.mockClear();
        }
    });

    it('注册 Pi 面板视图提供者', () => {
        activate(makeContext());
        expect(mocks.registerPiPanel).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    });

    it('注册 Pi 面板打开命令与既有工作台命令', () => {
        activate(makeContext());
        const ids = mocks.registerCommand.mock.calls.map((c) => c[0]);
        expect(ids).toContain('aiWorkbench.openPiPanel');
        expect(ids).toContain('aiWorkbench.toggleFullscreen');
        expect(ids).toContain('aiWorkbench.openAssistant');
        expect(ids).toContain('aiWorkbench.createWorkspace');
    });

    it('注册右键会话列表与聊天参与者入口', () => {
        activate(makeContext());
        expect(mocks.registerExplorerSessionList).toHaveBeenCalled();
        expect(mocks.registerChatParticipant).toHaveBeenCalled();
    });
});
