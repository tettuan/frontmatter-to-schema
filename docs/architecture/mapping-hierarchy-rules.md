# Mapping Hierarchy Rules for {@items} and $ref Processing

## Overview

This document defines the explicit mapping hierarchy rules for how `{@items}`
array expansion interacts with `$ref` schema references and template processing.

## Fundamental Concepts

### Mapping Origin (起点) - The PWD Concept

Just as Unix commands operate relative to a Present Working Directory (pwd),
template variable mapping requires a **definitive starting point** called the
**Mapping Origin**.

#### Definition of Mapping Origin

The **Mapping Origin** is the reference point that determines **data
partitioning** for template processing. It functions as a data splitting
boundary:

1. **Data Partitioning Purpose**: Origin defines how frontmatter data is split
   for template processing
2. **Dual Template System**:
   - `x-template`: Receives **schema root data** (origin at schema root)
   - `x-template-items`: Receives **moved origin data** (origin at
     `x-frontmatter-part: true` location)
3. **Independent Resolution**: Each template resolves variables from its
   respective data partition
4. **Moved Origin**: `x-frontmatter-part: true` **moves the origin** to
   partition array data separately
5. **Parallel Processing**: Both templates can coexist, each working with its
   assigned data partition

#### Mapping Origin Rules

**Rule MO-1: Single Origin Principle**

- Each template processing session has exactly ONE mapping origin
- Multiple `x-frontmatter-part: true` properties are invalid
- The origin is established during schema analysis phase

**Rule MO-2: Data Partitioning Rules**

- `x-template` → Always receives **full schema root data**
- `x-frontmatter-part: true` → Creates **data partition boundary**
- `x-template-items` → Receives **partitioned array data** from moved origin
- Data is split and passed separately to each template type

**Rule MO-3: Template Independence**

- `x-template` and `x-template-items` process **independently**
- Each template receives its own data partition:
  - `x-template`: Full frontmatter data from schema root
  - `x-template-items`: Array data from `x-frontmatter-part: true` location
- Templates don't share scope - they work with separate data partitions

#### Mapping Origin Examples

**Example 1: x-template (Schema Root Origin)**

```json
// Schema with x-template (no origin movement)
{
  "x-template": { "design": "{@items}" },
  "metadata": { "version": "string" }, // ← Accessible
  "commands": { // ← Accessible
    "type": "array",
    "items": { "$ref": "command_schema.json" }
  }
}
```

**Mapping Origin**: Schema Root (`frontmatter`) **Variable Resolution**:

- `{@items}` → `frontmatter.commands[*]` ✅
- `{metadata.version}` → `frontmatter.metadata.version` ✅
- All schema properties accessible ✅

**Example 2: Data Partitioning with x-frontmatter-part**

```json
// Schema with data partitioning
{
  "x-template": { "meta": "{metadata.version}", "cmds": "{@items}" },
  "metadata": { "version": "1.0" }, // ← Accessible to x-template
  "commands": { // ← Data partition boundary
    "type": "array",
    "x-frontmatter-part": true, // ← Creates partition
    "x-template-items": { "id": "{id.full}" },
    "items": { "$ref": "command_schema.json" }
  }
}
```

**Data Partitioning**:

- **Partition 1** (x-template): Full schema root data
  - `{metadata.version}` → `frontmatter.metadata.version` ✅
  - `{@items}` → Processed array from partition 2 ✅
- **Partition 2** (x-template-items): Array data only
  - `{id.full}` → `commands[current].id.full` ✅
  - `{metadata.version}` → Not in this partition (but OK, different template)

## Core Mapping Rules

### Rule 1: {@items} Resolution with Data Partitioning

`{@items}` is always resolved in the context of `x-template` which receives full
schema root data:

**Data Flow for {@items}:**

```
1. x-template receives: Full frontmatter data (schema root)
2. x-template-items receives: Array data only (from x-frontmatter-part location)
3. x-template-items processes: Each array item with its template
4. {@items} in x-template: Replaced with processed array from step 3
```

**Key Points**:

- `{@items}` appears in `x-template` but references processed results from
  `x-template-items`
- Data partitioning allows `x-template` to access all schema properties
- `x-template-items` works independently on array partition
- The two templates collaborate through `{@items}` substitution

### Rule 2: $ref Template Source Resolution

When `items` contains a `$ref`, the referenced schema's root structure becomes
the template source for each array item.

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

### Rule 3: Template Application Mapping

Each item in the hierarchy root array gets the template from the `$ref` schema
applied:

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

## Complete Flow Example with Data Partitioning

### Schema Definition

```json
{
  "x-template": {
    "version": "{version}",
    "description": "{description}",
    "design": "{@items}"
  },
  "version": "1.0.0",
  "description": "Design level traceability",
  "commands": {
    "type": "array",
    "x-frontmatter-part": true,
    "x-template-items": { "id": "{id.full}" },
    "items": { "$ref": "registry_command_schema.json" }
  }
}
```

### Data Partitioning

**Partition 1 - Schema Root Data (for x-template):**

```json
{
  "version": "1.0.0",
  "description": "Design level traceability",
  "commands": [...]  // Full array available for {@items}
}
```

**Partition 2 - Array Data (for x-template-items):**

```json
[
  { "id": { "full": "design:api:rest#20250912" } },
  { "id": { "full": "design:ui:component#20250913" } }
]
```

### Processing Flow

1. **Data Partitioning**: `x-frontmatter-part: true` splits data into two
   partitions
2. **x-template Processing**: Uses schema root data, resolves `{version}`,
   `{description}`, `{@items}`
3. **x-template-items Processing**: Uses array partition, applies to each item
4. **{@items} Resolution**: Replaced with processed array from x-template-items
5. **Final Assembly**: Container template with embedded processed items

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

### Constraint 1: Mapping Origin Types

- `x-template`: Uses **Schema Root** as origin (no movement required)
- `x-frontmatter-part: true`: **Moves origin** to that property location
- Mixed usage: Schema analysis determines which pattern is active

### Constraint 1a: Data Partitioning Scope

- **Data Split Strategy**: Origin movement creates two separate data partitions
- **Template Data Assignment**:
  - `x-template`: Receives complete frontmatter data (schema root scope)
  - `x-template-items`: Receives array data only (moved origin scope)
- **Independent Processing**: Each template works within its assigned partition
- This maintains clean separation of concerns between container and items

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

- `{@items}` results **MUST** maintain object structure regardless of property
  count
- Single property: `{ "id": "{id.full}" }` →
  `[{ "id": "value1" }, { "id": "value2" }]`
- Multiple properties: `{ "id": "{id.full}", "level": "{level}" }` →
  `[{ "id": "value1", "level": "levelX" }]`
- **Never extract primitive values** from single-property templates

## Implementation Notes

This mapping hierarchy with data partitioning ensures:

- **Clean Data Separation**: Origin movement creates distinct data partitions
  for templates
- **Template Independence**: `x-template` and `x-template-items` work with
  separate data
- **Predictable Resolution**: Each template knows exactly which data partition
  it receives
- **Schema Consistency**: `$ref` schemas provide item-level templates within
  array partition
- **Parallel Processing**: Container and items templates process independently
- **Separation of Concerns**: Container logic (x-template) separate from item
  logic (x-template-items)

### Comparison to Unix PWD

| Unix PWD                                  | Mapping Origin                                   |
| ----------------------------------------- | ------------------------------------------------ |
| Default PWD is root directory             | `x-template` uses schema root as origin          |
| `cd /path` moves PWD to new location      | `x-frontmatter-part: true` moves origin          |
| `./file` resolves relative to current PWD | `{variable}` resolves relative to current origin |
| Cannot access above filesystem root       | Cannot access outside origin scope when moved    |
| Path resolution is deterministic          | Variable resolution is deterministic             |
| Commands operate from current directory   | Templates operate from current mapping origin    |

This PWD-like approach ensures template processing has the same predictability
and security as filesystem operations, with origin movement providing the same
flexibility as changing directories.

## Related Documentation

- [x-template-items Specification](x-template-items-specification.md)
- [Template Processing Specification](template-processing-specification.md)
- [List Container vs List Items Separation](list-container-vs-list-items-separation.md)
