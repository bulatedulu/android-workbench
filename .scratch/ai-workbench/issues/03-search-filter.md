# 03 — 搜索与过滤

**What to build:** 用户可以在工作台里搜索会话（按标题和对话消息文本），并按项目、Agent、时间范围过滤，快速定位目标会话；搜索/过滤结果即时反映在树视图中。

**Blocked by:** 02

**Status:** resolved

- [x] 搜索框支持按标题 + 消息文本关键词匹配会话
- [x] 支持按项目、Agent、时间范围过滤
- [x] 搜索/过滤结果即时反映在树视图中
- [x] 搜索与过滤逻辑有单元测试

## Answer

已实现并提交。要点：
- `SearchService`（接缝 1）：标题 + 消息文本关键词匹配（大小写不敏感），agent / 时间范围（from/to）过滤；消息文本经注入的 `readSessionText` 获取。
- `AgentProvider.readSessionText`：读会话文件拼接全部消息文本（**不截断**，保证长消息后部关键词可命中）；JSONL 行遍历抽取为共享 `forEachJsonLine`。
- `WorkbenchService`：搜索状态（query/filters）、`setSearch`/`clearSearch`/`isSearching`；`listSessionsForProject` 应用搜索、`listAllSessionsForProject` 不受搜索影响。
- UI：视图标题栏「搜索」按钮 → 输入关键词 + 时间范围（全部/今天/近 7 天/近 30 天）→ 树即时过滤；「清除搜索」按钮还原；项目占位区分「无会话」/「无匹配会话」/「未找到 pi 会话存储」。
- 40 个单元测试全绿；`/code-review` 双轴审查修复：搜索文本截断 bug（关键）、JSONL 解析去重、isSearching 判定、占位误判、ADR-0001 措辞补充（搜索时按需读取）。
- 说明：v1 仅 pi，agent 过滤无 UI 入口（领域层已支持，留待后续 agent）；搜索为命令式即时刷新（VS Code TreeView 无内嵌自定义搜索框）。
