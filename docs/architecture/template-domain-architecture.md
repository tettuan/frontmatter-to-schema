# Template Domain Architecture

## Executive Summary

This document defines the authoritative architecture for Template Building and Template Output domains, establishing complete decoupling from all other system components. **All output operations MUST route through these domains without exception.**

## Core Principle

**TEMPLATE GATEWAY RULE**: All data transformations and outputs MUST pass through the Template Building and Template Output domains. Direct output bypassing these domains is strictly prohibited and constitutes an architectural violation.

## Domain Boundaries

### Template Building Domain

**Responsibility**: Construction and composition of templates from source data and schemas

**Boundary Definition**:
- Accepts: Template file path (from Schema) and value sets
- Produces: Compiled template instances ready for output
- Dependencies: None (pure domain logic)
- Consumers: Template Output Domain ONLY

### Template Output Domain

**Responsibility**: Rendering and delivery of compiled templates to final destinations

**Boundary Definition**:
- Accepts: Compiled template instances from Template Building Domain
- Produces: Final formatted output (files, streams, responses)
- Dependencies: Template Building Domain output contracts
- Consumers: Infrastructure adapters ONLY

## Architectural Layers

```
┌─────────────────────────────────────────────────────────┐
│                    External Systems                      │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────┐
│              Infrastructure Adapters                     │
│         (File Writers, API Clients, etc.)               │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ ONLY path for output
                            │
┌─────────────────────────────────────────────────────────┐
│              Template Output Domain                      │
│    ┌──────────────────────────────────────────────┐    │
│    │  OutputRenderer  │  OutputWriter  │          │    │
│    │  OutputValidator │  OutputRouter  │          │    │
│    └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ Compiled templates ONLY
                            │
┌─────────────────────────────────────────────────────────┐
│            Template Building Domain                      │
│    ┌──────────────────────────────────────────────┐    │
│    │  TemplateCompiler │  TemplateComposer │      │    │
│    │  TemplateValidator│  TemplateRegistry │      │    │
│    └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ Template path + Value set
                            │
┌─────────────────────────────────────────────────────────┐
│         Application Use Cases & Services                 │
└─────────────────────────────────────────────────────────┘
```

## Template Building Domain Components

### Input Requirements

The Template Building Domain requires exactly two pieces of information:

1. **Template File Path**: The path to the template file obtained from the Schema
2. **Value Set**: The collection of values to be applied to the template

### Core Entities

#### `TemplateSource`
```typescript
interface TemplateSource {
  templatePath: TemplateFilePath;  // Path from Schema
  valueSet: TemplateValueSet;       // Values to apply
}
```

#### `TemplateFilePath`
```typescript
// Value Object representing the template file path from Schema
class TemplateFilePath {
  constructor(private readonly path: string) {
    this.validate();
  }

  private validate(): void {
    if (!this.path || this.path.trim() === '') {
      throw new Error('Template path cannot be empty');
    }
  }

  toString(): string {
    return this.path;
  }

  resolve(): string {
    // Resolve relative path to absolute if needed
    return this.path;
  }
}
```

#### `TemplateValueSet`
```typescript
// Value Object representing the set of values for template
interface TemplateValueSet {
  values: Record<string, unknown>;
  metadata?: {
    source: string;
    timestamp: Date;
    schemaVersion?: string;
  };
}
```

#### `CompiledTemplate`
```typescript
interface CompiledTemplate {
  templatePath: TemplateFilePath;
  appliedValues: TemplateValueSet;
  compiledContent: string | Buffer;
  compiledAt: Date;
  checksum: string;
  format: OutputFormat;
  validate(): Result<void, ValidationError>;
}
```

### Domain Services

#### `TemplateCompiler`
- Responsibility: Compile template file with value set
- Input: TemplateFilePath + TemplateValueSet
- Output: CompiledTemplate
- Invariants: Template must exist, values must match template requirements

#### `TemplateLoader`
- Responsibility: Load template file from path
- Input: TemplateFilePath
- Output: Template content
- Invariants: Path must be valid and accessible

#### `TemplateValidator`
- Responsibility: Validate values against template requirements
- Input: Template content and value set
- Output: Validation result
- Invariants: All required fields must be present

#### `TemplateRegistry`
- Responsibility: Cache and manage loaded templates
- Input: Template registration requests
- Output: Cached template retrieval
- Invariants: Path uniqueness, cache consistency

### Value Objects

- `TemplateFilePath`: Path to template file from Schema
- `TemplateValueSet`: Collection of values to apply
- `TemplateContent`: Raw template file content
- `ValidationRule`: Template field requirements
- `CompilationResult`: Result of template compilation

## Template Output Domain Components

### Core Entities

#### `OutputSpecification`
```typescript
interface OutputSpecification {
  format: OutputFormat;
  destination: OutputDestination;
  encoding: OutputEncoding;
  options: OutputOptions;
}
```

#### `RenderedOutput`
```typescript
interface RenderedOutput {
  content: Buffer | string;
  format: OutputFormat;
  metadata: OutputMetadata;
  checksum: string;
  source: CompiledTemplate;
}
```

### Domain Services

#### `OutputRenderer`
- Responsibility: Render compiled templates to specific formats
- Input: CompiledTemplate + OutputSpecification
- Output: RenderedOutput
- Invariants: Format must match specification

#### `OutputValidator`
- Responsibility: Validate output before delivery
- Input: RenderedOutput
- Output: Validation result
- Invariants: Output must conform to format specifications

#### `OutputWriter`
- Responsibility: Write rendered output to destinations
- Input: RenderedOutput + OutputDestination
- Output: Write confirmation
- Invariants: Atomic writes, rollback on failure

#### `OutputRouter`
- Responsibility: Route outputs to appropriate destinations
- Input: RenderedOutput + routing rules
- Output: Routing result
- Invariants: Exactly-once delivery guarantee

### Value Objects

- `OutputFormat`: JSON, YAML, XML, Markdown, etc.
- `OutputDestination`: File path, URL, stream identifier
- `OutputEncoding`: UTF-8, ASCII, Base64, etc.
- `OutputMetadata`: Timestamps, checksums, version info

## Decoupling Enforcement Rules

### MANDATORY Requirements

1. **No Direct Output**: ALL output operations MUST route through Template Output Domain
2. **No Bypass Allowed**: Services attempting direct file/API writes MUST be rejected in code review
3. **Template Compilation Required**: Raw data MUST be compiled through Template Building Domain before output
4. **Single Entry Point**: Each domain exposes exactly ONE facade interface for external interaction
5. **Immutable Contracts**: Domain interfaces are immutable once defined
6. **Schema-Driven Templates**: Template paths MUST originate from Schema definitions

### PROHIBITED Patterns

❌ **Direct File Writing**
```typescript
// PROHIBITED - bypasses template domains
fs.writeFileSync('output.json', JSON.stringify(data));
```

❌ **Service-to-Infrastructure Coupling**
```typescript
// PROHIBITED - service directly uses infrastructure
class SomeService {
  writeOutput(data: any) {
    // Direct infrastructure access forbidden
    return fileRepository.write(data);
  }
}
```

❌ **Raw Data Output**
```typescript
// PROHIBITED - outputs unprocessed data
outputService.write(frontmatterData);
```

❌ **Hardcoded Template Paths**
```typescript
// PROHIBITED - template paths must come from Schema
const template = loadTemplate('./hardcoded/path.tmpl');
```

### REQUIRED Patterns

✅ **Schema-Driven Template Processing**
```typescript
// REQUIRED - template path from Schema, values from processing
const templatePath = schema.getTemplatePath();
const valueSet = extractedData.toValueSet();
const template = templateBuilder.build(templatePath, valueSet);
const rendered = templateOutput.render(template, specification);
const result = templateOutput.write(rendered);
```

✅ **Domain Facade Usage**
```typescript
// REQUIRED - interact only through domain facades
class ApplicationService {
  constructor(
    private templateFacade: TemplateBuilderFacade,
    private outputFacade: TemplateOutputFacade
  ) {}

  async processDocument(
    schemaTemplatePath: string,
    values: Record<string, unknown>
  ): Promise<Result<void, Error>> {
    const templateSource = {
      templatePath: new TemplateFilePath(schemaTemplatePath),
      valueSet: { values }
    };
    const template = await this.templateFacade.buildTemplate(templateSource);
    return this.outputFacade.outputTemplate(template);
  }
}
```

## Domain Interfaces

### Template Builder Facade

```typescript
interface TemplateBuilderFacade {
  buildTemplate(
    source: TemplateSource
  ): Promise<Result<CompiledTemplate, BuildError>>;

  composeTemplates(
    templates: CompiledTemplate[]
  ): Promise<Result<CompiledTemplate, CompositionError>>;

  validateTemplate(
    template: CompiledTemplate
  ): Result<void, ValidationError>;
}

interface TemplateSource {
  templatePath: TemplateFilePath;  // From Schema
  valueSet: TemplateValueSet;       // From data processing
}
```

### Template Output Facade

```typescript
interface TemplateOutputFacade {
  renderTemplate(
    template: CompiledTemplate,
    specification: OutputSpecification
  ): Promise<Result<RenderedOutput, RenderError>>;

  outputTemplate(
    rendered: RenderedOutput,
    destination: OutputDestination
  ): Promise<Result<void, OutputError>>;

  validateOutput(
    output: RenderedOutput
  ): Result<void, ValidationError>;
}
```

## Data Flow Specification

### Complete Processing Flow

```
1. Schema Loading
   └─→ Extract template file path

2. Data Processing
   └─→ Generate value set from frontmatter/data

3. Template Building [MANDATORY]
   ├─→ Load template from Schema path
   ├─→ Apply value set to template
   └─→ Produce CompiledTemplate

4. Template Output [MANDATORY]
   ├─→ Render CompiledTemplate
   ├─→ Validate output
   └─→ Write to destination

❌ ANY direct output path is PROHIBITED
```

## Migration Path

### Phase 1: Domain Implementation
1. Implement Template Building Domain services
2. Implement Template Output Domain services
3. Create domain facades
4. Add comprehensive unit tests

### Phase 2: Integration
1. Update DocumentProcessor to use template domains
2. Migrate existing template logic to new domains
3. Update all use cases to route through domains
4. Add integration tests

### Phase 3: Enforcement
1. Disable all direct output paths
2. Add architectural tests to prevent bypass
3. Remove deprecated output code
4. Code review enforcement

### Phase 4: Validation
1. End-to-end testing of all workflows
2. Performance validation
3. Security audit
4. Documentation update

## Compliance Monitoring

### Automated Checks

1. **Architectural Tests**: Prevent direct infrastructure access from services
2. **Dependency Analysis**: Ensure proper layer boundaries
3. **Output Path Validation**: Verify all outputs route through template domains
4. **Code Coverage**: Maintain 100% coverage for domain logic
5. **Template Path Validation**: Ensure all template paths originate from Schema

### Manual Reviews

1. **Code Review Checklist**: Verify template domain usage
2. **Architecture Review**: Monthly compliance audit
3. **Performance Review**: Quarterly performance analysis
4. **Security Review**: Bi-annual security assessment

## Authority Statement

**This document establishes the MANDATORY architecture for all template-related operations.** Any deviation requires:

1. Written architectural justification
2. Impact analysis document
3. Migration plan for compliance
4. Approval from technical lead
5. Update to this document

**Violations of this architecture will result in:**
- Immediate code review rejection
- Required refactoring before merge
- Architecture compliance training requirement

---

**Created**: December 2025
**Authority**: Canonical Architecture Documentation
**Enforcement**: MANDATORY - No exceptions permitted
**Review Schedule**: Quarterly