import { Session, SessionContent } from '../domain/session';
import { AgentProvider } from '../agent/provider';
import { formatTime } from './format';

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * 处理查看器发来的消息：收到 resume 时通过注入的 run 恢复会话。
 * 纯函数（不依赖 VS Code），便于行为级测试。
 * @returns 是否处理了该消息
 */
export function handleViewerMessage(
    message: unknown,
    session: Session,
    provider: AgentProvider,
    run: (command: string) => void
): boolean {
    if (message && typeof message === 'object' && (message as { type?: unknown }).type === 'resume') {
        provider.resumeSession(session, run);
        return true;
    }
    return false;
}

/** 构建会话查看器的 HTML（纯函数，便于测试）。 */
export function buildHtml(title: string, content: SessionContent): string {
    const rows = content.messages
        .map((m) => {
            const cls = m.role === 'user' ? 'user' : 'assistant';
            const body = escapeHtml(m.text).replace(/\n/g, '<br>');
            return `<div class="msg ${cls}">
  <div class="meta">${escapeHtml(m.role)} · ${formatTime(m.timestamp)}</div>
  <div class="body">${body || '（空）'}</div>
</div>`;
        })
        .join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; display: flex; flex-direction: column; height: 100vh; font-family: var(--vscode-font-family); }
  #title { padding: 8px 12px; font-weight: 600; border-bottom: 1px solid var(--vscode-panel-border); }
  #messages { flex: 1; overflow-y: auto; padding: 12px; }
  .msg { margin-bottom: 12px; }
  .msg .meta { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 2px; }
  .msg .body { white-space: pre-wrap; word-break: break-word; }
  .msg.user { background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.15)); border-radius: 4px; padding: 4px 8px; }
  #input { padding: 8px 12px; border-top: 1px solid var(--vscode-panel-border); }
  #input input { width: 100%; box-sizing: border-box; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); }
</style>
</head>
<body>
<div id="title">${escapeHtml(title)}</div>
<div id="messages">${rows || '<p style="color:var(--vscode-descriptionForeground)">（无消息）</p>'}</div>
<div id="input"><input type="text" placeholder="点击此处继续对话（将在集成终端中恢复该会话）" readonly></div>
<script>
  const vscode = acquireVsCodeApi();
  const input = document.querySelector('#input input');
  input.addEventListener('focus', () => {
    vscode.postMessage({ type: 'resume' });
  });
</script>
</body>
</html>`;
}
