import { describe, it, expect } from 'vitest';
import { buildWizardDialogHtml } from './wizardDialogHtml';
import { AssistantWizardState } from './assistantViewHtml';

function state(overrides: Partial<AssistantWizardState> = {}): AssistantWizardState {
    return {
        parent: undefined,
        subdirs: [],
        selected: [],
        defaultName: 'bug_list.code-workspace',
        ...overrides
    };
}

describe('buildWizardDialogHtml', () => {
    it('模态遮罩 + 居中卡片 + 标题与关闭按钮', () => {
        const html = buildWizardDialogHtml(state());
        expect(html).toContain('class="overlay"');
        expect(html).toContain('class="modal"');
        expect(html).toContain('选择工作目录');
        expect(html).toContain('id="close"');
        expect(html).toContain("vscode.postMessage({ type: 'close' })");
        expect(html).toContain('e.target === e.currentTarget');
    });

    it('未选目录时显示工作目录输入框（服务端无文件名/确认按钮）', () => {
        const html = buildWizardDialogHtml(state());
        expect(html).toContain('id="dir"');
        expect(html).toContain('点击选择');
        expect(html).not.toContain('value="bug_list.code-workspace"');
    });

    it('选择目录后列出子文件夹、文件名与确认按钮，回填勾选', () => {
        const html = buildWizardDialogHtml(
            state({
                parent: 'D:\\bug_list',
                subdirs: ['D:\\bug_list\\BUG-1', 'D:\\bug_list\\BUG-2'],
                selected: ['D:\\bug_list\\BUG-1'],
                defaultName: 'bug_list.code-workspace'
            })
        );
        expect(html).toContain('id="dir"');
        expect(html).toContain('value="D:\\bug_list"');
        expect(html).toContain('BUG-1');
        expect(html).toContain('BUG-2');
        expect(html).toContain('value="bug_list.code-workspace"');
        expect(html).toMatch(/value="D:\\bug_list\\BUG-1"[^>]*checked/);
        expect(html).not.toMatch(/value="D:\\bug_list\\BUG-2"[^>]*checked/);
        expect(html).toContain('<button id="create" class="primary">确认并进入聊天</button>');
    });

    it('包含引导交互脚本（点击选目录/输入目录/确认）与初始事件绑定', () => {
        const html = buildWizardDialogHtml(state());
        expect(html).toContain("vscode.postMessage({ type: 'pickParent' })");
        expect(html).toContain("vscode.postMessage({ type: 'dirChanged', dir: dirInput.value.trim() })");
        expect(html).toContain("vscode.postMessage({ type: 'create', folders, name");
        expect(html).toContain("msg.type === 'wizardState'");
        expect(html).toMatch(/wireWizardEvents\(\);\s*\n\s*vscode\.postMessage\(\{ type: 'ready' \}\)/);
    });
});
