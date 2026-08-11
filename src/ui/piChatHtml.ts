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
  .msg.system { color: var(--vscode-descriptionForeground); font-size: 11px; }
  #input-row { display: flex; gap: 6px; padding: 8px 12px; border-top: 1px solid var(--vscode-panel-border); }
  #input { flex: 1; padding: 5px 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); }
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
    <div id="input-row">
      <input id="input" placeholder="输入消息，Enter 发送…">
      <button id="send">发送</button>
      <button id="abort" title="停止生成">停止</button>
    </div>
  </div>
</div>
<script>
  const vscode = acquireVsCodeApi();
  const renderSession = (data) => {
    streaming = false;
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
  // 流式状态：assistant 增量追加到同一条消息，直到 chatEnd 或 user/system 消息打断
  let streaming = false;
  const appendChat = (role, text) => {
    if (role === 'system' || role === 'user') streaming = false;
    const list = document.getElementById('chat-messages');
    const last = list.lastElementChild;
    if (role === 'assistant' && streaming && last && last.classList.contains('assistant')) {
      const body = last.querySelector('.body');
      if (body) { body.textContent += text; return; }
    }
    const group = document.createElement('div');
    group.className = 'msg ' + role;
    if (role !== 'assistant') {
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = role === 'user' ? '我' : role;
      group.appendChild(meta);
    }
    const body = document.createElement('div');
    body.className = 'body';
    body.textContent = text;
    group.appendChild(body);
    list.appendChild(group);
    if (role === 'assistant') streaming = true;
    list.scrollTop = list.scrollHeight;
  };
  const sendChat = () => {
    const input = document.getElementById('input');
    const text = input.value.trim();
    if (!text) return;
    appendChat('user', text);
    vscode.postMessage({ type: 'send', text });
    input.value = '';
  };
  document.getElementById('send').addEventListener('click', sendChat);
  document.getElementById('abort').addEventListener('click', () => vscode.postMessage({ type: 'abort' }));
  document.getElementById('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
    else if (e.key === 'Escape') { vscode.postMessage({ type: 'abort' }); }
  });
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg) return;
    if (msg.type === 'session') renderSession(msg);
    else if (msg.type === 'chat') appendChat(msg.role, msg.text || '');
    else if (msg.type === 'chatEnd') streaming = false;
  });
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
