# 06 — 工作区驱动的项目管理

**What to build:** 工作台的项目改为来自**当前 VS Code 工作区的文件夹**（支持 `.code-workspace` 多根）：打开包含多个项目文件夹的工作区，工作台自动把所有文件夹识别为项目并展示各自的 pi 会话，**无需切换或重载窗口**。添加项目 = 选目录动态加入当前工作区；移除项目 = 从工作区移除该文件夹（仅移除，不删磁盘数据）；项目名称 = 文件夹名（去掉重命名），标签按路径持久化到 globalStorage；工作区文件夹增删（含 VS Code 原生操作）时工作台自动刷新。

**Blocked by:** None（重构既有功能，相关测试同步更新）

**Status:** resolved

- [x] 项目来自当前工作区文件夹（单根 / `.code-workspace` 多根均可），打开即自动识别
- [x] 添加项目：选目录 → `updateWorkspaceFolders` 动态加入当前工作区，不重载窗口，树即时更新
- [x] 移除项目：从当前工作区移除文件夹（仅移除，不删磁盘与 Agent 数据）
- [x] 项目名称 = 文件夹名；标签按路径持久化（globalStorage JSON）；去掉「重命名项目」
- [x] 工作区文件夹增删（含 VS Code 原生操作）时工作台自动刷新
- [x] 会话归属（cwd 匹配）、搜索、查看、恢复功能保持不变
- [x] 领域层（`ProjectSource` 抽象 + 标签存储）有单元测试

## Answer

已实现并提交。要点：
- 项目来源改为**当前工作区文件夹**（`ProjectSource` 抽象；`WorkspaceProjectSource` 读 `workspace.workspaceFolders`，支持 `.code-workspace` 多根）。
- 添加 = `updateWorkspaceFolders` 动态加入；移除 = 从工作区移除（均**不重载窗口**）；`onDidChangeWorkspaceFolders` 自动刷新树（含 VS Code 原生增删）。
- 名称 = 文件夹名（`projectFromPath`）；标签按路径存 `FileTagsStore`（globalStorage JSON）；去掉重命名。
- 移除旧的 `ProjectRegistry` 体系（globalStorage 项目注册表 → 仅存标签）。
- 54 个单元测试全绿；`/code-review` 双轴审查修复：CONTEXT.md 词汇同步（Project = 工作区文件夹）、Project.id 死字段、tagsFor 死接口、树显示标签、命令标题「移除项目」、测试夹具对齐真实实现、规范数据流误改。
- 已知限制：`.code-workspace` 中 `updateWorkspaceFolders` 只改内存不写回文件，重启后增删丢失（VS Code API 固有限制，需用户自行保存工作区）。
