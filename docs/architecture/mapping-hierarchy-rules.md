# Mapping Hierarchy Rules for {@items} and $ref Processing

## Overview

This document defines the explicit mapping hierarchy rules for how `{@items}` array expansion interacts with `$ref` schema references and template processing.

## Core Mapping Rules

### Rule 1: Hierarchy Root Determination

When a schema property has `x-frontmatter-part: true`, that property becomes the **hierarchy root** for `{@items}` resolution.

```json
{
  "commands": {
    "type": "array",
    "x-frontmatter-part": true,
    "items": { "$ref": "registry_command_schema.json" }
  }
}
```

In this case: `commands` → **hierarchy root** for `{@items}`

### Rule 2: {@items} Resolution Path

`{@items}` always resolves from the hierarchy root defined by `x-frontmatter-part`, NOT from nested properties or arbitrary arrays.

```
Template: "design": "{@items}"
Resolution Path: frontmatter.commands → {@items}
```

### Rule 3: $ref Template Source Resolution

When `items` contains a `$ref`, the referenced schema's root structure becomes the template source for each array item.

```json
// Main schema
"items": { "$ref": "registry_command_schema.json" }

// Referenced schema (registry_command_schema.json)
{
  "id": "{id.full}",
  "description": "{description}",
  "category": "{category}"
}
```

**Template Source**: Root of `registry_command_schema.json`

### Rule 4: Template Application Mapping

Each item in the hierarchy root array gets the template from the `$ref` schema applied:

**Input Array** (from `commands`):
```javascript
[
  { "id.full": "design:api:rest-architecture-6b4e9a#20250912", ... },
  { "id.full": "design:ui:component-library-2c7f5d#20250913", ... },
  { "id.full": "design:data:schema-design-8a1b3e#20250914", ... }
]
```

**Template** (from `$ref` schema):
```json
{ "id": "{id.full}" }
```

**Result** (for `{@items}`):
```json
[
  "design:api:rest-architecture-6b4e9a#20250912",
  "design:ui:component-library-2c7f5d#20250913",
  "design:data:schema-design-8a1b3e#20250914"
]
```

## Complete Flow Example

### Schema Definition
```json
{
  "commands": {
    "type": "array",
    "x-frontmatter-part": true,
    "items": { "$ref": "registry_command_schema.json" }
  }
}
```

### Template Definition
```json
{
  "version": "{version}",
  "description": "{description}",
  "design": "{@items}"
}
```

### Processing Flow

1. **Hierarchy Root**: `commands` (marked with `x-frontmatter-part: true`)
2. **{@items} Source**: Array data from `commands`
3. **Template Source**: Root structure from `registry_command_schema.json`
4. **Template Application**: Each `commands` item → template → result item
5. **Array Assembly**: All result items → replaces `{@items}`

### Final Output
```json
{
  "version": "1.0.0",
  "description": "Design level traceability IDs",
  "design": [
    "design:api:rest-architecture-6b4e9a#20250912",
    "design:ui:component-library-2c7f5d#20250913",
    "design:data:schema-design-8a1b3e#20250914"
  ]
}
```

## Architectural Constraints

### Constraint 1: Hierarchy Root Requirement
- `{@items}` **MUST** have a corresponding `x-frontmatter-part: true` property in schema
- Without hierarchy root, `{@items}` resolution fails

### Constraint 2: $ref Resolution Priority
- When `$ref` is present, referenced schema's root becomes template
- `x-template-items` in main schema overrides `$ref` template if both exist

### Constraint 3: Array Type Validation
- Hierarchy root property **MUST** be array type
- Non-array data at hierarchy root causes `{@items}` resolution failure

### Constraint 4: Template Scope Consistency
- Templates from `$ref` schemas apply to individual items
- Container templates with `{@items}` apply to the entire array

## Implementation Notes

This mapping hierarchy ensures:
- **Predictable Resolution**: Clear path from `{@items}` to data source
- **Schema Consistency**: `$ref` schemas provide item-level templates
- **Separation of Concerns**: Container vs. item template distinction
- **Error Prevention**: Explicit hierarchy prevents ambiguous resolution

## Related Documentation

- [x-template-items Specification](x-template-items-specification.md)
- [Template Processing Specification](template-processing-specification.md)
- [List Container vs List Items Separation](list-container-vs-list-items-separation.md)