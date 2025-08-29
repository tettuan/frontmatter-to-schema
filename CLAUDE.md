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

## Test Strategy

This project follows a comprehensive testing strategy aligned with DDD, TDD, and
Totality principles:

### Test Structure

- **Unit Tests**: Domain logic, value objects, and business rules
- **Integration Tests**: Cross-boundary component interactions
- **E2E Tests**: Complete CLI workflows and user scenarios
- **File Convention**: Use `*_test.ts` filename for all test files

### Coverage Standards

- **Minimum Coverage**: 80% line coverage maintained
- **Target Coverage**: 80.1% achieved (281 tests passing)
- **Focus Areas**: Domain models, use cases, and critical business logic
- **Exclusions**: Infrastructure adapters may have lower coverage

### Test Categories

1. **Domain Tests**: Core business logic validation
2. **Service Tests**: Application service behavior verification
3. **Repository Tests**: Data access layer validation
4. **Pipeline Tests**: End-to-end processing workflows
5. **CLI Tests**: Command-line interface functionality

### Test Execution

```bash
# Run all tests
deno test --allow-all

# Run with coverage
deno task test:coverage

# Run CI pipeline (includes tests)
deno task ci
```

### Quality Gates

- All tests must pass before merge
- Coverage must not decrease below 80%
- Integration tests must validate real workflows
- E2E tests must cover main CLI use cases

### Test Documentation

For detailed testing guidelines and best practices:

- **[Test Overview](docs/tests/README.md)**: Comprehensive testing strategy and
  architecture
- **[Testing Guidelines](docs/tests/testing_guidelines.md)**: Detailed TDD
  practices and implementation guide
- **[Comprehensive Test Strategy](docs/testing/comprehensive-test-strategy.md)**:
  Overall testing approach
- **[Schema Test Specification](docs/test-specifications/schema-matching-test-spec.md)**:
  Schema validation testing details

# Git

- use gh for Git access.

# Naming Conventions

- use TypeScript and Deno standard.
