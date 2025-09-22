# Mapping Hierarchy Rules for {@items} Processing and Data Partitioning

## Overview

This document defines the explicit mapping hierarchy rules for how `{@items}`
array expansion works with data partitioning and template processing.

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
   - `x-template`: Specifies a template filename that receives **schema root
     data**
   - `x-template-items`: Specifies a template filename that receives **moved
     origin data** (from `x-frontmatter-part: true` location)
3. **Template File References**: Both `x-template` and `x-template-items` must
   be **filenames** (e.g., "template.json"), containing the actual template
   content
4. **Independent Resolution**: Each template file resolves variables from its
   respective data partition
5. **Parallel Processing**: Both template files can coexist, each working with
   its assigned data partition

#### Mapping Origin Rules

**Rule MO-1: Single Origin Principle**

- Each template processing session has exactly ONE active mapping origin
- The active origin is the highest-level property marked with
  `x-frontmatter-part: true`; among peers at the same depth, the first
  declaration in schema order wins
- Additional `x-frontmatter-part: true` declarations below the active origin are
  ignored for the current session and do not create new origins

**Rule MO-2: Data Partitioning Rules**

- `x-template` → Specifies a filename of template that receives **full schema
  root data**
- `x-frontmatter-part: true` → Creates **data partition boundary**
- `x-template-items` → Specifies a filename of template that receives
  **partitioned array data** from moved origin
- Data is split and passed separately to each specified template file

**Rule MO-3: Template Independence**

- Template files referenced by `x-template` and `x-template-items` process
  **independently**
- Each template file receives its own data partition:
  - Template file in `x-template`: Full frontmatter data from schema root
  - Template file in `x-template-items`: Array data from
    `x-frontmatter-part: true` location
- Template files don't share scope - they work with separate data partitions

#### Mapping Origin Examples

**Example 1: x-template (Schema Root Origin)**

```json
// schema.json
{
  "x-template": "container_template.json",  // ← References template file
  "metadata": { "version": "string" }, // ← Accessible to template
  "commands": { // ← Accessible to template
    "type": "array",
    "items": { "$ref": "command_schema.json" }
  }
}

// container_template.json (referenced by x-template)
{
  "version": "{metadata.version}",
  "items": "{@items}"
}
```

**Mapping Origin**: Schema Root (`frontmatter`) **Variable Resolution**:

- `{@items}` → `frontmatter.commands[*]` ✅
- `{metadata.version}` → `frontmatter.metadata.version` ✅
- All schema properties accessible ✅

**Example 2: Data Partitioning with x-frontmatter-part**

```json
// schema.json
{
  "x-template": "output_template.json",  // ← References container template file
  "metadata": { "version": "1.0" }, // ← Accessible to output_template.json
  "commands": { // ← Data partition boundary
    "type": "array",
    "x-frontmatter-part": true, // ← Creates partition
    "x-template-items": "command_item_template.json", // ← References item template file
    "items": { "$ref": "command_schema.json" }
  }
}

// output_template.json (referenced by x-template)
{
  "meta": "{metadata.version}",
  "cmds": "{@items}"
}

// command_item_template.json (referenced by x-template-items)
{
  "id": "{id.full}",
  "category": "{category}"
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

### Rule 2: Schema Reference Independence

`$ref` is a standard JSON Schema feature for schema reuse and has NO
relationship with template processing. Templates are specified exclusively
through:

- `x-template`: Container template file
- `x-template-items`: Item template file (optional, required for {@items}
  expansion)

```json
// Main schema
"items": { "$ref": "registry_command_schema.json" }  // Schema structure only

// Template specification (completely independent of $ref)
"x-template": "container_template.json",
"x-template-items": "item_template.json"  // This specifies the item template
```

**Key Point**: `$ref` defines schema structure, `x-template-items` defines
template

### Rule 3: Template Application Mapping

Each item in the hierarchy root array gets the template from `x-template-items`
applied (NOT from $ref):

**Input Array** (from `commands`):

```javascript
[
  { "id.full": "design:api:rest-architecture-6b4e9a#20250912", ... },
  { "id.full": "design:ui:component-library-2c7f5d#20250913", ... },
  { "id.full": "design:data:schema-design-8a1b3e#20250914", ... }
]
```

**Template** (from `x-template-items` file):

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
// schema.json
{
  "x-template": "design_output_template.json",  // ← Container template file
  "version": "1.0.0",
  "description": "Design level traceability",
  "commands": {
    "type": "array",
    "x-frontmatter-part": true,
    "x-template-items": "design_item_template.json", // ← Item template file
    "items": { "$ref": "registry_command_schema.json" }
  }
}

// design_output_template.json (referenced by x-template)
{
  "version": "{version}",
  "description": "{description}",
  "design": "{@items}"
}

// design_item_template.json (referenced by x-template-items)
{
  "id": "{id.full}",
  "timestamp": "{timestamp}",
  "level": "{level}"
}

// registry_command_schema.json (referenced by $ref)
{
  "type": "object",
  "properties": {
    "id": {
      "type": "object",
      "properties": {
        "full": { "type": "string" }
      }
    },
    "timestamp": { "type": "string" },
    "level": { "type": "string" }
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

1. **Template Loading**:
   - Load `design_output_template.json` for container processing
   - Load `design_item_template.json` for item processing
2. **Data Partitioning**: `x-frontmatter-part: true` splits data into two
   partitions
3. **Container Template Processing**:
   - `design_output_template.json` uses schema root data
   - Resolves `{version}`, `{description}`, prepares for `{@items}`
4. **Item Template Processing**:
   - `design_item_template.json` uses array partition
   - Applies to each item in commands array
5. **{@items} Resolution**: Replaced with processed array from item template
6. **Final Assembly**: Container template with embedded processed items

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
- **Priority Rule**: If multiple `x-frontmatter-part` flags exist, use the
  highest-level first-occurring declaration and treat downstream flags as inert
  in that run
- **Independent Processing**: Each template works within its assigned partition
- This maintains clean separation of concerns between container and items

### Constraint 2: Template Specification

- `$ref` is for schema structure only, not template resolution
- `x-template-items` is the only way to specify item templates
- If `x-template-items` is not specified, {@items} expansion cannot occur

### Constraint 3: Origin Type Validation

- Mapping Origin property **MUST** be array type for `{@items}` resolution
- Non-array data at Mapping Origin causes `{@items}` resolution failure
- Origin type validation occurs during schema analysis phase

### Constraint 4: Template Scope Consistency

- Item templates (from `x-template-items`) apply to individual items
- Container templates with `{@items}` apply to the entire array
- `$ref` has no role in template processing

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
- **Schema Consistency**: `$ref` provides schema structure validation only
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
