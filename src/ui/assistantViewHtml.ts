import { escapeHtml } from './html';
import { NEW_ISSUE_COMMAND } from './messages';

/** 引导界面状态（工作目录 + 子文件夹 + 预勾选 + 文件名）。 */
export interface AssistantWizardState {
    parent: string | undefined;
    subdirs: string[];
    selected: string[];
    defaultName: string;
}

/** Webview → 宿主的消息（判别联合）。 */
export type AssistantViewMessage =
    | { type: 'ready' }
    | { type: 'pickParent' }
    | { type: 'dirChanged'; dir: string }
    | { type: 'create'; folders: string[]; name: string }
    | { type: 'send'; text: string };

/** 宿主 → Webview 的消息（判别联合）。 */
export type AssistantHostMessage =
    | { type: 'wizardState'; state: AssistantWizardState }
    | { type: 'focusDir' }
    | { type: 'chat'; role: 'assistant' | 'system'; text: string }
    | { type: 'phase'; phase: 'wizard' | 'chat' };

/** 引导区表单（工作目录输入框 / 子文件夹勾选 / 文件名 / 确认按钮）。 */
function renderProjectSection(state: AssistantWizardState): string {
    const dirBox =
        `<input id="dir" placeholder="点击选择，或 Tab 聚焦后直接输入…" value="${escapeHtml(state.parent ?? '')}" title="点击弹出目录选择器；Tab 聚焦后可直接输入路径">`;
    if (!state.parent) {
        return dirBox;
    }
    const rows = state.subdirs
        .map((d) => {
            const name = d.split(/[\\/]/).filter(Boolean).pop() ?? d;
            const checked = state.selected.includes(d) ? ' checked' : '';
            return `<label class="row"><input type="checkbox" value="${escapeHtml(d)}"${checked}> ${escapeHtml(name)}</label>`;
        })
        .join('');
    return (
        dirBox +
        `<div id="subdirs">${rows || '<p class="hint">（该目录下没有子文件夹）</p>'}</div>` +
        `<p>工作区文件名：<input id="name" value="${escapeHtml(state.defaultName)}"></p>` +
        `<button id="create" class="primary">确认并进入聊天</button>`
    );
}

/** 构建侧边栏助手视图 HTML（纯函数，便于测试）。引导区 + 聊天区，JS 切换阶段。 */
export function buildAssistantViewHtml(state: AssistantWizardState): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; font-family: var(--vscode-font-family); height: 100vh; display: flex; flex-direction: column; }
  /* 确保 hidden 属性生效（.section 的 display:flex 会覆盖 UA 的 display:none） */
  [hidden] { display: none !important; }
  .section { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 10px 12px; }
  h2 { margin: 0 0 10px; font-size: 13px; }
  .hint { color: var(--vscode-descriptionForeground); font-size: 12px; }
  code { word-break: break-all; }
  #subdirs { max-height: 220px; overflow-y: auto; border: 1px solid var(--vscode-panel-border); padding: 8px; margin: 8px 0; }
  .row { display: block; padding: 3px 0; }
  #name { width: 100%; box-sizing: border-box; padding: 4px 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); }
  #dir { width: 100%; box-sizing: border-box; padding: 4px 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); }
  a { color: var(--vscode-textLink-foreground); cursor: pointer; }
  button { margin-right: 6px; }
  button.primary { font-weight: 600; }
  #messages { flex: 1; min-height: 0; overflow-y: auto; }
  .msg { margin-bottom: 8px; padding: 6px 8px; border-radius: 4px; white-space: pre-wrap; word-break: break-word; font-size: 12px; }
  .msg.user { background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.15)); }
  .msg.assistant { background: var(--vscode-editor-selectionBackground, rgba(127,127,127,0.25)); }
  .msg.system { color: var(--vscode-descriptionForeground); font-size: 11px; }
  #input-row { display: flex; gap: 6px; padding-top: 8px; border-top: 1px solid var(--vscode-panel-border); }
  #input { flex: 1; padding: 5px 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); }
</style>
</head>
<body>
<div id="wizard-section" class="section">
  <h2>选择工作目录</h2>
  <div id="project-section">${renderProjectSection(state)}</div>
</div>
<div id="chat-section" class="section" hidden>
  <div id="messages"></div>
  <div id="input-row">
    <input id="input" placeholder="输入「${NEW_ISSUE_COMMAND}」创建新问题工作区（BUG-N），或输入其他指令…">
    <button id="send">发送</button>
  </div>
</div>
<script>
  const vscode = acquireVsCodeApi();
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const projectSection = document.getElementById('project-section');
  const renderWizard = (s) => {
    const dirBox =
      '<input id="dir" placeholder="点击选择，或 Tab 聚焦后直接输入…" value="' + esc(s.parent || '') + '" title="点击弹出目录选择器；Tab 聚焦后可直接输入路径">';
    if (!s.parent) {
      projectSection.innerHTML = dirBox;
    } else {
      const rows = (s.subdirs || []).map((d) => {
        const name = d.split(/[\\\\/]/).filter(Boolean).pop() ?? d;
        const checked = (s.selected || []).includes(d) ? ' checked' : '';
        return '<label class="row"><input type="checkbox" value="' + esc(d) + '"' + checked + '> ' + esc(name) + '</label>';
      }).join('');
      projectSection.innerHTML =
        dirBox +
        '<div id="subdirs">' + (rows || '<p class="hint">（该目录下没有子文件夹）</p>') + '</div>' +
        '<p>工作区文件名：<input id="name" value="' + esc(s.defaultName) + '"></p>' +
        '<button id="create" class="primary">确认并进入聊天</button>';
    }
    wireWizardEvents();
  };
  const wireWizardEvents = () => {
    const dirInput = document.getElementById('dir');
    if (dirInput) {
      dirInput.addEventListener('mousedown', (e) => { e.preventDefault(); });
      dirInput.addEventListener('click', () => vscode.postMessage({ type: 'pickParent' }));
      dirInput.addEventListener('change', () => vscode.postMessage({ type: 'dirChanged', dir: dirInput.value.trim() }));
    }
    document.getElementById('create')?.addEventListener('click', () => vscode.postMessage({ type: 'create', ...collect() }));
  };
  const collect = () => {
    const folders = Array.from(document.querySelectorAll('#subdirs input:checked')).map((i) => i.value);
    const nameEl = document.getElementById('name');
    return { folders, name: nameEl ? nameEl.value : '' };
  };
  const messages = document.getElementById('messages');
  const addChat = (cls, text) => {
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
    addChat('user', text);
    vscode.postMessage({ type: 'send', text });
    input.value = '';
  };
  document.getElementById('send').addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { send(); } });
  const showPhase = (phase) => {
    document.getElementById('wizard-section').hidden = phase !== 'wizard';
    document.getElementById('chat-section').hidden = phase !== 'chat';
  };
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg) { return; }
    if (msg.type === 'wizardState') { renderWizard(msg.state); }
    else if (msg.type === 'focusDir') { document.getElementById('dir')?.focus(); }
    else if (msg.type === 'chat') { addChat(msg.role === 'assistant' ? 'assistant' : 'system', msg.text); }
    else if (msg.type === 'phase') { showPhase(msg.phase); }
  });
  // 初始元素由服务端渲染，加载后立即绑定事件（否则首次打开点击无反应）
  wireWizardEvents();
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
