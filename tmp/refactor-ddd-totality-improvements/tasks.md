# DDD & Totality Refactoring Tasks

## Phase 1: Analysis & Understanding

- [x] Read Totality principles documentation
- [x] Read Domain boundary documentation
- [x] Read AI complexity control documentation
- [x] Analyze current codebase structure
- [x] Identify violations of Totality principles
- [x] Identify domain boundary violations

## Phase 2: Design & Planning

- [x] Create refactoring plan based on DDD principles
- [x] Define proper domain boundaries
- [x] Design Result type implementations
- [x] Design Smart Constructor patterns
- [x] Plan discriminated union replacements

## Phase 3: Core Domain Refactoring

- [ ] Refactor value objects with Smart Constructors
  - [ ] DocumentPath
  - [ ] ConfigPath
  - [ ] OutputPath
  - [ ] SchemaId
  - [ ] TemplateId
- [ ] Implement Result types for error handling
- [ ] Replace optional properties with discriminated unions
- [ ] Remove type assertions and unsafe casts

## Phase 4: Infrastructure Layer Refactoring

- [ ] Refactor SchemaAnalyzer implementations
  - [ ] ClaudeSchemaAnalyzer
  - [ ] MockSchemaAnalyzer
- [x] Refactor TemplateMapper implementations (removed type assertions)
- [ ] Refactor ConfigurationLoader
- [ ] Implement proper dependency injection

## Phase 5: Application Layer Refactoring

- [ ] Refactor use cases with Result types
- [ ] Implement proper error aggregation
- [ ] Remove exception-based control flow
- [ ] Add exhaustive switch statements

## Phase 6: Testing & Validation

- [ ] Update unit tests for refactored code
- [ ] Run deno test for each modified file
- [ ] Run full test suite
- [ ] Run deno task ci:dirty
- [ ] Verify all tests pass

## Current Focus Issues from GitHub

- [ ] Issue #159: Template placeholder replacement
- [ ] Issue #160: CLI output path handling
- [ ] Issue #161: Mock analyzer switching

## Completion Criteria

- [ ] All Totality principles applied
- [ ] Domain boundaries properly defined
- [ ] No type assertions or unsafe casts
- [ ] All tests passing
- [ ] CI pipeline green
