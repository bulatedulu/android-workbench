import * as vscode from 'vscode';
import * as path from 'node:path';
import { buildAssistantChatHtml } from './assistantHtml';
import { setupWorkspaceWizardPanel } from './workspaceWizard';
import {
    bugDirectoryName,
    createBugDirectory,
    listBugDirectories,
    nextBugNumber,
    resolveProjectRoot
} from '../domain/issueSpace';
import { NEW_ISSUE_COMMAND } from './messages';

interface PendingChat {
    role: 'assistant' | 'system';
    text: string;
}

/**
 * 打开居中的「AI 工作台助手」窗口：
 * - 无工作区文件时，第一步 = 多根工作区引导（确认后 openFolder 会重载窗口，引导不再出现）
 * - 有工作区文件时 = 聊天界面（本期不接 AI 模型）
 * - 「分析新问题」→ 在项目存放根目录下创建下一个 BUG-N（自增）→ 加入工作区 → 启动 pi（cwd=BUG-N）
 */
export function openAssistantHub(context: vscode.ExtensionContext): void {
    const panel = vscode.window.createWebviewPanel(
        'aiWorkbench.assistant',
        'AI 工作台助手',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    if (!vscode.workspace.workspaceFile) {
        // 第一步：引导创建多根工作区（项目存放根目录 = 工作区文件所在目录）
        setupWorkspaceWizardPanel(panel, context);
        return;
    }

    // 聊天界面（ready 握手后再发消息，避免首条消息丢失）
    panel.webview.html = buildAssistantChatHtml();
    let ready = false;
    const pending: PendingChat[] = [];
    const postChat = (role: 'assistant' | 'system', text: string): void => {
        if (ready) {
            void panel.webview.postMessage({ type: 'chat', role, text });
        } else {
            pending.push({ role, text });
        }
    };
    postChat('system', `已进入助手模式。输入「${NEW_ISSUE_COMMAND}」可创建新问题工作区（BUG-N）。`);

    panel.webview.onDidReceiveMessage(
        async (raw) => {
            const message = raw as { type?: string; text?: string };
            if (message?.type === 'ready') {
                ready = true;
                for (const m of pending) {
                    void panel.webview.postMessage({ type: 'chat', role: m.role, text: m.text });
                }
                pending.length = 0;
                return;
            }
            if (message?.type !== 'send') {
                return;
            }
            const text = (message.text ?? '').trim();
            if (!text) {
                return;
            }
            if (text.includes(NEW_ISSUE_COMMAND)) {
                await handleNewIssue(panel, postChat);
            } else {
                postChat('assistant', `暂未接入 AI 模型。当前可用指令：「${NEW_ISSUE_COMMAND}」。`);
            }
        },
        undefined,
        context.subscriptions
    );
}

async function handleNewIssue(
    panel: vscode.WebviewPanel,
    postChat: (role: 'assistant' | 'system', text: string) => void
): Promise<void> {
    const root = resolveProjectRoot(vscode.workspace.workspaceFile?.fsPath);
    if (!root) {
        postChat('system', '未找到项目存放根目录，请先创建多根工作区。');
        return;
    }
    const next = nextBugNumber(listBugDirectories(root));
    const dirName = bugDirectoryName(next);
    const dirPath = path.join(root, dirName);
    try {
        createBugDirectory(root, dirName);
    } catch (err) {
        postChat('system', `创建目录失败：${err instanceof Error ? err.message : String(err)}`);
        return;
    }
    // 加入工作区（不重载窗口）；失败则中止，不再启动 pi
    const added = vscode.workspace.updateWorkspaceFolders(
        vscode.workspace.workspaceFolders?.length ?? 0,
        0,
        { uri: vscode.Uri.file(dirPath) }
    );
    if (!added) {
        postChat('system', `已创建 ${dirName}，但加入工作区失败，已中止启动 pi。`);
        return;
    }
    // 实际启动 pi（cwd = 该目录，作用域限定在本项目内）
    const terminal = vscode.window.createTerminal({ name: `pi: ${dirName}`, cwd: dirPath });
    terminal.show();
    terminal.sendText('pi');
    postChat('assistant', `已创建 ${dirName} 并加入工作区，正在该目录启动 pi。`);
}
