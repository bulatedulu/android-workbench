import { escapeHtml } from './html';

export interface WizardViewState {
    /** 已选择的父目录；未选择时为 undefined */
    parent: string | undefined;
    /** 父目录下的子文件夹（绝对路径） */
    subdirs: string[];
    /** 工作区文件名默认值 */
    defaultName: string;
    /** 目标工作区文件是否已存在 */
    exists: boolean;
}

/** Webview → 宿主的消息（判别联合）。 */
export type WizardMessage =
    | { type: 'pickParent' }
    | { type: 'create'; folders: string[]; name: string }
    | { type: 'load'; name: string }
    | { type: 'overwrite'; folders: string[]; name: string }
    | { type: 'nameChanged'; name: string };

/** 宿主 → Webview 的消息。 */
export type WizardHostMessage = { type: 'exists'; exists: boolean };

/** 构建多根工作区引导面板的 HTML（纯函数，便于测试）。 */
export function buildWizardHtml(state: WizardViewState): string {
    const rows = state.subdirs
        .map((d) => {
            const name = d.split(/[\\/]/).filter(Boolean).pop() ?? d;
            return `<label class="row"><input type="checkbox" value="${escapeHtml(d)}" checked> ${escapeHtml(name)}</label>`;
        })
        .join('');

    const actions = `
    <button id="create" class="primary"${state.exists ? ' hidden' : ''}>创建并打开</button>
    <button id="load" class="primary"${state.exists ? '' : ' hidden'}>直接加载</button>
    <button id="overwrite"${state.exists ? '' : ' hidden'}>覆盖重建</button>`;

    const projectSection = state.parent
        ? `<p>父目录：<code>${escapeHtml(state.parent)}</code></p>
           <div id="subdirs">${rows || '<p class="hint">（该目录下没有子文件夹）</p>'}</div>
           <p>工作区文件名：<input id="name" value="${escapeHtml(state.defaultName)}"></p>
           <div id="actions">${actions}</div>
           <p id="existsHint" class="hint"${state.exists ? '' : ' hidden'}>该工作区文件已存在：可直接加载，或覆盖重建（会改写文件）。</p>`
        : '<button id="pick" class="primary">选择父目录…</button>';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: var(--vscode-font-family); padding: 16px 24px; max-width: 640px; }
  h2 { margin-top: 0; }
  .row { display: block; padding: 4px 0; }
  #subdirs { max-height: 280px; overflow-y: auto; border: 1px solid var(--vscode-panel-border); padding: 8px; margin-bottom: 8px; }
  #name { width: 320px; padding: 4px 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); }
  button { margin-right: 8px; }
  button.primary { font-weight: 600; }
  .hint { color: var(--vscode-descriptionForeground); font-size: 12px; }
  #future { margin-top: 24px; padding-top: 12px; border-top: 1px dashed var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-size: 12px; }
</style>
</head>
<body>
<h2>创建多根工作区</h2>
<div id="section-projects">${projectSection}</div>
<div id="future">（预留：默认 Agent、key 配置等）</div>
<script>
  const vscode = acquireVsCodeApi();
  let exists = ${state.exists ? 'true' : 'false'};
  const showButtons = () => {
    const create = document.getElementById('create');
    if (!create) { return; }
    create.hidden = exists;
    document.getElementById('load').hidden = !exists;
    document.getElementById('overwrite').hidden = !exists;
    document.getElementById('existsHint').hidden = !exists;
  };
  const collect = () => {
    const folders = Array.from(document.querySelectorAll('#subdirs input:checked')).map((i) => i.value);
    const nameEl = document.getElementById('name');
    return { folders, name: nameEl ? nameEl.value : '' };
  };
  document.getElementById('pick')?.addEventListener('click', () => vscode.postMessage({ type: 'pickParent' }));
  document.getElementById('create')?.addEventListener('click', () => vscode.postMessage({ type: 'create', ...collect() }));
  document.getElementById('load')?.addEventListener('click', () => vscode.postMessage({ type: 'load', ...collect() }));
  document.getElementById('overwrite')?.addEventListener('click', () => vscode.postMessage({ type: 'overwrite', ...collect() }));
  document.getElementById('name')?.addEventListener('input', (e) => {
    vscode.postMessage({ type: 'nameChanged', name: e.target.value });
  });
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg && msg.type === 'exists') {
      exists = !!msg.exists;
      showButtons();
    }
  });
  showButtons();
</script>
</body>
</html>`;
}
