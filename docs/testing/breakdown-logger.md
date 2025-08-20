# BreakdownLogger - Strategic Test Debugging Utility

## Overview

BreakdownLogger is a structured logging utility designed specifically for test debugging in the frontmatter-to-schema project. It follows Domain-Driven Design (DDD) principles and provides comprehensive test execution analysis with minimal performance impact when disabled.

## Key Features

- **Environment-controlled activation**: Only enabled when `BREAKDOWN_LOG=true`
- **Structured logging**: Follows AAA (Arrange-Act-Assert) pattern
- **Performance monitoring**: Built-in timing capabilities
- **Result type integration**: Native support for logging Result types
- **Test scoping**: Create isolated loggers for individual tests
- **Zero overhead when disabled**: No performance impact in normal test runs

## Usage

### Basic Setup

```typescript
import { getBreakdownLogger } from "../helpers/breakdown-logger.ts";

// Get the singleton logger instance
const logger = getBreakdownLogger();

// Create a scoped logger for a specific test
const testLogger = logger.createTestScope("MyTestName", "domain");
```

### Running Tests with BreakdownLogger

```bash
# Run tests with BreakdownLogger disabled (default)
deno task test

# Run tests with BreakdownLogger enabled
BREAKDOWN_LOG=true deno test --allow-env

# Run specific test with logging
BREAKDOWN_LOG=true deno test test/integration/analysis-pipeline.test.ts --allow-env
```

## Integration Points

### 1. Test Utilities Integration

The BreakdownLogger is integrated into the test utilities to provide automatic logging:

- **ResultAssertions**: Automatically logs Result type assertions
- **PerformanceTestUtils**: Logs performance measurements
- **TestWithBreakdown**: Provides structured test execution with automatic phase logging

### 2. Test Files Using BreakdownLogger

The following test files have been enhanced with strategic BreakdownLogger integration:

- `test/integration/analysis-pipeline.test.ts` - Pipeline processing and performance tests
- `tests/domain/core/comprehensive-unit.test.ts` - Domain value object tests
- `test/helpers/test-utilities.ts` - Core test utilities with embedded logging

### 3. TestWithBreakdown Helper

A new helper class that provides structured test execution:

```typescript
const test = new TestWithBreakdown("TestName", "domain");

await test.runTest(
  // Arrange phase
  async () => {
    // Setup test data
  },
  // Act phase
  async () => {
    // Execute operation
    return result;
  },
  // Assert phase
  async (result) => {
    // Verify results
  },
  // Optional cleanup phase
  async () => {
    // Clean up resources
  }
);
```

## Log Output Format

When enabled, BreakdownLogger produces structured output:

```
[INFO] [TestName:arrange] Creating ValidFilePath { filePath: "/test/file.md" }
[INFO] [TestName:act] Starting act phase
[INFO] [TestName:act] FrontMatter extraction completed (12.34ms)
[INFO] [TestName:assert] All assertions passed
```

## Performance Considerations

- **Disabled by default**: No impact on regular test runs
- **Lazy evaluation**: Log entries are only created when enabled
- **Minimal overhead**: Efficient timing and logging mechanisms
- **Structured data**: JSON-exportable for analysis tools

## Best Practices

1. **Strategic Placement**: Add logging at critical decision points and complex operations
2. **Result Logging**: Use `logResult()` for Result type operations
3. **Performance Tracking**: Use timers for operations that might be slow
4. **Test Scoping**: Always create scoped loggers for individual tests
5. **Environment Control**: Only enable during debugging sessions

## Implementation Details

### Core Components

1. **BreakdownLogger**: Singleton logger with environment-based activation
2. **TestScopeLogger**: Scoped logger for individual tests
3. **LogContext**: Structured context for each log entry
4. **LogEntry**: Timestamped log entry with level, context, and data

### Error Handling

The logger gracefully handles environments where `Deno.env` access is not permitted, defaulting to disabled state.

## Future Enhancements

- [ ] Log aggregation and analysis tools
- [ ] Visual test execution timeline
- [ ] Integration with CI/CD reporting
- [ ] Configurable log levels per test domain
- [ ] Export to various formats (JSON, CSV, HTML)

## Conclusion

BreakdownLogger provides a powerful debugging tool for understanding test execution flow and identifying performance bottlenecks, while maintaining zero overhead in production test runs. Its strategic placement in critical test paths enables developers to quickly diagnose issues when needed.