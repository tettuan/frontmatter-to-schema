# DDD & Totality Refactoring Tasks

## Phase 1: Foundation (Value Objects & Core Types)

- [ ] Refactor value-objects.ts with Smart Constructors
  - [ ] DocumentPath with validation
  - [ ] ConfigPath with validation
  - [ ] OutputPath with validation
  - [ ] SchemaPath with validation
  - [ ] TemplatePath with validation
- [ ] Update Result type usage across domain
- [ ] Create shared ValidationError types
- [ ] Update tests for value objects

## Phase 2: Domain Models (Entities & Aggregates)

- [ ] Refactor Schema model with discriminated unions
- [ ] Refactor Template model with proper constraints
- [ ] Refactor FrontMatter model with validation
- [ ] Update Document model to use new value objects
- [ ] Update tests for domain models

## Phase 3: Domain Services (Business Logic)

- [ ] Refactor SchemaAnalyzer to return Result types
- [ ] Refactor TemplateMapper to handle all cases
- [ ] Refactor FrontMatterExtractor for totality
- [ ] Update ResultAggregator for proper error handling
- [ ] Update tests for domain services

## Phase 4: Application Layer (Use Cases)

- [ ] Update ProcessDocumentsUseCase for Result types
- [ ] Update AnalyzeDocumentUseCase for totality
- [ ] Ensure exhaustive error handling
- [ ] Update integration tests

## Phase 5: Infrastructure Adapters

- [ ] Review and update file system adapters
- [ ] Update configuration loaders
- [ ] Ensure all external calls wrapped in Result
- [ ] Update adapter tests

## Phase 6: Final Validation

- [ ] Run `deno test src/` - all unit tests pass
- [ ] Run `deno task ci:dirty` - full CI passes
- [ ] Document changes and patterns applied
- [ ] Create completion report

## Current Status

**Active Phase**: Phase 1 - Starting with value objects
