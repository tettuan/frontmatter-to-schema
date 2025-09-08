# TypeScriptAnalyzer $ref Resolution

This document describes the $ref resolution capability implemented in
TypeScriptAnalyzer.

## Overview

The TypeScriptAnalyzer now supports recursive resolution of JSON Schema `$ref`
references, as required by requirements.ja.md line 46. This enables modular
schema design with reusable type definitions.

## Features

### Recursive Resolution

- Automatically resolves all `$ref` references in schemas before analysis
- Supports nested references (schemas that reference other schemas)
- Handles circular reference detection to prevent infinite loops

### File-Based References

- Resolves external schema files using relative or absolute paths
- Example: `{ "$ref": "command.json" }` loads command.json from the base path

### Custom Base Path Support

- Configure the base directory for resolving relative `$ref` paths
- Set via constructor or factory function parameter

## Usage

### Basic Usage

```typescript
import { createTypeScriptAnalyzer } from "./domain/analyzers/typescript-analyzer.ts";
import { createFileSystemRepository } from "./infrastructure/adapters/file-system-repository.ts";

const fileSystem = createFileSystemRepository();
const analyzer = createTypeScriptAnalyzer(
  fileSystem,
  "1.0.0", // default version
  "Description", // default description
  "./schemas", // base path for $ref resolution
);
```

### Schema with $ref

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "commands": {
      "type": "array",
      "items": { "$ref": "command_schema.json" }
    },
    "config": { "$ref": "config_schema.json" }
  }
}
```

### Referenced Schema (command_schema.json)

```json
{
  "type": "object",
  "properties": {
    "c1": { "type": "string" },
    "c2": { "type": "string" },
    "c3": { "type": "string" }
  },
  "required": ["c1", "c2", "c3"]
}
```

## Processing Flow

1. **Schema Loading**: TypeScriptAnalyzer receives a Schema object
2. **$ref Detection**: SchemaRefResolver scans for `$ref` properties
3. **File Resolution**: Referenced files are loaded from the file system
4. **Recursive Processing**: Referenced schemas are also scanned for `$ref`
5. **Schema Merging**: Resolved schemas replace `$ref` properties
6. **Analysis**: The fully resolved schema is used for frontmatter analysis

## Error Handling

### Missing References

If a referenced schema file cannot be found, the analyzer returns an error with
details about the missing file.

### Circular References

The resolver detects circular references and returns an error to prevent
infinite loops.

### Invalid JSON

If a referenced file contains invalid JSON, a parse error is returned with
details.

## Integration with SchemaRefResolver

The TypeScriptAnalyzer uses the domain's SchemaRefResolver service:

```typescript
private schemaResolver: SchemaRefResolver;

constructor(
  private readonly fileSystem: FileSystemRepository,
  private readonly defaultVersion: string = "1.0.0",
  private readonly defaultDescription: string = "...",
  private readonly basePath: string = ".",
) {
  this.schemaResolver = new SchemaRefResolver(fileSystem, basePath);
}
```

## Testing

Comprehensive tests are provided in
`tests/unit/domain/analyzers/typescript-analyzer.test.ts`:

- External $ref resolution
- Nested $ref resolution
- Missing file handling
- Custom base path support
- Circular reference detection

## Implementation Details

### Files Modified

- `src/domain/analyzers/typescript-analyzer.ts`: Added SchemaRefResolver
  integration
- `tests/unit/domain/analyzers/typescript-analyzer.test.ts`: Added $ref
  resolution tests

### Dependencies

- `SchemaRefResolver`: Core service for $ref resolution
- `FileSystemRepository`: For loading external schema files
- `path`: For resolving file paths

## Compatibility

This implementation maintains backward compatibility:

- Schemas without `$ref` work unchanged
- Existing TypeScriptAnalyzer usage remains valid
- The base path parameter is optional (defaults to ".")

## Future Enhancements

- Support for JSON Pointer references (e.g., `#/definitions/foo`)
- HTTP/HTTPS schema references
- Schema caching for improved performance
- Validation of resolved schemas
