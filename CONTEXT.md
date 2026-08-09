# AI Workbench

A VS Code extension providing a workbench to manage multiple projects and the AI sessions within them.

## Language

**Project**:
当前 VS Code 工作区中的一个文件夹（单根或 `.code-workspace` 多根），工作台管理其 AI 会话。名称 = 文件夹名；标签按路径存储；随工作区存在，不做独立注册。
_Avoid_: Workspace（指整个工作区）、独立注册的项目实体

**Session**:
A persisted AI conversation thread belonging to exactly one Project — a message list (role, content, timestamp), the model used, a title, tags, and timestamps.
_Avoid_: Chat, thread, conversation

**Agent**:
An external AI coding tool (e.g. `pi`, `omp`, `opencode`) that produces Sessions. Each Agent stores its Sessions in its own location and format; the workbench discovers and manages those locations in place.
_Avoid_: tool, 工具
