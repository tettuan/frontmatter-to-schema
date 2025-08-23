# MCP and CLI

- `climpt-*` is a bash command. It is also available via MCP. Execute the
  `climpt-*` command as a language. After execution, follow the instructions
  displayed in STDIN.

## When MCP response empty

```
climpt - spec (MCP)(args: ["analyze","quality-metrics","default"])
  ⎿
```

see options. "analyze","quality-metrics" is correct. or, change to
["analyze","quality-metrics","-i=default"] or
["analyze","quality-metrics","-a=default"]

# About Project

This project is a Markdown FrontMatter parser that utilizes `Claude Code SDK`
with a schema file.

- Deno Project, use JSR for packages
- DDD, TDD, Totality, AI-complexity-control

**MUST READ**:
AI-complexity-control:`docs/development/ai-complexity-control_compact.ja.md`
Totality: `docs/development/totality.ja.md` Prohibit-Hardcoding:
`prohibit-hardcoding.ja.md`

# Tests

- use `*_test.ts` filename for test file.

# Claude Code SDK

- use "Command line" SDK
- Claude Code SDK reference: https://docs.anthropic.com/ja/docs/claude-code/sdk
  - saved: docs/claude_code_sdk_command_line.md
