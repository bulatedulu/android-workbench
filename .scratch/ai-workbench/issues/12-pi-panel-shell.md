# 12 — Pi 辅助侧边栏面板骨架 + 右键入口

**What to build:** 右侧辅助侧边栏（与 Copilot Chat 同级）出现 Pi 专属面板：注册 Pi 容器与 WebviewView，打开后显示欢迎/空状态界面；在资源管理器任意目录上右键出现「会话列表」菜单项，点击可打开 Pi 面板。本 ticket 只搭骨架与入口，会话列表内容与对话在后续 ticket 完成。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 辅助侧边栏出现 Pi 容器图标（与 Copilot Chat 容器并列）
- [ ] 点击 Pi 图标展开 WebviewView 面板，显示欢迎/空状态界面（无当前会话时的引导文案）
- [ ] 资源管理器文件夹右键菜单出现「会话列表」项（仅文件夹显示）
- [ ] 点击「会话列表」能打开/聚焦 Pi 面板
- [ ] 面板 HTML 构建为纯函数，有对应单元测试
- [ ] 扩展注册与命令为薄壳，有 mock 测试
- [ ] typecheck / 全量测试 / 构建通过
