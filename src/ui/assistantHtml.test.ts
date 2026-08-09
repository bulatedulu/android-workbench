import { describe, it, expect } from 'vitest';
import { buildAssistantChatHtml } from './assistantHtml';

describe('buildAssistantChatHtml', () => {
    it('包含消息区、输入框与发送按钮', () => {
        const html = buildAssistantChatHtml();
        expect(html).toContain('id="messages"');
        expect(html).toContain('id="input"');
        expect(html).toContain('id="send"');
    });

    it('占位提示「分析新问题」指令', () => {
        const html = buildAssistantChatHtml();
        expect(html).toContain('分析新问题');
    });

    it('包含发送与消息处理脚本', () => {
        const html = buildAssistantChatHtml();
        expect(html).toContain("vscode.postMessage({ type: 'send', text })");
        expect(html).toContain("msg.type === 'chat'");
    });

    it('模态遮罩弹层：overlay + 居中卡片 + 关闭按钮', () => {
        const html = buildAssistantChatHtml();
        expect(html).toContain('class="overlay"');
        expect(html).toContain('class="modal"');
        expect(html).toContain('id="close"');
        expect(html).toContain("vscode.postMessage({ type: 'close' })");
        expect(html).toContain('e.target === e.currentTarget');
    });
});
