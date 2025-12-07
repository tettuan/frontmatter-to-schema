# Schema Extensions Reference

This document describes the custom JSON Schema extensions (`x-*` properties)
supported by frontmatter-to-schema.

## Related Documentation

- **[Transformation Model](./concepts/transformation-model.md)** - Conceptual
  overview of how x-\* directives work as a transformation language
- **[Directive Selection Guide](./guides/directive-selection.md)** - Decision
  flow for choosing which directives to use
- **[Troubleshooting Guide](./troubleshooting.md)** - Common issues and
  debugging tips

---

## Overview

These extensions enhance standard JSON Schema with frontmatter-specific
functionality, organized into three categories:

### Schema Structure Control

| Extension           | Level    | Description                           |
| ------------------- | -------- | ------------------------------------- |
| `x-derived-from`    | Property | Derive values from nested properties  |
| `x-derived-unique`  | Property | Remove duplicates from derived values |
| `x-flatten-arrays`  | Property | Flatten nested array structures       |
| `x-jmespath-filter` | Property | Apply JMESPath expression             |

### Frontmatter Processing Control

| Extension            | Level    | Description                         |
| -------------------- | -------- | ----------------------------------- |
| `x-frontmatter-part` | Property | Mark array for per-file processing  |
| `x-collect-pattern`  | Property | Collect properties by regex pattern |
| `x-map-from`         | Property | Map from alternative property names |

### Output Control

| Extension           | Level | Description                        |
| ------------------- | ----- | ---------------------------------- |
| `x-template`        | Root  | Template file for output rendering |
| `x-template-items`  | Root  | Item template for array rendering  |
| `x-template-format` | Root  | Output format specification        |

---

# Schema Structure Control

Extensions for deriving and transforming values within the schema.

---

## x-derived-from

Derives values by extracting properties from nested arrays.

**Level:** Property

**Type:** `string` (path expression)

### Path Expression Syntax

```
arrayProperty[].nestedProperty
parent.child[].deepProperty
```

### Usage

```json
{
  "properties": {
    "commands": {
      "type": "array",
      "x-frontmatter-part": true,
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "tags": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "allTags": {
      "type": "array",
      "x-derived-from": "commands[].tags",
      "items": { "type": "string" }
    },
    "allNames": {
      "type": "array",
      "x-derived-from": "commands[].name",
      "items": { "type": "string" }
    }
  }
}
```

### Behavior

- Extracts values after `x-frontmatter-part` arrays are populated
- Flattens nested arrays (e.g., `commands[].tags` where tags is an array)
- Preserves order of extraction
- Returns empty array if source path not found

### Supported Expressions

| Expression                | Description                        | Example Input                      | Output           |
| ------------------------- | ---------------------------------- | ---------------------------------- | ---------------- |
| `property`                | Top-level property access          | `{ "c1": "git" }`                  | `"git"`          |
| `parent.child`            | Dot-notation traversal             | `{ "user": { "name": "John" } }`   | `"John"`         |
| `items[].property`        | Extract property from array items  | `{ "items": [{ "id": 1 }, ...] }`  | `[1, ...]`       |
| `nested.items[].property` | Navigate nested path first         | `{ "data": { "items": [...] } }`   | Extracted values |
| `items[].deep.property`   | Extract nested property from items | `{ "items": [{ "a": { "b": 1 }}]}` | `[1]`            |

### Common Path Issues

| Issue                  | Incorrect                  | Correct                 | Explanation                |
| ---------------------- | -------------------------- | ----------------------- | -------------------------- |
| Missing array notation | `"commands.c1"`            | `"commands[].c1"`       | Need `[]` to iterate array |
| Wrong nesting level    | `"c1"` (for nested)        | `"tools.commands[].c1"` | Must include full path     |
| JSONPath syntax        | `"$.tools.commands[*].c1"` | `"tools.commands[].c1"` | JSONPath not supported     |
| JMESPath filter        | `"commands[?active].c1"`   | Use `x-jmespath-filter` | Filters not supported here |

### Not Supported

- JMESPath filter expressions: `items[?status==true]`
- JSONPath syntax: `$.items[*].name`
- Complex queries or transformations
- Multiple array traversals: `items[].subitems[].value`
- String manipulation (substring extraction, splitting)
- Regular expression matching
- Custom transformation functions

**Important**: The path syntax is specific to this system. It is neither
JSONPath nor JMESPath. For JMESPath queries, use `x-jmespath-filter` instead.

For common path issues and debugging, see the
[Troubleshooting Guide](./troubleshooting.md#schema-and-template-issues).

### Path Resolution Context

Paths are resolved against the **aggregated data structure**, not raw
frontmatter. Processing happens in phases:

1. Frontmatter extraction (raw per-file data)
2. `x-frontmatter-part` aggregation (arrays populated from files)
3. `x-derived-from` processing (values extracted from aggregated data)
4. Template rendering (final output)

This means `x-derived-from` can only access data that exists **after**
`x-frontmatter-part` has collected array items. For example:

```json
{
  "x-derived-from": "tools.commands[].c1"
}
```

This path assumes `tools.commands` is already populated with array items from
the `x-frontmatter-part` directive.

---

## x-derived-unique

Removes duplicate values from derived arrays.

**Level:** Property (used with `x-derived-from`)

**Type:** `boolean`

### Usage

```json
{
  "properties": {
    "allCategories": {
      "type": "array",
      "x-derived-from": "articles[].category",
      "x-derived-unique": true,
      "items": { "type": "string" }
    }
  }
}
```

### Behavior

- Applied after `x-derived-from` extraction
- Uses strict equality for comparison
- Preserves first occurrence order
- Works with primitive values (strings, numbers, booleans)

### Example

**Derived values:** `["tech", "design", "tech", "business", "design"]`

**After x-derived-unique:** `["tech", "design", "business"]`

---

## x-flatten-arrays

Flattens nested array structures within a specified property.

**Level:** Property

**Type:** `string` (property name)

### Usage

```json
{
  "properties": {
    "items": {
      "type": "array",
      "x-frontmatter-part": true,
      "x-flatten-arrays": "tags",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "tags": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

### Behavior

- Recursively flattens nested arrays in the specified property
- Single values are wrapped in an array
- `undefined` or `null` values become empty arrays
- Applied during Phase 1 processing (before x-derived-from)

### Example

**Input data:**

```json
{
  "tags": [["a", "b"], ["c"], [["d", "e"]]]
}
```

**After x-flatten-arrays:** `["a", "b", "c", "d", "e"]`

---

## x-jmespath-filter

Applies JMESPath expression for advanced data filtering and transformation.

**Level:** Property

**Type:** `string` (JMESPath expression)

### Usage

```json
{
  "properties": {
    "activeItems": {
      "type": "array",
      "x-jmespath-filter": "items[?status==`active`].name"
    },
    "summary": {
      "type": "object",
      "x-jmespath-filter": "{total: length(items), active: length(items[?status==`active`])}"
    }
  }
}
```

### Behavior

- Executed on the full aggregated data
- JMESPath expressions use backticks for string literals
- Supports all standard JMESPath functions
- Returns null if expression fails

### Common Patterns

| Pattern                                | Description              |
| -------------------------------------- | ------------------------ |
| `items[?status==\`active\`]`           | Filter by condition      |
| `items[*].name`                        | Extract all names        |
| `items                                 | [0]`                     |
| `{count: length(items)}`               | Create summary object    |
| `items[?contains(tags, \`featured\`)]` | Filter by array contains |

### References

- [JMESPath Specification](https://jmespath.org/specification.html)
- [JMESPath Examples](https://jmespath.org/examples.html)

---

## Value Transformation Limitations

Schema directives extract and aggregate values but do **not** transform them.
String manipulation, substring extraction, and custom transformations are not
supported.

### Not Supported

| Transformation     | Example Need                   | Status       |
| ------------------ | ------------------------------ | ------------ |
| Substring          | `"climpt-git"` → `"git"`       | Not possible |
| Split              | `"a/b/c"` → `["a", "b", "c"]`  | Not possible |
| Replace            | `"old-name"` → `"new-name"`    | Not possible |
| Regular expression | Extract pattern matches        | Not possible |
| Custom function    | Apply arbitrary transformation | Not possible |

### Workarounds

**1. Restructure source data:**

Instead of:

```yaml
c1: climpt-git
```

Use separate fields:

```yaml
c1_prefix: climpt
c1: git
```

**2. Pre-compute in frontmatter:**

```yaml
c1_full: climpt-git
c1: git # Pre-extracted for direct use
```

**3. Post-process output:**

```typescript
const output = JSON.parse(await Deno.readTextFile("output.json"));
output.items = output.items.map((item) => ({
  ...item,
  domain: item.c1.split("-").pop(),
}));
await Deno.writeTextFile("output.json", JSON.stringify(output, null, 2));
```

**4. Use x-jmespath-filter (limited):**

JMESPath has limited string functions. Test thoroughly:

```json
{
  "domains": {
    "x-jmespath-filter": "items[*].c1"
  }
}
```

---

# Frontmatter Processing Control

Extensions for controlling how frontmatter is read and processed from source
files.

---

## x-frontmatter-part

Marks an array property to receive individual frontmatter from multiple files.

**Level:** Property (array type)

**Type:** `boolean`

### Usage

```json
{
  "type": "object",
  "properties": {
    "articles": {
      "type": "array",
      "x-frontmatter-part": true,
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "date": { "type": "string" }
        }
      }
    }
  }
}
```

### Behavior

- When processing a directory, each markdown file's frontmatter becomes one
  array item
- File order is typically alphabetical by filename
- Works with `x-template-items` for custom item rendering

### Example

**Input files:**

```
docs/
  article-1.md  (frontmatter: {title: "First", date: "2025-01-01"})
  article-2.md  (frontmatter: {title: "Second", date: "2025-01-02"})
```

**Output:**

```json
{
  "articles": [
    { "title": "First", "date": "2025-01-01" },
    { "title": "Second", "date": "2025-01-02" }
  ]
}
```

---

## x-collect-pattern

Dynamically collects properties from a source object based on regex pattern
matching.

**Level:** Property

**Type:** `object`

### Configuration

| Option    | Type     | Required | Description                            |
| --------- | -------- | -------- | -------------------------------------- |
| `source`  | `string` | Yes      | Path to source object                  |
| `pattern` | `string` | Yes      | ECMAScript regex pattern               |
| `format`  | `string` | No       | Output format (default: `"key-value"`) |

### Output Formats

| Format      | Output Type               | Description               |
| ----------- | ------------------------- | ------------------------- |
| `key-value` | `Array<{key, value}>`     | Sorted key-value pairs    |
| `object`    | `Record<string, unknown>` | Object with matched pairs |
| `keys`      | `string[]`                | Matched keys only         |
| `values`    | `unknown[]`               | Matched values only       |

### Usage

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

### Example

**Input frontmatter:**

```yaml
options:
  input: ["default"]
  destination: true
  uv-scope: "domain architecture"
  uv-date: "2025-06-08"
  uv-author: "John"
```

**Output (key-value format):**

```json
{
  "userVariables": [
    { "key": "uv-author", "value": "John" },
    { "key": "uv-date", "value": "2025-06-08" },
    { "key": "uv-scope", "value": "domain architecture" }
  ]
}
```

### Nested Source Paths

```json
{
  "x-collect-pattern": {
    "source": "config.advanced",
    "pattern": "^feature-.*$"
  }
}
```

### Important Notes

- Source object should have `additionalProperties: true` to allow dynamic keys
- Pattern uses ECMAScript regex syntax
- Results are sorted alphabetically by key (for `key-value` and `keys` formats)
- Missing source path results in empty array/object

---

## x-map-from

Maps property values from alternative source property names.

**Level:** Property

**Type:** `string | string[]`

### Usage

```json
{
  "properties": {
    "title": {
      "type": "string",
      "x-map-from": "name"
    },
    "description": {
      "type": "string",
      "x-map-from": ["desc", "summary", "about"]
    }
  }
}
```

### Behavior

- If schema property name not found in frontmatter, tries `x-map-from` values
- For array of alternatives, uses first match found
- Original property name takes precedence
- Useful for handling property name variations

### Example

**Schema:**

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

**Input frontmatter:**

```yaml
writer: John Doe
```

**Output:**

```json
{
  "author": "John Doe"
}
```

---

# Output Control

Extensions for controlling the output file format and structure.

---

## x-template

Specifies the template file for rendering output.

**Level:** Root schema

**Type:** `string` (file path)

### Usage

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "template.json",
  "properties": {
    "title": { "type": "string" }
  }
}
```

### Behavior

- Path is relative to the schema file location
- If not specified, `template` option must be provided via API/CLI
- Template file format is auto-detected from extension (.json, .yaml, .yml)

---

## x-template-items

Specifies a separate template for rendering array items when using
`x-frontmatter-part`.

**Level:** Root schema

**Type:** `string` (file path)

### Usage

```json
{
  "type": "object",
  "x-template": "main_template.json",
  "x-template-items": "item_template.json",
  "properties": {
    "commands": {
      "type": "array",
      "x-frontmatter-part": true,
      "items": { "$ref": "command_schema.json" }
    }
  }
}
```

### Behavior

- Used in conjunction with `x-frontmatter-part`
- `x-template` renders the container structure
- `x-template-items` renders each individual item

---

## x-template-format

Specifies the output format for template rendering.

**Level:** Root schema

**Type:** `string` (`"json"` | `"yaml"`)

### Usage

```json
{
  "type": "object",
  "x-template": "template.json",
  "x-template-format": "yaml",
  "properties": {}
}
```

### Behavior

- Overrides format detection from output file extension
- Useful when template format differs from desired output

---

# Processing Order

Extensions are processed in the following order:

1. **x-map-from** - Property name resolution
2. **x-frontmatter-part** - Per-file frontmatter aggregation
3. **x-flatten-arrays** - Flatten nested array structures
4. **x-derived-from** / **x-derived-unique** - Value derivation
5. **x-collect-pattern** - Pattern-based collection
6. **x-jmespath-filter** - JMESPath transformations
7. **x-template** / **x-template-items** - Output rendering

---

# Complete Example

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "registry_template.json",
  "x-template-items": "command_template.json",
  "properties": {
    "version": { "type": "string", "default": "1.0.0" },
    "commands": {
      "type": "array",
      "x-frontmatter-part": true,
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "category": { "type": "string" },
          "tags": { "type": "array", "items": { "type": "string" } },
          "options": { "type": "object", "additionalProperties": true }
        }
      }
    },
    "categories": {
      "type": "array",
      "x-derived-from": "commands[].category",
      "x-derived-unique": true,
      "items": { "type": "string" }
    },
    "allTags": {
      "type": "array",
      "x-derived-from": "commands[].tags",
      "x-derived-unique": true,
      "items": { "type": "string" }
    }
  }
}
```
