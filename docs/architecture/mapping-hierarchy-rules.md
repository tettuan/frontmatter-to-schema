# Mapping Hierarchy Rules for {@items} and $ref Processing

## Overview

This document defines the explicit mapping hierarchy rules for how `{@items}` array expansion interacts with `$ref` schema references and template processing.

## Fundamental Concepts

### Mapping Origin (起点) - The PWD Concept

Just as Unix commands operate relative to a Present Working Directory (pwd), template variable mapping requires a **definitive starting point** called the **Mapping Origin**.

#### Definition of Mapping Origin

The **Mapping Origin** is the absolute reference point from which all template variable paths are resolved. It functions as the "pwd" for template processing:

1. **Schema-Defined Origin**: Determined by `x-frontmatter-part: true` annotation
2. **Immutable Reference**: Once established, all variable resolution uses this origin
3. **Absolute Path Base**: All variable paths resolve relative to this origin
4. **Scope Boundary**: Variables cannot resolve "above" the mapping origin

#### Mapping Origin Rules

**Rule MO-1: Single Origin Principle**
- Each template processing session has exactly ONE mapping origin
- Multiple `x-frontmatter-part: true` properties are invalid
- The origin is established during schema analysis phase

**Rule MO-2: Origin Precedence**
- `x-frontmatter-part: true` → **Primary origin marker**
- Schema root → **Default origin** (if no explicit marker)
- Nested properties → **Never become origin** without explicit marker

**Rule MO-3: Path Resolution Constraint**
- All variable paths resolve FROM the mapping origin
- `{@items}` → Origin's array data
- `{property.nested}` → Origin.property.nested
- **Cannot access data outside origin scope**

#### Mapping Origin Example

```json
// Schema defines origin
{
  "metadata": { "version": "string" },     // ← Not accessible to templates
  "commands": {                           // ← MAPPING ORIGIN
    "type": "array",
    "x-frontmatter-part": true,           // ← Origin marker
    "items": { "$ref": "command_schema.json" }
  }
}
```

**Mapping Origin**: `frontmatter.commands`
**Variable Resolution**:
- `{@items}` → `frontmatter.commands[*]` ✅
- `{metadata.version}` → **INVALID** (outside origin) ❌
- `{id.full}` → `frontmatter.commands[current].id.full` ✅

## Core Mapping Rules

### Rule 1: Hierarchy Root Determination (Legacy Reference)

**Note**: This rule is superseded by the Mapping Origin concept defined above.

When a schema property has `x-frontmatter-part: true`, that property becomes the **Mapping Origin** for all template variable resolution.

```json
{
  "commands": {
    "type": "array",
    "x-frontmatter-part": true,
    "items": { "$ref": "registry_command_schema.json" }
  }
}
```

In this case: `commands` → **Mapping Origin** for all variables

### Rule 2: {@items} Resolution Path

`{@items}` always resolves from the **Mapping Origin** defined by `x-frontmatter-part`, NOT from nested properties or arbitrary arrays.

```
Template: "design": "{@items}"
Mapping Origin: frontmatter.commands
Resolution Path: frontmatter.commands → {@items}
Variable Scope: ONLY within commands array
```

**Critical Constraint**: `{@items}` can only access data within the Mapping Origin scope. Any attempt to access data outside this scope results in resolution failure.

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
  { "id": "design:api:rest-architecture-6b4e9a#20250912" },
  { "id": "design:ui:component-library-2c7f5d#20250913" },
  { "id": "design:data:schema-design-8a1b3e#20250914" }
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
    { "id": "design:api:rest-architecture-6b4e9a#20250912" },
    { "id": "design:ui:component-library-2c7f5d#20250913" },
    { "id": "design:data:schema-design-8a1b3e#20250914" }
  ]
}
```

## Architectural Constraints

### Constraint 1: Mapping Origin Requirement
- All template variables **MUST** resolve from a valid Mapping Origin
- `x-frontmatter-part: true` **MUST** be present to establish Mapping Origin
- Without Mapping Origin, all variable resolution fails

### Constraint 1a: Origin Isolation
- Variables **CANNOT** access data outside the Mapping Origin scope
- Cross-origin references are strictly forbidden
- This maintains data encapsulation and prevents scope leakage

### Constraint 2: $ref Resolution Priority
- When `$ref` is present, referenced schema's root becomes template
- `x-template-items` in main schema overrides `$ref` template if both exist

### Constraint 3: Origin Type Validation
- Mapping Origin property **MUST** be array type for `{@items}` resolution
- Non-array data at Mapping Origin causes `{@items}` resolution failure
- Origin type validation occurs during schema analysis phase

### Constraint 4: Template Scope Consistency
- Templates from `$ref` schemas apply to individual items
- Container templates with `{@items}` apply to the entire array

### Constraint 5: Object Structure Consistency
- `{@items}` results **MUST** maintain object structure regardless of property count
- Single property: `{ "id": "{id.full}" }` → `[{ "id": "value1" }, { "id": "value2" }]`
- Multiple properties: `{ "id": "{id.full}", "level": "{level}" }` → `[{ "id": "value1", "level": "levelX" }]`
- **Never extract primitive values** from single-property templates

## Implementation Notes

This mapping hierarchy with strict Origin concept ensures:
- **Deterministic Resolution**: Mapping Origin provides absolute reference point like pwd
- **Scope Isolation**: Variables cannot escape their defined origin scope
- **Predictable Paths**: All variable paths resolve relative to single origin
- **Schema Consistency**: `$ref` schemas provide item-level templates within origin scope
- **Error Prevention**: Origin-based validation prevents ambiguous resolution
- **Security**: Scope isolation prevents unauthorized data access

### Comparison to Unix PWD

| Unix PWD | Mapping Origin |
|----------|----------------|
| `pwd` shows current directory | `x-frontmatter-part: true` defines origin |
| `./file` resolves relative to pwd | `{variable}` resolves relative to origin |
| Cannot access above filesystem root | Cannot access outside origin scope |
| Path resolution is deterministic | Variable resolution is deterministic |
| Commands operate from current directory | Templates operate from mapping origin |

This PWD-like approach ensures template processing has the same predictability and security as filesystem operations.

## Related Documentation

- [x-template-items Specification](x-template-items-specification.md)
- [Template Processing Specification](template-processing-specification.md)
- [List Container vs List Items Separation](list-container-vs-list-items-separation.md)