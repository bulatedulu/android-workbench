# 10 — 聊天视图参与者

**What to build:** 注册一个聊天参与者（像 Codex 一样出现在 VS Code 聊天视图）：可列出当前工作区项目的会话、查看某个会话内容、并在聊天中继续（用 `vscode.lm` 新线程引用会话内容，**不写回** pi 存储；真正回 pi 走 `pi --resume` 终端）。

**Blocked by:** 02、08（会话数据层）

**Status:** resolved

- [x] `vscode.chat.createChatParticipant` 注册，出现在聊天视图
- [x] 指令：列会话 / 显示会话 / 继续会话
- [x] 会话内容流式渲染；继续用 `vscode.lm`（需授权提示）
- [x] 不写回 pi 存储（符合 ADR-0001）

## Answer

- `src/ui/chatParticipantLogic.ts`（纯函数）：`parseIntent`（显示/继续/列表/帮助，中文关键词，具象指令先于列表检测避免误判）、`findSessionByKeyword`（按标题/ID 模糊查找）、`buildSessionListMarkdown`（含 agent/模型/创建~更新时间）、`buildSessionContentMarkdown`；`ProjectSessions` 类型命名数据泥团；14 个单元测试
- `src/ui/chatParticipant.ts`：`registerChatParticipant` 注册 `aiWorkbench.sessions`，图标 `tools`；`show`/`continue` 复用 `findSessionByKeyword`；`continue` 用 `vscode.lm.selectChatModels({vendor:'copilot'})` + `sendRequest`（`LanguageModelChat` 无 `sendChatRequest`，类型为 `sendRequest`；`ChatParticipant` 无 `description`，用 `iconPath`）流式渲染；无模型/失败时提示走 `pi --resume`（`RESUME_HINT` 常量复用）
- `src/ui/messages.ts`：新增 `RESUME_HINT` 常量
- `src/extension.ts`：`registerChatParticipant(context, service, provider)` 接线
- 验证：`npm run typecheck`、`npm run build`、`npx vitest run` 全绿（13 文件 94 测试）
- code-review：Standards 无硬性违规；Spec 修复解析误判（列表正则锚定+具象优先）
