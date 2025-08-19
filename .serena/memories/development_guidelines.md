# Development Guidelines and Conventions

## Code Style and Conventions

### File Naming

- TypeScript files: kebab-case with `.ts` extension
- Test files: `test-*.ts` in `test/` directory
- Domain files: Organized by domain boundaries in `src/domain/`

### Type Conventions

- Value Objects: PascalCase classes (e.g., `FilePath`, `FrontMatterContent`)
- Interfaces: PascalCase with descriptive names (e.g., `AnalysisStrategy`,
  `FrontMatterExtractor`)
- Generic Types: Use descriptive type parameters (e.g., `<TInput, TOutput>`,
  `<TSchema, TResult>`)

### Import/Export Style

- Use explicit imports: `import type { ... }` for types
- Prefer named exports over default exports
- Group imports: external packages, then local modules

## Architecture Patterns

### Domain-Driven Design (DDD)

- **Bounded Contexts**: Clear separation between core and supporting domains
- **Value Objects**: Immutable objects with behavior (FilePath,
  FrontMatterContent)
- **Entities**: Objects with identity (SourceFile, AnalysisResult)
- **Aggregates**: Consistency boundaries (Registry)
- **Domain Services**: Stateless operations (AnalysisEngine, Transformer)

### Test-Driven Development (TDD)

- Write tests first, then implement
- Test files in `test/` directory with `test-` prefix
- Focus on domain behavior, not implementation details
- Use descriptive test names that explain the behavior

### Totality Principles

- **No Partial Functions**: Use `Result<T, E>` instead of throwing exceptions
- **Discriminated Unions**: Instead of optional properties
- **Smart Constructors**: Private constructors with static creation methods
- **Comprehensive Error Types**: Typed error handling with descriptive messages

```typescript
// ❌ Bad: Partial function
function parseValue(input: string): number {
  return parseInt(input); // Can return NaN
}

// ✅ Good: Total function
function parseValue(input: string): Result<number, ValidationError> {
  const parsed = parseInt(input);
  if (isNaN(parsed)) {
    return { ok: false, error: { kind: "ParseError", input } };
  }
  return { ok: true, data: parsed };
}
```

## AI-Complexity-Control Principles

### Entropy Control

- Measure complexity using class count, interface count, abstraction layers
- Set entropy thresholds and monitor increases
- Prefer composition over inheritance
- Keep cyclomatic complexity low

### Functional Gravity

- Related functions should be close (high cohesion)
- Unrelated functions should be separate (low coupling)
- Identify the "mass center" of functionality
- Organize code around domain boundaries

### Pattern Convergence

- Use established patterns (Strategy, Factory, Pipeline)
- Avoid novel abstractions unless necessary
- Document pattern usage and rationale
- Prefer proven solutions over custom implementations

## Error Handling Strategy

### Result Type Pattern

```typescript
type Result<T, E> = { ok: true; data: T } | { ok: false; error: E };

// Common error types
type ValidationError =
  | { kind: "EmptyInput" }
  | { kind: "InvalidFormat"; format: string }
  | { kind: "OutOfRange"; value: number; min: number; max: number };
```

### Error Creation Helpers

```typescript
const createError = (error: ValidationError, customMessage?: string) => ({
  ...error,
  message: customMessage || getDefaultMessage(error),
});
```

## Configuration and Extensibility

### Plugin Architecture

- Use interfaces for pluggable components
- Implement factory patterns for component creation
- Support configuration-driven behavior
- Enable dependency injection

### Schema-Driven Development

- External schemas define data structure
- Templates define output format
- Prompts define AI interaction
- All configurable without code changes

## Documentation Requirements

### Code Documentation

- JSDoc comments for public APIs
- Inline comments for complex logic
- README files for major components
- Architecture decision records (ADRs) for significant changes

### Domain Documentation

- Ubiquitous language definitions
- Domain model diagrams
- Bounded context maps
- Integration patterns documentation

## Quality Assurance

### Testing Strategy

- Unit tests for domain logic
- Integration tests for external dependencies
- Contract tests for interfaces
- Example-based validation in `examples/`

### Code Quality

- No `any` types unless absolutely necessary
- Prefer `unknown` over `any` when type is uncertain
- Use type assertions sparingly and document why
- Enable strict TypeScript compiler options
