# x-template-items Specification

## Overview

The `x-template-items` extension provides a mechanism to specify which template
should be used when processing `{@items}` expansion, eliminating the need for
`x-template` declarations in referenced sub-schemas.

## Problem Statement

### Previous Design Issues

1. **Mandatory x-template in Sub-schemas**: Every `$ref` referenced schema
   required its own `x-template` declaration
2. **Template Reference Coupling**: Template selection was tightly coupled to
   schema structure
3. **Configuration Complexity**: Multiple template declarations scattered across
   schema files

### Example of Previous Complexity

```json
// Main schema
{
  "x-template": "main_template.json",
  "properties": {
    "items": {
      "type": "array",
      "items": { "$ref": "sub_schema.json" }
    }
  }
}

// Sub-schema (REQUIRED x-template)
{
  "x-template": "item_template.json",  // MANDATORY
  "properties": { ... }
}
```

## New x-template-items Design

### Core Concept

`x-template-items` allows the main schema to specify which template should be
used for `{@items}` expansion, making `x-template` optional in sub-schemas.

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

**x-template-items in Main Schema**: MUST be specified for `{@items}` expansion.
If not specified, an error occurs.

### Sub-schema Simplification

Sub-schemas no longer require `x-template` when the main schema provides
`x-template-items`:

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
    // Check main schema for x-template-items (REQUIRED)
    if (schema.hasMainSchemaTemplateItems()) {
      return schema.getMainSchemaTemplateItems();
    }

    // Error - x-template-items is mandatory
    throw new Error("x-template-items must be specified in main schema for {@items} expansion");
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

## Breaking Change Notice

This specification introduces a **breaking change**:

- `x-template-items` is **REQUIRED** in main schema for `{@items}` expansion
- Sub-schema `x-template` declarations are **NO LONGER SUPPORTED**
- This eliminates complexity and ensures consistent template resolution

## Authority

This specification establishes the definitive design for template reference
management in the frontmatter-to-schema system. All template processing must
support this `x-template-items` mechanism as the exclusive method for `{@items}`
template resolution.
