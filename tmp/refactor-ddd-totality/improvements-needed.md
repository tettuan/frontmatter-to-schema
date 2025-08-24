# Critical Improvements Needed for Totality

## 1. FrontMatterExtractor Interface (High Priority)
**File**: `src/domain/services/interfaces.ts`
**Issue**: Returns `FrontMatter | null` (partial function)
**Solution**: Use discriminated union:
```typescript
type ExtractionResult = 
  | { kind: "Found"; data: FrontMatter }
  | { kind: "NotFound" }
  | { kind: "Invalid"; reason: string };

extract(document: Document): Result<ExtractionResult, ProcessingError>
```

## 2. Optional Parameters in Services
Multiple services use optional parameters (`?:`) which should be converted to explicit presence/absence modeling.

## 3. Schema Types
Schema-related types should use exhaustive discriminated unions for different schema types instead of generic `unknown`.

## Current State Summary
- ✅ Value objects already use Smart Constructors
- ✅ Result types properly defined with discriminated error unions
- ✅ Error helpers follow totality
- ⚠️ Some service interfaces return nullable types
- ⚠️ Optional parameters used in many places
- ⚠️ Some type assertions still present

## Next Steps
1. Fix FrontMatterExtractor interface
2. Update implementations to match
3. Remove optional parameters where possible
4. Add exhaustive pattern matching
5. Run tests to ensure no breakage