# Troubleshooting Guide

## Error Handling and Validation Enhancements

This guide covers the enhanced error handling and validation features
implemented in v1.3.0, including detailed error messages, recovery strategies,
and debugging capabilities.

## Table of Contents

1. [Common Error Types](#common-error-types)
2. [Debug Mode](#debug-mode)
3. [Error Recovery](#error-recovery)
4. [Directive Validation](#directive-validation)
5. [Performance Troubleshooting](#performance-troubleshooting)
6. [FAQ](#faq)

## Common Error Types

### Property Path Errors

#### Invalid Property Path Format

**Error Message:**

```
❌ Invalid property path: "id..full"
   Reason: Consecutive dots are not allowed
   💡 Try: "id.full"
```

**Causes:**

- Consecutive dots in path (`id..full`)
- Path starting or ending with dot (`.id` or `id.`)
- Empty path segments (`id..name`)
- Spaces in property paths (`id .full`)

**Solutions:**

- Use single dots to separate path segments
- Ensure no leading or trailing dots
- Remove spaces from property paths
- Use valid property names

#### Property Not Found

**Error Message:**

```
❌ Property "missing.property" not found in source data
   📋 Available: id.full, name, tags
   💡 Did you mean: id.property, user.profile?
```

**Causes:**

- Typo in property path
- Property doesn't exist in source data
- Incorrect nesting level
- Case sensitivity issues

**Solutions:**

- Check available properties in the error message
- Verify property exists in source frontmatter
- Use the suggested alternatives
- Check case sensitivity

### Type Mismatch Errors

#### Extraction Type Mismatch

**Error Message:**

```
❌ Type mismatch at "count": expected number but got string
   📄 Actual value: "123"
   💡 Tip: Use [] notation in path to normalize single values to arrays
```

**Causes:**

- Schema expects different type than actual data
- String numbers not converted to numbers
- Single values when arrays expected

**Solutions:**

- Enable recovery mode for automatic type conversion
- Use `[]` notation for array normalization
- Update schema to match actual data types
- Convert data at source

### Array Expansion Errors

#### Array Expansion Failed

**Error Message:**

```
❌ Array expansion failed for "items[]": Cannot expand non-array value
   📊 Data structure: Object{id, name, type}
   💡 Ensure the path points to an array or use [] notation for normalization
```

**Causes:**

- Using `[]` notation on non-array values without normalization
- Incorrect path to array property
- Data structure doesn't match expectations

**Solutions:**

- Use `[]` notation for automatic normalization
- Verify data structure matches schema
- Check that path points to correct property
- Enable array normalization in processing

### Circular Dependency Errors

#### Circular Reference Detected

**Error Message:**

```
❌ Circular dependency: path1 → path2 → path3 → path1
   ⚠️  This would create an infinite loop during processing
   💡 Remove the circular reference or restructure the dependencies
```

**Causes:**

- `x-derived-from` references create cycles
- `x-flatten-arrays` processing creates circular dependencies
- Complex dependency chains form loops

**Solutions:**

- Restructure schema to avoid circular references
- Use intermediate properties to break cycles
- Review dependency graph for schema design

### Directive Conflicts

#### Conflicting Directives

**Error Message:**

```
⚠️  Directive conflict at "property": x-flatten-arrays, x-derived-from
   🔧 Resolution: x-flatten-arrays takes precedence
```

**Causes:**

- Multiple conflicting directives on same property
- Incompatible directive combinations
- Unclear processing priority

**Solutions:**

- Remove conflicting directives
- Understand processing precedence
- Use appropriate directive for use case
- Separate concerns into different properties

## Debug Mode

### Enabling Debug Mode

```typescript
import { DebugLogger, ErrorHandler } from "./src/application/services/";

// Enable comprehensive debugging
const errorHandler = ErrorHandler.create({
  debugMode: true,
  verboseLogging: true,
});

const debugLogger = DebugLogger.create({
  level: "verbose",
  enableTimestamps: true,
  enableDataDumps: true,
  outputFormat: "structured",
});
```

### Debug Output Examples

#### Operation Tracking

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "debug",
  "operation": "PropertyExtraction",
  "message": "Extracted property: id.full",
  "data": {
    "path": "id.full",
    "success": true,
    "extractedType": "string",
    "extractedValue": "req:001#20240115"
  }
}
```

#### Error Recovery Logging

```json
{
  "timestamp": "2024-01-15T10:30:46.456Z",
  "level": "info",
  "operation": "ErrorRecovery",
  "message": "Error recovery attempt for PropertyExtraction",
  "data": {
    "originalError": {
      "kind": "PropertyNotFound",
      "summary": "Property 'missing.prop' not found"
    },
    "recoveryStrategy": "defaultValue",
    "recoverySuccess": true,
    "recoveredValue": null
  }
}
```

### Debug Configuration Options

| Option              | Description          | Values                                                |
| ------------------- | -------------------- | ----------------------------------------------------- |
| `level`             | Logging verbosity    | `silent`, `error`, `warn`, `info`, `debug`, `verbose` |
| `enableTimestamps`  | Include timestamps   | `true`, `false`                                       |
| `enableStackTraces` | Include stack traces | `true`, `false`                                       |
| `enableDataDumps`   | Include data in logs | `true`, `false`                                       |
| `maxDataDumpSize`   | Limit data dump size | Number (bytes)                                        |
| `outputFormat`      | Log format           | `console`, `json`, `structured`                       |

## Error Recovery

### Recovery Strategies

#### Automatic Recovery

```typescript
const errorHandler = ErrorHandler.create({
  enableRecovery: true,
  maxRecoveryAttempts: 3,
  continueOnError: true,
});
```

#### Recovery Strategy Types

1. **Default Value Recovery**
   - Applied to: Missing properties
   - Result: Uses null as default value
   - Use case: Optional properties

2. **Type Conversion Recovery**
   - Applied to: Type mismatches
   - Result: Attempts automatic conversion
   - Use case: String numbers, array normalization

3. **Partial Result Recovery**
   - Applied to: Processing failures
   - Result: Returns available partial data
   - Use case: Incomplete extractions

4. **Skip Recovery**
   - Applied to: Non-critical errors
   - Result: Skips problematic operation
   - Use case: Optional processing steps

5. **Abort Recovery**
   - Applied to: Critical errors
   - Result: Stops processing
   - Use case: Circular dependencies, schema errors

### Custom Recovery Configuration

```typescript
// Configure specific recovery strategies
errorHandler.setRecoveryStrategy("PropertyNotFound_1", {
  kind: "defaultValue",
  value: "", // Use empty string instead of null
  reason: "Use empty string for missing text properties",
});
```

## Directive Validation

### Schema Validation

```typescript
import { DirectiveValidator } from "./src/domain/schema/validators/directive-validator.ts";

const validator = DirectiveValidator.create();

// Validate single property
const propertyResult = validator.validateProperty(
  schemaProperty,
  "property.path",
);

// Validate entire schema
const schemaResult = validator.validateSchema(schemaObject);
```

### Common Validation Issues

#### Missing Required Directives

```json
{
  "kind": "MissingRequiredDirective",
  "directive": "x-extract-from",
  "context": "x-frontmatter-part is true at array.property"
}
```

**Solution:** Add required `x-flatten-arrays` directive when using
`x-frontmatter-part: true` for array flattening

#### Invalid Directive Values

```json
{
  "kind": "TypeMismatch",
  "expected": "boolean",
  "actual": "string",
  "path": "property.x-frontmatter-part"
}
```

**Solution:** Use correct data types for directive values

### Validation Best Practices

1. **Validate schemas before processing**
2. **Use validator in development pipeline**
3. **Check validation warnings for optimization opportunities**
4. **Document schema validation requirements**

## Performance Troubleshooting

### Performance Monitoring

```typescript
const debugLogger = DebugLogger.create({
  level: "info",
  enableTimestamps: true,
});

// Monitor operation performance
const operationId = debugLogger.logOperationStart("SchemaProcessing");
// ... perform operation
debugLogger.logOperationComplete(operationId, "SchemaProcessing", true, result);

// Get performance statistics
const stats = debugLogger.getStatistics();
console.log(`Average operation time: ${stats.averageOperationTime}ms`);
```

### Common Performance Issues

#### Large Schema Processing

- **Symptom:** Slow schema validation
- **Solution:** Optimize schema structure, reduce nesting
- **Debug:** Enable performance logging

#### Memory Usage

- **Symptom:** High memory consumption
- **Solution:** Limit data dump size, clear debug logs
- **Debug:** Monitor object sizes in logs

#### Processing Bottlenecks

- **Symptom:** Slow extraction operations
- **Solution:** Optimize property paths, reduce complexity
- **Debug:** Analyze operation breakdown statistics

## FAQ

### How do I enable detailed error messages?

Use the enhanced ErrorHandler with debug mode:

```typescript
const errorHandler = ErrorHandler.create({
  debugMode: true,
  verboseLogging: true,
});
```

### How do I handle missing properties gracefully?

Enable recovery mode and configure default values:

```typescript
const errorHandler = ErrorHandler.create({
  enableRecovery: true,
  continueOnError: true,
});
```

### How do I validate my schema before processing?

Use the DirectiveValidator:

```typescript
const validator = DirectiveValidator.create();
const result = validator.validateSchema(mySchema);

if (!result.data.isValid) {
  console.error("Schema validation errors:", result.data.errors);
}
```

### How do I debug extraction operations?

Enable verbose logging and data dumps:

```typescript
const debugLogger = DebugLogger.create({
  level: "verbose",
  enableDataDumps: true,
  outputFormat: "json",
});
```

### How do I prevent circular dependencies?

1. Review schema design for circular references
2. Use DirectiveValidator to detect issues
3. Restructure dependencies to be acyclic
4. Use intermediate properties to break cycles

### How do I optimize performance for large datasets?

1. Limit debug logging in production
2. Reduce data dump sizes
3. Optimize schema structure
4. Monitor operation statistics
5. Use performance profiling

### How do I handle partial processing results?

Enable partial result recovery:

```typescript
const errorHandler = ErrorHandler.create({
  enableRecovery: true,
  continueOnError: true,
});

// Partial results will be available in error handling result
const result = await errorHandler.handleExtractionOperation(operation, "myOp");
if (!result.success && result.data) {
  console.log("Using partial result:", result.data);
}
```

## Support

For additional support:

1. Check the error messages for specific guidance
2. Enable debug mode for detailed operation logging
3. Review the schema validation results
4. Consult the source code documentation
5. Create an issue with debug output for complex problems
