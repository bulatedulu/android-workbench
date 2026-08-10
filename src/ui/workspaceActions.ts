import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildWorkspaceFileContent, resolveWorkspaceFile } from '../domain/workspaceSetup';
import { AssistantConfig, writeAssistantConfig } from './assistantConfig';

/** 写 .code-workspace + 保存配置 + 打开有名字的工作区（重载窗口）。侧边栏与引导弹窗共用。 */
export function confirmWorkspace(
    context: vscode.ExtensionContext,
    parent: string | undefined,
    folders: string[],
    name: string
): void {
    if (!parent) {
        return;
    }
    const file = resolveWorkspaceFile(parent, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buildWorkspaceFileContent(folders), 'utf8');
    const config: AssistantConfig = { parent, folders, name: path.basename(file) };
    void writeAssistantConfig(context.globalState, config);
    void vscode.window.showInformationMessage('初始化已完成。');
    // 打开有名字的工作区；重载后 workspaceFile 存在，侧边栏直接进聊天
    void vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(file));
}
