# 07 — 多根工作区引导面板

**What to build:** 一个可扩展的 Webview 引导面板（编辑器区居中弹出）：用户选择父目录（如 `D:\bug_list`）→ 面板列出该目录下的子文件夹（checkbox 多选）→ 确认后生成 `<父目录名>.code-workspace`（文件名可输入修改）并在当前窗口打开；若目标文件已存在则直接加载，并提供「覆盖重建」（二次确认）。入口为命令 + 视图标题栏按钮（**不自动弹出**）。面板为分区结构，为后续默认 Agent / key 配置预留扩展位。

**Blocked by:** None（独立功能，与 ticket 06 并存）

**Status:** resolved

- [x] 「创建多根工作区」命令 + 视图标题栏按钮
- [x] Webview 面板在编辑器区居中弹出
- [x] 选择父目录后列出其子文件夹（checkbox 多选）
- [x] 工作区文件名默认 `<父目录名>.code-workspace`，可输入修改
- [x] 确认后：目标不存在 → 生成文件并在当前窗口打开；已存在 → 直接加载；「覆盖重建」需二次确认
- [x] 纯逻辑（文件名、JSON 生成、子目录列举、HTML 构建）有单元测试

## Answer

已实现并提交。要点：
- Webview 引导面板（编辑器区 `ViewColumn.One` 居中）：选父目录 → 列出子文件夹（checkbox 多选）→ 文件名默认 `<父目录名>.code-workspace`（可改）→ 创建/加载/覆盖。
- 文件名输入实时判断存在性并**动态切换按钮**（创建并打开 ↔ 直接加载/覆盖重建）；覆盖重建走宿主端模态二次确认；空勾选拦截。
- `vscode.openFolder` 当前窗口打开；面板分区结构（`#future`）为后续默认 Agent / key 配置预留。
- 纯逻辑抽为可测函数：`workspaceSetup`（JSON 生成/默认名/补后缀/列子目录）+ `buildWizardHtml`（动态按钮组、转义、消息脚本）。
- 66 个单元测试全绿；`/code-review` 双轴审查修复：文件名输入与按钮联动（关键）、`load` 使用当前输入名、`resolveWorkspaceFile` 去重、`WizardMessage` 判别联合、空勾选校验、冗余调用清理。
