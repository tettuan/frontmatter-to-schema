# Refactoring Plan - Priority Issues

## Issue #159: Template Placeholder Replacement (Already Fixed)
The template placeholder replacement has been implemented but needs Totality improvements:
- Remove type assertions in `simple-template-mapper.ts`
- Implement proper Result type for replacePlaceholders method

## Issue #160: CLI Output Path Handling (Already Fixed)
The CLI path handling is working but can be improved:
- Create proper value object for output paths
- Use discriminated unions for path types

## Issue #161: Mock Analyzer Switching
Environment-based switching needs proper abstraction:
- Implement Strategy pattern for analyzer selection
- Use dependency injection for runtime selection

## Immediate Refactoring Tasks

### 1. Fix Type Assertions in SimpleTemplateMapper
Current issue: Lines 36 and 44 use `as Record<string, unknown>`

Solution:
```typescript
// Instead of type assertion, validate the result
private validateAsRecord(data: unknown): Result<Record<string, unknown>, ValidationError> {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return { ok: true, data: data as Record<string, unknown> };
  }
  return { 
    ok: false, 
    error: createError({ 
      kind: "InvalidFormat", 
      format: "object",
      input: typeof data 
    })
  };
}
```

### 2. Implement Discriminated Union for Document State
Current: `frontMatter: FrontMatter | null`

Better:
```typescript
type DocumentState = 
  | { kind: "WithFrontMatter"; frontMatter: FrontMatter; content: DocumentContent }
  | { kind: "WithoutFrontMatter"; content: DocumentContent };
```

### 3. Schema Injection Pattern
Implement runtime schema injection as per domain boundary documentation:
- Create SchemaContext for runtime injection
- Implement SchemaInjector interface
- Remove hardcoded schema dependencies from core

## Implementation Order
1. Fix type assertions (Quick win, addresses existing functionality)
2. Implement discriminated unions for entities
3. Add schema injection pattern
4. Update tests for refactored code
5. Run CI pipeline to verify