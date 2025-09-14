# Frontmatter-to-Schema

A Deno-based tool for extracting frontmatter from Markdown files and
transforming it into structured schemas using AI-powered analysis.

## Features

- **Intelligent Processing**: Advanced frontmatter extraction and schema
  generation
- **Two-Stage Processing**: Extraction followed by template-based transformation
- **Schema-Driven**: Define custom schemas for consistent data structures
- **DDD Architecture**: Clean domain-driven design with clear boundaries
- **Type-Safe**: Full TypeScript with Result pattern for error handling
- **Extensible**: Adapter pattern for custom processing pipelines

## Installation

### Prerequisites

- Deno 1.40+ installed
- Claude API key (for AI features)

### Quick Install

```bash
# Clone repository
git clone https://github.com/yourusername/frontmatter-to-schema.git
cd frontmatter-to-schema

# Run installation script
./scripts/frontmatter-install.sh
```

### Manual Setup

```bash
# Install dependencies
deno cache mod.ts

# Set Claude API key
export ANTHROPIC_API_KEY="your-api-key"
```

## Usage

### Basic CLI Usage

```bash
# Process with default config
deno run --allow-all src/main.ts

# Use custom config
deno run --allow-all src/main.ts --config path/to/config.json

# Process specific directory
deno run --allow-all src/main.ts --input ./docs --output ./output
```

### Programmatic Usage

```typescript
import { FrontmatterProcessor } from "./mod.ts";

const processor = new FrontmatterProcessor({
  inputDir: "./docs",
  outputDir: "./output",
  schema: {
    title: "string",
    tags: "array",
    date: "date",
  },
});

const result = await processor.process();
if (result.isOk()) {
  console.log("Processing complete:", result.value);
}
```

### Configuration

Create a `config.json` file:

```json
{
  "input": {
    "directory": "./docs",
    "patterns": ["**/*.md"],
    "exclude": ["**/draft-*.md"]
  },
  "output": {
    "directory": "./output",
    "format": "json"
  },
  "schema": {
    "required": ["title", "date"],
    "properties": {
      "title": { "type": "string" },
      "date": { "type": "string", "format": "date" },
      "tags": { "type": "array", "items": { "type": "string" } }
    }
  },
  "ai": {
    "model": "claude-3-sonnet",
    "temperature": 0.3
  }
}
```

## Examples

### Basic Frontmatter Extraction

```bash
# Run basic example
deno task example:articles
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
# Run advanced example with custom schema
deno task example:climpt
```

## Architecture

### Domain-Driven Design

```
src/
├── domain/          # Core business logic
│   ├── core/        # Value objects, entities
│   ├── models/      # Domain models
│   └── services/    # Domain services
├── application/     # Use cases
├── infrastructure/  # External adapters
└── presentation/    # CLI, API interfaces
```

### Key Components

- **FrontMatterExtractor**: Parses markdown frontmatter
- **SchemaValidator**: Validates against defined schemas
- **AIAnalyzer**: Claude-powered content analysis
- **TemplateMapper**: Maps extracted data to templates
- **RegistryBuilder**: Creates output registries

### Processing Pipeline

```
1. Discovery → 2. Extraction → 3. Validation → 4. Analysis → 5. Output
     ↓              ↓              ↓              ↓            ↓
  Find files   Parse front    Check schema   AI enhance   Generate
               matter                                      registry
```

## Development

### Setup Development Environment

```bash
# Install development dependencies
deno cache --reload mod.ts

# Run tests
deno task test

# Run with watch mode
deno task dev

# Run CI pipeline
deno task ci
```

### Testing

```bash
# Run all tests
deno test --allow-all

# Run specific test file
deno test --allow-all tests/domain/core/frontmatter_test.ts

# Run with coverage
deno test --allow-all --coverage=coverage
deno coverage coverage --lcov > coverage.lcov

# Run with debug logging (using breakdownlogger)
deno test --allow-all --env=DEBUG_LEVEL=debug
```

### Code Quality

- **Test Coverage**: Minimum 80% required
- **Type Safety**: Strict TypeScript with no `any`
- **Error Handling**: Result pattern, no exceptions
- **Code Style**: Deno formatter standards

## API Reference

### Core Classes

#### FrontmatterProcessor

```typescript
class FrontmatterProcessor {
  constructor(config: ProcessorConfig);
  process(): Promise<Result<ProcessingResult, ProcessingError>>;
  validate(data: unknown): Result<ValidatedData, ValidationError>;
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

## CLI Commands

```bash
# Main commands
frontmatter-to-schema process    # Process markdown files
frontmatter-to-schema validate   # Validate schemas
frontmatter-to-schema analyze    # Run AI analysis

# Options
--config, -c     Config file path
--input, -i      Input directory
--output, -o     Output directory
--schema, -s     Schema file path
--verbose, -v    Verbose output
--help, -h       Show help
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

Creates derived fields by aggregating values from nested properties. Uses
JSONPath-like expressions.

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

### x-derived-unique

When used with `x-derived-from`, ensures derived values are unique (removes
duplicates).

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

## Configuration Options

| Option            | Type     | Default           | Description        |
| ----------------- | -------- | ----------------- | ------------------ |
| `input.directory` | string   | `./docs`          | Source directory   |
| `input.patterns`  | string[] | `["**/*.md"]`     | File patterns      |
| `output.format`   | string   | `json`            | Output format      |
| `ai.enabled`      | boolean  | `true`            | Enable AI analysis |
| `ai.model`        | string   | `claude-3-sonnet` | AI model           |
| `schema.strict`   | boolean  | `false`           | Strict validation  |

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

### Development Guidelines

- Follow DDD principles
- Write tests first (TDD)
- Use Result pattern for errors
- Document public APIs
- Keep coverage above 80%

## Support

- Issues:
  [GitHub Issues](https://github.com/yourusername/frontmatter-to-schema/issues)
- Docs: [Documentation](./docs)
- Examples: [Example Directory](./examples)

## Acknowledgments

Built with:

- [Deno](https://deno.land) - Runtime
- [JSR](https://jsr.io) - Package Registry
- [@tettuan/breakdownlogger](https://jsr.io/@tettuan/breakdownlogger) - Debug
  logging and test analysis
