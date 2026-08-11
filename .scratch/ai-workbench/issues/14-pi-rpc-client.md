# 14 — PiRpcClient（pi CLI RPC 进程交互）

**What to build:** 与 pi CLI 的 RPC 交互模块：spawn `pi --mode rpc`（携带会话参数），通过 stdin 发送 prompt，解析 stdout 的 JSON 事件流（流式文本增量、错误、结束），支持取消（abort + 超时 kill），对 pi 的 UI 请求（select/confirm/input/editor）自动应答取消。全程不直接编辑 pi 存储文件，写入由 pi 自己完成（见 ADR-0002）。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 注入 spawn 工厂，可用假子进程测试
- [ ] 启动参数正确：`--mode rpc` + 会话参数（`--session <file>` 或 `--session-id <id>`）+ 项目目录作为 cwd；Windows 下能正确启动 pi（shell 兼容）
- [ ] stdin 发送 `{id, type: 'prompt', message}` 触发对话
- [ ] stdout 逐行解析：`text_delta` 增量流式回调；`response.success=false` 报错；`agent_end`/`agent_settled` 结束
- [ ] `extension_ui_request`（select/confirm/input/editor）自动回 `cancelled: true`，不阻塞
- [ ] 取消：发送 abort，超时后 kill；尊重取消令牌
- [ ] 进程异常退出/未安装 pi 时有明确错误
- [ ] 假子进程单测覆盖上述全部场景（不真跑 pi）
- [ ] typecheck / 全量测试 / 构建通过
