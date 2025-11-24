# x-collect-pattern Usage Guide

This guide explains how to use the `x-collect-pattern` directive to collect properties matching a regex pattern.

> **Specification**: For detailed technical specifications, see [x-collect-pattern-specification.md](../architecture/x-collect-pattern-specification.md)

## Overview

`x-collect-pattern` collects properties from a source object that match a regex pattern and outputs them as an array of key-value pairs.

---

## Basic Usage

### Pattern 1: Collecting from nested object (options)

Collect properties with a specific prefix from within `options`.

#### Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "options": {
      "type": "object",
      "properties": {
        "input": { "type": "array" },
        "destination": { "type": "boolean" }
      },
      "additionalProperties": true
    },
    "user_variables": {
      "type": "array",
      "description": "Collected user variables matching uv-* pattern",
      "x-collect-pattern": {
        "source": "options",
        "pattern": "^uv-.*$"
      },
      "items": {
        "type": "object",
        "properties": {
          "key": { "type": "string" },
          "value": { "type": "string" }
        }
      }
    }
  }
}
```

#### Frontmatter

```yaml
---
options:
  input: ["default"]
  destination: true
  uv-scope: "domain architecture"
  uv-date: "2025-06-08"
  uv-author: "John"
---
```

#### Result

```json
{
  "options": {
    "input": ["default"],
    "destination": true,
    "uv-scope": "domain architecture",
    "uv-date": "2025-06-08",
    "uv-author": "John"
  },
  "user_variables": [
    { "key": "uv-author", "value": "John" },
    { "key": "uv-date", "value": "2025-06-08" },
    { "key": "uv-scope", "value": "domain architecture" }
  ]
}
```

#### Template

```json
{
  "options": {
    "input": "{options.input}",
    "destination": "{options.destination}"
  },
  "user_variables": "{user_variables}"
}
```

---

### Pattern 2: Collecting from top-level object

Use a dedicated top-level object for user variables, keeping `options` clean.

#### Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "options": {
      "type": "object",
      "properties": {
        "input": { "type": "array" },
        "destination": { "type": "boolean" }
      }
    },
    "uv": {
      "type": "object",
      "description": "User variables container",
      "additionalProperties": true
    },
    "user_variables": {
      "type": "array",
      "description": "Collected user variables from uv object",
      "x-collect-pattern": {
        "source": "uv",
        "pattern": "^.*$"
      }
    }
  }
}
```

#### Frontmatter

```yaml
---
options:
  input: ["default"]
  destination: true
uv:
  scope: "domain architecture"
  date: "2025-06-08"
  author: "John"
---
```

#### Result

```json
{
  "options": {
    "input": ["default"],
    "destination": true
  },
  "uv": {
    "scope": "domain architecture",
    "date": "2025-06-08",
    "author": "John"
  },
  "user_variables": [
    { "key": "author", "value": "John" },
    { "key": "date", "value": "2025-06-08" },
    { "key": "scope", "value": "domain architecture" }
  ]
}
```

### Pattern Comparison

| Pattern | Pros | Cons |
|---------|------|------|
| Nested in options (`source: "options"`) | Maintains existing structure | Requires prefix (`uv-`), options becomes complex |
| Dedicated object (`source: "uv"`) | Clear structure, no prefix needed | Additional hierarchy in frontmatter |

---

## additionalProperties Placement Rules

When using `x-collect-pattern`, you must place `additionalProperties: true` on the **source object**.

### Basic Principle

**Place `additionalProperties: true` on the object specified by `source`**

```json
{
  "target_property": {
    "x-collect-pattern": {
      "source": "source_path",  // ← This path points to
      "pattern": "..."
    }
  },
  "source_path": {
    "type": "object",
    "additionalProperties": true  // ← Place here
  }
}
```

### Examples

#### Example 1: Top-level object

```json
{
  "properties": {
    "uv": {
      "type": "object",
      "additionalProperties": true  // ✅ Source for "source": "uv"
    },
    "user_variables": {
      "x-collect-pattern": {
        "source": "uv",
        "pattern": "^.*$"
      }
    }
  }
}
```

#### Example 2: Nested object

```json
{
  "properties": {
    "config": {
      "type": "object",
      "properties": {
        "settings": {
          "type": "object",
          "additionalProperties": true  // ✅ Source for "source": "config.settings"
        }
      }
    },
    "collected_settings": {
      "x-collect-pattern": {
        "source": "config.settings",
        "pattern": "^custom_.*$"
      }
    }
  }
}
```

#### Example 3: Object with existing properties

```json
{
  "properties": {
    "options": {
      "type": "object",
      "properties": {
        "input": { "type": "array" },
        "destination": { "type": "boolean" }
      },
      "additionalProperties": true  // ✅ Allow additional properties
    },
    "user_variables": {
      "x-collect-pattern": {
        "source": "options",
        "pattern": "^uv-.*$"
      }
    }
  }
}
```

### Common Mistakes

#### ❌ Mistake 1: Placing on target property

```json
{
  "user_variables": {
    "x-collect-pattern": {
      "source": "uv",
      "pattern": "^.*$"
    },
    "additionalProperties": true  // ❌ Wrong location
  },
  "uv": {
    "type": "object"
    // No additionalProperties → collected properties are dropped
  }
}
```

#### ❌ Mistake 2: Using additionalProperties: false

```json
{
  "uv": {
    "type": "object",
    "additionalProperties": false  // ❌ Collected properties are dropped
  },
  "user_variables": {
    "x-collect-pattern": {
      "source": "uv",
      "pattern": "^.*$"
    }
  }
}
```

This will generate warning `COLLECT_PATTERN_ADDITIONAL_PROPS_FALSE`.

### Why additionalProperties: true is Required

yaml-schema-mapper processes in this order:

1. Map properties defined in Schema
2. If `additionalProperties: false`, **delete** undefined properties
3. Execute `x-collect-pattern` collection

With `additionalProperties: false`, step 2 deletes the properties before step 3 can collect them.

---

## Format Options

The `format` option controls the output structure:

| Format | Output |
|--------|--------|
| `key-value` (default) | `[{key, value}, ...]` |
| `object` | `{key1: value1, ...}` |
| `keys` | `["key1", "key2", ...]` |
| `values` | `[value1, value2, ...]` |

### Example: keys format

```json
{
  "collected_keys": {
    "type": "array",
    "x-collect-pattern": {
      "source": "options",
      "pattern": "^uv-.*$",
      "format": "keys"
    }
  }
}
```

Result: `["uv-author", "uv-date", "uv-scope"]`

---

## Best Practices

1. **Use dedicated source objects**
   - Create objects like `uv`, `custom`, `meta` for collection
   - Explicitly set `additionalProperties: true`

2. **When collecting from existing objects**
   - Use prefix patterns (`^uv-.*$`) to clearly identify collection targets
   - Works fine with mixed fixed and collected properties

3. **Documentation**
   - Use `description` to explain which properties are collected
   - Clarify the intent of collection patterns
