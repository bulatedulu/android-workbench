# AI Workbench

A VS Code extension providing a workbench to manage multiple projects and the AI sessions within them.

## Language

**Project**:
An abstract entity managed by the workbench — a name, a disk path, and metadata (tags, description). It exists independently of which workspace is currently open in VS Code.
_Avoid_: Workspace, folder

**Session**:
A persisted AI conversation thread belonging to exactly one Project — a message list (role, content, timestamp), the model used, a title, tags, and timestamps.
_Avoid_: Chat, thread, conversation

**Agent**:
An external AI coding tool (e.g. `pi`, `omp`, `opencode`) that produces Sessions. Each Agent stores its Sessions in its own location and format; the workbench discovers and manages those locations in place.
_Avoid_: tool, 工具
