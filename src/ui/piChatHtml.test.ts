import { describe, it, expect } from 'vitest';
import { buildPiChatHtml } from './piChatHtml';

describe('buildPiChatHtml', () => {
    it('构建欢迎/空状态界面：含品牌标题与引导文案', () => {
        const html = buildPiChatHtml();
        expect(html).toContain('Pi 面板');
        expect(html).toContain('会话列表');
        expect(html).toContain('右键项目目录');
    });

    it('提示当前没有打开的会话', () => {
        const html = buildPiChatHtml();
        expect(html).toContain('当前还没有打开的会话');
    });

    it('包含 [hidden] 防御 CSS（不被后续 .section 的 display 覆盖）', () => {
        const html = buildPiChatHtml();
        expect(html).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important/);
    });

    it('webview 脚本加载后立即发 ready 消息（首次打开即握手）', () => {
        const html = buildPiChatHtml();
        expect(html).toContain('acquireVsCodeApi()');
        expect(html).toContain("vscode.postMessage({ type: 'ready' })");
    });

    it('包含隐藏的聊天区，可接收 session 消息渲染会话历史', () => {
        const html = buildPiChatHtml();
        expect(html).toContain('id="chat"');
        expect(html).toContain("msg.type === 'session'");
        expect(html).toContain('renderSession');
    });

    it('会话历史消息渲染使用 textContent（防注入）', () => {
        const html = buildPiChatHtml();
        expect(html).toContain('body.textContent');
        expect(html).toContain('meta.textContent');
    });

    it('聊天区含输入框与发送/取消按钮', () => {
        const html = buildPiChatHtml();
        expect(html).toContain('id="input"');
        expect(html).toContain('id="send"');
        expect(html).toContain('id="abort"');
    });

    it('脚本支持发送消息与取消（postMessage send/abort，含 Esc）', () => {
        const html = buildPiChatHtml();
        expect(html).toContain("vscode.postMessage({ type: 'send'");
        expect(html).toContain("vscode.postMessage({ type: 'abort' })");
        expect(html).toContain("e.key === 'Escape'");
    });

    it('脚本监听 chat 消息流式追加与 chatEnd 结束标记', () => {
        const html = buildPiChatHtml();
        expect(html).toContain("msg.type === 'chat'");
        expect(html).toContain("msg.type === 'chatEnd'");
    });
});
