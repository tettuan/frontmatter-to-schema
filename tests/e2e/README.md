# End-to-End (E2E) Test Architecture

## Philosophy

Following **Domain-Driven Design** and **Totality** principles:

- **Complete Workflows**: Test entire CLI workflows from command execution to
  file output
- **Real File Operations**: Use actual file system operations, not mocks
- **Isolated Environments**: Each test runs in isolated temporary directories
- **Result Type Safety**: All test operations return Result<T,E> types
- **Deterministic**: Tests produce consistent results regardless of environment

## Test Architecture

### Core E2E Test Scenarios

1. **Schema Processing Pipeline**
   - Input: Schema file + Markdown files with frontmatter
   - Output: Generated JSON/YAML files
   - Validation: Output structure matches schema expectations

2. **CLI Argument Validation**
   - Valid arguments: Success cases
   - Invalid arguments: Proper error handling
   - Help/Version commands: Correct output display

3. **File System Operations**
   - Non-existent schema files: Error handling
   - Invalid markdown files: Graceful degradation
   - Output directory creation: Automatic creation
   - Permission issues: Proper error messages

4. **Template Processing**
   - Simple templates: Variable replacement
   - Complex templates: Nested object handling
   - Array templates: Iteration and aggregation
   - Derivation rules: Data transformation

### Test Structure

```
tests/e2e/
├── README.md              # This file
├── cli_basic_test.ts       # Basic CLI functionality
├── cli_validation_test.ts  # Argument validation
├── file_operations_test.ts # File system operations
├── template_processing_test.ts # Template processing
├── schema_validation_test.ts   # Schema validation
├── helpers/
│   ├── e2e_test_helper.ts     # Common E2E utilities
│   ├── temp_dir_manager.ts    # Temporary directory management
│   └── cli_executor.ts        # CLI command execution
└── fixtures/
    ├── schemas/               # Test schema files
    ├── markdown/             # Test markdown files
    ├── templates/            # Test template files
    └── expected/             # Expected output files
```

## Test Implementation Principles

### 1. Isolation and Cleanup

```typescript
interface TestEnvironment {
  readonly tempDir: string;
  readonly cleanup: () => Promise<void>;
}
```

### 2. Result Type Safety

```typescript
type E2ETestResult<T> = Result<T, E2ETestError & { message: string }>;

type E2ETestError =
  | { kind: "CLIExecutionFailed"; exitCode: number; stderr: string }
  | { kind: "FileOperationFailed"; operation: string; path: string }
  | { kind: "OutputValidationFailed"; expected: unknown; actual: unknown }
  | { kind: "SetupFailed"; reason: string };
```

### 3. Deterministic Test Data

- Fixed input data in `fixtures/`
- Predictable output validation
- No random or time-based elements
- Consistent file ordering

## Test Categories

### Critical Path Tests (Must Pass)

- Basic CLI execution with valid inputs
- Schema validation with frontmatter data
- Output file generation and content validation

### Error Handling Tests

- Invalid command line arguments
- Missing schema files
- Malformed frontmatter
- File permission issues

### Edge Case Tests

- Empty frontmatter
- Complex nested object structures
- Large file processing
- Special characters in content

## Execution Strategy

### Local Development

```bash
# Run all E2E tests
deno test tests/e2e/ --allow-read --allow-write --allow-run --allow-env

# Run specific E2E test
deno test tests/e2e/cli_basic_test.ts --allow-read --allow-write --allow-run --allow-env
```

### CI Integration

- E2E tests run after unit and integration tests
- Separate reporting for E2E test results
- Timeout protection for long-running tests
- Parallel execution where safe

## Quality Gates

### Performance Requirements

- Individual test execution: < 5 seconds
- Full E2E suite: < 30 seconds
- No flaky tests (99.9% reliability)

### Coverage Requirements

- All CLI commands and flags tested
- All major error conditions covered
- All output formats validated
- All template processing scenarios tested

## Implementation Guidelines

### Test Naming Convention

```typescript
// Format: describe_behavior_when_condition
export const test_CLI_processes_valid_schema_when_provided_correct_arguments;
export const test_CLI_shows_help_when_help_flag_provided;
export const test_CLI_exits_with_error_when_schema_file_missing;
```

### Test Structure Pattern

```typescript
await t.step(
  "should process valid schema when provided correct arguments",
  async () => {
    // Arrange: Set up test environment and data
    const testEnv = await createTestEnvironment();
    const schemaPath = await createTestSchema(testEnv.tempDir);
    const markdownFiles = await createTestMarkdownFiles(testEnv.tempDir);

    // Act: Execute CLI command
    const result = await executeCliCommand([schemaPath, "output.json", "*.md"]);

    // Assert: Validate results
    assert(result.ok, `CLI execution failed: ${result.error?.message}`);
    const outputExists = await fileExists(
      path.join(testEnv.tempDir, "output.json"),
    );
    assert(outputExists, "Output file was not created");

    // Cleanup
    await testEnv.cleanup();
  },
);
```

This architecture ensures robust, maintainable, and reliable E2E tests that
validate the complete CLI workflows while maintaining the principles of
Domain-Driven Design and Totality.
