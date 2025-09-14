# x-template-items Specification

## Overview

The `x-template-items` extension provides a mechanism to specify which template
should be used when processing `{@items}` expansion, eliminating the need for
`x-template` declarations in referenced sub-schemas.

## Problem Statement

### Design Clarification

1. **Schema Independence**: `$ref` is a standard JSON Schema feature for schema
   reuse and has no relationship with template processing
2. **Template Specification**: Templates are specified exclusively through
   `x-template` and `x-template-items` extensions
3. **Configuration Simplicity**: Template declarations are centralized in the
   main schema file

### Clarified Design

```json
// Main schema
{
  "x-template": "main_template.json",
  "x-template-items": "item_template.json",  // Optional, but needed for {@items}
  "properties": {
    "items": {
      "type": "array",
      "items": { "$ref": "sub_schema.json" }  // Schema structure only
    }
  }
}

// Sub-schema (defines structure only)
{
  // No x-template needed - templates are specified in main schema
  "properties": { ... }
}
```

## New x-template-items Design

### Core Concept

`x-template-items` allows the main schema to specify which template should be
used for `{@items}` expansion. This is independent of any `$ref` schema references,
which are purely for schema structure validation.

### Syntax

```json
{
  "x-template": "container_template.json",
  "x-template-items": "item_template.json",
  "properties": {
    "items": {
      "type": "array",
      "items": { "$ref": "sub_schema.json" }
    }
  }
}
```

### Template Usage

In the container template:

```json
{
  "version": "{version}",
  "description": "{description}",
  "items": [
    "{@items}"
  ]
}
```

When `{@items}` is encountered, the system uses `x-template-items` to determine
the template for each array element.

## Architecture Impact

### Template Resolution Rule

**x-template-items in Main Schema**: Optional, but required for `{@items}` expansion.
If not specified, `{@items}` expansion cannot occur and will remain unexpanded.

### Schema Independence

Sub-schemas referenced via `$ref` are purely for structure validation and never
contain template specifications:

```json
// Sub-schema (x-template now OPTIONAL)
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" }
  }
}
```

## Benefits

1. **Centralized Template Control**: All template references in main schema
2. **Simplified Sub-schemas**: No mandatory template declarations
3. **Clear Separation**: Container vs. item template responsibilities
4. **Backward Compatibility**: Existing schemas continue to work

## Implementation Rules

### Template Resolution Logic

```typescript
interface TemplateResolutionLogic {
  resolveItemTemplate(schema: Schema): string {
    // Check main schema for x-template-items (optional)
    if (schema.hasMainSchemaTemplateItems()) {
      return schema.getMainSchemaTemplateItems();
    }

    // No x-template-items - {@items} will not be expanded
    return null;  // {@items} remains as placeholder
  }
}
```

### Processing Flow

```
Main Schema (x-template-items: "item_template.json")
    ↓
Container Template ("{@items}" encountered)
    ↓
Use x-template-items → "item_template.json"
    ↓
Apply item_template.json to each array element
```

## Examples

### Complete Example

**Main Schema (registry_schema.json)**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "registry_template.json",
  "x-template-items": "registry_command_template.json",
  "properties": {
    "version": { "type": "string" },
    "description": { "type": "string" },
    "tools": {
      "type": "object",
      "properties": {
        "commands": {
          "type": "array",
          "items": { "$ref": "registry_command_schema.json" }
        }
      }
    }
  }
}
```

**Sub-schema (registry_command_schema.json)**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "c1": { "type": "string" },
    "c2": { "type": "string" },
    "c3": { "type": "string" }
  }
}
```

**Container Template (registry_template.json)**:

```json
{
  "version": "{version}",
  "description": "{description}",
  "tools": {
    "commands": [
      "{@items}"
    ]
  }
}
```

**Item Template (registry_command_template.json)**:

```json
{
  "c1": "{c1}",
  "c2": "{c2}",
  "c3": "{c3}"
}
```

## Design Principles

This specification establishes clear separation of concerns:

- `x-template-items` is **OPTIONAL** but necessary for `{@items}` expansion
- `$ref` is for schema structure only, not template resolution
- Templates are specified exclusively through `x-template` and `x-template-items`
- Without `x-template-items`, `{@items}` placeholders remain unexpanded

## Authority

This specification establishes the definitive design for template reference
management in the frontmatter-to-schema system. All template processing must
support this `x-template-items` mechanism as the exclusive method for `{@items}`
template resolution.
