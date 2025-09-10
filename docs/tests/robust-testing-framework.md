# Robust Testing Framework

This document describes the enhanced robust testing framework that provides infrastructure for writing maintainable, parallel-safe, and change-resistant tests following DDD principles and Totality patterns.

## Framework Overview

The robust testing framework introduces several key improvements over traditional testing approaches:

### Core Principles

1. **Parallel Execution Safety**: Tests run independently with complete isolation
2. **Environment Independence**: Tests work consistently across different environments
3. **Minimal Test Maximum Coverage**: Fewer, more comprehensive tests that resist changes
4. **Domain-Focused Testing**: Tests validate business logic rather than implementation details
5. **Totality Compliance**: All test utilities follow Result<T,E> patterns

### Architecture Components

#### 1. Robust Test Framework (`tests/helpers/robust-test-framework.ts`)

Provides foundational utilities for safe, isolated testing:

```typescript
// Isolated environment management
await withIsolatedEnvironment(async (env) => {
  // Test runs in complete isolation
  const tempFile = await EnvironmentIsolation.createTempFile(env, "test content");
  // Automatic cleanup after test completion
});

// Result assertion helpers (Totality-focused)
ResultAssert.assertSuccess(result); // Type-safe success assertion
ResultAssert.assertFailure(result, "ExpectedErrorKind"); // Type-safe error assertion
ResultAssert.assertErrorMessage(result, /expected pattern/); // Error message validation

// Domain test helpers for Smart Constructors
await DomainTestHelpers.testSmartConstructor(
  t,
  "DocumentPath",
  DocumentPath.create,
  validInput,
  invalidInputs
);

// Performance testing utilities
await PerformanceTestUtils.measureExecutionTime(
  operation,
  maxTimeMs,
  "operation description"
);
```

#### 2. Minimal Coverage Strategy (`tests/helpers/minimal-coverage-strategy.ts`)

Implements patterns for comprehensive testing with fewer test cases:

```typescript
// Core behavior testing - replaces multiple granular tests
const coreBehaviors: CoreBehaviorTest<DocumentPath, DomainError>[] = [
  {
    description: "creates valid file path with proper extension",
    execute: () => DocumentPath.create("/valid/path/file.md"),
    expectations: [
      CommonExpectations.success((data) => {
        assertEquals(data.getValue(), "/valid/path/file.md");
      }),
    ],
  },
];

await CoreLogicTester.testBehaviorGroup(t, "DocumentPath Behaviors", coreBehaviors);

// Domain invariant testing
await InvariantTester.testDomainInvariant(
  t,
  "DocumentPath immutability",
  scenarios
);

// Consolidated error path testing
await ErrorPathTester.testErrorPaths(
  t,
  "DocumentPath.create",
  errorScenarios
);

// End-to-end workflow testing
await WorkflowTester.testWorkflow(t, "Document Processing Workflow", {
  setup: () => createTestData(),
  execute: (input) => processDocument(input),
  validate: (output) => verifyResults(output),
});
```

#### 3. Parallel Safety Guard (`tests/helpers/parallel-safety-guard.ts`)

Ensures complete test isolation and parallel execution safety:

```typescript
// High-level parallel-safe test execution
await ParallelSafeTestRunner.runIsolatedTest(
  "test name",
  async (ctx) => {
    // Test runs with guaranteed isolation
    const tempDir = EnvironmentIsolation.createTempDir(ctx);
    // Automatic resource cleanup
  },
  {
    maxExecutionTimeMs: 1000,
    maxMemoryDeltaMB: 50,
    environmentVariables: { TEST_ENV: "isolated" }
  }
);

// Parallel test execution with conflict detection
await ParallelSafeTestRunner.runParallelTests([
  { name: "test1", test: test1Function },
  { name: "test2", test: test2Function },
]);
```

## Usage Patterns

### 1. Smart Constructor Testing

Replace multiple individual validation tests with comprehensive behavior testing:

```typescript
// OLD: Multiple separate tests
Deno.test("should accept valid input", () => { /* ... */ });
Deno.test("should reject empty input", () => { /* ... */ });
Deno.test("should reject invalid format", () => { /* ... */ });

// NEW: Comprehensive behavior testing
Deno.test("DocumentPath - Core Business Logic", async (t) => {
  const coreBehaviors: CoreBehaviorTest<DocumentPath, DomainError>[] = [
    {
      description: "creates valid file path with proper validation",
      execute: () => DocumentPath.create("/valid/path.md"),
      expectations: [CommonExpectations.success()],
    },
    {
      description: "enforces business rules comprehensively",
      execute: () => DocumentPath.create(""),
      expectations: [CommonExpectations.failure("EmptyInput")],
    },
  ];

  await CoreLogicTester.testBehaviorGroup(t, "DocumentPath Behaviors", coreBehaviors);
});
```

### 2. Domain Invariant Testing

Test that domain rules always hold across different scenarios:

```typescript
await InvariantTester.testDomainInvariant(
  t,
  "Value object immutability",
  [
    {
      description: "created with valid data",
      setup: () => createValueObject(),
      invariantCheck: (obj) => verifyImmutability(obj),
    },
    {
      description: "after method calls",
      setup: () => {
        const obj = createValueObject();
        obj.someMethod(); // Should not mutate
        return obj;
      },
      invariantCheck: (obj) => verifyImmutability(obj),
    },
  ]
);
```

### 3. Error Path Consolidation

Group related error scenarios to reduce test duplication:

```typescript
await ErrorPathTester.testErrorPaths(
  t,
  "DocumentPath.create",
  [
    {
      scenario: "empty input",
      execute: () => DocumentPath.create(""),
      expectedErrorKind: "EmptyInput",
    },
    {
      scenario: "invalid characters",
      execute: () => DocumentPath.create("/path/with\0null"),
      expectedErrorKind: "InvalidFormat",
      errorValidation: (error) => {
        assertEquals(error.expectedFormat, "path without null bytes");
      },
    },
  ]
);
```

### 4. Integration Workflow Testing

Test complete business workflows with minimal setup:

```typescript
await WorkflowTester.testWorkflow(
  t,
  "Document Processing Pipeline",
  {
    setup: async () => {
      const tempDir = await createTempDirectory();
      const testFile = await createTestDocument(tempDir);
      return { tempDir, testFile };
    },
    execute: async ({ testFile }) => {
      const processor = new DocumentProcessor();
      return await processor.process(testFile);
    },
    validate: (result) => {
      ResultAssert.assertSuccess(result);
      assertEquals(result.data.processedCount, 1);
    },
    cleanup: async () => {
      await cleanupTempFiles();
    },
  }
);
```

## Benefits

### 1. Parallel Execution Safety
- Complete test isolation prevents race conditions
- Resource management eliminates conflicts
- Environment variables are properly scoped
- Automatic cleanup prevents test pollution

### 2. Change Resistance  
- Tests focus on business behavior, not implementation
- Fewer tests means less maintenance overhead
- Domain-focused assertions remain stable during refactoring
- Invariant testing catches regression across scenarios

### 3. Enhanced Debugging
- Comprehensive error context and validation
- Performance monitoring built into test execution
- Clear failure messages with expected vs actual values
- Resource usage tracking for optimization

### 4. DDD Alignment
- Tests validate domain rules and business logic
- Smart Constructor testing patterns
- Value object immutability verification
- Aggregate boundary testing support

## Migration Guide

### From Traditional Tests

1. **Replace individual validation tests** with `CoreBehaviorTest` patterns
2. **Consolidate error scenarios** using `ErrorPathTester`
3. **Add domain invariant tests** for business rules
4. **Wrap existing tests** with `ParallelTestSafety.isolatedTest`

### Best Practices

1. **Start with core behavior testing** - focus on essential business logic
2. **Use domain invariants** to validate business rules across scenarios  
3. **Consolidate error paths** rather than testing each error individually
4. **Test workflows end-to-end** instead of mocking everything
5. **Measure performance** for critical operations
6. **Always use isolated environments** for file system tests

## Integration with Existing Tests

The robust testing framework is designed to work alongside existing tests:

- **Gradual adoption**: Introduce robust patterns for new tests
- **Backward compatibility**: Existing tests continue to work unchanged
- **Performance improvement**: Parallel execution reduces total test time
- **Quality enhancement**: Better error detection and reporting

## Performance Characteristics

Based on initial testing:

- **17 test steps executed in 13ms** (robust framework example)
- **Automatic resource cleanup** prevents memory leaks
- **Parallel execution capability** scales with available cores
- **Environment isolation overhead** < 1ms per test

---

This robust testing framework enables writing fewer, more effective tests that provide comprehensive coverage while being resistant to changes in implementation details. The focus on business logic validation and domain invariants ensures tests remain valuable as the codebase evolves.