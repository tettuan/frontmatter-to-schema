# Frontmatter and Schema Processing Domain Flow

## Executive Summary

This document defines the complete processing flow from frontmatter extraction through schema validation to template output, establishing clear domain boundaries and responsibilities at each stage.

## Domain Separation Overview

The processing involves FOUR completely independent domains:

1. **Frontmatter Extraction Domain** - Extracts raw data from documents
2. **Schema Processing Domain** - Parses schemas, returns template path and values
3. **Schema Validation Domain** - Validates extracted data against schema rules
4. **Template Building/Output Domains** - Processes templates with validated data

## Complete Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Document Input                                │
│                (with frontmatter)                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Frontmatter Extraction Domain                      │
│                                                                 │
│  Input: Document content                                        │
│  Processing:                                                    │
│    ├── Parse frontmatter syntax (YAML/TOML/JSON)              │
│    ├── Extract key-value pairs                                 │
│    └── Return raw frontmatter data                            │
│                                                                 │
│  Output: FrontmatterData { values: Record<string, unknown> }   │
│                                                                 │
│  Boundaries:                                                    │
│    - DOES NOT validate against schema                          │
│    - DOES NOT know about templates                             │
│    - ONLY extracts raw data                                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                Schema Processing Domain                         │
│                                                                 │
│  Input: Schema file path                                        │
│  Processing:                                                    │
│    ├── Parse schema definition                                  │
│    ├── Extract template file path                              │
│    ├── Extract validation rules                                │
│    └── Extract default values (if any)                        │
│                                                                 │
│  Output: SchemaResult {                                        │
│    templatePath: string,                                       │
│    extractedValues: Record<string, unknown>,                   │
│    validationRules: ValidationRule[]                           │
│  }                                                             │
│                                                                 │
│  Boundaries:                                                    │
│    - DOES NOT load template files                              │
│    - DOES NOT validate frontmatter data                        │
│    - DOES NOT apply values to templates                        │
│    - ONLY extracts information from schema                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Schema Validation Domain                           │
│                                                                 │
│  Input: FrontmatterData + SchemaResult + ValidationRules      │
│  Processing:                                                    │
│    ├── Parse values according to Schema format definitions    │
│    ├── Apply validation rules to frontmatter                  │
│    ├── Check required fields                                   │
│    ├── Validate data types                                     │
│    ├── Transform values to Schema-specified format            │
│    └── Return validation result with formatted values         │
│                                                                 │
│  Output: ValidationResult + SchemaFormattedValues             │
│                                                                 │
│  Boundaries:                                                    │
│    - DOES NOT process templates                                │
│    - DOES NOT load files                                       │
│    - ONLY validates and formats data according to Schema      │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                Application Coordination                         │
│                                                                 │
│  Combines:                                                      │
│    ├── SchemaResult.templatePath                              │
│    ├── SchemaResult.extractedValues (from schema)             │
│    ├── ValidatedData (from frontmatter)                       │
│    └── Creates TemplateSource                                  │
│                                                                 │
│  Output: TemplateSource {                                      │
│    templatePath: TemplateFilePath,                             │
│    valueSet: { combined values }                               │
│  }                                                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Template Building Domain                           │
│                                                                 │
│  Input: TemplateSource                                          │
│  Processing: Load template + Apply values = CompiledTemplate   │
│                                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│               Template Output Domain                            │
│                                                                 │
│  Input: CompiledTemplate                                        │
│  Processing: Render + Validate + Write = Final Output         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Domain Boundaries and Responsibilities

### 1. Frontmatter Extraction Domain

**Single Responsibility**: Extract raw key-value data from document frontmatter

**Input**: Document content (string)
**Output**: `FrontmatterData`

```typescript
interface FrontmatterData {
  values: Record<string, unknown>;
  format: 'yaml' | 'toml' | 'json';
  rawContent: string;
}
```

**MUST NOT**:
- Validate against schema rules
- Know about schema structure
- Process templates
- Make validation decisions

**MUST ONLY**:
- Parse frontmatter syntax
- Extract key-value pairs
- Detect format type
- Return raw data

### 2. Schema Processing Domain

**Single Responsibility**: Parse schema definitions and extract information

**Input**: Schema file path or content
**Output**: `SchemaResult`

```typescript
interface SchemaResult {
  templatePath: string;                     // Path to template file
  extractedValues: Record<string, unknown>; // Default values from schema
  validationRules: ValidationRule[];       // Rules for data validation
  metadata: SchemaMetadata;
}
```

**MUST NOT**:
- Load template files
- Validate frontmatter data
- Apply values to templates
- Generate output

**MUST ONLY**:
- Parse schema syntax
- Extract template path
- Extract validation rules
- Extract default values

### 3. Schema Validation Domain

**Single Responsibility**: Validate extracted data against schema rules AND parse values according to Schema format

**Input**: `FrontmatterData` + `ValidationRule[]` + `SchemaDefinition`
**Output**: `ValidationResult`

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  validatedData: Record<string, unknown>;  // Values parsed according to Schema format
  schemaFormattedValues: Record<string, unknown>; // Values in Schema-defined format
}
```

**MUST NOT**:
- Process templates
- Load files
- Make output decisions
- Modify template paths

**MUST ONLY**:
- Apply validation rules to data
- Check required fields
- Validate data types
- **Parse values according to Schema format specifications**
- Return validation results with properly formatted values

### 4. Application Coordination Layer

**Single Responsibility**: Coordinate between domains and combine results

**Processing**:
1. Receive results from all domains
2. Combine schema values with frontmatter values
3. Handle value precedence (frontmatter overrides schema defaults)
4. Create TemplateSource for Template Domain

```typescript
// Value combination logic
const combinedValues = {
  ...schemaResult.extractedValues,  // Schema defaults
  ...validatedFrontmatter.values    // Frontmatter overrides
};

const templateSource: TemplateSource = {
  templatePath: new TemplateFilePath(schemaResult.templatePath),
  valueSet: { values: combinedValues }
};
```

## Key Architectural Rules

### Domain Independence

1. **No Cross-Domain Dependencies**: Each domain operates independently
2. **Single Direction Flow**: Data flows forward, never backwards
3. **No Side Effects**: Each domain returns results without side effects
4. **Stateless Operations**: Domains don't maintain state between operations

### Data Transformation Points

1. **Frontmatter → Raw Data**: Syntax parsing only
2. **Schema → Configuration**: Extract paths and rules only
3. **Validation → Verified Data**: Apply rules to data
4. **Coordination → Template Input**: Combine and structure for templates

### Error Handling Boundaries

Each domain handles its own errors:

- **Frontmatter Domain**: Syntax errors, parsing failures
- **Schema Domain**: Invalid schema format, missing template paths
- **Validation Domain**: Data validation failures, rule violations
- **Application Layer**: Coordination errors, combination conflicts

## Implementation Examples

### Frontmatter Extraction Service

```typescript
class FrontmatterExtractionService {
  extract(content: string): Result<FrontmatterData, ExtractionError> {
    // Parse frontmatter syntax ONLY
    // Return raw key-value pairs
    // NO validation against schema
  }
}
```

### Schema Processing Service

```typescript
class SchemaProcessingService {
  parseSchema(schemaPath: string): Result<SchemaResult, SchemaError> {
    // Extract template path and rules ONLY
    // NO template loading
    // NO data validation
  }
}
```

### Schema Validation Service

```typescript
class SchemaValidationService {
  validate(
    data: FrontmatterData,
    rules: ValidationRule[]
  ): Result<ValidationResult, ValidationError> {
    // Validate data against rules ONLY
    // NO template processing
    // NO file operations
  }
}
```

### Application Coordination

```typescript
class DocumentProcessingCoordinator {
  async process(
    documentContent: string,
    schemaPath: string
  ): Promise<Result<void, ProcessingError>> {

    // Step 1: Extract frontmatter
    const frontmatterResult = frontmatterService.extract(documentContent);

    // Step 2: Process schema
    const schemaResult = schemaService.parseSchema(schemaPath);

    // Step 3: Validate data
    const validationResult = validationService.validate(
      frontmatterResult.data,
      schemaResult.data.validationRules
    );

    // Step 4: Coordinate for template processing
    const templateSource = this.createTemplateSource(
      schemaResult.data,
      validationResult.data
    );

    // Step 5: Process template (separate domains)
    return templateService.processTemplate(templateSource);
  }
}
```

## Testing Strategy

### Domain Isolation Tests

Each domain must be testable in complete isolation:

```typescript
// Frontmatter Domain - no schema knowledge
Deno.test('Frontmatter extraction without schema', () => {
  const content = '---\ntitle: Test\n---\nContent';
  const result = frontmatterExtractor.extract(content);

  assertEquals(result.values.title, 'Test');
  // Should not validate against any schema
});

// Schema Domain - no frontmatter knowledge
Deno.test('Schema processing without frontmatter', () => {
  const result = schemaProcessor.parse('schema.json');

  assertExists(result.templatePath);
  assertExists(result.validationRules);
  // Should not process any frontmatter data
});

// Validation Domain - pure rule application
Deno.test('Validation without templates', () => {
  const data = { title: 'Test' };
  const rules = [{ field: 'title', required: true }];
  const result = validator.validate(data, rules);

  assertEquals(result.isValid, true);
  // Should not involve templates
});
```

### Integration Tests

Test coordination between domains:

```typescript
Deno.test('Complete frontmatter to template flow', async () => {
  // Test that all domains work together correctly
  // Verify data flows through each domain
  // Ensure no domain boundaries are violated
});
```

## Authority Statement

**This document establishes the MANDATORY processing flow for frontmatter and schema operations.**

Each domain:
- MUST maintain complete independence
- MUST handle only its designated responsibility
- MUST NOT cross domain boundaries
- MUST return structured results for coordination

**Violations will result in architectural compliance failure.**

---

**Created**: December 2025
**Authority**: Canonical Architecture Documentation
**Enforcement**: MANDATORY
**Review Schedule**: Quarterly