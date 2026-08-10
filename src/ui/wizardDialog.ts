import * as vscode from 'vscode';
import * as fs from 'node:fs';
import { buildWizardDialogHtml, WizardDialogHostMessage, WizardDialogMessage } from './wizardDialogHtml';
import { AssistantWizardState } from './assistantViewHtml';
import { AssistantConfig, readAssistantConfig } from './assistantConfig';
import { defaultWorkspaceFileName, listSubdirectories } from '../domain/workspaceSetup';
import { hideEditorTabsWhileOpen } from './editorTabs';
import { confirmWorkspace } from './workspaceActions';

/** 打开「引导弹窗」：全屏 webview + 隐藏标签栏 + 模态遮罩卡片，内容为引导表单。 */
export function openWizardDialog(context: vscode.ExtensionContext): void {
    const panel = vscode.window.createWebviewPanel(
        'aiWorkbench.wizardDialog',
        '选择工作目录',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    // 弹窗打开期间隐藏编辑器标签栏，更像独立窗口；关闭时自动恢复
    hideEditorTabsWhileOpen(panel, context);

    let parent: string | undefined = readAssistantConfig(context.globalState).parent;
    const post = (message: WizardDialogHostMessage): void => {
        void panel.webview.postMessage(message);
    };

    const wizardState = (config: AssistantConfig): AssistantWizardState => {
        const p = config.parent ?? parent;
        if (!p) {
            return { parent: undefined, subdirs: [], selected: [], defaultName: '' };
        }
        const subdirs = listSubdirectories(p);
        const saved = config.folders.filter((f) => subdirs.includes(f));
        const selected = saved.length > 0 ? saved : subdirs; // 旧目录回填已选，新目录默认全选
        const defaultName = config.name || defaultWorkspaceFileName(p);
        return { parent: p, subdirs, selected, defaultName };
    };

    const render = (config: AssistantConfig): void => {
        panel.webview.html = buildWizardDialogHtml(wizardState(config));
    };
    render(readAssistantConfig(context.globalState));

    panel.webview.onDidReceiveMessage(
        async (raw) => {
            const message = raw as WizardDialogMessage;
            switch (message.type) {
                case 'ready': {
                    const config = readAssistantConfig(context.globalState);
                    parent = config.parent;
                    post({ type: 'wizardState', state: wizardState(config) });
                    break;
                }
                case 'pickParent': {
                    const folders = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: '选择工作目录'
                    });
                    if (!folders || folders.length === 0) {
                        post({ type: 'focusDir' });
                        break;
                    }
                    parent = folders[0].fsPath;
                    const saved = readAssistantConfig(context.globalState);
                    const config =
                        saved.parent === parent ? saved : { parent, folders: [], name: '' };
                    post({ type: 'wizardState', state: wizardState(config) });
                    break;
                }
                case 'dirChanged': {
                    const dir = (message.dir ?? '').trim();
                    if (!dir) {
                        break;
                    }
                    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
                        void vscode.window.showErrorMessage(`目录不存在：${dir}`);
                        break;
                    }
                    parent = dir;
                    post({
                        type: 'wizardState',
                        state: wizardState({ parent: dir, folders: [], name: '' })
                    });
                    break;
                }
                case 'create': {
                    if (!parent) {
                        break;
                    }
                    const folders = Array.isArray(message.folders) ? message.folders.map(String) : [];
                    if (folders.length === 0) {
                        void vscode.window.showErrorMessage('请至少选择一个项目文件夹。');
                        break;
                    }
                    // 同名直接覆盖写入 .code-workspace，然后打开有名字的工作区（重载窗口）
                    confirmWorkspace(context, parent, folders, message.name);
                    break;
                }
                case 'close': {
                    panel.dispose();
                    break;
                }
            }
        },
        undefined,
        context.subscriptions
    );
}
