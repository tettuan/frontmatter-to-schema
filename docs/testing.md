# Testing Specification - Execution Guide

> **Important**: 
> This document is a **practical guide for test execution**. For complete test strategy, 
> refer to [../../tests/README.md](../../tests/README.md).

## Current Status

### Established Test Strategy

A test strategy based on **Domain-Driven Design** has been established:

- **Test Location**: Under `tests/` (numbered domain structure)
- **Execution Status**: Complete migration of 188 test files

### Test Placement Policy

- **Unit Tests**: Placed in the same directory as implementation files under `src/`
- **Integration/E2E Tests**: Placed in independent test directories under `tests/`

```
src/                          # Implementation files + unit tests
├── domain/
│   ├── service.ts
│   └── service.test.ts       # Unit test (same location as implementation)
└── ...

tests/                        # Dedicated to integration/E2E tests
├── 0_core_domain/           # Core domain integration tests
├── 4_cross_domain/          # Cross-domain integration tests
│   ├── collaboration/       # Cross-domain collaboration/integration tests
│   └── e2e/                # System-wide E2E tests
└── ...
```

## Test Execution Methods

### Basic Execution

```bash
# Execute unit tests (under src/)
deno test src/

# Execute integration/E2E tests (under tests/)
deno test tests/

# Execute all tests (recommended: unit tests → integration tests order)
deno test src/ && deno test tests/

# Execute all domain tests (executed in numerical order)
deno test tests/

# Domain-specific execution (recommended execution order)
deno test tests/0_core_domain/        # Core domain (highest priority)
deno test tests/1_supporting_domain/  # Supporting domain
deno test tests/2_generic_domain/     # Technical foundation
deno test tests/3_interface_layer/    # Interface layer
deno test tests/4_cross_domain/       # Integration tests (last)
```

### Category-Based Execution

```bash
# Unit tests (under src/)
deno test src/ --filter="0_architecture"  # Architecture constraint tests
deno test src/ --filter="1_behavior"      # Behavior verification tests
deno test src/ --filter="2_structure"     # Structure integrity tests

# Integration/E2E tests (under tests/)
deno test tests/*/3_core/                    # Core functionality tests
deno test tests/4_cross_domain/e2e/          # E2E tests
deno test tests/4_cross_domain/collaboration/ # Integration tests
```

### Execution Order Design Philosophy

1. **`0_architecture/`**: First verify that system foundation is correctly built
2. **`1_behavior/`**: Verify basic functions work normally
3. **`2_structure/`**: Verify data structure integrity
4. **`3_core/`**: Verify intra-domain integration functions
5. **`4_cross_domain/`**: Finally verify system-wide collaboration

### CI/CD Execution

```bash
# Traditional CI execution method (using script)
bash scripts/local_ci.sh

# Staged execution (recommended)
deno test src/                    # Unit tests
deno test tests/0_core_domain/    # Core domain integration tests
deno test tests/4_cross_domain/   # E2E/integration tests
```

## Debugging and Logging

### Using BreakdownLogger

BreakdownLogger should be **used only in test code**:

```typescript
import { BreakdownLogger } from "@tettuan/breakdownlogger";

const logger = new BreakdownLogger("domain-test");
logger.debug("Domain test execution started", {
  domain: "core_domain",
  testCase: "prompt_path_resolution",
});
```

### Debug Log Levels and Filtering

- `LOG_LEVEL`: debug, info, warn, error
- `LOG_KEY`: Filtering for specific modules
- `LOG_LENGTH`: Message length control

For details, refer to [debug.ja.md](./debug.ja.md).

### Extracting Specific Logs with LOG_KEY

Output only log messages containing specific keywords:

```bash
# Display only logs related to specific features
LOG_KEY="parser" deno test --allow-env --allow-write --allow-read

# Filter with multiple keywords
LOG_KEY="parser,validation" deno test --allow-env --allow-write --allow-read
```

### Output Control with LOG_LENGTH

```bash
# Shortened display (100 characters)
LOG_LENGTH=S deno test --allow-env --allow-write --allow-read

# Detailed display (no limit)
LOG_LENGTH=W deno test --allow-env --allow-write --allow-read
```

### Stage-Based Log Settings

```bash
# During development/debugging
LOG_LEVEL=debug LOG_LENGTH=W deno test

# When testing specific features
LOG_KEY="target_function" LOG_LEVEL=debug deno test

# During CI execution
LOG_LEVEL=info LOG_LENGTH=S deno test
```

## Error Handling and Debugging

### Error Investigation Procedure

1. Check debug logs
2. Verify test environment status
3. Execute related test cases
4. Document error reproduction steps

### Handling Test Failures

1. Check error messages
2. Re-execute in debug mode
3. Verify related implementation
4. Determine preprocessing failures
5. Fix and retest

### Preprocessing Failure Determination

- If a test fails in preprocessing not related to the test's purpose, another preprocessing test is needed
- Preprocessing tests should be placed in earlier execution stages
- Preprocessing examples:
  - Configuration determination test fails on config file loading → 
    Create config file loading test
- Test preprocessing should use confirmed processes executed before the relevant test