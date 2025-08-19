# Domain Boundaries and Architecture Design

## Core Principles

1. **Schema-Driven Processing**: All transformations are driven by external schemas
2. **Template-Based Output**: All outputs are generated from external templates
3. **Complete Abstraction**: No specific use case logic in core domain
4. **Configuration-Based**: All specifics are provided via configuration

## Domain Boundaries

### 1. Core Domain
**Responsibility**: Pure business logic for markdown processing and transformation

- **Entities**:
  - `Document`: Represents a markdown file with frontmatter
  - `Schema`: Represents a validation/transformation schema
  - `Template`: Represents an output template
  - `TransformationResult`: Result of applying schema to document

- **Value Objects**:
  - `FrontMatter`: Extracted frontmatter data
  - `DocumentPath`: Path to a document
  - `SchemaDefinition`: Schema structure
  - `TemplateDefinition`: Template structure

- **Domain Services**:
  - `FrontMatterExtractor`: Extracts frontmatter from markdown
  - `SchemaValidator`: Validates data against schema
  - `TemplateMapper`: Maps data to template format

### 2. Application Layer
**Responsibility**: Orchestration and use case implementation

- **Use Cases**:
  - `ProcessDocumentBatch`: Process multiple documents
  - `TransformWithSchema`: Apply schema transformation
  - `GenerateIndex`: Generate index from transformed data

- **Application Services**:
  - `DocumentProcessor`: Orchestrates document processing
  - `BatchProcessor`: Handles batch operations
  - `ConfigurationLoader`: Loads and validates configuration

### 3. Infrastructure Layer
**Responsibility**: External system integration

- **Adapters**:
  - `FileSystemAdapter`: File I/O operations
  - `ClaudeAPIAdapter`: Claude API integration
  - `YamlAdapter`: YAML parsing/generation
  - `JsonAdapter`: JSON parsing/generation

- **Repositories**:
  - `DocumentRepository`: Document persistence
  - `SchemaRepository`: Schema storage
  - `TemplateRepository`: Template storage

### 4. Presentation Layer
**Responsibility**: User interaction

- **CLI**:
  - `CommandParser`: Parse command arguments
  - `ConfigurationReader`: Read configuration files
  - `OutputFormatter`: Format results for display

## Data Flow

```
1. Configuration → Application Layer
2. Application Layer → Document Discovery (Infrastructure)
3. Documents → FrontMatter Extraction (Domain)
4. FrontMatter + Schema → Claude Analysis (Infrastructure)
5. Analysis Result → Template Mapping (Domain)
6. Mapped Result → Output Generation (Infrastructure)
```

## Configuration Structure

```typescript
interface ProcessingConfiguration {
  // Input configuration
  input: {
    path: string;           // Path to markdown files
    pattern?: string;       // File pattern to match
  };
  
  // Schema configuration
  schema: {
    definition: object;     // JSON Schema or other schema format
    format: 'json' | 'yaml' | 'custom';
  };
  
  // Template configuration
  template: {
    definition: string;     // Template definition
    format: 'json' | 'yaml' | 'handlebars' | 'custom';
  };
  
  // Output configuration
  output: {
    path: string;           // Output file path
    format: 'json' | 'yaml' | 'markdown';
  };
  
  // Processing configuration
  processing: {
    extractionPrompt?: string;  // Claude prompt for extraction
    mappingPrompt?: string;      // Claude prompt for mapping
    parallel?: boolean;          // Process in parallel
    continueOnError?: boolean;   // Continue if individual file fails
  };
}
```

## Key Abstraction Points

1. **No Hard-coded Schemas**: All schemas are external
2. **No Hard-coded Templates**: All templates are external
3. **No Specific Domain Logic**: No "climpt" or "books" logic in core
4. **Pluggable Processors**: Different processors for different formats
5. **Extensible Adapters**: Easy to add new input/output formats