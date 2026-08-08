# AGENTS.md

## 语言 / Language

用户不擅长英语。所有思考过程、解释、对话和文档内容一律使用中文（zh-cn），方便用户检查。代码标识符、文件名、命令等按惯例保留英文。

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles mapped to default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
