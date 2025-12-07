# frontmatter-to-schema

Extract YAML frontmatter from Markdown files and transform it into structured
data using JSON Schema.

[![JSR](https://jsr.io/badges/@aidevtool/frontmatter-to-schema)](https://jsr.io/@aidevtool/frontmatter-to-schema)

## Overview

**frontmatter-to-schema** solves the problem of extracting and transforming
structured metadata from Markdown files. It's ideal for:

- **Documentation systems**: Build indexes, registries, or catalogs from
  Markdown frontmatter
- **Static site generators**: Extract metadata for navigation, search, or
  categorization
- **Content management**: Aggregate content metadata across multiple files
- **Configuration generation**: Transform human-readable Markdown into
  machine-readable configs

### Key Features

- **Schema-driven validation**: Define expected structure with JSON Schema
- **Template-based output**: Transform data into any JSON/YAML structure
- **Flexible input**: Process single files, directories, or glob patterns
- **Type-safe API**: Full TypeScript with Result pattern error handling
- **Custom extensions**: `x-derived-from`, `x-collect-pattern`, and more

## Installation

### As a Library (JSR)

```typescript
import {
  processFiles,
  processMarkdown,
} from "jsr:@aidevtool/frontmatter-to-schema";
```

Or add to your `deno.json`:

```json
{
  "imports": {
    "@aidevtool/frontmatter-to-schema": "jsr:@aidevtool/frontmatter-to-schema@^1.5.0"
  }
}
```

### As a CLI Tool

```bash
deno install --allow-read --allow-write --allow-env \
  --name frontmatter-to-schema \
  jsr:@aidevtool/frontmatter-to-schema/cli
```

## Quick Start

### Library Usage

#### Process Markdown String

```typescript
import { processMarkdown } from "jsr:@aidevtool/frontmatter-to-schema";

const result = await processMarkdown({
  markdown: `---
title: Getting Started
author: John Doe
tags: [tutorial, beginner]
---
# Welcome
This is the content.`,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      author: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
  },
});

if (result.isOk()) {
  console.log(result.unwrap().data);
  // { title: "Getting Started", author: "John Doe", tags: ["tutorial", "beginner"] }
}
```

#### Process Multiple Files

```typescript
import { processFiles } from "jsr:@aidevtool/frontmatter-to-schema";

const result = await processFiles({
  schema: "./schema.json",
  input: "./docs/",
  output: "./output.json",
  template: "./template.json", // Optional if schema has x-template
});

if (result.isOk()) {
  console.log(`Processed ${result.unwrap().processedDocuments} files`);
}
```

#### Reusable Processor

```typescript
import { createProcessor } from "jsr:@aidevtool/frontmatter-to-schema";

const processorResult = createProcessor();
if (processorResult.isError()) {
  throw processorResult.unwrapError();
}

const processor = processorResult.unwrap();

// Process multiple batches efficiently
await processor.processFiles({
  schema: "./schema1.json",
  input: "./docs1/",
  output: "./out1.json",
});
await processor.processFiles({
  schema: "./schema2.json",
  input: "./docs2/",
  output: "./out2.json",
});
```

### CLI Usage

```bash
# Basic usage
frontmatter-to-schema schema.json docs/ output.json

# With custom template
frontmatter-to-schema schema.json docs/ output.json --template template.json

# YAML output
frontmatter-to-schema schema.json docs/ output.yaml
```

## Example: Building a Document Registry

### Input: `docs/api-guide.md`

```markdown
---
title: API Guide
category: documentation
version: 2.0
tags: [api, reference]
---

# API Guide

...
```

### Schema: `schema.json`

```json
{
  "type": "object",
  "x-template": "template.json",
  "properties": {
    "title": { "type": "string" },
    "category": { "type": "string" },
    "version": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["title"]
}
```

### Template: `template.json`

```json
{
  "documents": "{@items}",
  "generatedAt": "{$timestamp}"
}
```

### Output: `registry.json`

```json
{
  "documents": [
    {
      "title": "API Guide",
      "category": "documentation",
      "version": "2.0",
      "tags": ["api", "reference"]
    }
  ],
  "generatedAt": "2025-01-15T10:30:00Z"
}
```

## API Reference

### Primary Functions

| Function                   | Description                        |
| -------------------------- | ---------------------------------- |
| `processMarkdown(options)` | Process a single markdown string   |
| `processFiles(options)`    | Process files from disk            |
| `createProcessor()`        | Create reusable processor instance |
| `run(args)`                | Execute CLI programmatically       |

### Types

```typescript
interface ProcessMarkdownOptions {
  markdown: string; // Raw markdown with YAML frontmatter
  schema: JsonSchema; // JSON Schema for validation
  template?: Template; // Optional output template
}

interface ProcessMarkdownResult {
  data: Record<string, unknown>; // Transformed data
  rawFrontmatter: Record<string, unknown>; // Original frontmatter
  body: string; // Markdown body
}

interface ProcessFilesOptions {
  schema: string; // Path to schema file
  input: string | string[]; // Input path(s)
  output: string; // Output file path
  template?: string; // Optional template path
  format?: "json" | "yaml"; // Output format
}

interface ProcessFilesResult {
  processedDocuments: number;
  outputPath: string;
  executionTime: number;
}
```

### Error Handling

All functions return `Result<T, ProcessingError>`:

```typescript
const result = await processMarkdown({ ... });

if (result.isOk()) {
  const data = result.unwrap();
  // Use data
} else {
  const error = result.unwrapError();
  console.error(error.message, error.code);
}
```

## Schema Extensions

Custom JSON Schema extensions for enhanced functionality:

| Extension            | Description                                  |
| -------------------- | -------------------------------------------- |
| `x-template`         | Template file path for output rendering      |
| `x-template-items`   | Item template for array rendering            |
| `x-template-format`  | Output format specification (json/yaml)      |
| `x-frontmatter-part` | Mark array for individual file processing    |
| `x-derived-from`     | Derive values from nested properties         |
| `x-derived-unique`   | Remove duplicates from derived values        |
| `x-flatten-arrays`   | Flatten nested array structures              |
| `x-collect-pattern`  | Collect properties matching regex pattern    |
| `x-map-from`         | Map from alternative property names          |
| `x-jmespath-filter`  | Apply JMESPath expression for transformation |

For detailed documentation, syntax, and examples, see
**[Schema Extensions Reference](./docs/schema-extensions.md)**.

## Advanced Usage

### Custom File System Adapter

```typescript
import { createProcessor } from "jsr:@aidevtool/frontmatter-to-schema";

const processor = createProcessor({
  fileSystem: myCustomAdapter, // Implement FileSystemPort interface
});
```

### Direct Pipeline Access

```typescript
import {
  DenoFileSystemAdapter,
  PipelineOrchestrator,
} from "jsr:@aidevtool/frontmatter-to-schema";

const fs = DenoFileSystemAdapter.create();
const orchestrator = PipelineOrchestrator.create(fs);

const result = await orchestrator.unwrap().execute({
  schemaPath: "./schema.json",
  templatePath: "./template.json",
  inputPath: "./docs/",
  outputPath: "./output.json",
  outputFormat: "json",
});
```

## Development

```bash
# Run tests
deno task test

# Type check
deno check mod.ts

# Format
deno fmt

# Lint
deno lint
```

For detailed development guidelines, see [docs/](./docs/).

## License

MIT
