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
});
