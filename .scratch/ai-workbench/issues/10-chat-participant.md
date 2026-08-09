# 10 — 聊天视图参与者

**What to build:** 注册一个聊天参与者（像 Codex 一样出现在 VS Code 聊天视图）：可列出当前工作区项目的会话、查看某个会话内容、并在聊天中继续（用 `vscode.lm` 新线程引用会话内容，**不写回** pi 存储；真正回 pi 走 `pi --resume` 终端）。

**Blocked by:** 02、08（会话数据层）

**Status:** ready-for-agent

- [ ] `vscode.chat.createChatParticipant` 注册，出现在聊天视图
- [ ] 指令：列会话 / 显示会话 / 继续会话
- [ ] 会话内容流式渲染；继续用 `vscode.lm`（需授权提示）
- [ ] 不写回 pi 存储（符合 ADR-0001）
