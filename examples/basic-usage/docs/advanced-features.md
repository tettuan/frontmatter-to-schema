---
title: Advanced Features
author: Tech Lead
date: 2024-01-20
tags:
  - advanced
  - features
  - configuration
---

# Advanced Features

Explore the advanced capabilities of frontmatter-to-schema.

## Schema Extensions

The tool supports custom schema extensions:

- `x-frontmatter-part`: Marks schema sections for frontmatter binding
- `x-template-format`: Specifies output format preferences

## Variable Resolution

### Simple Variables
- `{{variable}}` - Direct value substitution
- `{{nested.path}}` - Nested object traversal

### Array Handling
- `{@items}` - Array iteration marker
- Automatic context switching for array elements

## Aggregation Support

Combine data from multiple files:
- Collect metadata across documents
- Build indexes and catalogs
- Generate summary reports

## Error Handling

Robust validation and error reporting:
- Schema validation errors
- Missing required fields
- Type mismatches
- Template syntax errors