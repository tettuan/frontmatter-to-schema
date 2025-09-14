# Test Debugging Strategy with breakdownlogger

## Overview

This document outlines the comprehensive test debugging strategy using
`@tettuan/breakdownlogger` for enhanced test analysis and debugging capabilities
in the Frontmatter to Schema project.

## Debug Logging Integration

### breakdownlogger Package

- **Package**: `@tettuan/breakdownlogger`
- **Purpose**: Structured debug logging and test execution analysis
- **Integration**: JSR dependency with environment-based activation
- **Target**: Test debugging, performance analysis, and execution tracing

### Core Features

1. **Structured Logging**: Hierarchical log output with context preservation
2. **Performance Tracking**: Execution time measurement and bottleneck
   identification
3. **Test Flow Analysis**: Step-by-step test execution breakdown
4. **Error Context**: Enhanced error reporting with execution state
5. **Coverage Integration**: Test coverage analysis with debug context

## Implementation Strategy

### 1. Environment Configuration

```bash
# Enable debug logging for all tests
export DEBUG_LEVEL=debug

# Enable specific debug categories
export DEBUG_CATEGORIES=test,domain,integration

# Save debug output to file
export DEBUG_OUTPUT=tmp/test-debug.log
```

### 2. Test Integration Points

#### Domain Tests

- **Focus**: Business logic validation and rule enforcement
- **Debug Level**: High detail for domain service interactions
- **Tracking**: Entity state changes, validation flows, business rule evaluation

#### Integration Tests

- **Focus**: Component interaction and data flow
- **Debug Level**: Medium detail for service orchestration
- **Tracking**: Cross-boundary communication, adapter interactions, pipeline
  stages

#### E2E Tests

- **Focus**: Complete workflow validation
- **Debug Level**: Low detail for high-level flow
- **Tracking**: CLI command execution, file system operations, output validation

### 3. Debug Categories

| Category      | Purpose                | Level | Use Cases                                         |
| ------------- | ---------------------- | ----- | ------------------------------------------------- |
| `test`        | Test execution flow    | INFO  | Test start/end, assertions, setup/teardown        |
| `domain`      | Domain logic debugging | DEBUG | Entity operations, business rules, validation     |
| `integration` | Component interactions | DEBUG | Service calls, data transformation, pipeline flow |
| `performance` | Execution timing       | TRACE | Performance bottlenecks, slow operations          |
| `error`       | Error analysis         | ERROR | Exception context, failure analysis, stack traces |

## Usage Guidelines

### 1. Basic Debug Test Execution

```bash
# Run all tests with debug output
deno test --allow-all --env=DEBUG_LEVEL=debug

# Run specific test category with debug
deno test tests/domain/ --allow-all --env=DEBUG_CATEGORIES=domain,test

# Run with performance tracking
deno test --allow-all --env=DEBUG_LEVEL=trace --env=DEBUG_CATEGORIES=performance
```

### 2. Advanced Debugging Scenarios

#### Debugging Failed Tests

```bash
# Enhanced error context for failed tests
deno test tests/integration/failing_test.ts --allow-all --env=DEBUG_LEVEL=error --env=DEBUG_OUTPUT=tmp/failure-analysis.log
```

#### Performance Analysis

```bash
# Identify slow tests and bottlenecks
deno test --allow-all --env=DEBUG_CATEGORIES=performance,test --env=DEBUG_OUTPUT=tmp/performance.log
```

#### Domain Logic Tracing

```bash
# Trace business logic execution
deno test tests/domain/ --allow-all --env=DEBUG_CATEGORIES=domain --env=DEBUG_LEVEL=trace
```

### 3. Test Code Integration

#### Basic Logger Setup

```typescript
import { BreakdownLogger } from "@tettuan/breakdownlogger";

describe("Schema Analyzer Tests", () => {
  const logger = new BreakdownLogger("schema-analyzer-test");

  beforeEach(() => {
    logger.startSection("test-setup");
  });

  afterEach(() => {
    logger.endSection("test-setup");
  });
});
```

#### Enhanced Test Debugging

```typescript
import { BreakdownLogger, Timer } from "@tettuan/breakdownlogger";

Deno.test("should process complex schema", async () => {
  const logger = new BreakdownLogger("complex-schema-test");
  const timer = new Timer();

  logger.info("Starting complex schema processing test");
  timer.start("schema-processing");

  // Arrange
  logger.debug("Setting up test data", { schemaType: "complex" });
  const schema = createComplexSchema();

  // Act
  logger.debug("Processing schema through analyzer");
  const result = await schemaAnalyzer.process(schema);

  // Assert
  timer.end("schema-processing");
  logger.info("Schema processing completed", {
    duration: timer.getDuration("schema-processing"),
    resultType: typeof result,
  });

  assertEquals(result.isOk(), true);
});
```

## Debug Output Analysis

### 1. Log Structure

```
[2024-01-20T10:30:00Z] [DEBUG] [schema-analyzer-test] Starting complex schema processing test
[2024-01-20T10:30:00Z] [DEBUG] [schema-analyzer-test] Setting up test data | schemaType: complex
[2024-01-20T10:30:01Z] [DEBUG] [schema-analyzer-test] Processing schema through analyzer
[2024-01-20T10:30:02Z] [INFO]  [schema-analyzer-test] Schema processing completed | duration: 1.2s, resultType: object
```

### 2. Performance Metrics

- **Test Execution Time**: Individual test duration tracking
- **Component Performance**: Service and adapter execution timing
- **Memory Usage**: Memory allocation and cleanup analysis
- **I/O Operations**: File system and external service call timing

### 3. Error Analysis

- **Exception Context**: Full stack trace with execution state
- **Assertion Failures**: Enhanced assertion context with debug data
- **Setup/Teardown Issues**: Test environment preparation debugging

## Best Practices

### 1. Debug Level Guidelines

- **TRACE**: Detailed execution flow, performance metrics
- **DEBUG**: Component interactions, data transformations
- **INFO**: Test lifecycle events, major operations
- **WARN**: Potential issues, fallback scenarios
- **ERROR**: Failures, exceptions, critical issues

### 2. Performance Considerations

- **Conditional Logging**: Use environment checks to avoid performance impact
- **Async Logging**: Non-blocking log operations for high-volume tests
- **Log Rotation**: Manage debug output file sizes
- **Category Filtering**: Enable only necessary debug categories

### 3. Integration with CI/CD

- **Failure Analysis**: Automatic debug log capture on test failures
- **Performance Regression**: Track test execution time trends
- **Coverage Analysis**: Combine debug logs with coverage reports
- **Artifact Storage**: Store debug logs as CI artifacts

## Troubleshooting Guide

### Common Debugging Scenarios

#### 1. Flaky Tests

```bash
# Run test multiple times with debug output
for i in {1..10}; do
  echo "Run $i"
  deno test tests/flaky_test.ts --allow-all --env=DEBUG_LEVEL=debug --env=DEBUG_OUTPUT=tmp/flaky-run-$i.log
done
```

#### 2. Memory Leaks

```bash
# Monitor memory usage during test execution
deno test --allow-all --env=DEBUG_CATEGORIES=performance,memory --env=DEBUG_LEVEL=trace
```

#### 3. Slow Tests

```bash
# Identify performance bottlenecks
deno test --allow-all --env=DEBUG_CATEGORIES=performance --env=DEBUG_THRESHOLD=1000ms
```

### Debug Output Locations

- **Console Output**: Real-time debugging during development
- **File Output**: `tmp/test-debug.log` for detailed analysis
- **Structured Logs**: JSON format for automated analysis
- **CI Artifacts**: Debug logs stored as pipeline artifacts

## Related Documentation

- [Testing Guidelines](./testing_guidelines.md): TDD practices and
  implementation
- [Test Coverage Strategy](../testing/comprehensive-test-strategy.md): Coverage
  analysis approach
- [AI Complexity Control](../development/ai-complexity-control.md): Complexity
  management in tests
- [Totality Principles](../development/totality.md): Complete test coverage
  requirements

---

This strategy ensures comprehensive test debugging capabilities while
maintaining performance and clarity in the test execution process.
