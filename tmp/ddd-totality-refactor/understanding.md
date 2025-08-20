# DDD and Totality Understanding

## Totality Principles

- Convert partial functions to total functions
- Use type system to eliminate impossible states
- Discriminated unions over optional properties
- Smart constructors with validation
- Result types for error handling

## Domain Boundaries (from docs/domain/domain-boundary.md)

- Schema variability is central - schemas are loaded at runtime
- Core domain is schema-agnostic
- Schema injection boundary for runtime determination
- Dynamic schema management layer
- Runtime configuration boundary

## Key Refactoring Areas

### 1. Value Objects Need Smart Constructors

- ConfigPath, DocumentPath, OutputPath lack validation
- Should return Result types instead of throwing

### 2. Domain Services Need Result Types

- SchemaAnalyzer, TemplateMapper return promises without error handling
- Should use Result<T, E> pattern

### 3. Use Cases Need Better Error Handling

- ProcessDocumentsUseCase uses try-catch
- Should propagate Result types through the chain

### 4. Infrastructure Adapters Need Totality

- File operations should return Result types
- Claude analyzer should handle API errors as values

## Next Steps

1. Analyze each domain layer for partial functions
2. Create comprehensive task list
3. Implement changes systematically
