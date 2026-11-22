# Android 工作台

> 在 VS Code 里跨项目集中管理终端型 AI 编码 Agent 的会话：浏览历史、找回上下文、继续对话。

Android 工作台（`android-workbench`）是一个 VS Code 扩展。它把散落在各项目目录、由终端型 AI 编码 Agent（当前支持 `pi`）产生的会话集中到 VS Code 中管理：项目直接来自当前工作区的文件夹，会话原地只读加载；需要继续对话时，通过 Agent 自己的 CLI 完成，扩展从不复制或改写会话数据。

## 功能

- **跨项目**：项目 = 当前 VS Code 工作区的文件夹，支持 `.code-workspace` 多根工作区。名称取文件夹名，无需注册，也不用来回切换窗口。
- **右侧「面板」对话**：在资源管理器右键项目文件夹 →「打开最近会话」，右侧辅助侧边栏的「面板」（与 Copilot Chat 同级）会加载该目录最新的 pi 会话；没有历史会话时则为该目录新建会话。输入消息后，通过 `pi --mode rpc` 流式显示回复，生成中可随时停止。
- **全屏工作台**：命令面板中的「Android 工作台：打开工作台」把工作台铺满编辑区。引导完成后进入聊天界面，输入「分析新问题」会在根目录下创建下一个 `BUG-N` 目录、加入当前工作区，并在集成终端启动 pi；引导配置（父目录、勾选文件夹、文件名）会保存，下次自动回填。
- **多根工作区引导**：选择父目录、勾选子文件夹，生成并打开 `<父目录名>.code-workspace`；同名文件已存在时可选择直接加载或确认覆盖。
- **容错**：pi 未安装或调用失败时会给出明确提示；个别会话文件损坏不会影响其他会话的浏览。

## 工作原理

- **会话来源**：扫描 pi 的本地存储 `~/.pi/agent/sessions/` 下的 JSONL 文件，解析出标题、时间、模型、工作目录等元数据。
- **项目匹配**：按会话的工作目录匹配工作区文件夹（路径相同或位于其子目录下），只展示属于当前项目的会话。
- **只读浏览**：打开面板或查看历史时直接读取并渲染会话内容，不启动进程、不复制文件。
- **继续对话**：面板通过 pi 的 RPC 模式（`pi --mode rpc`）流式对话，由 pi 自己写入会话文件；终端方式则使用 `pi --resume`。扩展不直接编辑 Agent 的存储文件（见 [ADR-0001](docs/adr/0001-index-plus-inplace-read.md)、[ADR-0002](docs/adr/0002-pi-chat-via-cli-rpc.md)）。

## 环境要求

- VS Code `^1.95.0`
- Node.js 20 或更高版本（开发与构建）
- [`pi`](https://github.com/earendil-works/pi) CLI 已安装并位于 `PATH`；其会话默认存放在 `~/.pi/agent/sessions/`

> 本扩展尚未发布到 VS Code 应用市场，请从源码运行。

## 快速开始

```bash
git clone https://github.com/bulatedulu/android-workbench.git
cd android-workbench
npm install
npm run build
```

用 VS Code 打开项目目录，按 `F5`（运行配置「运行扩展」）启动扩展开发宿主。

### 使用

1. 在开发宿主中打开一个或多个项目文件夹，或打开已有多根 `.code-workspace` 工作区。
2. 在资源管理器中右键项目文件夹 →「打开最近会话」，右侧「面板」会显示该目录的最新会话；没有历史会话时会新建一个。
3. 在面板底部输入消息，pi 的回复会流式显示；生成中可点击停止按钮或按 `Esc` 取消。
4. 如果要从零整理一组项目：运行「Android 工作台：创建多根工作区」或「打开工作台」，按引导选择父目录、勾选子文件夹并创建工作区。

## 开发

```bash
npm install
npm run watch        # 监听构建，配合 F5 调试
npm run typecheck    # TypeScript 类型检查
npm test             # Vitest 单元测试
npm run build        # 生产构建，输出 dist/extension.js
```

| 脚本 | 说明 |
| --- | --- |
| `npm run build` | 使用 esbuild 打包到 `dist/extension.js` |
| `npm run watch` | 监听模式打包 |
| `npm run typecheck` | 运行 `tsc --noEmit` |
| `npm test` | 运行全部 Vitest 测试 |
| `npm run test:watch` | 监听模式运行测试 |

> 部分测试用例使用 Windows 路径样例（如 `D:\bug_list`），在非 Windows 平台上运行时可能出现路径相关失败。

### 目录结构

```text
src/
├── extension.ts   扩展入口：命令与面板注册
├── domain/        纯逻辑（无 vscode 依赖）：项目/会话模型、匹配、搜索、工作区与 BUG-N
├── agent/         Agent 适配层：Provider 接口、PiProvider、PiRpcClient
├── ui/            VS Code 壳层与 Webview：面板、会话查看器、引导
└── storage/       globalStorage 持久化（项目标签）
media/             扩展图标
docs/adr/          架构决策记录
.scratch/          规范与 issue 记录（本地 markdown issue tracker）
CONTEXT.md         领域词汇表（Project / Session / Agent）
```

### 设计要点

- **领域逻辑与 VS Code API 解耦**：`src/domain` 为纯逻辑，测试使用 Vitest 覆盖领域层、Agent Provider 与 Webview 纯函数。
- **会话数据原地读取**：按需扫描并构建内存模型，v1 不建持久索引、不复制内容（[ADR-0001](docs/adr/0001-index-plus-inplace-read.md)）。
- **写入走 Agent CLI**：终端用 `pi --resume`，面板用 `pi --mode rpc`，扩展不直接修改会话存储（[ADR-0002](docs/adr/0002-pi-chat-via-cli-rpc.md)）。
- **Webview 保持薄**：使用原生 TypeScript/HTML 构建界面，不引入前端框架。

## 当前范围

- 仅实现 `pi` 的 Provider；`omp`、`opencode` 等其他 Agent 按同一 Provider 接口预留。
- 面板一次专注一个会话，不提供多标签并行会话。
- 暂未提供持久化全局索引、会话标签/归档/统计、团队同步等能力。

## 相关文档

- [CONTEXT.md](CONTEXT.md)：领域词汇表
- [docs/adr/](docs/adr/)：架构决策记录
- [.scratch/ai-workbench/spec.md](.scratch/ai-workbench/spec.md)：v1 规范与用户故事

## 许可证

MIT
