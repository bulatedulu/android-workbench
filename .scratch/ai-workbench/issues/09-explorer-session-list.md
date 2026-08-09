# 09 — Explorer 右键会话列表

**What to build:** 在资源管理器文件夹的右键菜单添加「AI 工作台：查看会话列表」：点击后以 QuickPick 列出该目录下的 AI 会话（标题/时间/模型），选中后可打开只读查看器或恢复会话。

**Blocked by:** 02（会话数据层）

**Status:** ready-for-agent

- [ ] `explorer/context` 菜单项（文件夹）
- [ ] QuickPick 列出该目录下会话（按 cwd 匹配）
- [ ] 选中 → 打开只读会话查看器；提供恢复入口
- [ ] 无会话 / 非工作区目录时给出友好提示
