# Refactoring Tasks - Issue #377

## Quick Wins (Phase 1)

### 1. Consolidate Use Cases Directories
- [ ] Move `src/application/usecases/BuildRegistryUseCase.ts` to `src/application/use-cases/`
- [ ] Delete empty `src/application/usecases/` directory
- [ ] Update all imports

### 2. Consolidate Mock Implementations
- [ ] Create single `src/infrastructure/adapters/mock-analyzer.ts`
- [ ] Merge `mock-ai-analyzer.ts` and `mock-schema-analyzer.ts`
- [ ] Update test imports
- [ ] Delete redundant mock files

### 3. Review Analyzer Overlap
- [ ] Analyze ClaudeSchemaAnalyzer (450 lines) - seems overly complex
- [ ] Compare with TypeScriptSchemaAnalyzer (230 lines)
- [ ] Identify shared functionality
- [ ] Consider consolidation strategy

## Structural Improvements (Phase 2)

### 4. Flatten Domain Structure
- [ ] Review `src/domain/` subdirectories
- [ ] Consolidate related modules:
  - [ ] Merge `analysis/` with `core/analysis-*` files
  - [ ] Combine `prompt/` and `prompts/` directories
  - [ ] Review need for separate `extraction/` directory

### 5. Simplify Infrastructure
- [ ] Evaluate if all 5 analyzer implementations are needed
- [ ] Consider adapter pattern consolidation
- [ ] Review port definitions

## DDD Alignment (Phase 3)

### 6. Clear Bounded Contexts
- [ ] Define clear boundaries for:
  - [ ] Analysis context
  - [ ] Schema context
  - [ ] Template context
- [ ] Ensure no cross-boundary violations

### 7. Value Objects Review
- [ ] Check for duplicate value objects
- [ ] Consolidate similar patterns
- [ ] Ensure proper encapsulation

## Implementation Order

1. **Start with Quick Wins** - Low risk, immediate benefit
2. **Test after each change** - Ensure nothing breaks
3. **Document decisions** - Why consolidation or separation
4. **Measure improvement** - Track file count reduction

## Success Metrics

- [ ] Reduce file count from 81 to ~60 (-25%)
- [ ] Eliminate duplicate directories
- [ ] Consolidate mock implementations from 2 to 1
- [ ] All tests passing
- [ ] CI green

## Current Status

**Phase**: Starting Phase 1
**Next Action**: Consolidate use-cases directories