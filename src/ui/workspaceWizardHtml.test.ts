import { describe, it, expect } from 'vitest';
import { buildWizardHtml, WizardViewState } from './workspaceWizardHtml';

function state(overrides: Partial<WizardViewState> = {}): WizardViewState {
    return {
        parent: undefined,
        subdirs: [],
        defaultName: 'bug_list.code-workspace',
        exists: false,
        ...overrides
    };
}

describe('buildWizardHtml', () => {
    it('未选择父目录时只显示选择按钮', () => {
        const html = buildWizardHtml(state());
        expect(html).toContain('选择父目录');
        expect(html).not.toContain('创建并打开');
        expect(html).not.toContain('value="bug_list.code-workspace"');
    });

    it('选择父目录后列出子文件夹并带默认文件名，未存在时「创建并打开」可见', () => {
        const html = buildWizardHtml(
            state({ parent: 'D:\\bug_list', subdirs: ['D:\\bug_list\\BUG-1', 'D:\\bug_list\\BUG-2'] })
        );
        expect(html).toContain('D:\\bug_list');
        expect(html).toContain('BUG-1');
        expect(html).toContain('BUG-2');
        expect(html).toContain('value="bug_list.code-workspace"');
        expect(html).toContain('<button id="create" class="primary">创建并打开</button>');
        expect(html).toContain('<button id="load" class="primary" hidden>直接加载</button>');
    });

    it('文件已存在时「直接加载」「覆盖重建」可见，「创建并打开」隐藏', () => {
        const html = buildWizardHtml(
            state({ parent: 'D:\\bug_list', subdirs: ['D:\\bug_list\\BUG-1'], exists: true })
        );
        expect(html).toContain('<button id="create" class="primary" hidden>创建并打开</button>');
        expect(html).toContain('<button id="load" class="primary">直接加载</button>');
        expect(html).toContain('<button id="overwrite">覆盖重建</button>');
        expect(html).toContain('该工作区文件已存在');
    });

    it('包含文件名输入监听与存在性消息处理脚本', () => {
        const html = buildWizardHtml(state({ parent: 'D:\\x', subdirs: [] }));
        expect(html).toContain("vscode.postMessage({ type: 'nameChanged', name: e.target.value })");
        expect(html).toContain("msg.type === 'exists'");
        expect(html).toContain('showButtons()');
    });

    it('模态遮罩弹层：overlay + 居中卡片 + 关闭按钮', () => {
        const html = buildWizardHtml(state());
        expect(html).toContain('class="overlay"');
        expect(html).toContain('class="modal"');
        expect(html).toContain('id="close"');
        expect(html).toContain("vscode.postMessage({ type: 'close' })");
        expect(html).toContain('e.target === e.currentTarget');
    });

    it('子文件夹名做 HTML 转义（防注入）', () => {
        const html = buildWizardHtml(
            state({ parent: 'D:\\x', subdirs: ['D:\\x\\<script>alert(1)</script>'] })
        );
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;');
    });
});
