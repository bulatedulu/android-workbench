# 01 — 扩展脚手架 + 项目注册

**What to build:** 用户安装并激活「AI 工作台」扩展后，能在 Activity Bar 看到工作台图标与侧边栏树视图；通过「添加项目」命令把一个目录注册为项目，项目出现在树里；可以编辑项目的名称与标签、删除项目（删除只移除注册，不触碰任何磁盘上的会话数据）；项目列表在重启 VS Code 后仍然保留。

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] 扩展可加载，Activity Bar 显示工作台图标，Tree View 可展开
- [x] 「添加项目」命令：选择/输入目录后创建项目并出现在树中
- [x] 项目可编辑名称、标签；可删除（仅移除注册，不删除任何磁盘数据）
- [x] 项目注册表持久化：重启 VS Code 后项目仍在
- [x] 领域层（项目注册表增删改查与持久化）有单元测试覆盖

## Answer

已实现并提交。要点：
- 脚手架：TypeScript + esbuild + Vitest，`npm run typecheck` / `build` / `test` 全绿（10 个单元测试）。
- 领域层 `ProjectRegistry`（增删改查 + 持久化 + 空名称校验 + Windows 大小写不敏感重复检测），接缝 `ProjectStore` 抽象。
- 持久化：globalStorage 下 `projects.json`（符合规范决策），同步写入、加载有防御。
- UI 壳层：Activity Bar 图标 + Tree View + 命令（打开工作台 / 添加 / 编辑 / 删除），保持薄。
- 经 `/code-review` 双轴审查后修复：持久化机制对齐规范、重复路径大小写、空名称、`persist()` 提取、`list()` 拷贝、`load()` 防御、补充「打开工作台」命令。
