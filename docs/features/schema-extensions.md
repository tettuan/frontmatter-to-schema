# Schema Extension Properties

This document describes the x-* extension properties supported for JSON Schema
in the frontmatter-to-schema project.

## Overview

Schema extensions enable advanced data aggregation and processing capabilities
through custom x-* properties in your JSON Schema definitions.

## Supported Extensions

### x-derived-from

Aggregates values from multiple documents using JSONPath-like expressions.

**Example:**

```json
{
  "availableConfigs": {
    "type": "array",
    "x-derived-from": "commands[].c1",
    "x-derived-unique": true,
    "items": {
      "type": "string"
    }
  }
}
```

This will collect all `c1` values from the `commands` array across all processed
documents.

### x-derived-unique

When used with `x-derived-from`, removes duplicate values from the aggregated
results.

**Example:**

```json
{
  "tools": {
    "type": "array",
    "x-derived-from": "tools[].name",
    "x-derived-unique": true
  }
}
```

### x-derived-flatten

Flattens nested arrays into a single-level array.

**Example:**

```json
{
  "allItems": {
    "type": "array",
    "x-derived-from": "nested",
    "x-derived-flatten": true
  }
}
```

Input: `[["item1", "item2"], ["item3"]]` Output: `["item1", "item2", "item3"]`

### x-frontmatter-part

Marks array properties that should be used for iterating over markdown files in
batch processing.

**Example:**

```json
{
  "commands": {
    "type": "array",
    "x-frontmatter-part": true,
    "items": {
      "type": "object"
    }
  }
}
```

## Usage Example

Complete schema with multiple extensions:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "registry": {
      "type": "object",
      "properties": {
        "availableConfigs": {
          "type": "array",
          "description": "Aggregated list of all unique config names",
          "x-derived-from": "commands[].c1",
          "x-derived-unique": true,
          "items": {
            "type": "string"
          }
        },
        "commands": {
          "type": "array",
          "x-frontmatter-part": true,
          "items": {
            "type": "object",
            "properties": {
              "c1": { "type": "string" },
              "c2": { "type": "string" },
              "c3": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

## Implementation

The schema extensions are processed by the `SchemaAggregationAdapter` which
bridges the schema definition with the aggregation service. The processing
pipeline:

1. Schema parsing - Extract x-* properties
2. Rule creation - Convert to aggregation rules
3. Data collection - Process multiple documents
4. Aggregation - Apply rules (derive, unique, flatten)
5. Template mapping - Apply aggregated data to output

## Testing

All schema extensions are covered by comprehensive unit tests in
`schema-aggregation-adapter_test.ts`.
