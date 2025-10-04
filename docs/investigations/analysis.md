# DDD and Totality Refactoring Investigation

## Current State Analysis

### ✅ Already Implemented (Good)

1. **Result Type**: Robust Result<T, E> implementation with:
   - Railway pattern (andThen, map, mapError)
   - Safe unwrapping (unwrapOr, unwrapOrElse)
   - Pattern matching (match)
   - Deprecated unsafe methods (unwrap, unwrapError) marked for removal

2. **Domain Structure**: Already follows DDD boundaries:
   - `src/domain/schema/` - Schema Context
   - `src/domain/frontmatter/` - Frontmatter Context
   - `src/domain/template/` - Template Context
   - `src/domain/aggregation/` - Aggregation Context
   - `src/domain/shared/` - Shared types

3. **Error Hierarchy**: Structured error classes:
   - DomainError (base)
   - SchemaError, FrontmatterError, TemplateError
   - AggregationError, ValidationError, ProcessingError
   - All include code and context

### ⚠️ Potential Totality Violations to Investigate

Based on totality.ja.md principles:

#### 1. Error Type Design

**Current**: Inheritance-based error classes (extends Error) **Totality
Recommendation**: Discriminated unions with kind tags

```typescript
// Current (inheritance)
export class SchemaError extends DomainError {
  constructor(message: string, code: string, context?: Record<string, unknown>);
}

// Totality pattern (discriminated union)
type ValidationError =
  | { kind: "OutOfRange"; value: unknown; min?: number; max?: number }
  | { kind: "InvalidRegex"; pattern: string }
  | { kind: "PatternMismatch"; value: string; pattern: string };
```

**Question**: Should we refactor errors to discriminated unions?

- **Pro**: Better type safety, exhaustive checking, aligns with totality.ja.md
- **Con**: Breaking change, current design already functional
- **Decision**: Needs architectural review

#### 2. Optional Properties in Interfaces/Types

**Search needed**: Look for `prop?: Type` patterns that could be discriminated
unions

#### 3. Type Assertions and Unsafe Casts

**Initial search**: No `as Type` found in domain layer ✅ **Next**: Check
application and infrastructure layers

#### 4. Partial Functions (undefined/null returns)

**Initial search**: No explicit `return null` found in domain ✅ **Next**: Check
for functions returning `T | undefined` without Result wrapper

#### 5. Exception-based Control Flow

**Initial search**: No `throw new` in domain layer ✅ **Note**: Error classes
themselves extend Error but are used with Result type

### 🔍 Next Investigation Steps

1. **Search for optional properties** in type definitions
   - Pattern: `\?\s*:`
   - Check if they represent multiple states → convert to discriminated unions

2. **Search for partial function returns**
   - Pattern: `T \| undefined`, `T \| null`
   - Check if they should be wrapped in Result<T, E>

3. **Check for Smart Constructor pattern usage**
   - Look for value objects with validation
   - Ensure they use private constructors + static create()

4. **Examine error creation patterns**
   - Check if errors provide discriminated union information
   - Consider adding helper functions like `createError` from totality.ja.md

5. **Review switch statements**
   - Ensure exhaustive checking (no default needed)
   - Look for if-else chains that should be switch

## Compliance Questions

### Q1: Should errors be discriminated unions instead of classes?

**Current Design**:

```typescript
class ValidationError extends DomainError {
  constructor(message: string, code: string, context?: Record<string, unknown>);
}
```

**Totality Pattern**:

```typescript
type ValidationError =
  | { kind: "EmptyInput"; message: string }
  | {
    kind: "OutOfRange";
    value: unknown;
    min: number;
    max: number;
    message: string;
  };

const createError = (
  error: ValidationError,
): ValidationError & { message: string } => ({
  ...error,
  message: error.message || getDefaultMessage(error),
});
```

**Analysis**:

- Current design: More traditional OOP, familiar to TypeScript developers
- Totality pattern: Better type safety, exhaustive checking, no instanceof
  needed
- Impact: Breaking change to all error handling code

**Recommendation**: Document both approaches, let project owner decide

### Q2: Result<T, E> error unwrapping

Current Result has deprecated `unwrap()` that throws. Should we:

- Remove it entirely?
- Keep it for gradual migration?

**Recommendation**: Keep deprecated for now, add migration guide

## Files to Examine Next

1. `src/domain/shared/value-objects/` - Check Smart Constructor pattern
2. `src/application/**/*.ts` - Check for partial functions
3. `src/infrastructure/**/*.ts` - Check for type assertions
4. Core domain services in each context

## Totality Compliance Checklist

- [ ] No type assertions (`as Type`)
- [ ] No optional properties for state representation
- [ ] No `any` or unsafe `unknown` usage
- [ ] All functions return Result<T, E>
- [ ] Smart constructors for validated values
- [ ] Discriminated unions for state
- [ ] Exhaustive switch statements (no default)
- [ ] No exception-based control flow

## Notes

- The project already has strong totality foundations
- Main question is whether to refactor errors to discriminated unions
- Need to check value objects, application layer, and infrastructure
- This is not a major refactoring - more of a compliance audit and minor
  improvements
