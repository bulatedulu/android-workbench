import { escapeHtml } from './html';
import { AssistantWizardState } from './assistantViewHtml';

/** Webview → 宿主的消息（判别联合，弹窗只需要引导相关）。 */
export type WizardDialogMessage =
    | { type: 'ready' }
    | { type: 'pickParent' }
    | { type: 'dirChanged'; dir: string }
    | { type: 'create'; folders: string[]; name: string }
    | { type: 'close' };

/** 宿主 → Webview 的消息。 */
export type WizardDialogHostMessage =
    | { type: 'wizardState'; state: AssistantWizardState }
    | { type: 'focusDir' };

/** 引导表单（目录输入框 / 子文件夹勾选 / 文件名 / 确认按钮）。 */
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

/** 构建「引导弹窗」HTML（纯函数，便于测试）：模态遮罩 + 居中卡片，内容为引导表单。 */
export function buildWizardDialogHtml(state: AssistantWizardState): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; font-family: var(--vscode-font-family); height: 100vh; }
  .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); display: flex; align-items: center; justify-content: center; }
  .modal { width: min(560px, 92vw); max-height: 84vh; display: flex; flex-direction: column; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45); overflow: hidden; }
  .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--vscode-panel-border); }
  .modal-head h2 { margin: 0; font-size: 14px; font-weight: 600; }
  #close { background: none; border: none; cursor: pointer; color: var(--vscode-descriptionForeground); font-size: 16px; padding: 2px 6px; line-height: 1; }
  #close:hover { color: var(--vscode-foreground); }
  .modal-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 20px; }
  #dir, #name { width: 100%; box-sizing: border-box; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); }
  #subdirs { max-height: 260px; overflow-y: auto; border: 1px solid var(--vscode-panel-border); padding: 8px; margin: 10px 0; }
  .row { display: block; padding: 3px 0; }
  .hint { color: var(--vscode-descriptionForeground); font-size: 12px; }
  button.primary { font-weight: 600; padding: 6px 16px; }
</style>
</head>
<body>
<div class="overlay">
  <div class="modal">
    <div class="modal-head">
      <h2>选择工作目录</h2>
      <button id="close" title="关闭">✕</button>
    </div>
    <div class="modal-body" id="project-section">${renderProjectSection(state)}</div>
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
    document.getElementById('create')?.addEventListener('click', () => {
      const folders = Array.from(document.querySelectorAll('#subdirs input:checked')).map((i) => i.value);
      const nameEl = document.getElementById('name');
      vscode.postMessage({ type: 'create', folders, name: nameEl ? nameEl.value : '' });
    });
  };
  const close = () => vscode.postMessage({ type: 'close' });
  document.getElementById('close').addEventListener('click', close);
  document.querySelector('.overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) { close(); }
  });
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg) { return; }
    if (msg.type === 'wizardState') { renderWizard(msg.state); }
    else if (msg.type === 'focusDir') { document.getElementById('dir')?.focus(); }
  });
  wireWizardEvents();
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
