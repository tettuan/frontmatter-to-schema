# Fix DDD Violation - Schema Version (#375)

## Tasks

### Phase 1: Core Changes

- [ ] Update `AIAnalysisOrchestrator.extractInformation()` signature
  - [ ] Change parameter from `SchemaDefinition` to `Schema`
  - [ ] Extract definition using `schema.getDefinition()`
  - [ ] Extract version using `schema.getVersion()`
  - [ ] Replace hard-coded "1.0.0" with extracted version

- [ ] Update `AIAnalysisOrchestrator.analyze()` signature
  - [ ] Change parameter from `SchemaDefinition` to `Schema`
  - [ ] Pass full Schema to extractInformation
  - [ ] Update mapToTemplate call similarly

- [ ] Add toString() method to SchemaVersion if needed
  - [ ] Check if SchemaVersion has toString()
  - [ ] Add if missing for string representation

### Phase 2: Update Callers

- [ ] Find all files importing AIAnalysisOrchestrator
- [ ] Update each caller to pass Schema instead of SchemaDefinition
- [ ] Ensure Schema entities are properly loaded

### Phase 3: Test Updates

- [ ] Update ai-analysis-orchestrator tests
  - [ ] Create proper Schema entities in test fixtures
  - [ ] Test version extraction
  - [ ] Test error cases

- [ ] Run unit tests
  - [ ] `deno test src/domain/core/ai-analysis-orchestrator.test.ts`
  - [ ] Fix any failing tests

### Phase 4: Integration Testing

- [ ] Run full test suite
  - [ ] `deno test --allow-all src/`
  - [ ] Fix any integration issues

- [ ] Run CI validation
  - [ ] `deno task ci:dirty`
  - [ ] Ensure all checks pass

## Files to Modify

1. **Core File**:
   - `src/domain/core/ai-analysis-orchestrator.ts`

2. **Value Object** (if needed):
   - `src/domain/models/value-objects.ts` (add toString to SchemaVersion)

3. **Test Files**:
   - Tests for ai-analysis-orchestrator
   - Integration tests using the orchestrator

4. **Callers** (to be identified):
   - Files that call analyze() or extractInformation()

## Success Criteria

- ✅ No hard-coded version strings
- ✅ Version extracted from Schema entity
- ✅ All tests passing
- ✅ CI validation successful
