import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildWizardHtml, WizardHostMessage, WizardMessage, WizardViewState } from './workspaceWizardHtml';
import {
    buildWorkspaceFileContent,
    defaultWorkspaceFileName,
    ensureWorkspaceExtension,
    listSubdirectories
} from '../domain/workspaceSetup';

function resolveWorkspaceFile(parent: string, name: string): string {
    return path.join(parent, ensureWorkspaceExtension(name));
}

/**
 * 打开「创建多根工作区」引导面板（编辑器区居中）：
 * 选父目录 → 列子文件夹勾选 → 生成 .code-workspace 并在当前窗口打开；
 * 文件名输入时实时判断存在性并切换按钮；文件已存在时可直接加载或二次确认后覆盖重建。
 */
export function openWorkspaceWizard(context: vscode.ExtensionContext): void {
    const panel = vscode.window.createWebviewPanel(
        'aiWorkbench.workspaceWizard',
        '创建多根工作区',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    let parent: string | undefined;

    const send = (msg: WizardHostMessage): void => {
        void panel.webview.postMessage(msg);
    };
    const render = (state: WizardViewState): void => {
        panel.webview.html = buildWizardHtml(state);
    };

    render({ parent: undefined, subdirs: [], defaultName: '', exists: false });

    panel.webview.onDidReceiveMessage(
        async (raw) => {
            const message = raw as WizardMessage;
            switch (message?.type) {
                case 'pickParent': {
                    const folders = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: '选择项目存放目录'
                    });
                    if (!folders || folders.length === 0) {
                        break;
                    }
                    parent = folders[0].fsPath;
                    const subdirs = listSubdirectories(parent);
                    const defaultName = defaultWorkspaceFileName(parent);
                    render({
                        parent,
                        subdirs,
                        defaultName,
                        exists: fs.existsSync(resolveWorkspaceFile(parent, defaultName))
                    });
                    break;
                }
                case 'nameChanged': {
                    if (!parent) {
                        break;
                    }
                    send({ type: 'exists', exists: fs.existsSync(resolveWorkspaceFile(parent, message.name)) });
                    break;
                }
                case 'create':
                case 'overwrite': {
                    if (!parent) {
                        break;
                    }
                    const folders = Array.isArray(message.folders) ? message.folders.map(String) : [];
                    if (folders.length === 0) {
                        void vscode.window.showErrorMessage('请至少选择一个项目文件夹。');
                        break;
                    }
                    const file = resolveWorkspaceFile(parent, message.name);
                    const exists = fs.existsSync(file);
                    if (exists && message.type === 'create') {
                        const answer = await vscode.window.showWarningMessage(
                            `工作区文件已存在：${path.basename(file)}`,
                            { modal: true },
                            '直接加载',
                            '覆盖'
                        );
                        if (answer === '直接加载') {
                            openWorkspace(file);
                        } else if (answer === '覆盖') {
                            writeAndOpen(file, folders);
                        }
                        break;
                    }
                    if (exists && message.type === 'overwrite') {
                        const answer = await vscode.window.showWarningMessage(
                            `确定覆盖重建 ${path.basename(file)}？将改写该工作区文件。`,
                            { modal: true },
                            '覆盖'
                        );
                        if (answer !== '覆盖') {
                            break;
                        }
                    }
                    writeAndOpen(file, folders);
                    break;
                }
                case 'load': {
                    if (!parent) {
                        break;
                    }
                    const file = resolveWorkspaceFile(parent, message.name);
                    if (fs.existsSync(file)) {
                        openWorkspace(file);
                    }
                    break;
                }
            }
        },
        undefined,
        context.subscriptions
    );
}

function writeAndOpen(filePath: string, folders: string[]): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buildWorkspaceFileContent(folders), 'utf8');
    openWorkspace(filePath);
}

function openWorkspace(filePath: string): void {
    void vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(filePath));
}
