# Template Output Subdomain Separation

## Current Architecture

The template output domain is orchestrated by `OutputRenderingService`, which is
called by `PipelineOrchestrator`. The flow is:

`PipelineOrchestrator` → `OutputRenderingService` → `TemplateRenderer`

The `OutputRenderingService` handles:

1. **Dual-Template Processing** - Main template and items template coordination
2. **Variable Replacement** - Replacing template variables with data values
3. **Template Composition** - Combining items template results into main
   template

See `template-processing-specification.md` Section 5.2 for the authoritative
specification.

## Subdomain Architecture

### 1. List Aggregation Subdomain

**Responsibility**: Generate aggregate views from multiple documents

```
domain/template/list-aggregation/
├── services/
│   ├── ListAggregatorService.ts      # Orchestrates list creation
│   └── IndexGeneratorService.ts      # Generates index structures
├── value-objects/
│   ├── AggregateList.ts             # Represents aggregated list data
│   └── ListTemplate.ts              # Template for list rendering
└── renderers/
    └── ListRenderer.ts               # Specialized list rendering logic
```

**Key Characteristics**:

- Receives array of processed frontmatter data
- Creates unified list structures (e.g., command registry, index files)
- Handles sorting, filtering, and grouping operations
- Outputs single aggregate file

### 2. Document Processing Subdomain

**Responsibility**: Process individual frontmatter documents

```
domain/template/document-processing/
├── services/
│   ├── DocumentIteratorService.ts     # Iterates through documents
│   ├── DocumentTransformService.ts    # Transforms individual documents
│   └── TemplateResolverService.ts     # Resolves x-template-items references
├── value-objects/
│   ├── DocumentTemplate.ts           # Template for single document
│   ├── DocumentOutput.ts             # Processed document output
│   └── TemplateReference.ts          # x-template-items reference handling
└── renderers/
    └── DocumentRenderer.ts            # Individual document rendering
```

**Key Characteristics**:

- Processes documents one at a time
- Applies document-specific templates
- Handles {@items} expansion within single document context
- Outputs multiple individual files

## Domain Boundary Rules

### List Aggregation Subdomain

- **Input**: `FrontmatterData[]` (array of all documents)
- **Processing**: Aggregate operations (merge, group, sort)
- **Output**: Single file (e.g., `registry.json`, `index.json`)
- **Template Variables**: Array-level variables, summary statistics

### Document Processing Subdomain

- **Input**: `FrontmatterData` (single document)
- **Processing**: Individual transformations
- **Output**: Multiple files (one per document)
- **Template Variables**: Document-level variables, {@items} expansion

## Integration Points

```typescript
// PipelineOrchestrator delegates template rendering to OutputRenderingService
class PipelineOrchestrator {
  constructor(
    private readonly documentProcessor: FrontmatterTransformationService,
    private readonly schemaProcessor: SchemaProcessingService,
    private readonly outputRenderingService: OutputRenderingService,
    private readonly fileSystem: FileSystem,
  ) {}

  async execute(config: PipelineConfig): Promise<Result<void, DomainError>> {
    // 1. Process documents and schema
    const processedData = await this.documentProcessor.processDocuments(...);
    const schema = await this.loadSchema(config.schemaPath);

    // 2. Extract items data if needed (x-frontmatter-part)
    const itemsData = this.extractFrontmatterPartData(processedData, schema);

    // 3. Delegate to OutputRenderingService for template rendering
    return this.outputRenderingService.renderOutput(
      templatePath,
      itemsTemplatePath,
      mainData,
      itemsData,
      config.outputPath,
    );
  }
  }
}

// Cross-domain coordination for template-schema handoff
interface TemplateSchemaCoordinator {
  resolveTemplateContext(
    schema: Schema,
  ): Promise<Result<TemplateHandoffContext, ProcessingError>>;
}
```

## Benefits

1. **Clear Responsibilities**: Each subdomain has a single, well-defined purpose
2. **Improved Testability**: Isolated testing of list vs. document processing
3. **Better Maintainability**: Changes to list processing don't affect document
   processing
4. **Type Safety**: Distinct types for list vs. document operations
5. **Scalability**: Can optimize each subdomain independently

## Migration Strategy

1. **Phase 1**: Create subdomain structure without breaking existing
   functionality
2. **Phase 2**: Gradually move existing code to appropriate subdomains
3. **Phase 3**: Refactor interfaces to enforce subdomain boundaries
4. **Phase 4**: Remove legacy mixed-responsibility code

## Implementation Principles

1. **Totality**: Each subdomain must handle all cases within its scope
2. **DDD Alignment**: Subdomains represent distinct business capabilities
3. **No Cross-Contamination**: List processing logic never appears in document
   processing
4. **Clear Contracts**: Well-defined interfaces between subdomains

## Authority

This architectural decision establishes the definitive structure for template
output processing. All template-related development must align with these
subdomain boundaries.
