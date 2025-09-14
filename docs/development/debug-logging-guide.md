# Debug Logging Guide

This guide covers the enhanced debug logging functionality implemented to
address issue #798, providing comprehensive visibility into processing flows
across the application.

## Overview

The debug logging system provides structured, configurable logging for all major
processing stages, including:

- Schema processing (loading, resolution, analysis)
- Frontmatter processing (extraction, validation, aggregation)
- Template processing (rendering, variable replacement, formatting)
- Error handling and troubleshooting information

## Environment Configuration

### Debug Levels

Control logging verbosity using the `DEBUG_LEVEL` environment variable:

```bash
export DEBUG_LEVEL=0    # ERROR: Errors only
export DEBUG_LEVEL=1    # WARNING: Warnings and errors
export DEBUG_LEVEL=2    # INFO: Information, warnings, and errors
export DEBUG_LEVEL=3    # DEBUG: All debug information (most verbose)
```

**Default**: `DEBUG_LEVEL=0` (errors only)

### Output Format

Control output format using the `DEBUG_JSON` environment variable:

```bash
export DEBUG_JSON=true   # Structured JSON output
export DEBUG_JSON=false  # Human-readable format (default)
```

## Usage Examples

### Basic Debug Logging

```bash
# Enable info-level logging
export DEBUG_LEVEL=2

# Run your application
deno run --allow-all cli.ts process "*.md" schema.json template.json output.json
```

### Full Debug with JSON Output

```bash
# Enable full debug logging with JSON format
export DEBUG_LEVEL=3
export DEBUG_JSON=true

# Run application - output can be processed by log analysis tools
deno run --allow-all cli.ts process "*.md" schema.json template.json output.json
```

## Log Categories

### Schema Processing

**Stages logged**:

- `schema-loading`: Schema file loading and caching
- `schema-parsing`: JSON parsing and validation
- `schema-analysis`: Schema structure analysis
- `schema-traversal`: Property traversal during analysis
- `derivation-rules`: Extraction of derivation rules
- `extension-detection`: Detection of schema extensions (x-*)

**Example output**:

```
[2025-09-14T07:30:00.000Z] INFO [schema-loading] Loading schema from: registry_schema.json
[2025-09-14T07:30:00.100Z] DEBUG [schema-analysis] Searching for frontmatter-part schema
[2025-09-14T07:30:00.150Z] INFO [derivation-rules] Extracted 4 derivation rules
```

### Frontmatter Processing

**Stages logged**:

- `document-processing`: Overall document processing pipeline
- `file-listing`: File discovery and pattern matching
- `file-processing`: Individual file processing
- `frontmatter-extraction`: Frontmatter extraction from markdown
- `frontmatter-validation`: Schema-based validation
- `frontmatter-parts`: Processing of x-frontmatter-part sections
- `aggregation`: Data aggregation with derivation rules

**Example output**:

```
[2025-09-14T07:30:00.200Z] INFO [document-processing] Starting document processing with pattern: .agent/climpt/prompts/**/*.md
[2025-09-14T07:30:00.250Z] INFO [file-listing] Found 25 files to process
[2025-09-14T07:30:00.300Z] DEBUG [frontmatter-extraction] Successfully extracted frontmatter from: build.md
```

### Template Processing

**Stages logged**:

- `template-rendering`: Overall template rendering pipeline
- `template-loading`: Template file loading
- `variable-processing`: Variable replacement processing
- `array-item-processing`: Processing individual items in array rendering
- `output-formatting`: Final output formatting (JSON/YAML/Markdown)
- `output-writing`: File output operations

**Example output**:

```
[2025-09-14T07:30:01.000Z] INFO [template-rendering] Starting template rendering pipeline
[2025-09-14T07:30:01.050Z] INFO [template-render-array] Starting array data template rendering
[2025-09-14T07:30:01.100Z] DEBUG [output-formatting] Formatting output as json
```

## Integration in Code

### Dependency Injection

Services accept an optional `DebugLogger` parameter:

```typescript
import { DebugLoggerFactory } from "./infrastructure/adapters/debug-logger.ts";

// Create logger based on environment
const debugLogger = DebugLoggerFactory.create();

// Inject into services
const documentService = new DocumentProcessingService(
  frontmatterProcessor,
  aggregator,
  basePropertyPopulator,
  fileReader,
  fileLister,
  debugLogger, // Optional parameter
);
```

### Custom Logger Implementation

Implement the `DebugLogger` interface for custom logging:

```typescript
import { DebugLogger } from "./infrastructure/adapters/debug-logger.ts";

class CustomDebugLogger implements DebugLogger {
  logInfo(
    stage: string,
    message: string,
    details?: Record<string, unknown>,
  ): void {
    // Custom implementation
    myLoggingService.log({ level: "info", stage, message, details });
  }

  // Implement other methods...
}
```

## Log Levels and Performance

### Performance Considerations

- **DEBUG level** generates significant output - use only for troubleshooting
- **INFO level** provides good balance of information and performance
- **ERROR level** has minimal performance impact
- Debug logging uses conditional checks to minimize overhead when disabled

### Structured Data

All log entries include:

- **timestamp**: ISO timestamp
- **level**: Log level (error, info, debug)
- **stage**: Processing stage identifier
- **message**: Human-readable message
- **details**: Structured context data (optional)

## Troubleshooting Common Issues

### Schema Issues

```bash
# Debug schema loading and analysis
export DEBUG_LEVEL=3
# Look for messages in stages: schema-loading, schema-analysis, derivation-rules
```

**Common messages**:

- `Schema cache miss/hit` - Cache behavior
- `No x-frontmatter-part schema found` - Missing required schema sections
- `Extracted N derivation rules` - Rule discovery results

### Frontmatter Processing Issues

```bash
# Debug document processing
export DEBUG_LEVEL=2
# Look for messages in stages: file-processing, frontmatter-extraction, aggregation
```

**Common messages**:

- `No valid data found at path` - Frontmatter-part extraction issues
- `Successfully processed N documents` - Processing summary
- `Frontmatter parsing FAILED` - Parse errors in markdown files

### Template Rendering Issues

```bash
# Debug template processing
export DEBUG_LEVEL=2
# Look for messages in stages: template-rendering, variable-processing, output-formatting
```

**Common messages**:

- `Variable processing successful/failed` - Variable replacement status
- `Template rendering successful` - Overall rendering status
- `Formatting output as [format]` - Output format processing

## Architecture

### DDD Integration

Debug logging follows Domain-Driven Design principles:

- **Infrastructure Layer**: Logger implementation
- **Domain Services**: Accept logger via dependency injection
- **No Coupling**: Domain logic doesn't depend on specific logger implementation

### Totality Principles

- All error paths are logged appropriately
- Result types are logged with success/failure context
- No silent failures - all processing stages provide visibility

## Testing

The debug logging system includes comprehensive tests:

```bash
# Run debug logger tests
deno test tests/unit/infrastructure/debug-logger_test.ts --allow-env
```

Tests cover:

- Environment variable configuration
- Logger factory behavior
- Output format validation
- No-op logger verification
- Error handling scenarios

## Related Documentation

- [Issue #798](https://github.com/user/repo/issues/798) - Original enhancement
  request
- [AI Complexity Control](./ai-complexity-control.md) - Overall development
  strategy
- [Totality Principles](./totality.md) - Error handling philosophy
