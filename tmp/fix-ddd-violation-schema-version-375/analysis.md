# Issue #375: DDD Violation Analysis Report

## Problem Summary
The `ai-analysis-orchestrator.ts` has a hard-coded schema version string ("1.0.0") at line 162, violating DDD principles and Totality design patterns.

## Current State Analysis

### 1. Location of Issue
- **File**: `src/domain/core/ai-analysis-orchestrator.ts`
- **Line**: 162
- **Code**: `schemaVersion: "1.0.0", // TODO: Get from schema`

### 2. Root Cause
The `extractInformation` method receives `SchemaDefinition` (a value object) instead of the full `Schema` entity, preventing access to the version information.

### 3. Available Infrastructure
- ✅ `Schema` entity already has `getVersion(): SchemaVersion` method
- ✅ `SchemaVersion` value object exists with proper Smart Constructor pattern
- ✅ Value object follows Totality principles with semantic versioning validation

## Design Violations

### DDD Violations
1. **Hard-coded infrastructure concern**: Version string embedded in domain logic
2. **Incomplete aggregate usage**: Using partial schema data instead of full entity
3. **Bypassing domain model**: Not utilizing existing `SchemaVersion` value object

### Totality Violations
1. **Partial function**: Hard-coded value doesn't handle all schema versions
2. **Missing type safety**: String literal instead of validated value object
3. **No compile-time guarantee**: Version correctness not enforced by types

## Solution Design

### Approach 1: Pass Full Schema Entity (Recommended)
Change method signature to receive the complete `Schema` entity:

```typescript
async extractInformation(
  frontMatter: FrontMatterContent,
  schema: Schema,  // Changed from SchemaDefinition
): Promise<Result<ExtractedInfo, ValidationError>>
```

Benefits:
- Direct access to `schema.getVersion()`
- Maintains aggregate boundaries
- Follows DDD principles

### Approach 2: Pass Version Separately
Add version as a parameter:

```typescript
async extractInformation(
  frontMatter: FrontMatterContent,
  schemaDefinition: SchemaDefinition,
  schemaVersion: SchemaVersion,
): Promise<Result<ExtractedInfo, ValidationError>>
```

Drawbacks:
- Breaks cohesion
- Increases parameter count
- Less maintainable

## Implementation Plan

### Phase 1: Update Method Signatures
1. Change `extractInformation` to accept `Schema` entity
2. Update `mapToTemplate` similarly for consistency
3. Extract definition and version from entity within methods

### Phase 2: Fix Usage Sites
1. Find all callers of these methods
2. Update to pass full `Schema` entity
3. Ensure proper entity loading from repositories

### Phase 3: Update Tests
1. Modify test fixtures to use full entities
2. Add tests for version extraction
3. Ensure version validation works

## Files to Modify

### Core Changes
1. `src/domain/core/ai-analysis-orchestrator.ts`
   - Update method signatures
   - Replace hard-coded version with `schema.getVersion().toString()`

### Caller Updates
2. Files calling `extractInformation`:
   - Need to investigate usage sites
   - Update to pass full Schema entity

### Test Updates
3. Test files for ai-analysis-orchestrator
   - Update mock data
   - Add version validation tests

## Acceptance Criteria
- [ ] No hard-coded version strings in domain layer
- [ ] Schema version extracted from Schema entity
- [ ] All tests passing with new signatures
- [ ] Type-safe version handling throughout
- [ ] `deno task ci:dirty` passes without errors