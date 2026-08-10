import { escapeHtml } from './html';
import { NEW_ISSUE_COMMAND } from './messages';

/** 引导界面状态（父目录 + 子文件夹 + 预勾选 + 文件名 + 文件是否存在）。 */
export interface AssistantWizardState {
    parent: string | undefined;
    subdirs: string[];
    selected: string[];
    defaultName: string;
    exists: boolean;
}

/** Webview → 宿主的消息（判别联合）。 */
export type AssistantViewMessage =
    | { type: 'ready' }
    | { type: 'pickParent' }
    | { type: 'nameChanged'; name: string }
    | { type: 'create'; folders: string[]; name: string }
    | { type: 'load'; name: string }
    | { type: 'overwrite'; folders: string[]; name: string }
    | { type: 'backToWizard' }
    | { type: 'send'; text: string };

/** 宿主 → Webview 的消息（判别联合）。 */
export type AssistantHostMessage =
    | { type: 'wizardState'; state: AssistantWizardState }
    | { type: 'exists'; exists: boolean }
    | { type: 'chat'; role: 'assistant' | 'system'; text: string }
    | { type: 'phase'; phase: 'wizard' | 'chat' };

/** 引导区表单（父目录行 / 子文件夹勾选 / 文件名 / 按钮）。 */
function renderProjectSection(state: AssistantWizardState): string {
    if (!state.parent) {
        return '<button id="pick" class="primary">选择父目录…</button>';
    }
    const rows = state.subdirs
        .map((d) => {
            const name = d.split(/[\\/]/).filter(Boolean).pop() ?? d;
            const checked = state.selected.includes(d) ? ' checked' : '';
            return `<label class="row"><input type="checkbox" value="${escapeHtml(d)}"${checked}> ${escapeHtml(name)}</label>`;
        })
        .join('');
    const actions =
        `<button id="create" class="primary"${state.exists ? ' hidden' : ''}>确认并进入聊天</button>` +
        `<button id="load" class="primary"${state.exists ? '' : ' hidden'}>直接加载</button>` +
        `<button id="overwrite"${state.exists ? '' : ' hidden'}>覆盖重建</button>`;
    return (
        `<p>父目录：<code>${escapeHtml(state.parent)}</code></p>` +
        `<div id="subdirs">${rows || '<p class="hint">（该目录下没有子文件夹）</p>'}</div>` +
        `<p>工作区文件名：<input id="name" value="${escapeHtml(state.defaultName)}"></p>` +
        `<div id="actions">${actions}</div>` +
        `<p id="exists-hint" class="hint"${state.exists ? '' : ' hidden'}>该工作区文件已存在：可直接加载，或覆盖重建（会改写文件）。</p>`
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
  .section { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 10px 12px; }
  h2 { margin: 0 0 10px; font-size: 13px; }
  .hint { color: var(--vscode-descriptionForeground); font-size: 12px; }
  code { word-break: break-all; }
  #subdirs { max-height: 220px; overflow-y: auto; border: 1px solid var(--vscode-panel-border); padding: 8px; margin: 8px 0; }
  .row { display: block; padding: 3px 0; }
  #name { width: 100%; box-sizing: border-box; padding: 4px 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); }
  button { margin-right: 6px; }
  button.primary { font-weight: 600; }
  .chat-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 6px; margin-bottom: 8px; }
  .chat-head b { font-size: 12px; }
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
  <h2>创建多根工作区</h2>
  <div id="project-section">${renderProjectSection(state)}</div>
</div>
<div id="chat-section" class="section" hidden>
  <div class="chat-head">
    <b>AI 工作台助手</b>
    <button id="back-to-wizard">返回引导</button>
  </div>
  <div id="messages"></div>
  <div id="input-row">
    <input id="input" placeholder="输入「${NEW_ISSUE_COMMAND}」创建新问题工作区（BUG-N），或输入其他指令…">
    <button id="send">发送</button>
  </div>
</div>
<script>
  const vscode = acquireVsCodeApi();
  let exists = ${state.exists ? 'true' : 'false'};
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const projectSection = document.getElementById('project-section');
  const showButtons = () => {
    const create = document.getElementById('create');
    if (!create) { return; }
    create.hidden = exists;
    document.getElementById('load').hidden = !exists;
    document.getElementById('overwrite').hidden = !exists;
    document.getElementById('exists-hint').hidden = !exists;
  };
  const renderWizard = (s) => {
    if (!s.parent) {
      projectSection.innerHTML = '<button id="pick" class="primary">选择父目录…</button>';
    } else {
      const rows = (s.subdirs || []).map((d) => {
        const name = d.split(/[\\\\/]/).filter(Boolean).pop() ?? d;
        const checked = (s.selected || []).includes(d) ? ' checked' : '';
        return '<label class="row"><input type="checkbox" value="' + esc(d) + '"' + checked + '> ' + esc(name) + '</label>';
      }).join('');
      const actions =
        '<button id="create" class="primary"' + (s.exists ? ' hidden' : '') + '>确认并进入聊天</button>' +
        '<button id="load" class="primary"' + (s.exists ? '' : ' hidden') + '>直接加载</button>' +
        '<button id="overwrite"' + (s.exists ? '' : ' hidden') + '>覆盖重建</button>';
      projectSection.innerHTML =
        '<p>父目录：<code>' + esc(s.parent) + '</code></p>' +
        '<div id="subdirs">' + (rows || '<p class="hint">（该目录下没有子文件夹）</p>') + '</div>' +
        '<p>工作区文件名：<input id="name" value="' + esc(s.defaultName) + '"></p>' +
        '<div id="actions">' + actions + '</div>' +
        '<p id="exists-hint" class="hint"' + (s.exists ? '' : ' hidden') + '>该工作区文件已存在：可直接加载，或覆盖重建（会改写文件）。</p>';
    }
    exists = !!s.exists;
    wireWizardEvents();
    showButtons();
  };
  const wireWizardEvents = () => {
    document.getElementById('pick')?.addEventListener('click', () => vscode.postMessage({ type: 'pickParent' }));
    document.getElementById('create')?.addEventListener('click', () => vscode.postMessage({ type: 'create', ...collect() }));
    document.getElementById('load')?.addEventListener('click', () => vscode.postMessage({ type: 'load', ...collect() }));
    document.getElementById('overwrite')?.addEventListener('click', () => vscode.postMessage({ type: 'overwrite', ...collect() }));
    document.getElementById('name')?.addEventListener('input', (e) => vscode.postMessage({ type: 'nameChanged', name: e.target.value }));
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
  document.getElementById('back-to-wizard').addEventListener('click', () => vscode.postMessage({ type: 'backToWizard' }));
  const showPhase = (phase) => {
    document.getElementById('wizard-section').hidden = phase !== 'wizard';
    document.getElementById('chat-section').hidden = phase !== 'chat';
  };
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg) { return; }
    if (msg.type === 'wizardState') { renderWizard(msg.state); }
    else if (msg.type === 'exists') { exists = !!msg.exists; showButtons(); }
    else if (msg.type === 'chat') { addChat(msg.role === 'assistant' ? 'assistant' : 'system', msg.text); }
    else if (msg.type === 'phase') { showPhase(msg.phase); }
  });
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
