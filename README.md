# Frontmatter-to-Schema

A Deno-based tool for extracting frontmatter from Markdown files and
transforming it into structured schemas using AI-powered analysis.

## Features

- **Schema-Driven Processing**: Validate frontmatter against JSON Schema with
  custom x-* extensions
- **Template-Based Transformation**: Convert validated data using customizable
  JSON/YAML templates
- **Flexible Input Patterns**: Support for directories, glob patterns, and
  single files
- **DDD Architecture**: Clean domain-driven design with totality principles
- **Type-Safe**: Full TypeScript with discriminated unions and Result pattern
- **Multi-Format Output**: Generate JSON or YAML outputs with proper formatting
- **Advanced Field Processing**: Derived fields, unique filtering, and JMESPath
  expressions
- **Comprehensive Testing**: 80%+ coverage with TDD and specification-driven
  tests

## Installation

### Prerequisites

- Deno 1.40+ installed
- Claude API key (for AI features)

### Quick Install

```bash
# Install from GitHub (installs to ~/.deno/bin/)
curl -fsSL https://raw.githubusercontent.com/tettuan/frontmatter-to-schema/main/scripts/frontmatter-install.sh | bash

# Or clone and install locally
git clone https://github.com/tettuan/frontmatter-to-schema.git
cd frontmatter-to-schema
./scripts/frontmatter-install.sh
```

### Manual Setup

```bash
# Install dependencies
deno cache --reload cli.ts

# Or install as global command
deno install --allow-read --allow-write --allow-env --allow-run \
  --name frontmatter-to-schema \
  --force \
  https://raw.githubusercontent.com/tettuan/frontmatter-to-schema/main/cli.ts
```

## Usage

### Basic CLI Usage

```bash
# After installation (via deno install):
frontmatter-to-schema schema.json docs/ output.json

# For direct execution without installation:
./cli.ts schema.json docs/ output.json

# With custom template
frontmatter-to-schema schema.json docs/ output.json --template template.json

# Process with glob pattern
frontmatter-to-schema schema.json "**/*.md" output.yaml

# Enable verbose logging
frontmatter-to-schema schema.json docs/ output.json --verbose

# Generate prompt for schema/template creation
frontmatter-to-schema schema.json docs/ output.json --generate-prompt
```

### Programmatic Usage

```typescript
import { PipelineConfig, PipelineOrchestrator } from "./mod.ts";

const config: PipelineConfig = {
  schemaPath: "./schema.json",
  templatePath: "./template.json",
  inputPattern: "./docs",
  destinationPath: "./output.json",
};

const orchestrator = await PipelineOrchestrator.create(config);
const result = await orchestrator.execute();

if (result.ok) {
  console.log("Processing complete:", result.data);
} else {
  console.error("Error:", result.error);
}
```

### Schema Configuration

Create a JSON Schema file (`schema.json`):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "template.json",
  "required": ["title", "date"],
  "properties": {
    "title": { "type": "string" },
    "date": { "type": "string", "format": "date" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "commands": {
      "type": "array",
      "x-frontmatter-part": true,
      "items": { "$ref": "command_schema.json" }
    },
    "availableConfigs": {
      "type": "array",
      "x-derived-from": "commands[].config",
      "x-derived-unique": true
    }
  }
}
```

## Examples

### Basic Frontmatter Extraction

```bash
# Run basic example
cd examples/1.articles
./run.sh

# Or manually
frontmatter-to-schema articles_schema.json docs/ articles-index-output.yml \
  --template articles_template.json
```

Input markdown:

```markdown
---
title: Getting Started
date: 2024-01-15
tags: [tutorial, beginner]
---

# Content here...
```

Output JSON:

```json
{
  "title": "Getting Started",
  "date": "2024-01-15",
  "tags": ["tutorial", "beginner"],
  "metadata": {
    "source": "getting-started.md",
    "processed": "2024-01-20T10:30:00Z"
  }
}
```

### Advanced Schema Mapping

```bash
# Run Climpt registry example (complex nested schemas)
cd examples/2.climpt
./run.sh

# Or manually
frontmatter-to-schema registry_schema.json prompts/ climpt-registry-output.json \
  --template registry_template.json
```

## Architecture

### Domain-Driven Design with Totality

```
src/
├── domain/               # Core business logic (pure, no I/O)
│   ├── frontmatter/      # Frontmatter processing domain
│   ├── schema/           # Schema validation domain
│   ├── template/         # Template rendering domain
│   ├── aggregation/      # Data aggregation domain
│   ├── configuration/    # Configuration management
│   └── shared/           # Shared types, errors, utilities
├── application/          # Use cases and orchestration
│   ├── services/         # Pipeline orchestrator
│   └── interfaces/       # Port definitions
├── infrastructure/       # External adapters (I/O)
│   ├── file-system/      # File operations
│   ├── caching/          # Schema cache
│   └── logging/          # Debug logging
└── presentation/         # User interfaces
    └── cli/              # Command-line interface
```

### Key Components

- **PipelineOrchestrator**: Coordinates the entire processing pipeline
- **FrontmatterProcessor**: Extracts and processes markdown frontmatter
- **SchemaProcessingService**: Validates data against JSON Schema
- **TemplateRenderer**: Renders data using template files
- **JMESPathFilterService**: Processes x-derived-from expressions
- **Aggregator**: Combines multiple documents into single output
- **BasePropertyPopulator**: Applies schema defaults and transformations

### Processing Pipeline

```
1. Discovery → 2. Extraction → 3. Validation → 4. Transform → 5. Aggregate → 6. Render
     ↓              ↓               ↓              ↓              ↓            ↓
  Find files   Parse YAML     Schema check   Apply derived   Combine      Template
  (glob/dir)   frontmatter    & defaults     fields         documents    output
```

## Development

### Setup Development Environment

```bash
# Install development dependencies
deno cache --reload cli.ts

# Run all tests (using robust test runner)
deno task test

# Run specific test categories
deno task test:unit        # Unit tests only
deno task test:integration # Integration tests
deno task test:e2e         # End-to-end tests

# Run with coverage
deno task test:coverage
deno task coverage:report

# Run CI pipeline
deno task ci
```

### Testing

```bash
# Run all tests with robust runner
deno task test

# Run specific test file
deno test --allow-all tests/unit/frontmatter-processor_test.ts

# Run with coverage (saves to tmp/coverage)
deno task test:coverage
deno task coverage:report

# Run with debug logging
DEBUG_LEVEL=3 deno test --allow-all

# Test categories:
# - unit/: Domain logic tests
# - integration/: Cross-boundary tests
# - e2e/: Full CLI workflow tests
# - specifications/: TDD compliance tests
# - performance/: Performance benchmarks
```

### Code Quality

- **Test Coverage**: 80%+ maintained (281 tests passing)
- **Type Safety**: Strict TypeScript with discriminated unions
- **Error Handling**: Result<T, E> pattern throughout
- **Code Style**: Deno formatter and linter standards
- **Architecture**: DDD with Totality principles
- **Testing**: TDD with specification-driven development

## API Reference

### Core Classes

#### PipelineOrchestrator

```typescript
class PipelineOrchestrator {
  static create(config: PipelineConfig): Promise<PipelineOrchestrator>;
  execute(): Promise<Result<ProcessingSuccess, ProcessingError>>;
}

interface PipelineConfig {
  schemaPath: string;
  inputPattern: string;
  destinationPath: string;
  templatePath?: string;
  verbosity?: VerbosityConfig;
}
```

#### SchemaDefinition

```typescript
interface SchemaDefinition {
  required?: string[];
  properties: Record<string, PropertyDefinition>;
  additionalProperties?: boolean;
}
```

#### Result Type

```typescript
type Result<T, E> = Ok<T> | Err<E>;

interface Ok<T> {
  isOk(): true;
  value: T;
}

interface Err<E> {
  isErr(): true;
  error: E;
}
```

## CLI Usage

```bash
# Basic command structure
frontmatter-to-schema <schema> <input> <output> [options]

# Arguments
<schema>    Path to JSON schema file
<input>     Directory, glob pattern, or file path
<output>    Output file path (.json or .yaml)

# Options
--template, -t        Custom template file
--verbose            Enable verbose logging
--generate-prompt    Generate schema/template creation prompt
--help, -h          Show help message
--version, -v       Show version

# Permissions required
--allow-read        Read files
--allow-write       Write output
--allow-env         Debug logging (optional)
--allow-run         External commands (optional)
```

## Schema Extensions (x-* Properties)

This application defines custom JSON Schema extensions for enhanced
functionality:

### x-template

Specifies the template file to use for rendering output from this schema.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "registry_template.json",
  "properties": {
    // ... schema properties
  }
}
```

### x-frontmatter-part

Marks array properties for individual frontmatter processing. When `true`, each
item in the array corresponds to a separate markdown file.

```json
{
  "commands": {
    "type": "array",
    "x-frontmatter-part": true,
    "items": { "$ref": "command_schema.json" }
  }
}
```

### x-derived-from

Creates derived fields by aggregating values from nested properties. Uses simple
array notation with dot-path expressions.

```json
{
  "availableConfigs": {
    "type": "array",
    "x-derived-from": "commands[].c1",
    "x-derived-unique": true,
    "items": { "type": "string" }
  }
}
```

**Supported expressions:**

- `items[].property` - Extract property from array items
- `nested.items[].deep.property` - Navigate nested structures

**Not supported:**

- JMESPath filter expressions like `items[?status==true]`
- Complex queries or transformations

### x-derived-unique

When used with `x-derived-from`, ensures derived values are unique (removes
duplicates).

### x-jmespath-filter

Applies JMESPath expressions for advanced data filtering and transformation.

```json
{
  "filteredData": {
    "type": "array",
    "x-jmespath-filter": "items[?status==`active`].name"
  }
}
```

### x-template-format

Specifies the output format for the template rendering (json, yaml, etc.).

### x-template-items

Specifies a separate template file for rendering array items when using
dual-template rendering with `x-frontmatter-part`.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "main_template.json",
  "x-template-items": "item_template.json",
  "properties": {
    "commands": {
      "type": "array",
      "x-frontmatter-part": true,
      "items": { "$ref": "command_schema.json" }
    }
  }
}
```

## Template Writing Guidelines

### Array Expansion with {@items}

The `{@items}` placeholder provides special array expansion functionality, but
its behavior depends on how it's positioned in the JSON template:

#### ✅ Correct Usage (Object Property Value)

```json
{
  "version": "{version}",
  "description": "{description}",
  "tools": {
    "commands": "{@items}"
  }
}
```

**Result**: `{@items}` is replaced with the actual array data:

```json
{
  "version": "1.0.0",
  "description": "Basic command registry example",
  "tools": {
    "commands": [
      { "id": "command1" },
      { "id": "command2" }
    ]
  }
}
```

#### ❌ Incorrect Usage (Array Element)

```json
{
  "version": "{version}",
  "description": "{description}",
  "tools": {
    "commands": ["{@items}"]
  }
}
```

**Result**: `{@items}` is treated as a regular string and remains unreplaced:

```json
{
  "version": "1.0.0",
  "description": "Basic command registry example",
  "tools": {
    "commands": ["{@items}"]
  }
}
```

#### Key Rules

- **`{@items}` must be the complete property value** - not embedded in arrays or
  other structures
- **Array expansion only occurs when positioned as an object property value**
- **Use exact match**: `"property": "{@items}"` (works),
  `"property": "[{@items}]"` (doesn't work)

This design ensures type-safe JSON generation while maintaining clear template
semantics.

## Output Formats

The tool automatically detects output format based on file extension:

| Extension | Format | Description                        |
| --------- | ------ | ---------------------------------- |
| `.json`   | JSON   | Formatted JSON with 2-space indent |
| `.yaml`   | YAML   | YAML format with proper structure  |
| `.yml`    | YAML   | Same as .yaml                      |

### Supported Input Patterns

| Pattern Type | Example        | Description                |
| ------------ | -------------- | -------------------------- |
| Directory    | `docs/`        | All .md files in directory |
| Glob         | `**/*.md`      | All .md files recursively  |
| Specific     | `docs/**/*.md` | .md files under docs/      |
| Single file  | `readme.md`    | Single markdown file       |

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

### Development Guidelines

- Follow DDD and Totality principles
- Write tests first (TDD)
- Use Result<T, E> pattern for all error handling
- Document public APIs with JSDoc
- Keep coverage above 80%
- Use discriminated unions for type safety
- Avoid hardcoding - use value objects and registries

## Support

- Issues:
  [GitHub Issues](https://github.com/tettuan/frontmatter-to-schema/issues)
- Repository: [GitHub](https://github.com/tettuan/frontmatter-to-schema)
- Docs: [Documentation](./docs)
- Examples: [Example Directory](./examples)

## Acknowledgments

Built with:

- [Deno](https://deno.land) - Runtime and toolchain
- [JSR](https://jsr.io) - Package registry for dependencies
- [@tettuan/breakdownlogger](https://jsr.io/@tettuan/breakdownlogger) - Enhanced
  debug logging
- [@halvardm/jmespath](https://jsr.io/@halvardm/jmespath) - JMESPath expressions
- [@std/*](https://jsr.io/@std) - Deno standard library
