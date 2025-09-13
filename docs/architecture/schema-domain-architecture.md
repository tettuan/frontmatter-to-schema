# Schema Domain Architecture

## Executive Summary

This document defines the authoritative architecture for the Schema Processing Domain, establishing clear boundaries and complete separation from Template Processing. The Schema Domain's sole responsibility is to parse schemas and extract template file paths and validation rules, returning this information to consumers without any template processing.

## Core Principles

**SCHEMA SINGLE RESPONSIBILITY RULE**: The Schema Processing Domain has exactly ONE responsibility: parse schema definitions and extract information for downstream processing. It MUST NOT:
- Process templates
- Apply values to templates
- Determine output formats
- Generate final output
- Make decisions about template usage

**SCHEMA OUTPUT RULE**: The Schema Domain returns:
1. Template file path (string)
2. Validation rules for values
3. Extracted values (if present in schema)
4. Schema metadata

The domain completes its responsibility by providing this information and has NO involvement in subsequent processing.

## Domain Boundaries

### Schema Processing Domain

**Responsibility**: Parse and validate schema definitions, extract template paths and validation rules

**Boundary Definition**:
- Input: Schema file path or schema definition
- Output: Template path + validation rules + extracted values + metadata
- Dependencies: None (pure domain logic)
- Consumers: Application services that coordinate with Template Building Domain

**CRITICAL SEPARATION**: Schema Processing and Template Building are completely independent domains:
- Schema Domain does NOT know about template content
- Schema Domain does NOT process templates
- Schema Domain does NOT apply values to templates
- Schema Domain provides template path and extracted values separately

## Architectural Layers

```
┌─────────────────────────────────────────────────────────┐
│              Application Use Cases                       │
│                                                          │
│  1. Load Schema → Get template path, values & rules     │
│  2. Pass template path + values to Template Building    │
│  3. Schema Domain responsibility ENDS at step 1         │
└─────────────────────────────────────────────────────────┘
                ▲                         ▲
                │                         │
    ┌───────────┴──────────┐ ┌───────────┴──────────┐
    │  Schema Processing    │ │  Template Building   │
    │       Domain          │ │       Domain         │
    │                       │ │                      │
    │  Returns:             │ │  Receives:           │
    │  - Template path      │ │  - Template path     │
    │  - Extracted values   │ │  - Value set         │
    │  - Validation rules   │ │                      │
    │                       │ │                      │
    │  NO INTERACTION ←─────┼─────→ NO INTERACTION   │
    └───────────────────────┘ └──────────────────────┘
```

## Schema Domain Components

### Core Entities

#### `SchemaDefinition`
```typescript
interface SchemaDefinition {
  id: SchemaId;
  version: string;
  templatePath: string;  // Path to template file - ONLY A STRING
  validationRules: ValidationRule[];
  metadata: SchemaMetadata;
}
```

#### `SchemaResult`
```typescript
// The ONLY output from Schema Domain
interface SchemaResult {
  templatePath: string;           // Path to template file
  extractedValues: Record<string, unknown>; // Values extracted from schema
  validationRules: ValidationRule[];
  metadata: SchemaMetadata;
}
```

### Domain Services

#### `SchemaParser`
- Responsibility: Parse schema file and extract information
- Input: Schema file path or content
- Output: SchemaResult (template path + rules)
- Invariants:
  - MUST NOT load template files
  - MUST NOT validate template content
  - MUST NOT process templates
  - Returns ONLY the template path as string

#### `SchemaValidator`
- Responsibility: Validate schema structure and syntax
- Input: Schema definition
- Output: Validation result
- Invariants:
  - Validates ONLY schema syntax
  - Does NOT validate templates
  - Does NOT validate values

#### `SchemaResolver`
- Responsibility: Resolve schema references and imports
- Input: Schema with references
- Output: Resolved schema
- Invariants:
  - Resolves ONLY schema references
  - Does NOT resolve template references
  - Does NOT load templates

### Value Objects

- `SchemaId`: Unique schema identifier
- `SchemaVersion`: Schema version information
- `ValidationRule`: Rules for validating values (NOT templates)
- `SchemaMetadata`: Schema metadata (author, date, etc.)

## Separation Enforcement Rules

### MANDATORY Boundaries

1. **No Template Loading**: Schema Domain MUST NOT load or read template files
2. **No Template Processing**: Schema Domain MUST NOT process template content
3. **No Value Application**: Schema Domain MUST NOT apply values to templates
4. **No Output Generation**: Schema Domain MUST NOT generate any output
5. **String Path Only**: Template path must be returned as a simple string

### PROHIBITED Patterns

❌ **Loading Template Files**
```typescript
// PROHIBITED - Schema domain loading templates
class SchemaService {
  async process(schema: Schema) {
    const template = await loadTemplate(schema.templatePath); // FORBIDDEN
  }
}
```

❌ **Processing Templates**
```typescript
// PROHIBITED - Schema domain processing templates
class SchemaService {
  compileWithTemplate(schema: Schema, values: any) {
    // Schema domain MUST NOT compile templates
    return compileTemplate(schema.templatePath, values); // FORBIDDEN
  }
}
```

❌ **Making Template Decisions**
```typescript
// PROHIBITED - Schema domain making template decisions
class SchemaService {
  selectTemplate(schema: Schema, context: any) {
    // Schema domain MUST NOT select templates
    if (context.type === 'json') {
      return 'template.json'; // FORBIDDEN
    }
  }
}
```

### REQUIRED Patterns

✅ **Return Path, Values, and Rules**
```typescript
// REQUIRED - Schema domain returns path, values, and rules
class SchemaService {
  async parseSchema(schemaPath: string): Promise<SchemaResult> {
    const schema = await this.loadSchema(schemaPath);

    // Return ONLY the extracted information
    return {
      templatePath: schema.templatePath,    // Template file path
      extractedValues: schema.values || {}, // Values from schema (if any)
      validationRules: schema.rules,
      metadata: schema.metadata
    };
    // Schema domain responsibility ENDS here
  }
}
```

✅ **Complete Separation from Templates**
```typescript
// REQUIRED - Application coordinates between domains
class ApplicationService {
  async processDocument(schemaPath: string, additionalValues?: any) {
    // Step 1: Get template path and values from Schema Domain
    const schemaResult = await schemaService.parseSchema(schemaPath);

    // Step 2: Combine schema values with additional values
    const combinedValues = {
      ...schemaResult.extractedValues,  // Values from schema
      ...additionalValues               // Additional values if provided
    };

    // Step 3: Pass to Template Domain (Schema not involved)
    const templateSource = {
      templatePath: new TemplateFilePath(schemaResult.templatePath),
      valueSet: { values: combinedValues }
    };

    // Schema Domain has NO involvement beyond step 1
    return templateService.buildTemplate(templateSource);
  }
}
```

## Data Flow Specification

### Schema Processing Flow

```
1. Schema Loading
   ├─→ Parse schema file
   ├─→ Extract template path (as string)
   ├─→ Extract values (if present in schema)
   ├─→ Extract validation rules
   └─→ Return SchemaResult

2. Schema Domain ENDS HERE
   - No further involvement
   - No template processing
   - No value application to templates

3. Application Layer
   ├─→ Receives SchemaResult (with values)
   ├─→ Combines schema values with other values
   ├─→ Coordinates with Template Domain
   └─→ Schema Domain NOT involved
```

## Integration Points

### With Application Layer

The Schema Domain integrates with the application layer through a single, simple interface:

```typescript
interface SchemaService {
  parseSchema(path: string): Promise<SchemaResult>;
  validateSchema(content: string): Result<void, ValidationError>;
}
```

### With Template Domain

**THERE IS NO DIRECT INTEGRATION**. The domains are completely separated:
- Schema Domain provides template path to Application
- Application provides template path to Template Domain
- The domains never interact directly

## Testing Requirements

### Boundary Tests

Tests MUST verify:
1. Schema Domain never loads template files
2. Schema Domain never processes templates
3. Schema Domain returns only path and rules
4. Schema Domain completes after returning results
5. No coupling between Schema and Template domains

### Independence Tests

```typescript
Deno.test('Schema Domain - must not load template files', async () => {
  // Verify no template file operations
  // Verify only schema operations
});

Deno.test('Schema Domain - must return only path as string', async () => {
  // Verify output contains only:
  // - templatePath (string)
  // - validationRules (array)
  // - metadata (object)
});

Deno.test('Schema Domain - must have no template dependencies', async () => {
  // Verify no imports from template domain
  // Verify no template-related code
});
```

## Compliance Monitoring

### Automated Checks

1. **Import Analysis**: Verify no imports from Template Domain
2. **Dependency Check**: Ensure no template-related dependencies
3. **Output Validation**: Verify only allowed output types
4. **Boundary Testing**: Automated tests for domain boundaries

### Manual Reviews

1. **Code Review**: Verify separation in all schema-related code
2. **Architecture Review**: Regular boundary compliance checks
3. **Integration Review**: Verify proper application coordination

## Authority Statement

**This document establishes the MANDATORY boundaries for the Schema Processing Domain.**

The Schema Domain:
- MUST parse schemas and extract template paths
- MUST return template paths as simple strings
- MUST NOT process templates in any way
- MUST NOT interact with Template Domain

**Violations will result in:**
- Immediate code review rejection
- Required refactoring
- Architecture review

---

**Created**: December 2025
**Authority**: Canonical Architecture Documentation
**Enforcement**: MANDATORY - No exceptions permitted
**Review Schedule**: Quarterly