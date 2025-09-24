# Duplicate Services Consolidation Plan

## Issue #1042: Multiple duplicate implementations causing maintenance burden

### Current State Analysis

#### ProcessingStrategyService (4 versions)

1. `processing-strategy-service.ts` (19,694 bytes) - Used by tests
2. `processing-strategy-service-v3.ts` (10,242 bytes) - Unused
3. `processing-strategy-service-final.ts` (11,853 bytes) - **ACTIVE** (used by
   DocumentTransformationCoordinator)
4. `processing-strategy-service-compact.ts` (9,250 bytes) - Unused

#### AggregationProcessingService (3 versions)

1. `aggregation-processing-service.ts` (18,578 bytes) - Used by tests
2. `aggregation-processing-service-v2.ts` (10,754 bytes) - Unused
3. `aggregation-processing-service-final.ts` (8,968 bytes) - **ACTIVE** (used by
   DocumentTransformationCoordinator)

#### DirectiveProcessor (2 locations)

1. `src/application/services/directive-processor.ts` - Duplicate (can be
   removed)
2. `src/domain/schema/services/directive-processor.ts` - **ACTIVE**

### Why Direct Consolidation Failed

The attempt to directly remove duplicates and rename files failed because:

1. **Interface Incompatibility**: The "final" versions have different method
   signatures and constructor parameters than the original versions
2. **Test Coupling**: Test files are tightly coupled to the old interfaces
3. **Breaking Changes**: Direct replacement would break all existing tests

### Recommended Phased Migration Strategy

#### Phase 1: Analysis and Planning (Current)

- Document all duplicate services and their usage
- Identify interface differences
- Create migration plan

#### Phase 2: Create Compatibility Layer

```typescript
// Create adapter classes that support both interfaces
export class ProcessingStrategyServiceAdapter {
  static create(configOrParams) {
    // Support both old config-based and new parameter-based creation
  }
}
```

#### Phase 3: Gradual Test Migration

- Update tests one at a time to use new interfaces
- Maintain backward compatibility during migration
- Run CI after each test migration to ensure stability

#### Phase 4: Service Consolidation

- Once all tests use new interfaces, remove old versions
- Rename `-final` files to standard names
- Update all imports

#### Phase 5: Cleanup

- Remove adapter classes once migration is complete
- Update documentation
- Final CI verification

### Benefits of Phased Approach

1. **No Breaking Changes**: System remains functional throughout migration
2. **Incremental Validation**: Each step can be tested independently
3. **Rollback Capability**: Can revert at any stage if issues arise
4. **Learning Opportunity**: Understand interface differences thoroughly

### Estimated Timeline

- Phase 1: ✅ Complete (this document)
- Phase 2: 1-2 days
- Phase 3: 3-4 days
- Phase 4: 1 day
- Phase 5: 1 day

**Total: ~1 week for complete, safe migration**

### Next Steps

1. Create GitHub issues for each phase
2. Implement adapter classes in a feature branch
3. Migrate tests incrementally
4. Review and merge when complete

### Risk Mitigation

- **Risk**: Breaking production code
  - **Mitigation**: Use feature branch, extensive testing

- **Risk**: Incomplete migration
  - **Mitigation**: Track progress with checklist, automated tests

- **Risk**: Performance degradation
  - **Mitigation**: Benchmark before and after migration

### Success Criteria

- [ ] All duplicate files removed
- [ ] Single source of truth for each service
- [ ] All tests passing
- [ ] No performance regression
- [ ] Clean, maintainable codebase
