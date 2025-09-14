---
title: Getting Started with Frontmatter-to-Schema
author: Documentation Team
date: 2024-01-15
tags:
  - tutorial
  - basics
  - frontmatter
---

# Getting Started with Frontmatter-to-Schema

This document demonstrates the basic usage of the frontmatter-to-schema tool.

## Overview

The frontmatter-to-schema tool extracts metadata from markdown files and transforms it according to defined schemas and templates.

## Key Features

- **Schema Validation**: Ensures frontmatter conforms to JSON Schema
- **Template Transformation**: Converts data to desired output format
- **Multiple Formats**: Supports JSON, YAML, and custom formats

## Basic Workflow

1. Define your schema (JSON Schema format)
2. Create a template for output formatting
3. Process markdown files with frontmatter
4. Generate structured output

## Example Usage

```bash
frontmatter-to-schema docs/ --schema=schema.json --template=template.json
```

This will process all markdown files in the `docs/` directory and generate output based on the schema and template specifications.