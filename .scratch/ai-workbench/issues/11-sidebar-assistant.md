# 11 — 侧边栏助手视图（替换项目树，引导 + 聊天两步式）

**What to build:** 把 Activity Bar 的 AI 工作台容器从「项目树」改为「助手视图」（Webview View）：
- 两步式：第一步引导（选父目录 → 勾选子文件夹 → 工作区文件名 → 确认），第二步聊天界面（「分析新问题」→ BUG-N）
- 引导配置（父目录 + 勾选文件夹 + 文件名）持久化到 globalStorage，下次展开自动回填，避免重选
- 开发阶段：每次展开侧边栏都回到引导界面（配置回填，确认即进入聊天）
- 引导确认：确保 .code-workspace 存在 → `updateWorkspaceFolders` 加入当前窗口（不重载）→ 进入聊天
- 移除项目树视图及其命令/菜单；移除居中助手弹窗（assistantHub / assistantHtml / editorTabs）

**Blocked by:** 07（引导逻辑）、08（BUG-N 逻辑）

**Status:** resolved

- [x] package.json：views 替换为 `aiWorkbench.assistant`（webview）；清理 commands / menus
- [x] `assistantConfig`：配置读写（globalStorage Memento）
- [x] `assistantViewHtml`：引导区 + 聊天区单 HTML，阶段切换脚本
- [x] `assistantView` 宿主：`resolveWebwebView`、消息处理、每次可见回引导、配置回填
- [x] 引导确认 → 写 .code-workspace + `updateWorkspaceFolders` + 存配置 → 聊天
- [x] 聊天「分析新问题」→ BUG-N（复用 issueSpace；根目录回退用保存的父目录）
- [x] 清理：删除项目树 / 弹窗相关文件
- [x] typecheck + build + 全量测试 + code-review + 提交

## Answer

- `src/ui/assistantConfig.ts`：`AssistantConfig`（parent/folders/name）读写 globalStorage（Memento 可 mock），类型清洗；8 个测试
- `src/ui/assistantViewHtml.ts`：单 HTML 含引导区 + 聊天区，JS `showPhase` 切换；`wizardState`（回填父目录/勾选/文件名/exists）/`exists`（轻量更新，不重置输入）/`chat`/`phase` 消息；5 个测试
- `src/ui/assistantView.ts` 宿主：`registerWebviewViewProvider('aiWorkbench.assistant')`；`resolveWebviewView` 与 `onDidChangeVisibility(visible)` 都回到引导（开发阶段每次展开显示引导，配置回填）；引导确认 → 写 .code-workspace + `updateWorkspaceFolders` 增量加入（不重载）+ 保存配置 → 聊天；「分析新问题」→ root = 保存的父目录（回退 workspaceFile）→ BUG-N → 加入工作区 → 启动 pi
- `src/extension.ts`：移除项目树/居中弹窗；`openWorkbench`/`openAssistant` → `aiWorkbench.assistant.focus`；保留 openSession/createWorkspace/explorerSessionList/chatParticipant
- `package.json`：views 替换为 `aiWorkbench.assistant`（webview）；命令精简（移除 addProject/editTags/removeProject/searchSessions/clearSearch/refresh）；menus 移除 view/title、view/item/context
- 清理删除：assistantHub/assistantHtml(+test)/editorTabs(+test)/workbenchTree/commands/searchCommands（git rm）
- 验证：typecheck、build、`npx vitest run` 全绿（13 文件 100 测试）
- code-review 修复：
  - spec 根目录优先级描述修正为「优先取引导保存的父目录（侧边栏不重载窗口，workspaceFile 常不存在），无则回退当前工作区文件所在目录」（与实现/Answer 一致）
  - `assistantView.ts` 移除只写不读的 `this.phase` 字段
  - 移除冗余 `openWorkbench` 命令（与 `openAssistant` 等价），只留 `openAssistant`
  - `resolveWorkspaceFile` 下沉到 `domain/workspaceSetup.ts` 共享（消除 assistantView/workspaceWizard 重复）
  - 删除 `messages.ts` 的 `statusMessage`/`NO_STORE_MESSAGE`（无生产调用方）+ `messages.test.ts`；保留 `NO_COMMAND_MESSAGE`（sessionViewer 仍用）
  - 恢复外部格式工具造成的 2 空格漂移（`chatParticipantLogic.ts`/`workspaceWizardHtml.ts` 还原 4 空格，与全库一致）
  - `pickParent` 重选同一父目录时回填已保存配置（Spec 轻微问题）
  - 已知保留：HTML 服务端渲染与 JS 动态渲染双份（初始 SSR + 更新，避免空白闪烁）；`create/overwrite/load` 确认逻辑与 workspaceWizard 相似但差异大（不重载+存配置）暂不合并
