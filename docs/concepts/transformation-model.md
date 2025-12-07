# Transformation Model

This document explains the conceptual model of frontmatter-to-schema: how YAML
frontmatter is transformed into structured output using schema-driven
directives.

## Core Concept

**frontmatter-to-schema** is a transformation pipeline that:

1. **Reads** YAML frontmatter from Markdown files
2. **Transforms** data according to `x-*` directive instructions in a JSON
   Schema
3. **Outputs** structured data (JSON/YAML) using templates

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Markdown Files │     │   JSON Schema   │     │    Template     │
│  (Frontmatter)  │     │ (x-* directives)│     │   (Structure)   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Transformation Pipeline                       │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────────────┐  │
│  │ Extract │ → │ Collect │ → │ Derive  │ → │ Render Template │  │
│  │  YAML   │   │ Arrays  │   │ Values  │   │     Output      │  │
│  └─────────┘   └─────────┘   └─────────┘   └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────┐
                    │  Output File    │
                    │  (JSON/YAML)    │
                    └─────────────────┘
```

## The x-\* Directive Language

The `x-*` directives are a **transformation procedure language** embedded in
JSON Schema. They describe:

- **What to collect**: `x-frontmatter-part` marks which arrays receive
  frontmatter data
- **How to transform**: `x-derived-from`, `x-flatten-arrays`,
  `x-jmespath-filter`
- **What to output**: `x-template`, `x-template-items`, `x-template-format`

### Directive Categories

| Category                | Purpose                   | Directives                                               |
| ----------------------- | ------------------------- | -------------------------------------------------------- |
| **Collection Control**  | Gather data from files    | `x-frontmatter-part`, `x-collect-pattern`, `x-map-from`  |
| **Data Transformation** | Process and derive values | `x-derived-from`, `x-derived-unique`, `x-flatten-arrays` |
| **Filtering**           | Advanced queries          | `x-jmespath-filter`                                      |
| **Output Rendering**    | Control final output      | `x-template`, `x-template-items`, `x-template-format`    |

### Key Constraints (Common Beginner Mistakes)

Understanding these three constraints will prevent most common errors:

#### 1. Full Path Notation in `x-derived-from`

`x-derived-from` requires **full JSONPath-style paths** from the schema root:

```json
// ✅ Correct - full path from root
{ "x-derived-from": "tools.commands[].c1" }

// ❌ Wrong - relative path
{ "x-derived-from": "commands[].c1" }  // Missing "tools." prefix
```

The path must match your schema's exact nesting structure.

#### 2. Template Variables: Single Reference Only

Each placeholder can only reference **one variable**. Compound expressions are
not supported:

```json
// ✅ Correct - single variable per placeholder
{
  "name": "{title}",
  "id": "{c1}"
}

// ❌ Wrong - compound expansion not supported
{
  "usage": "{title}\n{c1}"  // Will NOT expand both variables
}
```

For complex output, structure your template with separate properties or use
`x-template-items` for per-item formatting.

#### 3. Schema-Defined Variables Only

**Only variables defined in the schema are available** for template expansion.
Frontmatter properties not declared in the schema are ignored:

```yaml
# Frontmatter
---
title: My Document
author: John  # Not in schema
custom_field: value  # Not in schema
---
```

```json
// Schema
{
  "properties": {
    "title": { "type": "string" }
    // "author" and "custom_field" not defined
  }
}
```

```json
// Template result
{
  "name": "{title}", // ✅ Expands to "My Document"
  "writer": "{author}" // ❌ Stays as "{author}" - not in schema
}
```

**Rule**: If you need a frontmatter property in output, it must be declared in
your schema.

## Three Domain Boundaries

The system operates across three distinct domains:

### 1. Schema Analysis Domain

**Purpose**: Parse schema and identify processing instructions

**Outputs**:

- Frontmatter structure specification (what to extract)
- Template references (where to find templates)
- Data processing directives (how to transform)

**Key directives**: All `x-*` directives are parsed here

### 2. Data Processing Domain

**Purpose**: Extract, transform, and aggregate frontmatter data

**Inputs**: Raw YAML frontmatter from Markdown files

**Outputs**: Transformed data ready for template rendering

**Processing steps**:

1. YAML extraction (`@std/front-matter`)
2. Schema-compliant mapping (`yaml-schema-mapper`)
3. Array aggregation (`x-frontmatter-part`)
4. Value derivation (`x-derived-from`, `x-derived-unique`)
5. Advanced filtering (`x-jmespath-filter`)

### 3. Template Rendering Domain

**Purpose**: Generate final output file

**Inputs**: Processed data + template files

**Outputs**: JSON/YAML/TOML/Markdown file

**Key concepts**:

- `x-template`: Container template (full data scope)
- `x-template-items`: Item template (per-item scope)
- `{@items}`: Expansion marker for array items
- `{variable}`: Variable substitution

## Processing Flow

The 8-stage processing pipeline:

| Stage | Name                  | Key Directive        | Sub-module         |
| ----- | --------------------- | -------------------- | ------------------ |
| 0     | Schema Transformation | (schema parsing)     | yaml-schema-mapper |
| 1     | Target Identification | `x-frontmatter-part` | -                  |
| 2     | Array Flattening      | `x-flatten-arrays`   | -                  |
| 3     | JMESPath Filtering    | `x-jmespath-filter`  | -                  |
| 4     | Value Aggregation     | `x-derived-from`     | data-path-resolver |
| 5     | Deduplication         | `x-derived-unique`   | -                  |
| 6     | Data Collection       | (internal)           | -                  |
| 7     | Template Application  | `x-template*`        | json-template      |

## Quick Example

### Input: `docs/api.md`

```yaml
---
title: API Reference
category: documentation
tags: [api, rest]
---
```

### Schema: `schema.json`

```json
{
  "x-template": "output.json",
  "properties": {
    "documents": {
      "type": "array",
      "x-frontmatter-part": true
    },
    "categories": {
      "type": "array",
      "x-derived-from": "documents[].category",
      "x-derived-unique": true
    }
  }
}
```

### Template: `output.json`

```json
{
  "docs": "{@items}",
  "categories": "{categories}"
}
```

### Result

```json
{
  "docs": [
    {
      "title": "API Reference",
      "category": "documentation",
      "tags": ["api", "rest"]
    }
  ],
  "categories": ["documentation"]
}
```

## Next Steps

| Task                            | Document                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| Choose which directives to use  | [Directive Selection Guide](../guides/directive-selection.md)                             |
| Learn directive syntax          | [Schema Extensions Reference](../schema-extensions.md)                                    |
| Debug transformation issues     | [Troubleshooting Guide](../troubleshooting.md)                                            |
| Understand processing details   | [Schema Directives Specification](../architecture/schema-directives-specification.md)     |
| Learn template variable scoping | [Template Processing Specification](../architecture/template-processing-specification.md) |

## Related Documentation

- [README](../../README.md) - Installation and quick start
- [Examples](../../examples/README.md) - Working examples with real use cases
- [Architecture Overview](../architecture/README.md) - Detailed architectural
  documentation
