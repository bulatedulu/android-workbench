# 08 — 居中助手窗口（项目管理中心）

**What to build:** 一个居中的 Webview 助手窗口：
- **第一步 = 多根工作区引导**（复用现有引导逻辑）：选父目录（如 `D:\bug_list`）→ 建 `.code-workspace` → 在当前窗口打开；该目录成为**项目存放根目录**（= 工作区文件所在目录）
- 确认后引导不再显示 → 切换为**聊天界面**（本期不接 AI 模型，仅界面 + 指令）
- 聊天输入「**分析新问题**」→ 在根目录下创建下一个 `BUG-N`（自增）目录 → `updateWorkspaceFolders` 加入工作区（不重载）→ 集成终端**实际启动 pi**（cwd = BUG-N）
- BUG-N 创建**限定在根目录内**；根目录推导（`dirname(workspaceFile)`）、BUG-N 自增/命名抽为可测纯逻辑

**Blocked by:** 07（复用引导逻辑）

**Status:** resolved

- [x] 助手窗口（居中 Webview）：无工作区文件时先显示引导，确认后创建并打开工作区
- [x] 有工作区文件时直接显示聊天界面（引导不再出现）
- [x] 聊天界面有输入框，支持「分析新问题」指令（或按钮）
- [x] 「分析新问题」→ 根目录下创建下一个 BUG-N（自增）→ 加入工作区 → 启动 pi（cwd=BUG-N，集成终端）
- [x] BUG-N 创建被限定在项目存放根目录内
- [x] 纯逻辑（根目录推导、BUG-N 自增/命名）有单元测试

## Answer

已实现并提交。要点：
- 居中助手窗口（`ViewColumn.One`）：无工作区文件 → 第一步内嵌引导（`setupWorkspaceWizardPanel` 抽取复用，确认后 openFolder 重载、引导不再出现）；有工作区文件 → 聊天界面（本期不接 AI 模型）。
- 「分析新问题」→ `resolveProjectRoot`（= `dirname(workspaceFile)`）→ 自增 `BUG-N`（`nextBugNumber`/`listBugDirectories`）→ `createBugDirectory` 建目录 → `updateWorkspaceFolders` 加入工作区（不重载）→ 集成终端启动 pi（cwd=BUG-N，作用域限定）。
- ready 握手防首条消息丢失；加入工作区失败中止启动 pi（不再自相矛盾）；「分析新问题」抽为共享常量。
- 79 个单元测试全绿；`/code-review` 双轴审查修复：失败中止、常量抽取、ready 竞态、建目录下沉领域层。
