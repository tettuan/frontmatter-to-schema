# Domain-Driven Design Refactoring Tasks

## Priority Tasks Based on Current Analysis

### Phase 1: Critical Issues (Immediate)

- [x] **Task 1.1**: Fix template data mapping in NativeTemplateStrategy
  - Location: `/src/domain/template/strategies.ts`
  - Issue: Template processing produces identical copies instead of actual
    frontmatter data transformation
  - Root Cause: Missing schema-driven variable resolution
  - **COMPLETED**: Implemented `FrontMatterDataMapper` and `SchemaExpander` with
    proper schema-driven data mapping
  - **Result**: Template processing now performs actual frontmatter-to-template
    data transformation

- [x] **Task 1.2**: Implement proper Result type error handling for file
      operations
  - Locations: `/src/infrastructure/adapters/configuration-loader.ts`,
    `/src/infrastructure/adapters/deno-document-repository.ts`
  - Issue: Permission errors causing test failures
  - Required: Comprehensive Result type implementation
  - **COMPLETED**: Result type error handling already properly implemented
  - **Result**: Infrastructure tests pass individually, E2E issues are due to
    missing --allow-run permission

### Phase 2: Architecture Compliance (High Priority)

- [ ] **Task 2.1**: Restructure TypeScript Analysis Domain aggregate
  - Location: `/src/domain/core/TypeScriptProcessingOrchestrator.ts`
  - Issue: Not following domain-boundary.md 2-stage processing specification
    (B→C→D)
  - Required: Proper aggregate root implementation

- [ ] **Task 2.2**: Separate Template Management Domain boundaries
  - Location: `/src/domain/template/` directory
  - Issue: Domain boundary violations per CD4 specification
  - Required: Clear separation of template loading, validation, and application

### Phase 3: Totality Implementation (Medium Priority)

- [ ] **Task 3.1**: Complete Result type coverage across domain operations
  - Status: Currently 60% gap identified
  - Required: Replace nullable types with Result<T,E> pattern

- [ ] **Task 3.2**: Implement smart constructor patterns for value objects
  - Status: Currently 45% gap identified
  - Required: Private constructors with static create() methods

### Phase 4: Test Enhancement (Medium Priority)

- [ ] **Task 4.1**: Add boundary value and error path test coverage
  - Reference: `docs/testing/comprehensive-test-strategy.md`
  - Required: Edge case and error scenario testing

- [ ] **Task 4.2**: Implement totality-compliant test patterns
  - Required: All tests using Result type assertions

## Completion Criteria

1. All domain boundaries aligned with specifications in
   `docs/domain/domain-boundary.md`
2. Template mapping produces actual data transformations, not identical copies
3. 100% Result type coverage for domain operations
4. All tests passing with comprehensive error path coverage
5. `deno test` runs without permission errors or failures

## Current Status

- **Tests**: 186 steps passing, 2 critical failures (ConfigurationLoader,
  DenoDocumentRepository)
- **Domain Architecture**: Multiple boundary violations identified
- **Template Processing**: Producing identical copies instead of transformed
  data
- **Totality Compliance**: 60% Result type gap, 45% smart constructor gap
