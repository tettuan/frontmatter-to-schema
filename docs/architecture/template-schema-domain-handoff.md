# Template-Schema Domain Handoff Mechanism

## Overview

The `x-template-items` functionality requires coordination between two distinct
domains:

- **Template Domain**: Processes `{@items}` expansion and needs template
  references
- **Schema Domain**: Contains `x-template-items` declarations and template
  metadata

This document establishes the definitive handoff mechanism between these
domains.

## Domain Responsibility Separation

### Template Domain Responsibilities

- **Template Processing**: Parse and render templates with variable substitution
- **{@items} Detection**: Identify when `{@items}` expansion is required
- **Item Iteration**: Apply item templates to each data element
- **Output Generation**: Produce final rendered output

### Schema Domain Responsibilities

- **Template Reference Storage**: Maintain `x-template-items` declarations
- **Template Path Resolution**: Provide absolute paths to template files
- **Schema Extension Parsing**: Extract template metadata from schema extensions
- **Validation**: Ensure required template references exist

## Handoff Interface Design

### Core Handoff Object

```typescript
interface TemplateHandoffContext {
  readonly containerTemplate: TemplatePath;
  readonly itemsTemplate: TemplatePath | null;
  readonly schemaContext: SchemaContext;
}

interface SchemaContext {
  readonly sourceSchema: Schema;
  readonly resolvedExtensions: SchemaExtensions;
  readonly templateResolutionStrategy: TemplateResolutionStrategy;
}

interface TemplatePath {
  readonly path: string;
  readonly type: "container" | "items";
  readonly source: "x-template" | "x-template-items";
}
```

### Handoff Flow

```
1. Template Domain: Detects {@items} in template
      ↓
2. Template Domain: Requests item template from Schema Domain
      ↓
3. Schema Domain: Resolves x-template-items reference
      ↓
4. Schema Domain: Returns TemplateHandoffContext
      ↓
5. Template Domain: Uses context for {@items} processing
```

## Implementation Architecture

### Template Domain Components

```typescript
// PipelineOrchestrator is the main coordinator that calls OutputRenderingService
class PipelineOrchestrator {
  constructor(
    private readonly documentProcessor: DocumentProcessingService,
    private readonly schemaProcessor: SchemaProcessingService,
    private readonly outputRenderingService: OutputRenderingService,
    private readonly fileSystem: FileSystem,
  ) {}

  // Orchestrates the entire pipeline including template rendering
  async execute(config: PipelineConfig): Promise<Result<void, DomainError>> {
    // ... process documents and schema ...

    // Delegates template rendering to OutputRenderingService
    return this.outputRenderingService.renderOutput(
      templatePath,
      itemsTemplatePath,
      mainData,
      itemsData,
      config.outputPath,
    );
  }
}

// Template Domain - OutputRenderingService orchestrates template processing
// Called by PipelineOrchestrator, coordinates template loading, rendering, and file I/O
class OutputRenderingService {
  constructor(
    private readonly templateRenderer: TemplateRenderer,
    private readonly fileReader: FileReader,
    private readonly fileWriter: FileWriter,
  ) {}

  // Main orchestration method - handles dual-template processing
  renderOutput(
    templatePath: string,
    itemsTemplatePath: string | undefined,
    mainData: FrontmatterData,
    itemsData: FrontmatterData[] | undefined,
    outputPath: string,
  ): Result<void, DomainError> {
    // See template-processing-specification.md Section 5.2 for full details
    // Orchestrates dual-template rendering with variable replacement
  }
}

// TemplateRenderer is the internal rendering engine used by OutputRenderingService
class TemplateRenderer {
  render(
    template: Template,
    data: FrontmatterData,
  ): Result<string, DomainError>;
  renderWithArray(
    template: Template,
    dataArray: FrontmatterData[],
  ): Result<string, DomainError>;
}
```

### Schema Domain Components

```typescript
// Schema Domain - Template Resolution Service
class SchemaTemplateResolver {
  async resolveTemplateContext(
    schema: Schema,
  ): Promise<Result<TemplateHandoffContext, SchemaError>> {
    const extensions = schema.getExtensions();

    // Extract template references
    const containerTemplate = this.extractContainerTemplate(extensions);
    const itemsTemplate = this.extractItemsTemplate(extensions);

    if (!itemsTemplate) {
      return err(createError({
        kind: "MissingTemplateReference",
        message: "x-template-items is required for {@items} expansion",
      }));
    }

    return ok({
      containerTemplate,
      itemsTemplate,
      schemaContext: {
        sourceSchema: schema,
        resolvedExtensions: extensions,
        templateResolutionStrategy: this.getResolutionStrategy(schema),
      },
    });
  }

  private extractItemsTemplate(
    extensions: SchemaExtensions,
  ): TemplatePath | null {
    const itemsTemplateRef = extensions["x-template-items"];

    if (!itemsTemplateRef) {
      return null;
    }

    return {
      path: this.resolveTemplatePath(itemsTemplateRef),
      type: "items",
      source: "x-template-items",
    };
  }
}
```

### Cross-Domain Service

```typescript
// Cross-Domain Coordination Service
class TemplateSchemaCoordinator {
  constructor(
    private readonly templateDomain: TemplateRenderer,
    private readonly schemaDomain: SchemaTemplateResolver,
  ) {}

  async processWithSchemaTemplates(
    schema: Schema,
    data: FrontmatterData[],
  ): Promise<Result<ProcessedOutput, ProcessingError>> {
    // 1. Extract template references from Schema Domain
    const templateContext = await this.schemaDomain
      .resolveTemplateContext(schema);

    if (!templateContext.ok) {
      return templateContext;
    }

    // 2. Load templates and pass to Template Domain
    const containerTemplate = await this.loadTemplate(
      templateContext.data.containerTemplate.path,
    );

    if (!containerTemplate.ok) {
      return containerTemplate;
    }

    // 3. Template Domain processes with schema context
    return this.templateDomain.renderWithItems(
      containerTemplate.data,
      data,
    );
  }
}
```

## Integration Points

### Existing Template Processing Extension

The handoff mechanism extends the existing template processing architecture:

```typescript
// BEFORE: Simple template processing
class PipelineOrchestrator {
  async process(documents: MarkdownDocument[]): Promise<ProcessingResult> {
    const template = await this.loadTemplate(this.templatePath);
    return this.templateRenderer.render(template, documents);
  }
}

// AFTER: Schema-aware template processing
class PipelineOrchestrator {
  constructor(
    private readonly templateSchemaCoordinator: TemplateSchemaCoordinator,
  ) {}

  async process(documents: MarkdownDocument[]): Promise<ProcessingResult> {
    const schema = await this.loadSchema(this.schemaPath);
    const frontmatterData = await this.extractFrontmatter(documents);

    // Use coordinated processing
    return this.templateSchemaCoordinator.processWithSchemaTemplates(
      schema,
      frontmatterData,
    );
  }
}
```

## Error Handling Strategy

### Template Domain Error Conditions

- `{@items}` found but no schema context available
- Item template loading failure
- Template rendering errors during expansion

### Schema Domain Error Conditions

- Missing `x-template-items` when `{@items}` expansion required
- Invalid template path references
- Schema extension parsing errors

### Cross-Domain Error Coordination

```typescript
type TemplateSchemaHandoffError =
  | {
    kind: "TemplateNotFound";
    templateType: "container" | "items";
    path: string;
  }
  | {
    kind: "SchemaExtensionMissing";
    extension: "x-template" | "x-template-items";
  }
  | { kind: "ItemsExpansionFailed"; reason: string }
  | { kind: "HandoffContextInvalid"; context: unknown };
```

## Validation Rules

1. **Template Domain**: MUST request schema context before processing `{@items}`
2. **Schema Domain**: MUST validate `x-template-items` exists before creating
   handoff context
3. **Cross-Domain Service**: MUST ensure both domains receive valid, consistent
   data
4. **Error Propagation**: Errors MUST be propagated with domain-specific context

## Authority

This handoff mechanism establishes the definitive architecture for
`x-template-items` coordination between Template and Schema domains. All
implementations must follow this pattern to ensure proper separation of concerns
while enabling seamless template processing functionality.
