# Template Processing Consolidation Tasks

## Phase 1: Domain Structure Setup

- [x] Create `src/domain/template/` directory structure
- [x] Define `TemplateAggregate` as the aggregate root
- [x] Create `TemplateRepository` interface
- [x] Define domain events (`TemplateLoaded`, `TemplateApplied`)
- [x] Create unified `TemplateProcessingService` (via strategies)

## Phase 2: Totality Implementation

- [x] Fix `getValueByPath` to return Result type
- [x] Fix `applyDataToTemplate` to use Result type
- [ ] Remove type assertions in template mappers
- [ ] Add discriminated unions for template states
- [ ] Implement smart constructors for all template-related value objects

## Phase 3: Strategy Pattern Implementation

- [x] Define `TemplateProcessingStrategy` interface
- [x] Implement `AITemplateStrategy` (using Claude)
- [x] Implement `NativeTemplateStrategy` (TypeScript fallback)
- [x] Create `TemplateStrategySelector` with clear rules (CompositeStrategy)
- [x] Consolidate all template processing through single entry point
      (TemplateProcessingService)

## Phase 4: Migration and Testing

- [ ] Migrate `SimpleTemplateMapper` logic to domain
- [ ] Update all references to use new consolidated mapper
- [ ] Write comprehensive tests for new template domain
- [ ] Ensure backward compatibility
- [ ] Remove deprecated implementations

## Phase 5: Event Integration

- [ ] Implement event publisher for template operations
- [ ] Add event subscribers in dependent domains
- [ ] Test event flow through the system
- [ ] Document event contracts

## Phase 6: Cleanup

- [ ] Remove duplicate template processing code
- [ ] Update documentation
- [ ] Run full test suite (`deno task ci:dirty`)
- [ ] Update CLAUDE.md with new template processing approach

## Current Status

- Phase 1: Not started
- Phase 2: Not started
- Phase 3: Not started
- Phase 4: Not started
- Phase 5: Not started
- Phase 6: Not started

## Notes

- Priority: Focus on consolidating duplicate logic first
- Risk: Ensure AI template processing remains primary approach
- Testing: Each phase must maintain 100% test coverage
