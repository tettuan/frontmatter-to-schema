# behavior

- Compact often.

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

This project is a Markdown FrontMatter parser that convert to template format
with a schema file.

- Deno Project, use JSR for packages
- DDD, TDD, Totality, AI-complexity-control

**MUST READ**: AI-complexity-control:
`docs/development/ai-complexity-control.md` (English) or
`docs/development/ai-complexity-control_compact.ja.md` (Japanese) Totality:
`docs/development/totality.md` (English) or `docs/development/totality.ja.md`
(Japanese) Prohibit-Hardcoding: `prohibit-hardcoding.ja.md`

# Documentation Language Policy

**Primary Language**: English - for broader accessibility and maintainability
**Secondary Language**: Japanese - architectural documents available in both
languages

## Language Guidelines

### Code and Comments

- **All code comments**: English only
- **Variable/function names**: English only
- **Error messages**: English only
- **Log messages**: English only

### Documentation

- **README files**: English primary
- **API documentation**: English only
- **Architectural documents**: English + Japanese (.ja.md files)
- **Development guides**: English primary, Japanese (.ja.md) when beneficial

### Rationale

- **Accessibility**: Broader international contributor base
- **Maintainability**: Single language reduces maintenance overhead
- **Consistency**: Clear standards prevent mixed-language confusion
- **Internationalization**: Structured approach for multi-language support when
  needed

# Tests

- use `*_test.ts` filename for test file.

# Git

- use gh for Git access.
