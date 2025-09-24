# Testing Overview

This document provides a comprehensive overview of the testing strategy and
approach for the Frontmatter to Schema project.

## Testing Philosophy

This project follows **Test-Driven Development (TDD)** principles with a focus
on:

- **Specification-Driven Testing**: Tests reflect business requirements and
  specifications
- **Domain-Driven Design**: Tests validate domain logic and business rules
- **Totality Principles**: Tests ensure complete coverage of all code paths
- **AI Complexity Control**: Tests maintain low entropy and high maintainability

## Testing Architecture

### Test Strategy Layers

1. **Unit Tests**: Individual component validation
2. **Integration Tests**: Cross-component interaction verification
3. **Comparison Tests**: Process effectiveness evaluation using BreakdownLogger

### Test Structure

```
tests/
├── 0_core_domain/      # Core domain tests
├── 1_supporting_domain/ # Supporting domain tests
├── 2_generic_domain/   # Technical foundation tests
├── 3_interface_layer/  # Interface layer tests
├── 4_cross_domain/     # Cross-domain integration tests
│   ├── collaboration/  # Inter-domain collaboration tests
│   └── e2e/           # End-to-end system tests
└── fixtures/          # Test data and fixtures
```

### Test File Naming Convention

- Use `*_test.ts` filename pattern for all test files
- Follow TypeScript and Deno standard naming conventions
- Group tests by domain or component functionality

## Test Categories

### 1. Domain Tests

- **Purpose**: Validate business logic and domain rules
- **Location**: `tests/domain/`
- **Focus**: Entity behavior, value object validation, domain services
- **Example**: `schema_analyzer_test.ts`, `template_mapper_test.ts`

### 2. Integration Tests

- **Purpose**: Test component interactions and system integration
- **Location**: `tests/integration/`
- **Focus**: Service orchestration, data flow, external dependencies
- **Example**: `document_processor_test.ts`, `pipeline_integration_test.ts`

### 3. End-to-End Tests

- **Purpose**: Test complete CLI workflows and user scenarios
- **Location**: `tests/e2e/`
- **Focus**: Full pipeline validation, CLI argument processing, file operations
- **Example**: `cli_basic_test.ts`, `cli_validation_test.ts`

### 4. Infrastructure Tests

- **Purpose**: Test adapters and external system interfaces
- **Location**: `tests/infrastructure/`
- **Focus**: File system operations, external API calls, configuration
- **Example**: `file_system_adapter_test.ts`, `ai_analyzer_adapter_test.ts`

## BreakdownLogger Debug Integration

### Strategic Test Debugging

The test suite integrates `@tettuan/breakdownlogger` for enhanced debugging
capabilities:

#### Environment-Based Configuration

- **LOG_KEY**: Filter debug output by component (`base-property-population`,
  `schema-validation`)
- **LOG_LENGTH**: Control output verbosity (`S`=160 chars, `L`=300 chars,
  `W`=whole message)
- **LOG_LEVEL**: Set severity threshold (`debug`, `info`, `warn`, `error`)

#### Quick Debug Commands

```bash
# Component-specific debugging
LOG_KEY=base-property-population LOG_LENGTH=L deno test --allow-all

# Multiple component analysis
LOG_KEY=schema-validation,template-rendering deno test --allow-all

# Convenience script
./scripts/test-with-debug.sh component-name
```

For detailed debugging strategies, see
[BreakdownLogger Integration](./breakdownlogger-integration.md).

## Test Guidelines

### Core Principles

1. **Red-Green-Refactor**: Follow TDD cycle strictly
2. **One Assertion Per Test**: Each test validates one specific behavior
3. **Descriptive Test Names**: Test names should describe the expected behavior
4. **Arrange-Act-Assert**: Structure tests clearly with setup, execution, and
   validation

### Test Coverage Requirements

- **Minimum Coverage**: 80% line coverage
- **Critical Path Coverage**: 100% for domain logic
- **Error Path Coverage**: All error conditions must be tested
- **Edge Case Coverage**: Boundary conditions and edge cases

### Mock and Stub Strategy

- **External Dependencies**: Always mock external services (AI, file system)
- **Domain Services**: Use real implementations when testing domain logic
- **Infrastructure**: Mock infrastructure adapters in domain tests
- **Test Doubles**: Use TypeScript interfaces for easy mocking

## Running Tests

For detailed execution instructions, see [Testing Execution Guide (Japanese)](./testing.ja.md).

### Quick Start

```bash
# Run all tests
deno test --allow-all

# Run with coverage
deno task test:coverage

# Run CI pipeline
deno task ci

# Debug specific component
LOG_KEY=component-name LOG_LENGTH=L deno test --allow-all
```

### CI/CD Pipeline

Tests are automatically executed as part of the CI pipeline:

1. Type checking
2. JSR compatibility check
3. Test execution (277 tests currently)
4. Linting
5. Formatting validation

## Test Data Management

### Fixtures

- **Location**: `tests/fixtures/`
- **Purpose**: Reusable test data and sample files
- **Format**: JSON, YAML, and Markdown files for various test scenarios

### Test Doubles

- **Mock Objects**: For external dependencies and complex services
- **Stub Objects**: For simple return value scenarios
- **Fake Objects**: For lightweight in-memory implementations

## Quality Metrics

### Current Test Statistics

- **Total Tests**: 124 tests (40 steps)
- **Test Files**: 16 active test files
- **Coverage Target**: >80% line coverage
- **Performance**: Tests complete in <1.2s
- **E2E Tests**: 2 test suites with 11 test steps

### Success Criteria

- ✅ All tests pass consistently
- ✅ Fast execution time (<5 seconds)
- ✅ Clear test failure messages
- ✅ No flaky tests
- ✅ High code coverage

## Related Documentation

### Core Test Documentation

- **[Test Execution Guide](./test-execution.ja.md)** - Practical execution guide with DDD-based structure (Japanese)
- **[Test Debugging Strategy](./test-debugging.md)** - BreakdownLogger integration and comparison testing
- **[Testing Guidelines](./testing_guidelines.md)** - Detailed TDD practices and implementation guide

### Additional Resources

- [E2E Test Execution Guide](../../tmp/e2e-test-execution-guide.md) - Comprehensive E2E testing strategy
- [E2E Test Architecture](../../tests/e2e/README.md) - End-to-end test design principles
- [Robust Testing Framework](./robust-testing-framework.md) - Enhanced testing infrastructure

## Best Practices

### Test Writing

1. **Start with failing test** (Red phase)
2. **Write minimal code to pass** (Green phase)
3. **Refactor with confidence** (Refactor phase)
4. **Test behavior, not implementation**
5. **Keep tests simple and focused**

### Test Maintenance

1. **Update tests when requirements change**
2. **Remove obsolete tests promptly**
3. **Refactor tests alongside production code**
4. **Review test coverage regularly**
5. **Address flaky tests immediately**

---

For detailed testing guidelines and TDD practices, see
[Testing Guidelines](./testing_guidelines.md).
