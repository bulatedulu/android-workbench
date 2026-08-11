/** 构建 Pi 面板 HTML（纯函数，便于测试）：欢迎/空状态 + 隐藏聊天区（渲染会话历史）。 */
export function buildPiChatHtml(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; height: 100vh; display: flex; flex-direction: column; font-family: var(--vscode-font-family); }
  /* 确保 hidden 属性生效（避免后续 .section 的 display:flex 覆盖） */
  [hidden] { display: none !important; }
  #welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; gap: 10px; }
  .brand { font-size: 20px; font-weight: 600; }
  .hint { color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 1.7; }
  code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; }
  /* 聊天区 */
  #chat { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  #chat-title { padding: 8px 12px; font-weight: 600; border-bottom: 1px solid var(--vscode-panel-border); }
  #chat-messages { flex: 1; overflow-y: auto; padding: 10px 12px; }
  .msg { margin-bottom: 10px; }
  .msg .meta { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 2px; }
  .msg .body { white-space: pre-wrap; word-break: break-word; font-size: 12px; }
  .msg.user { background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.15)); border-radius: 4px; padding: 4px 8px; }
  .msg.assistant .body { padding: 2px 0; }
</style>
</head>
<body>
<div id="pi-panel">
  <div id="welcome">
    <div class="brand">Pi 面板</div>
    <div class="hint">右键项目目录 → 选择「会话列表」<br>即可打开或开启该目录下的 Pi 会话。</div>
    <div class="hint">当前还没有打开的会话。</div>
  </div>
  <div id="chat" hidden>
    <div id="chat-title"></div>
    <div id="chat-messages"></div>
  </div>
</div>
<script>
  const vscode = acquireVsCodeApi();
  const renderSession = (data) => {
    document.getElementById('chat-title').textContent = data.title || '';
    const list = document.getElementById('chat-messages');
    list.textContent = '';
    for (const m of data.messages || []) {
      const group = document.createElement('div');
      group.className = 'msg ' + (m.role === 'user' ? 'user' : 'assistant');
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = (m.role === 'user' ? '我' : m.role) + (m.time ? ' · ' + m.time : '');
      const body = document.createElement('div');
      body.className = 'body';
      body.textContent = m.text || '（空）';
      group.appendChild(meta);
      group.appendChild(body);
      list.appendChild(group);
    }
    document.getElementById('welcome').hidden = true;
    document.getElementById('chat').hidden = false;
  };
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg) return;
    if (msg.type === 'session') renderSession(msg);
  });
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
