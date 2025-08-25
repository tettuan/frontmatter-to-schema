# Requirements

1. Extract and analyze Markdown frontmatter
2. Map analyzed results to template format based on Schema and write output
3. Use TypeScript structured processing for analysis to ensure frontmatter
   flexibility

## Purpose

To create indexes for Markdown files. Various Markdown files exist for different
purposes with diverse frontmatter definitions. Creating indexes is difficult
without strict Schema definitions in operation. Therefore, we use AI to perform
post-hoc type definition and indexing (not through input validation or
pre-definition, but for already created Markdown).

## Background

Markdown and frontmatter offer the advantage of flexible operation as needed.
However, since they are created without strict type definitions, input methods
and naming tend to be operator-dependent. Furthermore, including accumulated
past Markdown files makes it difficult to pre-define and operate everything.
This addresses these challenges.

## Reason for Flexibility

Applications that only support specific patterns cannot adapt to Schema changes.
Therefore, the application reads Schemas and templates externally, uses Schema
definitions with replacement in mind, and outputs to templates.

This allows changing only the index-side definitions **without modifying the
Markdown side** when index specifications change.

Additionally, by switching Schema and template sets and changing Markdown file
paths and index output destinations, the same application can create various
indexes for prompt collections, article indexes, etc.

This is the reason for ensuring flexibility and why "making replaceable Schemas
and templates is an important requirement."

# Deliverables

1. Requirement organization and specification
2. Separation of functional and non-functional requirements
3. Domain boundary design documentation
4. Implemented analysis scripts and robust tests
5. TypeScript processing logic for two-stage analysis
6. Execution examples using real cases in examples/

# Analysis Process

First, create a prompt list. (Result A) Also, create the final deliverable in an
empty state (Final Result Z)

Process Result A in a loop. Process all items. In each loop, process one prompt
at a time. First, extract the frontmatter portion using Deno. (Result B) Analyze
Result B with TypeScript processing (Result C) Map Result C to structured data
using TypeScript processing (Result D) Integrate Result D into Final Result Z
Save Final Result Z.

## TypeScript Processing

Use the following two types:

a. Extract information using Schema expansion and mapping from frontmatter data
b. Map extracted information to analysis template using type-safe variable
substitution

Embed extraction prompts inside TypeScript.

## Abstraction Level

Rules:

1. Do not mix concrete Example 1-Example 2 patterns in implementation
2. Application code is unaffected by changes to Example 1-Example 2 Schema and
   template examples
3. Application code is unaffected by changes to Example 1-Example 2 hierarchy
   information
4. Points 2 and 3 above are resolved through configuration or arguments
5. Final Result Z equals the combined results from TypeScript processing

# Reference Information

The following are actual use case examples. The deliverable is a generically
abstracted application that can handle cases beyond Example 1-Example 2 listed
here. These examples are provided to verify whether the application can actually
map from Schema to template using these real cases.

For actual usage examples, create under examples/ in an executable form. tests/
strengthens application code, while examples/ demonstrates real examples.

## Example 1

### Frontmatter Analysis Target Folder:

`.agent/climpt/prompts`

### Analysis Result Save Location:

`.agent/climpt/registry.json`

### Analysis Result Schema:

```json
{
  "tools": {
    "commands[]": {
      "title": "command name (3 words max)",
      "description": "command description",
      "type": "string"
    }
  }
}
```

### Analysis Template:

```json
{
  "tools": {
    "availableConfigs": ["default", "alternate"],
    "commands": [
      {
        "title": "example command title",
        "description": "example command description"
      }
    ]
  }
}
```

## Example 2

### Frontmatter Analysis Target Folder:

`blog/posts/*.md`

### Analysis Result Save Location:

`blog/index.json`

### Analysis Result Schema:

```json
{
  "posts[]": {
    "title": "article title",
    "date": "publication date",
    "tags": "tag list",
    "summary": "article summary"
  }
}
```

### Analysis Template:

```json
{
  "posts": [
    {
      "title": "Example Article",
      "date": "2024-01-01",
      "tags": ["tech", "ai"],
      "summary": "This is an example article summary"
    }
  ]
}
```

# Implementation Guidelines

## Architecture

- Follow Domain-Driven Design (DDD) principles
- Implement clear separation between domain logic and infrastructure
- Use dependency injection for flexibility
- Apply Result type pattern for error handling

## Code Quality

- Write comprehensive unit tests
- Implement integration tests for real scenarios
- Use TypeScript for type safety
- Follow clean code principles

## Error Handling

- Use Result types instead of exceptions
- Provide detailed error messages
- Handle all edge cases gracefully
- Log errors appropriately

## Performance

- Optimize for batch processing
- Implement caching where appropriate
- Use async/await for I/O operations
- Monitor memory usage for large datasets
