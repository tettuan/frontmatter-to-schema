# Test Debugging Strategy

## Overview

This document defines the test debugging strategy using
`@tettuan/breakdownlogger` for strategic test analysis, comparison testing, and
debugging. The logger provides structured debugging with `LOG_KEY` filtering and
`LOG_LENGTH` control.

## Document Relationships

- **[Test Overview](./README.md)**: High-level testing philosophy and
  architecture
- **[Test Execution Guide](./test-execution.ja.md)**: Practical execution guide
  (Japanese)
- **This Document**: Debugging strategy and BreakdownLogger integration

## Environment Variables

### LOG_KEY (Component Filtering)

Filter debug output by specific test components:

```bash
# Single component
LOG_KEY=base-property-population deno test

# Multiple components (comma/colon/slash separated)
LOG_KEY=base-property-population,schema-validation deno test
LOG_KEY=processing:template-rendering deno test
LOG_KEY=frontmatter/aggregation deno test
```

### LOG_LENGTH (Message Length Control)

Control output verbosity:

```bash
# Short format (160 chars, default)
LOG_LENGTH=S deno test

# Long format (300 chars)
LOG_LENGTH=L deno test

# Whole message (complete output)
LOG_LENGTH=W deno test
```

### LOG_LEVEL (Severity Filtering)

Set minimum log level:

```bash
# Debug (all messages)
LOG_LEVEL=debug deno test

# Info (default)
LOG_LEVEL=info deno test

# Warn (warnings and errors only)
LOG_LEVEL=warn deno test

# Error (errors only)
LOG_LEVEL=error deno test
```

## Test Component Keys

The following logger keys are strategically used across the test suite:

### Integration Tests

- `base-property-population`: Base property population logic
- `base-property-override`: Frontmatter override behavior
- `pipeline-orchestrator`: Complete processing pipeline

### Unit Tests

- `schema-validation`: Schema validation logic
- `template-rendering`: Template processing
- `frontmatter-parsing`: Frontmatter extraction
- `aggregation-rules`: Data aggregation logic

### E2E Tests

- `cli-basic`: Basic CLI functionality
- `cli-validation`: CLI argument validation
- `end-to-end-flow`: Complete workflow testing

## Usage Examples

### Debugging Specific Test Failures

```bash
# Focus on base property issues
LOG_KEY=base-property-population LOG_LENGTH=L deno test tests/integration/base-property-integration_test.ts

# Debug schema validation problems
LOG_KEY=schema-validation LOG_LENGTH=W deno test tests/unit/domain/schema/

# Trace complete pipeline execution
LOG_KEY=pipeline-orchestrator LOG_LEVEL=debug deno test tests/integration/pipeline/
```

### Using the Debug Script

```bash
# Run specific component tests with debug
./scripts/test-with-debug.sh base-property-population

# Multiple components with long format
LOG_LENGTH=L ./scripts/test-with-debug.sh "base-property-population,schema-validation"

# All tests with complete output
LOG_LENGTH=W ./scripts/test-with-debug.sh all
```

### CI/CD Integration

```bash
# In CI pipeline - minimal debug output
LOG_LEVEL=error LOG_LENGTH=S deno test --allow-all

# For debugging CI failures - focused output
LOG_KEY=failing-component LOG_LEVEL=debug LOG_LENGTH=L deno test --allow-all
```

## Strategic Testing Patterns

### Comparison Testing Strategy

BreakdownLogger enables **Comparison Testing** - a strategic approach to
validate processing effectiveness by comparing results with and without specific
operations.

#### Purpose of Comparison Testing

1. **Quantitative Validation**: Measure the actual impact of processing
   operations
2. **Process Effectiveness**: Verify that filters, transformations, and
   optimizations work correctly
3. **Behavioral Verification**: Ensure consistent behavior across different
   execution paths
4. **Runtime Process Evaluation**: Detailed tracking of execution flow for
   analysis

#### Implementation Pattern

```typescript
import { BreakdownLogger } from "@tettuan/breakdownlogger";
import { assertEquals } from "@std/assert";

Deno.test("Comparison Test: Filter Processing Effectiveness", async () => {
  const logger = new BreakdownLogger("comparison-test");

  // Test data with filterable items
  const testData = [
    { id: 1, active: true, name: "Alice" },
    { id: 2, active: false, name: "Bob" }, // Should be filtered
    { id: 3, active: true, name: "Charlie" },
  ];

  // Log initial state
  logger.debug("Pre-filter state", { count: testData.length });

  // Process WITHOUT filtering
  const withoutFilter = testData;

  // Process WITH filtering
  logger.debug("Starting filter process");
  const withFilter = testData.filter((item) => {
    const keep = item.active;
    logger.trace("Filter decision", {
      id: item.id,
      active: item.active,
      decision: keep ? "keep" : "remove",
    });
    return keep;
  });

  // Compare results
  logger.info("Comparison results", {
    original: withoutFilter.length,
    filtered: withFilter.length,
    removed: withoutFilter.length - withFilter.length,
    effectiveness: `${
      ((withoutFilter.length - withFilter.length) / withoutFilter.length * 100)
        .toFixed(1)
    }%`,
  });

  // Assertions
  assertEquals(withFilter.length, 2);
  assertEquals(withFilter.every((item) => item.active), true);
});
```

#### Application Scenarios

1. **Filtering Operations**: Validate data reduction effectiveness
2. **Transformation Processing**: Verify format conversion accuracy
3. **Optimization Processing**: Measure performance improvements
4. **Cache Processing**: Ensure consistency with/without caching
5. **Conditional Branching**: Compare different execution path results

### 1. Data Structure Analysis

```typescript
const logger = new BreakdownLogger("component-name");

// Log object structure and size
logger.debug("Schema content structure", schemaObject);
logger.debug("Processing result", {
  success: result.success,
  dataKeys: Object.keys(result.data),
  errorType: result.error?.kind,
});
```

### 2. Flow Tracing

```typescript
logger.info("Executing processing pipeline", {
  schema: paths.schema,
  pattern: inputPattern,
  step: "processing",
});

logger.debug("Processing completed", {
  duration: Date.now() - startTime,
  outputSize: Object.keys(output).length,
});
```

### 3. Error Context

```typescript
logger.error("Operation failed", {
  error: error.message,
  context: {
    component: "schema-validator",
    input: inputData,
    expectedType: "object",
  },
});
```

## Performance Considerations

- **Test-only execution**: BreakdownLogger only works in test files (*_test.ts)
- **Environment filtering**: Use LOG_KEY to reduce noise in large test suites
- **Length control**: Use LOG_LENGTH=S in CI to minimize output volume
- **Level filtering**: Use LOG_LEVEL=error in production-like environments

## Best Practices

### 1. Component-based Keys

Choose descriptive, component-focused logger keys:

```typescript
// Good
new BreakdownLogger("schema-path-resolver");
new BreakdownLogger("frontmatter-aggregator");

// Avoid
new BreakdownLogger("test1");
new BreakdownLogger("debug");
```

### 2. Structured Logging

Provide meaningful context objects:

```typescript
// Good
logger.debug("Validation failed", {
  schemaPath: path.toString(),
  errorCount: errors.length,
  firstError: errors[0]?.message,
});

// Avoid
logger.debug("Validation failed: " + JSON.stringify(errors));
```

### 3. Level Appropriateness

Use appropriate log levels:

- `debug`: Internal state, detailed flow
- `info`: Major operations, test phases
- `warn`: Potential issues, fallbacks
- `error`: Failures, exceptions

## Integration with Existing Tests

The logger is integrated into key test files:

- `tests/integration/base-property-integration_test.ts`: Base property debugging
- `tests/integration/pipeline/pipeline-orchestrator_test.ts`: Pipeline flow
  tracing
- Additional integration planned for failing tests

## Troubleshooting

### Common Issues

1. **No debug output**: Check LOG_LEVEL setting
2. **Too much output**: Use LOG_KEY filtering
3. **Truncated messages**: Increase LOG_LENGTH
4. **Missing test context**: Ensure logger key matches test focus

### Debug Commands

```bash
# Check if breakdownlogger is working
LOG_LEVEL=debug LOG_KEY=test deno test --allow-all --filter="should show basic functionality"

# Verify environment variables
deno run --allow-env -e "console.log('LOG_LEVEL:', Deno.env.get('LOG_LEVEL'))"

# Test specific integration
LOG_KEY=base-property-population LOG_LENGTH=W deno test tests/integration/base-property-integration_test.ts
```

This integration provides powerful, focused debugging capabilities for
identifying and resolving test failures systematically.
