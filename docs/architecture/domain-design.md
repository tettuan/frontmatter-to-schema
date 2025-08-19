# Domain-Driven Design Architecture

## Core Domain Concepts

### Bounded Contexts

1. **Document Processing Context**
   - Responsible for markdown file discovery and frontmatter extraction
   - Entities: Document, FrontMatter
   - Value Objects: DocumentPath, FrontMatterContent

2. **Schema Analysis Context**
   - Handles AI-powered analysis and schema validation
   - Entities: Schema, AnalysisResult
   - Value Objects: SchemaDefinition, ValidationRule

3. **Template Mapping Context**
   - Maps analyzed data to output templates
   - Entities: Template, MappingResult
   - Value Objects: TemplateFormat, MappingRule

4. **Configuration Context**
   - Manages system configuration and runtime settings
   - Entities: Configuration, ProcessingPipeline
   - Value Objects: ConfigPath, OutputFormat

## Domain Model

### Entities

```typescript
// Document Entity
class Document {
  readonly id: DocumentId
  readonly path: DocumentPath
  readonly frontMatter: FrontMatter
  readonly content: DocumentContent
}

// Schema Entity
class Schema {
  readonly id: SchemaId
  readonly definition: SchemaDefinition
  readonly version: SchemaVersion
}

// Template Entity
class Template {
  readonly id: TemplateId
  readonly format: TemplateFormat
  readonly mappingRules: MappingRule[]
}

// AnalysisResult Entity
class AnalysisResult {
  readonly id: AnalysisId
  readonly document: Document
  readonly extractedData: ExtractedData
  readonly mappedData: MappedData
}
```

### Value Objects

```typescript
// Paths and Locations
class DocumentPath { /* Smart constructor with validation */ }
class ConfigPath { /* Smart constructor with validation */ }
class OutputPath { /* Smart constructor with validation */ }

// Content Types
class FrontMatterContent { /* Validated frontmatter */ }
class DocumentContent { /* Document body content */ }
class SchemaDefinition { /* JSON Schema or similar */ }
class TemplateFormat { /* Template structure */ }

// Rules and Configurations
class ValidationRule { /* Schema validation rules */ }
class MappingRule { /* Data transformation rules */ }
class ProcessingOptions { /* Runtime options */ }
```

### Domain Services

```typescript
interface FrontMatterExtractor {
  extract(document: Document): Result<FrontMatter, ExtractionError>
}

interface SchemaAnalyzer {
  analyze(frontMatter: FrontMatter, schema: Schema): Result<ExtractedData, AnalysisError>
}

interface TemplateMapper {
  map(data: ExtractedData, template: Template): Result<MappedData, MappingError>
}

interface ResultAggregator {
  aggregate(results: AnalysisResult[]): Result<AggregatedResult, AggregationError>
}
```

### Repositories

```typescript
interface DocumentRepository {
  findAll(path: DocumentPath): Result<Document[], RepositoryError>
  findByPattern(pattern: string): Result<Document[], RepositoryError>
}

interface SchemaRepository {
  load(path: ConfigPath): Result<Schema, RepositoryError>
  validate(schema: Schema): Result<void, ValidationError>
}

interface TemplateRepository {
  load(path: ConfigPath): Result<Template, RepositoryError>
  validate(template: Template): Result<void, ValidationError>
}

interface ResultRepository {
  save(result: AggregatedResult, path: OutputPath): Result<void, RepositoryError>
}
```

## Application Layer

### Use Cases

```typescript
class ProcessDocumentsUseCase {
  execute(config: ProcessingConfig): Result<ProcessingResult, ProcessingError>
}

class AnalyzeDocumentUseCase {
  execute(document: Document, config: AnalysisConfig): Result<AnalysisResult, AnalysisError>
}

class GenerateIndexUseCase {
  execute(results: AnalysisResult[], template: Template): Result<Index, GenerationError>
}
```

### Application Services

```typescript
class DocumentProcessor {
  process(config: ProcessingConfig): Result<ProcessingResult, ProcessingError>
}

class ConfigurationManager {
  load(path: ConfigPath): Result<Configuration, ConfigError>
  validate(config: Configuration): Result<void, ValidationError>
}
```

## Infrastructure Layer

### Adapters

```typescript
// File System Adapter
class DenoFileSystemAdapter implements DocumentRepository, ResultRepository {
  // Implementation using Deno APIs
}

// AI Analyzer Adapter
class ClaudeAnalyzerAdapter implements SchemaAnalyzer {
  // Implementation using Claude API
}

// Template Engine Adapter
class HandlebarsTemplateAdapter implements TemplateMapper {
  // Implementation using template engine
}
```

### Ports

```typescript
interface FileSystem {
  read(path: string): Promise<Result<string, IOError>>
  write(path: string, content: string): Promise<Result<void, IOError>>
  list(path: string): Promise<Result<string[], IOError>>
}

interface AIAnalyzer {
  analyze(prompt: string, content: string): Promise<Result<string, AnalysisError>>
}

interface TemplateEngine {
  render(template: string, data: unknown): Result<string, RenderError>
}
```

## Dependency Flow

```
Domain Layer (Core)
    ↑
Application Layer (Use Cases)
    ↑
Infrastructure Layer (Adapters)
    ↑
Main (Composition Root)
```

## Key Design Principles

1. **Hexagonal Architecture**: Core domain is independent of external dependencies
2. **Dependency Inversion**: Adapters depend on domain interfaces, not vice versa
3. **Result Types**: All operations return Result<T, E> for totality
4. **Smart Constructors**: Value objects validate at construction time
5. **Immutability**: All domain objects are immutable
6. **Configuration Injection**: No hardcoded values, all config is external