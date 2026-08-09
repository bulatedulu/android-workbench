import { NEW_ISSUE_COMMAND } from './messages';

/** 构建居中助手窗口的聊天界面 HTML（纯函数，便于测试）。 */
export function buildAssistantChatHtml(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; display: flex; flex-direction: column; height: 100vh; font-family: var(--vscode-font-family); }
  #messages { flex: 1; overflow-y: auto; padding: 12px; }
  .msg { margin-bottom: 10px; padding: 8px 10px; border-radius: 6px; white-space: pre-wrap; word-break: break-word; }
  .msg.user { background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.15)); }
  .msg.assistant { background: var(--vscode-editor-selectionBackground, rgba(127,127,127,0.25)); }
  .msg.system { color: var(--vscode-descriptionForeground); font-size: 12px; }
  #input-row { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--vscode-panel-border); }
  #input { flex: 1; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); }
  #send { padding: 6px 14px; }
</style>
</head>
<body>
<div id="messages"></div>
<div id="input-row">
  <input id="input" placeholder="输入「${NEW_ISSUE_COMMAND}」创建新问题工作区（BUG-N），或输入其他指令…">
  <button id="send">发送</button>
</div>
<script>
  const vscode = acquireVsCodeApi();
  const messages = document.getElementById('messages');
  const add = (cls, text) => {
    const div = document.createElement('div');
    div.className = 'msg ' + cls;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  };
  const input = document.getElementById('input');
  const send = () => {
    const text = input.value.trim();
    if (!text) { return; }
    add('user', text);
    vscode.postMessage({ type: 'send', text });
    input.value = '';
  };
  document.getElementById('send').addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { send(); } });
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg && msg.type === 'chat') {
      add(msg.role === 'assistant' ? 'assistant' : 'system', msg.text);
    }
  });
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
