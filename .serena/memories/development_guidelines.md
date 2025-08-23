# Essential Development Guidelines

## Totality Patterns

### Result Types
```typescript
type Result<T, E> = { ok: true; data: T } | { ok: false; error: E };

// Smart Constructor Pattern
class ValidValue {
  private constructor(readonly value: string) {}
  static create(input: string): Result<ValidValue, ValidationError> {
    if (input.trim().length === 0) {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
    }
    return { ok: true, data: new ValidValue(input) };
  }
}
```

### Discriminated Unions
```typescript
// ❌ Bad: Optional properties
interface BadState { a?: X; b?: Y; }

// ✅ Good: Tagged unions
type GoodState = { kind: "A"; data: X } | { kind: "B"; data: Y };
```

## DDD Structure
- **Domain Layer**: Pure business logic, no dependencies
- **Value Objects**: Immutable with smart constructors
- **Entities**: Objects with identity
- **Aggregates**: Consistency boundaries

## AI-Complexity-Control
1. **Entropy Control**: Limit class/interface growth
2. **Functional Gravity**: Related code stays together
3. **Pattern Convergence**: Use established patterns

## Key Commands
```bash
# Testing
./run-tests.sh
deno task ci

# Main execution
deno run --allow-read --allow-write --allow-run src/main.ts

# Quality
deno fmt && deno lint
```

## Error Handling
- No exceptions - use Result types
- Comprehensive error types with messages
- Chain operations with `flatMap`