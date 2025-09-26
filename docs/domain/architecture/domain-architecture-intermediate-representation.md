# Domain Architecture - Intermediate Representation Layer

## Overview

The Intermediate Representation (IR) layer provides a normalized, scope-aware
data structure that bridges the gap between directive-processed frontmatter data
and template variable resolution. This design addresses the critical issue of
losing variable scope during array expansion and deep path resolution.

## Core Concepts

### 1. IR Node Types (Algebraic Data Type)

```typescript
import { Result } from "../../shared/types";

/**
 * Algebraic data type representing all possible IR nodes.
 * Follows functional programming principles with exhaustive pattern matching.
 */
export type IRNode = IRScalar | IRObject | IRArray;

/**
 * Represents a scalar value in the IR tree.
 * Immutable by design with readonly properties.
 */
export interface IRScalar {
  readonly kind: "scalar";
  readonly path: TemplatePath;
  readonly value: string | number | boolean | null;
}

/**
 * Represents an object node with child entries.
 * Uses ReadonlyMap for immutable operations.
 */
export interface IRObject {
  readonly kind: "object";
  readonly path: TemplatePath;
  readonly entries: ReadonlyMap<string, IRNode>;
}

/**
 * Represents an array node with ordered items.
 * Maintains index information for scope resolution.
 */
export interface IRArray {
  readonly kind: "array";
  readonly path: TemplatePath;
  readonly items: readonly IRNode[];
}
```

### 2. Template Path Management

```typescript
/**
 * Extended TemplatePath supporting template-specific notations.
 * Handles both standard paths and array shortcuts.
 */
export class TemplatePath {
  private constructor(
    private readonly segments: readonly TemplatePathSegment[],
    private readonly rawPath: string,
  ) {}

  /**
   * Smart constructor with comprehensive validation.
   * Supports: standard.path, array[0], @items, items[]
   */
  static create(path: string): Result<TemplatePath, PathError> {
    // Validation and parsing logic
    // Handles special template notations
  }

  /**
   * Resolves relative path from current position.
   * Essential for scope-based variable resolution.
   */
  resolveRelative(relativePath: string): Result<TemplatePath, PathError> {
    // Path resolution logic
  }

  toString(): string {
    return this.rawPath;
  }

  getSegments(): readonly TemplatePathSegment[] {
    return this.segments;
  }
}

/**
 * Represents a single segment in a template path.
 * Supports property access and array indexing.
 */
export type TemplatePathSegment =
  | { kind: "property"; name: string }
  | { kind: "index"; value: number }
  | { kind: "array-marker"; marker: string }; // @items, items[]
```

### 3. Intermediate Representation Interface

```typescript
/**
 * Main interface for template intermediate representation.
 * Provides scope-aware data access and resolution.
 */
export interface TemplateIntermediateRepresentation {
  readonly root: IRObject;

  /**
   * Resolves a path from the root context.
   * Returns Result type for explicit error handling.
   */
  resolve(path: TemplatePath): Result<IRNode, VariableResolutionError>;

  /**
   * Creates a scoped context for variable resolution.
   * Essential for {@items} expansion and nested contexts.
   */
  createScope(
    path: TemplatePath,
  ): Result<TemplateScope, VariableResolutionError>;

  /**
   * Serializes IR back to a simple object structure.
   * Useful for debugging and testing.
   */
  toObject(): Record<string, unknown>;
}
```

### 4. Template Scope

```typescript
/**
 * Represents a scoped context for template variable resolution.
 * Maintains cursor position and resolution breadcrumbs.
 */
export interface TemplateScope {
  /**
   * Current position in the IR tree.
   * Updated when entering array elements or object properties.
   */
  readonly cursor: IRNode;

  /**
   * Path segments from root to current position.
   * Used for fallback resolution and debugging.
   */
  readonly breadcrumbs: readonly TemplatePathSegment[];

  /**
   * Resolves a path relative to the current scope.
   * Falls back to parent scopes if not found locally.
   */
  resolveRelative(path: TemplatePath): Result<IRNode, VariableResolutionError>;

  /**
   * Creates a child scope for nested contexts.
   * Used in {@items} expansion and object iteration.
   */
  createChildScope(
    segment: TemplatePathSegment,
  ): Result<TemplateScope, ScopeError>;

  /**
   * Gets the absolute path from root to current position.
   */
  getAbsolutePath(): TemplatePath;
}
```

## Builder Pattern

```typescript
/**
 * Builds IR from processed frontmatter data.
 * Follows Builder pattern for complex object construction.
 */
export class TemplateIntermediateBuilder {
  private root: IRObject | null = null;

  /**
   * Creates builder from frontmatter data array.
   * Merges multiple data sources into unified IR.
   */
  static fromFrontmatterData(
    data: readonly FrontmatterData[],
  ): Result<TemplateIntermediateBuilder, BuildError> {
    // Implementation
  }

  /**
   * Adds or updates a value at the specified path.
   * Creates intermediate nodes as needed.
   */
  addValue(path: TemplatePath, value: unknown): Result<void, BuildError> {
    // Implementation
  }

  /**
   * Builds the final immutable IR.
   * Validates completeness and consistency.
   */
  build(): Result<TemplateIntermediateRepresentation, BuildError> {
    // Implementation
  }
}
```

## Error Types

```typescript
/**
 * Comprehensive error types for IR operations.
 * Each error includes context for debugging.
 */
export type VariableResolutionError =
  | { kind: "PathNotFound"; path: string; availablePaths: string[] }
  | { kind: "InvalidPathSyntax"; path: string; reason: string }
  | { kind: "ScopeError"; message: string; scope: string }
  | { kind: "TypeMismatch"; expected: string; actual: string; path: string };

export type BuildError =
  | { kind: "InvalidData"; message: string }
  | { kind: "PathConflict"; path: string; existing: string; new: string }
  | { kind: "MissingRoot"; message: string };
```

## Integration Points

### 1. From Directive Processing

```typescript
// After directive processing
const processedData = await directiveProcessor.process(frontmatter, schema);

// Build IR
const builderResult = TemplateIntermediateBuilder.fromFrontmatterData(
  processedData,
);
if (!builderResult.ok) {
  return { ok: false, error: builderResult.error };
}

const irResult = builderResult.data.build();
```

### 2. To Template Resolution

```typescript
// In TemplateVariableResolver
private resolveWithIR(
  variable: string,
  ir: TemplateIntermediateRepresentation,
  scope: TemplateScope,
): Result<string, TemplateError> {
  const pathResult = TemplatePath.create(variable);
  if (!pathResult.ok) {
    return { ok: false, error: pathResult.error };
  }

  // Try relative resolution first
  const relativeResult = scope.resolveRelative(pathResult.data);
  if (relativeResult.ok) {
    return this.nodeToString(relativeResult.data);
  }

  // Fall back to root resolution
  const rootResult = ir.resolve(pathResult.data);
  if (rootResult.ok) {
    return this.nodeToString(rootResult.data);
  }

  // Apply fallback policy
  return this.applyFallbackPolicy(variable);
}
```

## Design Principles

### 1. Immutability

- All IR nodes are immutable
- Operations return new instances
- Thread-safe by design

### 2. Totality

- All functions are total (no partial functions)
- Result types for explicit error handling
- Exhaustive pattern matching

### 3. Scope Awareness

- Maintains variable resolution context
- Supports nested scopes for array expansion
- Fallback chain from local to global

### 4. Type Safety

- Algebraic data types prevent invalid states
- Smart constructors validate invariants
- Compile-time guarantees

## Performance Considerations

### 1. Memory Efficiency

- Structural sharing for unchanged nodes
- Lazy evaluation where possible
- Efficient path lookups using Maps

### 2. Caching Strategy

- Cache resolved paths within scope
- Memoize common transformations
- Clear cache boundaries at scope transitions

### 3. Large Dataset Handling

- Streaming support for large arrays
- Incremental building for memory efficiency
- Configurable depth limits

## Testing Strategy

### 1. Unit Tests

- Path parsing with edge cases
- Node construction and validation
- Scope resolution with various depths

### 2. Property-Based Tests

- Random JSON to IR conversion
- Resolution always returns valid Result
- Scope operations maintain invariants

### 3. Integration Tests

- Full pipeline from frontmatter to template
- Array expansion with nested variables
- Deep path resolution scenarios

## Future Extensions

### 1. Plugin Support

- Custom node types for extensions
- Transformation hooks
- Validation plugins

### 2. Performance Optimizations

- Parallel IR building
- Incremental updates
- Path indexing for faster lookups

### 3. Advanced Features

- JSONPath support
- XPath-like queries
- GraphQL-style field selection

## Migration Path

### Phase 1: Foundation

- Implement core IR types
- Basic builder functionality
- Simple path resolution

### Phase 2: Integration

- Wire into existing pipeline
- Maintain backward compatibility
- Feature flag for gradual rollout

### Phase 3: Optimization

- Performance tuning
- Advanced caching
- Memory optimization

### Phase 4: Deprecation

- Remove old resolution logic
- Clean up legacy code
- Update all tests

## References

- [Template Processing Specification](../../architecture/template-processing-specification.md)
- [Domain Architecture - Template](./domain-architecture-template.md)
- [Variable Resolution Roadmap](../../architecture/template-variable-resolution-roadmap.md)
