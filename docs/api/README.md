# FrontMatter to Schema API Documentation

## Overview

A Domain-Driven Design (DDD) implementation for extracting, analyzing, and
transforming markdown frontmatter using flexible schemas and templates. Built
with TypeScript/Deno following totality principles and AI-complexity control.

## Core Architecture

### Domain Layer

#### Value Objects

Smart constructors ensuring type safety and validation:

```typescript
import {
  DocumentPath,
  SchemaDefinition,
} from "./domain/models/value-objects.ts";

// All constructors return Result<T, E> types
const pathResult = DocumentPath.create("/docs/article.md");
if (pathResult.ok) {
  const path = pathResult.data;
  console.log(path.getValue()); // "/docs/article.md"
  console.log(path.getFilename()); // "article.md"
  console.log(path.getDirectory()); // "/docs"
}
```

#### Entities

Core domain models with business logic:

```typescript
import { Document, Schema, Template } from "./domain/models/entities.ts";

const document = Document.create(path, frontMatter, content);
const schema = Schema.create(id, definition, version);
const template = Template.create(id, format, mappingRules);
```

### Application Layer

#### Use Cases

Orchestrate domain operations:

```typescript
import { ProcessDocumentsUseCase } from "./application/use-cases/process-documents.ts";

const useCase = new ProcessDocumentsUseCase(
  documentRepo,
  schemaRepo,
  templateRepo,
  resultRepo,
  frontMatterExtractor,
  schemaAnalyzer,
  templateMapper,
  resultAggregator,
);

const result = await useCase.execute({
  config: processingConfiguration,
});
```

### Infrastructure Layer

#### Repositories

Data access implementations:

```typescript
import { DenoDocumentRepository } from "./infrastructure/adapters/deno-document-repository.ts";

const repo = new DenoDocumentRepository();
const documents = await repo.findAll(DocumentPath.create("./docs"));
```

#### Adapters

External service integrations:

```typescript
import { TypeScriptSchemaAnalyzer } from "./infrastructure/adapters/typescript-schema-analyzer.ts";

const analyzer = new TypeScriptSchemaAnalyzer();
const result = await analyzer.analyze(frontMatter, schema);
```

## Configuration

### Processing Configuration

```json
{
  "documentsPath": "./docs",
  "schemaPath": "./schema.json",
  "templatePath": "./template.yaml",
  "outputPath": "./output.json",
  "options": {
    "parallel": true,
    "maxConcurrency": 5,
    "continueOnError": false
  }
}
```

### Schema Definition

```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "author": { "type": "string" },
    "tags": {
      "type": "array",
      "items": { "type": "string" }
    },
    "published": { "type": "boolean" }
  },
  "required": ["title", "author"]
}
```

### Template Formats

Supports multiple template formats:

- JSON with placeholders: `{"name": "{name}"}`
- YAML mappings
- Handlebars templates
- Custom transformations

## CLI Usage

### Basic Command

```bash
deno run --allow-read --allow-write --allow-env main.ts \
  --documents ./docs \
  --schema ./schema.json \
  --template ./template.yaml \
  --output ./results.json
```

### Configuration File

```bash
deno run --allow-read --allow-write --allow-env main.ts \
  --config ./config.json
```

## Error Handling

All operations follow Result type pattern:

```typescript
type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// Usage
const result = await processor.process(documents);
if (result.ok) {
  console.log(`Processed ${result.data.processedCount} documents`);
} else {
  console.error(`Error: ${result.error.message}`);
}
```

## Testing

Run comprehensive test suite:

```bash
# All tests
deno test

# Specific domain tests
deno test tests/domain/

# With coverage
deno test --coverage
```

## Performance

- Parallel processing with configurable concurrency
- Smart constructor caching for value objects
- Lazy evaluation of transformations
- Optimized for large document sets

## Extension Points

### Custom Analyzers

Implement `SchemaAnalyzer` interface:

```typescript
interface SchemaAnalyzer {
  analyze(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Promise<Result<ExtractedData, AnalysisError>>;
}
```

### Custom Mappers

Implement `TemplateMapper` interface:

```typescript
interface TemplateMapper {
  map(
    data: ExtractedData,
    template: Template,
  ): Result<MappedData, MappingError>;
}
```

## Examples

See `/examples` directory for:

- `climpt-registry/` - Command registry generation
- `articles-index/` - Blog article indexing
- Complete end-to-end workflows

## License

MIT
