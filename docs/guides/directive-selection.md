# Directive Selection Guide

This guide helps you choose which `x-*` directives to use for your specific use
case.

## Decision Flowchart

```
                     ┌──────────────────────────────────┐
                     │    What do you want to do?       │
                     └──────────────────┬───────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
        ▼                               ▼                               ▼
┌───────────────────┐     ┌───────────────────┐         ┌───────────────────┐
│ Collect data from │     │ Transform/derive  │         │ Control output    │
│ multiple files    │     │ values            │         │ format            │
└─────────┬─────────┘     └─────────┬─────────┘         └─────────┬─────────┘
          │                         │                             │
          ▼                         ▼                             ▼
   x-frontmatter-part        x-derived-from              x-template
   x-collect-pattern         x-derived-unique            x-template-items
   x-map-from                x-flatten-arrays            x-template-format
                             x-jmespath-filter
```

## Use Case Matrix

### "I want to..."

| Goal                                    | Directive(s)                          | Example                            |
| --------------------------------------- | ------------------------------------- | ---------------------------------- |
| Collect frontmatter from multiple files | `x-frontmatter-part`                  | Build article index                |
| Extract unique values from an array     | `x-derived-from` + `x-derived-unique` | List all categories                |
| Flatten nested arrays                   | `x-flatten-arrays`                    | Combine all tags from all articles |
| Map alternative property names          | `x-map-from`                          | Accept "writer" as "author"        |
| Collect properties matching a pattern   | `x-collect-pattern`                   | Gather all `uv-*` options          |
| Apply advanced filtering                | `x-jmespath-filter`                   | Filter active items only           |
| Customize output structure              | `x-template`                          | Define output JSON structure       |
| Customize each array item's output      | `x-template-items`                    | Format each command differently    |
| Change output format                    | `x-template-format`                   | Output as YAML instead of JSON     |

---

## Directive Selection by Scenario

### Scenario 1: Build an Article Index

**Goal**: Process multiple Markdown files and create an index

**Required directives**:

```json
{
  "x-template": "index_template.json",
  "properties": {
    "articles": {
      "type": "array",
      "x-frontmatter-part": true
    }
  }
}
```

**Optional additions**:

- `x-template-items` - Custom format for each article entry
- `x-derived-from` + `x-derived-unique` - Extract unique categories/tags

---

### Scenario 2: Extract Unique Categories

**Goal**: Get a list of all unique categories from articles

**Required directives**:

```json
{
  "properties": {
    "articles": {
      "type": "array",
      "x-frontmatter-part": true
    },
    "categories": {
      "type": "array",
      "x-derived-from": "articles[].category",
      "x-derived-unique": true
    }
  }
}
```

**Path expression pattern**: `arrayProperty[].nestedProperty`

---

### Scenario 3: Combine All Tags (Flatten)

**Goal**: Get a flat list of all tags from all articles

**Required directives**:

```json
{
  "properties": {
    "articles": {
      "type": "array",
      "x-frontmatter-part": true,
      "x-flatten-arrays": "tags"
    },
    "allTags": {
      "type": "array",
      "x-derived-from": "articles[].tags",
      "x-derived-unique": true
    }
  }
}
```

**Note**: `x-flatten-arrays` flattens nested arrays before `x-derived-from`
processes them.

---

### Scenario 4: Handle Property Name Variations

**Goal**: Accept different frontmatter property names

**Required directives**:

```json
{
  "properties": {
    "author": {
      "type": "string",
      "x-map-from": ["writer", "created_by", "owner"]
    }
  }
}
```

**Lookup order**: `author` → `writer` → `created_by` → `owner`

---

### Scenario 5: Collect Dynamic Properties

**Goal**: Gather all properties matching a pattern

**Required directives**:

```json
{
  "properties": {
    "options": {
      "type": "object",
      "additionalProperties": true
    },
    "userVariables": {
      "type": "array",
      "x-collect-pattern": {
        "source": "options",
        "pattern": "^uv-.*$",
        "format": "key-value"
      }
    }
  }
}
```

**Output**: `[{ "key": "uv-scope", "value": "..." }, ...]`

---

### Scenario 6: Filter Data with Conditions

**Goal**: Select only items matching a condition

**Required directives**:

```json
{
  "properties": {
    "activeCommands": {
      "type": "array",
      "x-jmespath-filter": "commands[?status==`active`]"
    }
  }
}
```

**Note**: Use JMESPath syntax with backticks for string literals.

---

### Scenario 7: Custom Output Templates

**Goal**: Control the exact structure of output

**Required directives**:

```json
{
  "x-template": "container.json",
  "x-template-items": "item.json",
  "x-template-format": "yaml"
}
```

**Template files**:

`container.json`:

```json
{
  "version": "1.0",
  "items": "{@items}",
  "generated": "{$timestamp}"
}
```

`item.json`:

```json
{
  "name": "{title}",
  "meta": { "category": "{category}" }
}
```

---

## Directive Compatibility Matrix

| Directive            | Works with                              | Requires                                  |
| -------------------- | --------------------------------------- | ----------------------------------------- |
| `x-frontmatter-part` | `x-template-items`, `x-flatten-arrays`  | Array type                                |
| `x-derived-from`     | `x-derived-unique`                      | Source array                              |
| `x-derived-unique`   | `x-derived-from`                        | `x-derived-from` on same prop             |
| `x-flatten-arrays`   | `x-frontmatter-part`                    | Nested array property                     |
| `x-collect-pattern`  | -                                       | Source object with `additionalProperties` |
| `x-map-from`         | -                                       | -                                         |
| `x-jmespath-filter`  | -                                       | -                                         |
| `x-template`         | `x-template-items`, `x-template-format` | -                                         |
| `x-template-items`   | `x-template`, `x-frontmatter-part`      | Array with `x-frontmatter-part`           |
| `x-template-format`  | `x-template`                            | `x-template`                              |

---

## Processing Order

Directives are processed in this order:

1. `x-map-from` - Property name resolution
2. `x-frontmatter-part` - File collection
3. `x-flatten-arrays` - Array flattening
4. `x-jmespath-filter` - JMESPath filtering
5. `x-derived-from` / `x-derived-unique` - Value derivation
6. `x-collect-pattern` - Pattern collection
7. `x-template` / `x-template-items` - Template rendering

**Important**: Later stages can only access data from earlier stages. For
example, `x-derived-from` can access data after `x-frontmatter-part` has
populated arrays.

---

## Common Mistakes

### 1. Missing array notation in path

```json
// Wrong
{ "x-derived-from": "articles.category" }

// Correct
{ "x-derived-from": "articles[].category" }
```

### 2. Using relative paths instead of full paths

`x-derived-from` requires **full JSONPath-style paths** from schema root:

```json
// Wrong - relative path
{
  "x-derived-from": "commands[].c1"  // Missing parent path
}

// Correct - full path from root
{
  "x-derived-from": "tools.commands[].c1"  // Includes full hierarchy
}
```

**Tip**: The path must match your schema's exact nesting structure.

### 3. Compound template variable expansion

Each placeholder can only reference **one variable**:

```json
// Wrong - compound expansion not supported
{
  "usage": "{title}\n{c1}"  // Will NOT expand both variables
}

// Correct - one variable per placeholder
{
  "title": "{title}",
  "command": "{c1}"
}
```

### 4. Using frontmatter properties not in schema

Only schema-defined properties are available for templates:

```yaml
# Frontmatter has "author"
---
title: Guide
author: John
---
```

```json
// Schema only defines "title"
{
  "properties": {
    "title": { "type": "string" }
    // "author" is NOT defined
  }
}

// Template - {author} will NOT expand
{
  "name": "{title}",    // ✅ Works
  "writer": "{author}"  // ❌ Stays as literal "{author}"
}
```

**Rule**: Add all needed frontmatter properties to your schema.

### 5. Using x-template-items without x-frontmatter-part

```json
// Missing - needs x-frontmatter-part on target array
{
  "x-template-items": "item.json",
  "properties": {
    "items": { "type": "array" } // Missing x-frontmatter-part
  }
}
```

---

## Quick Reference Card

| Need                   | Use                                      |
| ---------------------- | ---------------------------------------- |
| Collect files → array  | `x-frontmatter-part: true`               |
| Extract from array     | `x-derived-from: "array[].prop"`         |
| Remove duplicates      | `x-derived-unique: true`                 |
| Flatten nested arrays  | `x-flatten-arrays: "propName"`           |
| Map property names     | `x-map-from: ["alt1", "alt2"]`           |
| Collect by pattern     | `x-collect-pattern: { source, pattern }` |
| Filter with conditions | `x-jmespath-filter: "expr"`              |
| Container template     | `x-template: "file.json"`                |
| Item template          | `x-template-items: "item.json"`          |
| Output format          | `x-template-format: "yaml"`              |

---

## Related Documentation

- [Transformation Model](../concepts/transformation-model.md) - Conceptual
  overview
- [Schema Extensions Reference](../schema-extensions.md) - Detailed directive
  syntax
- [Troubleshooting Guide](../troubleshooting.md) - Common issues and solutions
- [Examples](../../examples/README.md) - Working examples
