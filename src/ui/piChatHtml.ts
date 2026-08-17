/** 构建 Pi 面板 HTML（纯函数，便于测试）：欢迎/空状态 + 隐藏聊天区（渲染会话历史）。 */
export function buildPiChatHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; height: 100vh; display: flex; flex-direction: column; font-family: var(--vscode-font-family); -webkit-font-smoothing: antialiased; }
  /* 滚动条：细窄圆角，贴合面板 */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background, rgba(127,127,127,0.4)); border-radius: 4px; border: 2px solid transparent; background-clip: content-box; }
  ::-webkit-scrollbar-thumb:hover { background-color: var(--vscode-scrollbarSlider-hoverBackground, rgba(127,127,127,0.6)); }
  ::-webkit-scrollbar-track { background: transparent; }
  /* 确保 hidden 属性生效（避免后续 .section 的 display:flex 覆盖） */
  [hidden] { display: none !important; }
  /* 根容器撑满窗口：welcome/chat 在内部 flex 布局，输入框固定在最底部 */
  #pi-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  #welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; gap: 12px; }
  .pi-logo { width: 52px; height: 52px; border-radius: 14px; background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.15)); color: var(--vscode-descriptionForeground); font-size: 26px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .brand { font-size: 20px; font-weight: 600; }
  .hint { color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 1.7; max-width: 260px; }
  code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; }
  /* 聊天区 */
  #chat { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  #chat-title { padding: 10px 12px; font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--vscode-panel-border); }
  #chat-messages { flex: 1; overflow-y: auto; padding: 12px 14px; }
  .msg { margin-bottom: 12px; animation: msgIn 0.18s ease; }
  @keyframes msgIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  .msg .body { white-space: pre-wrap; word-break: break-word; font-size: 12.5px; line-height: 1.6; }
  .msg .meta { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
  /* 用户消息：右侧灰色圆角矩形 */
  .msg.user { display: flex; flex-direction: column; align-items: flex-end; }
  .msg.user .meta { display: none; }
  .msg.user .body { background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.15)); border-radius: 8px; padding: 7px 12px; max-width: 85%; }
  /* AI 消息：纯文字，无徽标无包裹 */
  .msg.assistant .meta { display: none; }
  .msg.assistant .body { padding-top: 2px; }
  /* 系统消息：居中灰色 */
  .msg.system { text-align: center; color: var(--vscode-descriptionForeground); font-size: 11px; }
  /* 输入区：Copilot 风格（上下文区 + 多行输入 + 工具条） */
  #input-row { padding: 8px 12px 14px; }
  #input-box { display: flex; flex-direction: column; gap: 4px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); border-radius: 8px; padding: 10px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: border-color 0.15s, box-shadow 0.15s; }
  #input-box:hover { border-color: var(--vscode-input-border, var(--vscode-focusBorder)); }
  #input-box:focus-within { border-color: var(--vscode-focusBorder); box-shadow: 0 0 0 1px var(--vscode-focusBorder); }
  /* 上下文选择区：选中的文件/文本 chip，可移除 */
  #context-area { display: flex; flex-wrap: wrap; gap: 4px; max-height: 64px; overflow-y: auto; }
  .ctx-chip { display: inline-flex; align-items: center; gap: 4px; background: var(--vscode-badge-background, rgba(127,127,127,0.2)); color: var(--vscode-badge-foreground, var(--vscode-foreground)); padding: 2px 8px; font-size: 11px; max-width: 220px; }
  .ctx-chip .ctx-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #input { flex: 1; min-height: 32px; border: none; outline: none; background: transparent; color: var(--vscode-input-foreground); resize: none; font-family: var(--vscode-font-family); font-size: 13px; line-height: 1.5; max-height: 120px; padding: 6px 2px; }
  /* 工具条：+ Agent 模型 思考 工具 … 语音 ↑ */
  #toolbar { display: flex; align-items: center; gap: 3px; }
  .tb-btn { width: 26px; height: 26px; border: none; border-radius: 6px; background: transparent; color: var(--vscode-descriptionForeground); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px; }
  .tb-btn:hover { background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.2)); }
  .chip { display: inline-flex; align-items: center; gap: 4px; border-radius: 6px; background: transparent; color: var(--vscode-descriptionForeground); padding: 2px 6px; font-size: 11px; cursor: pointer; white-space: nowrap; }
  .chip:hover { color: var(--vscode-foreground); background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.15)); }
  .tb-spacer { flex: 1; }
  #send, #abort { width: 28px; height: 28px; min-width: 28px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; background: var(--vscode-button-background); color: var(--vscode-button-foreground); transition: opacity 0.15s; }
  #send:disabled { opacity: 0.4; cursor: default; }
  #send::before { content: '↑'; font-size: 17px; font-weight: 700; }
  #abort::before { content: '■'; font-size: 13px; }
</style>
</head>
<body>
<div id="pi-panel">
  <div id="welcome">
    <div class="pi-logo">π</div>
    <div class="brand">Pi 面板</div>
    <div class="hint">右键项目目录 → 选择「会话列表」<br>即可打开或开启该目录下的 Pi 会话。</div>
    <div class="hint">当前还没有打开的会话。</div>
  </div>
  <div id="chat" hidden>
    <div id="chat-title"></div>
    <div id="chat-messages"></div>
    <div id="input-row">
      <div id="input-box">
        <div id="context-area" hidden></div>
        <textarea id="input" rows="1" placeholder="输入消息…"></textarea>
        <div id="toolbar">
          <button class="tb-btn" id="add-context" title="添加上下文（暂未支持）">＋</button>
          <span class="chip" id="agent-chip" title="Agent（暂未支持）">Agent: pi</span>
          <span class="chip" id="model-chip" title="模型（暂未支持）">默认</span>
          <span class="chip" id="thinking-chip" title="思考等级（暂未支持）">off</span>
          <button class="tb-btn" id="tools-btn" title="工具列表（暂未支持）">⚙</button>
          <div class="tb-spacer"></div>
          <button class="tb-btn" id="mic-btn" title="语音输入（暂未支持）">🎙</button>
          <button id="send" title="发送" disabled></button>
          <button id="abort" title="停止生成" hidden></button>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
  const vscode = acquireVsCodeApi();
  // 流式状态：assistant 增量追加到同一条消息，直到 chatEnd 或 user/system 消息打断
  let streaming = false;
  const input = document.getElementById('input');
  const sendBtn = document.getElementById('send');
  const abortBtn = document.getElementById('abort');
  // 多行自动增高 + 空内容禁用发送
  const autosize = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    sendBtn.disabled = !input.value.trim();
  };
  // 生成中：隐藏发送、显示停止
  const updateButtons = () => {
    sendBtn.hidden = streaming;
    abortBtn.hidden = !streaming;
  };
  const renderSession = (data) => {
    streaming = false;
    updateButtons();
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
    updateButtons();
  };
  const sendChat = () => {
    const text = input.value.trim();
    if (!text) return;
    appendChat('user', text);
    vscode.postMessage({ type: 'send', text });
    input.value = '';
    autosize();
  };
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    else if (e.key === 'Escape') { vscode.postMessage({ type: 'abort' }); }
  });
  sendBtn.addEventListener('click', sendChat);
  abortBtn.addEventListener('click', () => vscode.postMessage({ type: 'abort' }));
  autosize();
  updateButtons();
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg) return;
    if (msg.type === 'session') renderSession(msg);
    else if (msg.type === 'chat') appendChat(msg.role, msg.text || '');
    else if (msg.type === 'chatEnd') { streaming = false; updateButtons(); }
  });
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
