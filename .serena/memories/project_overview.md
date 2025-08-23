# Frontmatter-to-Schema Project Overview

## Core Purpose

Deno-based DDD system using Claude AI (`Claude Code SDK`) for frontmatter
extraction and schema-driven analysis.

**Stack**: Deno + TypeScript + JSR packages + Claude CLI **Principles**: DDD,
TDD, Totality, AI-complexity-control

## Architecture

### Domain Structure

```
src/domain/
├── core/ - Types, abstractions, Result patterns
├── services/ - AI orchestration, template mapping
└── models/ - Value objects, entities
```

### Key Domains

1. **Core**: FrontMatter Analysis (schema-driven)
2. **Support**: File Discovery, AI Integration, Registry Building

### Processing Flow

1. File Discovery → 2. FrontMatter Extraction → 3. AI Analysis (2-stage) → 4.
   Template Mapping → 5. Registry Output

## Core Patterns

### Totality Design

- `Result<T, E>` types everywhere
- Smart constructors with validation
- Discriminated unions over optionals
- No partial functions or exceptions

### AI Integration

- **Stage 1**: Information extraction via `Claude Code SDK`
- **Stage 2**: Template application via `Claude Code SDK`
- TypeScript only handles I/O and orchestration

### Value Objects

- `ValidFilePath`, `FrontMatterContent`, `SchemaDefinition`
- Private constructors + static `create()` methods
- Immutable with behavior

## Current Status

- 83/83 tests passing
- Full DDD + Totality implementation
- Branch: `feat/frontmatter-pipeline-enhancements`
- Ready for cosmic deployment!
