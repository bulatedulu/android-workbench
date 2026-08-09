# 09 — Explorer 右键会话列表

**What to build:** 在资源管理器文件夹的右键菜单添加「AI 工作台：查看会话列表」：点击后以 QuickPick 列出该目录下的 AI 会话（标题/时间/模型），选中后可打开只读查看器或恢复会话。

**Blocked by:** 02（会话数据层）

**Status:** resolved

- [x] `explorer/context` 菜单项（文件夹）
- [x] QuickPick 列出该目录下会话（按 cwd 匹配）
- [x] 选中 → 打开只读会话查看器；提供恢复入口
- [x] 无会话 / 非工作区目录时给出友好提示

## Answer

已实现并提交。要点：
- `explorer/context` 文件夹右键「AI 工作台：查看会话列表」（`explorerResourceIsFolder`）。
- 命令经 `WorkbenchService.listSessionsUnderFolder`（cwd 匹配，含子目录）列出会话 → QuickPick（标题/模型/时间/路径）→ 选中打开只读查看器（内含懒加载恢复入口）。
- 无会话提示「该目录下没有 AI 会话」；`listAllSessionsForProject` 复用 `listSessionsUnderFolder` 消除重复。
- 80 个单元测试全绿；`/code-review` 修复：extension.ts 格式事故、方法去重。
