# Test Suite Overview

This directory contains the comprehensive test suite for the Frontmatter to
Schema project, following DDD, TDD, and Totality principles.

## Directory Structure

```
tests/
├── unit/           # Unit tests for individual components
├── integration/    # Integration tests for component interactions
├── e2e/           # End-to-end CLI workflow tests
├── helpers/       # Test utilities and shared helpers
└── debug/         # Debug utilities and diagnostic tools
```

## Test Categories

### Unit Tests (`tests/unit/`)

- **Domain Logic**: Core business rules and entity behavior
- **Value Objects**: Validation and immutability tests
- **Services**: Individual service component testing
- **Utilities**: Helper functions and utilities

### Integration Tests (`tests/integration/`)

- **Component Interactions**: Cross-boundary communication
- **Data Flow**: Complete processing pipeline validation
- **Service Orchestration**: Multi-service coordination
- **File I/O Integration**: Real file system operations

### End-to-End Tests (`tests/e2e/`)

- **CLI Workflows**: Complete command-line interface testing
- **User Scenarios**: Real-world usage patterns
- **Error Handling**: Complete error flow validation
- **Output Validation**: Final result verification

## BreakdownLogger Debug Strategy

### Quick Start

```bash
# Debug specific component
LOG_KEY=base-property-population LOG_LENGTH=L deno test --allow-all

# Use convenience script
./scripts/test-with-debug.sh component-name

# Multiple components
LOG_KEY=schema-validation,template-rendering deno test --allow-all
```

### Environment Variables

#### LOG_KEY - Component Filtering

Target specific test components for focused debugging:

```bash
# Integration test components
LOG_KEY=base-property-population      # Base property logic
LOG_KEY=base-property-override        # Frontmatter override behavior
LOG_KEY=pipeline-orchestrator         # Complete processing pipeline

# Unit test components
LOG_KEY=schema-validation             # Schema validation logic
LOG_KEY=template-rendering            # Template processing
LOG_KEY=frontmatter-parsing           # Frontmatter extraction
LOG_KEY=aggregation-rules             # Data aggregation logic

# E2E test components
LOG_KEY=cli-basic                     # Basic CLI functionality
LOG_KEY=cli-validation                # CLI argument validation
LOG_KEY=end-to-end-flow               # Complete workflow testing
```

#### LOG_LENGTH - Output Control

Control the verbosity of debug output:

```bash
LOG_LENGTH=S    # Short (160 chars, default)
LOG_LENGTH=L    # Long (300 chars)
LOG_LENGTH=W    # Whole (complete output)
```

#### LOG_LEVEL - Severity Filtering

Set minimum log level:

```bash
LOG_LEVEL=debug    # Show all messages (default for debugging)
LOG_LEVEL=info     # Show info, warn, error
LOG_LEVEL=warn     # Show warn, error only
LOG_LEVEL=error    # Show errors only
```

### Strategic Debug Patterns

#### 1. Test Flow Analysis

```bash
# Trace complete test execution
LOG_KEY=pipeline-orchestrator LOG_LEVEL=debug LOG_LENGTH=L deno test tests/integration/pipeline/

# Focus on specific failure
LOG_KEY=base-property-population LOG_LENGTH=W deno test tests/integration/base-property-integration_test.ts
```

#### 2. Data Structure Investigation

```bash
# Schema processing debugging
LOG_KEY=schema-validation LOG_LENGTH=L deno test tests/unit/domain/schema/

# Template rendering analysis
LOG_KEY=template-rendering LOG_LEVEL=debug deno test tests/unit/domain/template/
```

#### 3. Error Context Analysis

```bash
# Failed test investigation with full context
LOG_KEY=failing-component LOG_LENGTH=W LOG_LEVEL=debug deno test specific-test-file.ts

# CI failure debugging
LOG_KEY=component-name LOG_LEVEL=error deno test --allow-all
```

## Test Execution

### Local Development

```bash
# Standard test execution
deno test --allow-all

# With coverage
deno test --allow-all --coverage=tmp/coverage

# Specific test category
deno test tests/unit/ --allow-all
deno test tests/integration/ --allow-all
deno test tests/e2e/ --allow-all

# Debug-enabled execution
LOG_KEY=component-name ./scripts/test-with-debug.sh
```

### CI/CD Integration

```bash
# Minimal debug output for CI
LOG_LEVEL=error LOG_LENGTH=S deno test --allow-all

# Focused CI debugging
LOG_KEY=failing-component LOG_LEVEL=debug deno test --allow-all
```

## Test Helper Utilities

### Integration Test Environment

Located in `tests/helpers/integration-test-helper.ts`:

- Isolated test environments
- Automatic cleanup
- Test file management
- Mock data generators

### Debug Logger Integration

```typescript
import { BreakdownLogger } from "@tettuan/breakdownlogger";

const logger = new BreakdownLogger("component-name");
logger.debug("Test step", { data: someObject });
logger.info("Major operation", { status: "completed" });
logger.error("Test failure", { error: errorObject });
```

## Test File Naming Convention

- **Unit tests**: `*_test.ts`
- **Integration tests**: `*_test.ts`
- **E2E tests**: `*_test.ts`
- **Helper utilities**: `*-helper.ts`
- **Debug utilities**: `*-diagnostic.ts`

## Coverage Requirements

- **Minimum**: 80% line coverage
- **Target**: 80.1%+ maintained
- **Focus**: Domain logic and business rules
- **Coverage output**: Saved to `tmp/coverage/` directory

## Quality Standards

### Test Principles

- **DDD Alignment**: Tests validate domain concepts
- **TDD Practice**: Red-Green-Refactor cycle
- **Totality**: All code paths covered
- **AI Complexity Control**: Maintainable, readable tests

### Error Handling

- All Result types properly tested
- Error conditions explicitly verified
- Edge cases covered
- Failure scenarios documented

### Performance

- Tests complete in <5 seconds
- No flaky tests allowed
- Parallel execution safe
- Resource cleanup guaranteed

## Troubleshooting

### Common Debug Scenarios

#### Test Failures

```bash
# Specific test debugging
LOG_KEY=failing-test-component LOG_LENGTH=W deno test failing-test.ts

# Multiple failure investigation
LOG_KEY=component1,component2 LOG_LEVEL=debug deno test
```

#### Integration Issues

```bash
# Cross-component communication
LOG_KEY=pipeline-orchestrator LOG_LENGTH=L deno test tests/integration/

# Data flow investigation
LOG_KEY=frontmatter-parsing,template-rendering deno test
```

#### Performance Issues

```bash
# Execution timing analysis
LOG_LEVEL=debug deno test --allow-all

# Memory usage investigation
LOG_KEY=memory-intensive-component deno test
```

### Debug Output Analysis

The breakdownlogger provides structured JSON output for:

- **Test execution flow**: Step-by-step progression
- **Data structures**: Object inspection and validation
- **Error contexts**: Detailed failure information
- **Performance metrics**: Execution timing and resource usage

## Related Documentation

- [Test Overview](../docs/tests/README.md): Comprehensive testing strategy
- [BreakdownLogger Integration](../docs/tests/breakdownlogger-integration.md):
  Detailed debug strategy
- [Testing Guidelines](../docs/tests/testing_guidelines.md): TDD practices
- [Test Debugging Strategy](../docs/tests/test-debugging-strategy.md): Advanced
  debugging techniques

## Quick Reference

### Most Common Debug Commands

```bash
# Basic component debug
LOG_KEY=component-name deno test

# Detailed output
LOG_KEY=component-name LOG_LENGTH=L deno test

# Complete information
LOG_KEY=component-name LOG_LENGTH=W LOG_LEVEL=debug deno test

# Convenience script
./scripts/test-with-debug.sh component-name
```

### Test Execution Shortcuts

```bash
# Quick test run
deno test --allow-all

# With debug
LOG_KEY=failing-component deno test --allow-all

# Coverage
deno test --allow-all --coverage=tmp/coverage
```

This test suite provides comprehensive coverage while maintaining clear
debugging capabilities through strategic breakdownlogger integration.
