# Test File Naming Convention Analysis

## Current State

### Directory Structure Issues
1. **Inconsistent directories**: `test/` vs `tests/`
2. **Mixed naming patterns**: 
   - Standard: `*.test.ts` (e.g., `result.test.ts`)
   - Non-standard: `test-*.ts` (e.g., `test-edge-cases.ts`)
   - Root level test files: `test.ts`, `run-tests.ts`

### Current File Distribution

#### Standard Pattern (`*.test.ts`)
- test/domain/core/: 5 files
- test/integration/: 1 file
- tests/domain/core/: 1 file
- tests/domain/models/: 2 files
- tests/domain/services/: 3 files
- tests/integration/: 1 file

#### Non-Standard Pattern
- `test/test-edge-cases.ts`
- `test/test-extractor.ts`
- `test/test-registry-aggregator.ts`
- `test.ts` (root)
- `run-tests.ts` (root)

## Proposed Convention

### Directory Structure
```
tests/                          # Single unified test directory
├── unit/                       # Unit tests
│   ├── domain/
│   │   ├── core/              # Core domain logic
│   │   ├── models/            # Value objects and entities
│   │   └── services/          # Domain services
│   ├── application/           # Application layer tests
│   └── infrastructure/        # Infrastructure tests
├── integration/               # Integration tests
├── e2e/                       # End-to-end tests
├── fixtures/                  # Test fixtures and data
├── helpers/                   # Test utilities and helpers
└── performance/               # Performance tests
```

### Naming Convention
1. **Test files**: Always use `*.test.ts` suffix
2. **Test utilities**: Use `*.utils.ts` or place in `helpers/`
3. **Test fixtures**: Place in `fixtures/` directory
4. **No `test-` prefix**: Convert to `*.test.ts` suffix

## Migration Plan

### Phase 1: Directory Consolidation
1. Merge `test/` and `tests/` into single `tests/` directory
2. Create proper subdirectory structure

### Phase 2: File Renaming
1. Rename non-standard test files:
   - `test-edge-cases.ts` → `edge-cases.test.ts`
   - `test-extractor.ts` → `extractor.test.ts`
   - `test-registry-aggregator.ts` → `registry-aggregator.test.ts`

### Phase 3: File Organization
1. Move unit tests to `tests/unit/`
2. Keep integration tests in `tests/integration/`
3. Move helpers to `tests/helpers/`
4. Handle root level test files appropriately

### Phase 4: Update Imports
1. Update all import paths in test files
2. Update test scripts in deno.json
3. Verify all tests still pass

## Benefits
1. **Consistency**: Single naming pattern across all tests
2. **Discoverability**: Easy to find and identify test files
3. **Organization**: Clear separation of test types
4. **Tooling**: Better IDE and tool support with standard patterns
5. **Maintenance**: Easier to maintain and navigate test suite