/** 构建 Pi 面板的欢迎/空状态 HTML（纯函数，便于测试）。后续 ticket 在此基础上加聊天区。 */
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
</style>
</head>
<body>
<div id="pi-panel">
  <div id="welcome">
    <div class="brand">Pi 面板</div>
    <div class="hint">右键项目目录 → 选择「会话列表」<br>即可打开或开启该目录下的 Pi 会话。</div>
    <div class="hint">当前还没有打开的会话。</div>
  </div>
  <div id="chat" hidden></div>
</div>
<script>
  const vscode = acquireVsCodeApi();
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
