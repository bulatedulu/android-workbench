import { describe, it, expect } from 'vitest';
import { buildAssistantViewHtml, AssistantWizardState } from './assistantViewHtml';

function state(overrides: Partial<AssistantWizardState> = {}): AssistantWizardState {
    return {
        parent: undefined,
        subdirs: [],
        selected: [],
        defaultName: 'bug_list.code-workspace',
        exists: false,
        ...overrides
    };
}

describe('buildAssistantViewHtml', () => {
    it('包含引导区与聊天区两个阶段', () => {
        const html = buildAssistantViewHtml(state());
        expect(html).toContain('id="wizard-section"');
        expect(html).toContain('id="chat-section"');
        expect(html).toContain('id="messages"');
        expect(html).toContain('id="input"');
        expect(html).toContain('id="send"');
    });

    it('聊天区默认 hidden，且 CSS 强制 [hidden] 生效（不被 .section 的 display:flex 覆盖）', () => {
        const html = buildAssistantViewHtml(state());
        expect(html).toContain('<div id="chat-section" class="section" hidden>');
        expect(html).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important/);
    });

    it('未选父目录时包含选择按钮（初始渲染引导区）', () => {
        const html = buildAssistantViewHtml(state());
        expect(html).toContain('id="pick"');
        expect(html).toContain('选择父目录');
    });

    it('选择父目录后列出子文件夹并回填勾选与文件名', () => {
        const html = buildAssistantViewHtml(
            state({
                parent: 'D:\\bug_list',
                subdirs: ['D:\\bug_list\\BUG-1', 'D:\\bug_list\\BUG-2', 'D:\\bug_list\\BUG-3'],
                selected: ['D:\\bug_list\\BUG-1', 'D:\\bug_list\\BUG-3'],
                defaultName: 'bug_list.code-workspace',
                exists: false
            })
        );
        expect(html).toContain('D:\\bug_list');
        expect(html).toContain('BUG-1');
        expect(html).toContain('BUG-2');
        expect(html).toContain('value="bug_list.code-workspace"');
        // 勾选的预选，未勾选的不带 checked
        expect(html).toMatch(/value="D:\\bug_list\\BUG-1"[^>]*checked/);
        expect(html).not.toMatch(/value="D:\\bug_list\\BUG-2"[^>]*checked/);
        expect(html).toMatch(/value="D:\\bug_list\\BUG-3"[^>]*checked/);
        expect(html).toContain('确认并进入聊天');
    });

    it('文件已存在时显示「直接加载」「覆盖重建」，确认按钮隐藏', () => {
        const html = buildAssistantViewHtml(
            state({ parent: 'D:\\bug_list', subdirs: ['D:\\bug_list\\BUG-1'], exists: true })
        );
        expect(html).toContain('<button id="load" class="primary">直接加载</button>');
        expect(html).toContain('<button id="overwrite">覆盖重建</button>');
        expect(html).toContain('<button id="create" class="primary" hidden>确认并进入聊天</button>');
    });

    it('包含阶段切换与消息处理脚本', () => {
        const html = buildAssistantViewHtml(state());
        expect(html).toContain('showPhase');
        expect(html).toContain("msg.type === 'wizardState'");
        expect(html).toContain("msg.type === 'chat'");
        expect(html).toContain("msg.type === 'phase'");
        expect(html).toContain("vscode.postMessage({ type: 'pickParent' })");
        expect(html).toContain("vscode.postMessage({ type: 'send', text })");
    });

    it('子文件夹名做 HTML 转义（防注入）', () => {
        const html = buildAssistantViewHtml(
            state({ parent: 'D:\\x', subdirs: ['D:\\x\\<script>alert(1)</script>'] })
        );
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;');
    });
});
