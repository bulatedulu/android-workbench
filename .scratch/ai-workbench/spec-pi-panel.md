Status: ready-for-agent
Feature: ai-workbench-pi-panel

# AI 工作台 — Pi 辅助侧边栏面板 规范

## 问题陈述

用户（开发者）用终端型 AI 编码 Agent（当前为 `pi`）在多个项目（BUG-N 目录）中开发。现有工作台 v1 只能**只读**浏览/搜索 pi 会话，继续对话要跳去集成终端；也没有一个像 Copilot Chat 那样常驻的图形化对话界面。用户想：在工作区里**右键一个项目目录，就能看到该目录的会话列表**，选一个会话在**右侧辅助侧边栏**（和 Copilot Chat 同级）的 **Pi 面板**里打开，直接继续对话——全程不离开 VS Code。

## 解决方案

扩展在**辅助侧边栏（`secondarySidebar`，右侧，与 Copilot Chat 同级）**注册一个 **Pi 专属聊天面板**（WebviewView），并预留多 Agent 面板架构（将来 Codex/Copilot 各一个面板），v1 只实现 Pi。交互：

1. 在资源管理器**右键**任意项目目录（如 `BUG-1`）→ 菜单出现「会话列表」。
2. 点击 → 弹出 QuickPick：**第一项「开启新会话」**，其后是该目录下的历史会话（最新优先）。
3. 选中历史会话 → 右侧 Pi 面板打开并**加载该会话历史**；选中「开启新会话」→ Pi 面板打开一个新会话。
4. 在 Pi 面板输入框对话 → 工作台 spawn `pi --mode rpc`（携带会话文件）→ pi 的回复**流式渲染**在面板里，可随时取消。

会话写入通过 pi 自己的 CLI（`--session`/`--session-id`），工作台不直接编辑 store 文件（见 ADR-0002，扩展自 ADR-0001 的边界）。

## 用户故事

1. 作为开发者，我想在右侧辅助侧边栏看到与 Copilot Chat 同级的 Pi 面板图标，以便像用 Copilot Chat 一样随时打开 Pi 对话界面。
2. 作为开发者，我想在资源管理器文件夹上右键看到「会话列表」菜单项，以便快速进入该目录的会话管理。
3. 作为开发者，我想点击「会话列表」后弹出一个选择器，第一项是「开启新会话」，其后按最新优先列出该目录的历史会话，以便一眼看到有哪些可继续的会话。
4. 作为开发者，我想选中一个历史会话后，右侧 Pi 面板自动打开并加载该会话的历史消息，以便接着上次的对话继续。
5. 作为开发者，我想选中「开启新会话」后，右侧 Pi 面板打开一个新会话，以便在该目录开始全新对话。
6. 作为开发者，我想在 Pi 面板输入消息后看到 pi 的回复**流式**显示（打字机效果），以便感知生成进度。
7. 作为开发者，我想在 pi 生成过程中点击「取消」（或 Esc）终止本次回复，以便及时止损。
8. 作为开发者，我想 Pi 面板的对话**写回 pi 自己的会话存储**，以便以后在工作台/终端/pi 里都能看到这段对话。
9. 作为开发者，我想 Pi 面板会话的写入落盘在 pi 默认存储（`~/.pi/agent/sessions/--<目录>--/`），以便现有会话扫描和列表能直接看到新会话。
10. 作为开发者，我想在 Pi 面板顶部看到当前会话标题（取用户首条消息或目录名），以便识别在跟哪个会话对话。
11. 作为开发者，我想在右键选择会话后切换 Pi 面板内容（单面板加载所选会话），以便不用开多个面板。
12. 作为开发者，我想在没有历史会话的目录下也能选择「开启新会话」，以便新目录直接开始对话。
13. 作为开发者，我想在 `pi` 未安装或未配置模型时看到明确提示而不是崩溃，以便知道环境问题。
14. 作为开发者，我想 Pi 面板的架构能按 Agent 扩展（为 Codex/Copilot 预留），以便以后每个 Agent 都有同级面板。
15. 作为开发者，我想现有的全屏工作台、`aiWorkbench.sessions` 聊天参与者等全部照旧工作，以便不破坏已验证的功能。
16. 作为开发者，我想 Pi 面板的对话默认使用 pi 当前配置的模型，以便不用额外设置。
17. 作为开发者，我想在一个目录有多个历史会话时按时间最新优先排列，以便优先看到最近的工作。
18. 作为开发者，我想右键选择会话时如果有目录名能确认我选的是哪个目录（QuickPick 标题显示目录名），以便避免选错。

## 实现决策

- **辅助侧边栏容器**：通过 `viewsContainers.secondarySidebar` 贡献 Pi 容器（图标），容器内一个 WebviewView（`type: webview`）即 Pi 面板，与 Copilot Chat 的容器在右侧侧边栏并列。视图保留 `retainContextWhenHidden`。
- **右键会话列表**：`menus.explorer/context` 贡献「会话列表」命令（`when: explorerResourceIsFolder`），命令参数为右键目录 URI → 弹 QuickPick。QuickPick 项组装与目录推导抽为**纯函数**（无 VS Code 依赖）：
  - 第一项「开启新会话」（固定）；
  - 其后该目录历史会话项（标题 + 时间 + 模型，最新优先，复用现有 pi 会话扫描/解析）。
- **会话文件解析**（纯逻辑）：
  - 有历史 → 取该目录（cwd 匹配）下最新 `.jsonl` 会话文件，用 `--session <file>` 续写；
  - 无历史 → 由目录路径派生**固定 session-id**，用 `--session-id` 让 pi 在默认存储（`~/.pi/agent/sessions/--<目录>--/`）创建，与现有 `PiProvider` 扫描兼容。
- **RPC 客户端**（`PiRpcClient`，与进程交互的唯一接缝，注入 spawn 工厂）：
  - spawn `pi --mode rpc` + 会话参数（`--session <file>` 或 `--session-id <id>`）+ `--no-tools` 可选，`cwd` = 项目目录，stdio 管道；
  - stdin 发送 `{"id","type":"prompt","message"}`；stdout 逐行解析 JSON 事件：`message_update`+`text_delta` → 流式回调；`response.success===false` → 错误；`agent_end`/`agent_settled` → 完成；`extension_ui_request`（select/confirm/input/editor）→ 自动回 `cancelled:true`；
  - 取消：stdin 发 `abort`，超时后 kill；支持 vs 取消令牌。
  - Windows 注意：pi 是 npm shim（`.ps1`/`.cmd`），spawn 需 `shell: true` 或解析到可执行文件。
- **面板宿主**（`PiChatController`，复用 host 抽象：post/setHtml）：
  - 消息协议：`ready`/`send`/`abort`/`pickSession` 等；宿主侧消息：`sessionLoaded`（历史消息）/`chat`（流式增量）/`phase`（加载/就绪）/`error`；
  - 加载会话历史复用现有 `PiProvider.readSessionContent`；流式增量由 RPC 客户端回调转发到 webview 渲染；
  - 未安装 pi / 无模型：面板内显示引导提示。
- **面板 HTML**（纯函数构建）：会话标题 + 历史消息区 + 输入框 + 发送/取消按钮；样式用 VS Code CSS 变量；`[hidden]{display:none!important}` 防御；初始元素脚本加载后立即绑定事件。
- **会话上下文**：右键选中后记录「当前会话」（globalState），Pi 面板打开/恢复时按它加载；无当前会话时面板显示空状态引导。
- **现有功能全保留**：全屏工作台、`aiWorkbench.sessions` participant、会话查看器等不动。
- **架构预留**：Agent 面板抽象（面板注册 + 会话解析按 Agent 提供者切换），v1 只实现 Pi 一个面板。

## 测试决策

- 好测试的标准：只测**外部行为**（输入消息 → 面板状态/流式文本变化），不测实现细节；RPC 进程交互用**假子进程**模拟 stdout 事件流，不真跑 pi。
- **PiRpcClient**：注入 spawn 工厂，用可编程假子进程测：prompt 发送、`text_delta` 流式回调、`response.success=false` 错误、`agent_end` 完成、取消（abort + kill 时序）、`extension_ui_request` 自动取消。先例：`PiProvider.resumeSession` 注入 runner。
- **会话选择纯函数**：目录 → 「开启新会话 + 历史会话」项列表（最新优先）；固定 session-id 派生；无历史时的空列表行为。先例：`chatParticipantLogic`。
- **PiChatController**：注入 host + PiRpcClient + 会话提供者，测消息处理（send 转发、流式追加、abort、错误提示、ready 握手）。先例：`assistantController`。
- **面板 HTML**：纯函数断言关键结构与脚本。先例：`assistantViewHtml`/`sessionViewerHtml`。
- **薄壳**（扩展注册/命令）：vscode mock 断言注册与命令调用。先例：`chatParticipant` 测试。

## 超出范围

- 多 Agent 面板（Codex/Copilot）——仅预留接口，v1 不实现。
- 面板内多 tab 并行会话——单面板切换。
- 工具审批 UI、模型选择器、思考级别控制——用 pi 默认。
- 修改现有 `aiWorkbench.sessions` 参与者或全屏工作台。
- 会话内容的程序化编辑（工作台只通过 pi CLI 写入会话）。

## 补充说明

- 相关 ADR：`docs/adr/0002-pi-chat-via-cli-rpc.md`（扩展 ADR-0001：写走 pi CLI，工作台不直接编辑 store 文件）。
- 关键技术已验证：`pi --mode rpc --session <file>` 组合可行（流式 `text_delta` + 会话文件落盘，标准格式与扫描兼容）；`vscode.menus` 动态菜单 API 不存在，故会话列表用 QuickPick 而非 hover 动态子菜单。
- Windows spawn pi 需 `shell: true`（npm shim）；`--no-tools` 默认关闭工具调用可在验证阶段使用，正式是否开启由后续决策定。
