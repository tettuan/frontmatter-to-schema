# Template Context Specification

## Overview

The Template Context system provides a scope-aware environment for template
variable resolution, managing the relationship between template placeholders and
the Intermediate Representation (IR) data. This specification defines the
complete context management architecture that enables accurate variable
resolution in nested and array-expanded scenarios.

## Core Architecture

### 1. Template Context Interface

```typescript
/**
 * Main context for template processing.
 * Manages scope stack, fallback policies, and array bindings.
 */
export interface TemplateContext {
  /**
   * Stack of scopes, with the current scope at the top.
   * Pushed/popped during {@items} expansion and object traversal.
   */
  readonly scopeStack: readonly TemplateScope[];

  /**
   * Policy for handling missing variables.
   * Configurable per template or globally.
   */
  readonly fallbackPolicy: FallbackPolicy;

  /**
   * Active array expansions for {@items} markers.
   * Tracks which arrays are currently being iterated.
   */
  readonly arrayBindings: readonly ArrayBinding[];

  /**
   * Current verbosity mode for debugging.
   * Affects error messages and logging detail.
   */
  readonly verbosityMode: VerbosityMode;

  /**
   * Resolves a variable in the current context.
   * Tries current scope first, then falls back through parent scopes.
   */
  resolve(variable: string): Result<ResolvedValue, ResolutionError>;

  /**
   * Enters an array for {@items} expansion.
   * Creates new scopes for each array element.
   */
  enterArray(arrayPath: TemplatePath): Result<ArrayContext, ContextError>;

  /**
   * Enters an object property.
   * Updates the current scope cursor.
   */
  enterProperty(property: string): Result<TemplateContext, ContextError>;

  /**
   * Creates a child context with additional scope.
   * Used for nested template processing.
   */
  withScope(scope: TemplateScope): TemplateContext;

  /**
   * Creates a context with different fallback policy.
   * Useful for strict vs. lenient processing modes.
   */
  withFallbackPolicy(policy: FallbackPolicy): TemplateContext;
}
```

### 2. Fallback Policy

```typescript
/**
 * Defines behavior when variables cannot be resolved.
 * Supports different use cases and debugging needs.
 */
export type FallbackPolicy =
  | { kind: "empty"; value: "" } // Replace with empty string
  | { kind: "preserve" } // Keep original {variable} syntax
  | { kind: "null"; value: null } // Replace with null
  | { kind: "error" } // Throw error on missing variable
  | { kind: "custom"; handler: FallbackHandler };

/**
 * Custom fallback handler for advanced use cases.
 */
export interface FallbackHandler {
  handle(variable: string, context: TemplateContext): Result<string, Error>;
}
```

### 3. Array Binding

```typescript
/**
 * Represents an active array iteration binding.
 * Created when entering {@items} expansion.
 */
export interface ArrayBinding {
  /**
   * The marker used in the template (e.g., "@items", "items[]").
   */
  readonly marker: string;

  /**
   * Path to the array in the IR.
   */
  readonly arrayPath: TemplatePath;

  /**
   * Current iteration index.
   * -1 if not currently iterating.
   */
  readonly currentIndex: number;

  /**
   * Total number of items in the array.
   */
  readonly totalItems: number;

  /**
   * Metadata available during iteration.
   * Includes $index, $first, $last, etc.
   */
  readonly iterationMeta: IterationMetadata;
}

/**
 * Metadata available during array iteration.
 * Provides context-aware variables for templates.
 */
export interface IterationMetadata {
  readonly index: number; // Current index (0-based)
  readonly count: number; // Current count (1-based)
  readonly first: boolean; // Is first element
  readonly last: boolean; // Is last element
  readonly odd: boolean; // Is odd index
  readonly even: boolean; // Is even index
  readonly total: number; // Total items in array
}
```

### 4. Array Context

```typescript
/**
 * Context for processing array iterations.
 * Returned when entering an array expansion.
 */
export interface ArrayContext {
  /**
   * Iterator over array element contexts.
   * Each iteration provides a scoped context.
   */
  readonly items: Iterable<ElementContext>;

  /**
   * The array being iterated.
   */
  readonly array: IRArray;

  /**
   * Original context before array entry.
   * Used to restore state after iteration.
   */
  readonly parentContext: TemplateContext;

  /**
   * Processes template for each array element.
   * Handles scope management automatically.
   */
  processTemplate(
    template: string,
    processor: TemplateProcessor,
  ): Result<string[], ProcessingError>;
}

/**
 * Context for a single array element.
 * Provides scoped access to element data.
 */
export interface ElementContext {
  /**
   * Template context scoped to this element.
   */
  readonly context: TemplateContext;

  /**
   * The element's IR node.
   */
  readonly element: IRNode;

  /**
   * Iteration metadata for this element.
   */
  readonly metadata: IterationMetadata;
}
```

### 5. Verbosity Modes

```typescript
/**
 * Controls the level of detail in error messages and debugging.
 */
export type VerbosityMode =
  | "silent" // Minimal output, suppress warnings
  | "normal" // Standard output with basic errors
  | "verbose" // Detailed output with context
  | "debug"; // Full debugging information

/**
 * Resolution result with metadata.
 */
export interface ResolvedValue {
  /**
   * The resolved value.
   */
  readonly value: string;

  /**
   * Path where the value was found.
   */
  readonly sourcePath: TemplatePath;

  /**
   * Resolution strategy used.
   */
  readonly strategy: ResolutionStrategy;

  /**
   * Scopes traversed during resolution.
   */
  readonly scopeChain: readonly string[];
}

export type ResolutionStrategy =
  | "direct" // Found in current scope
  | "inherited" // Found in parent scope
  | "fallback" // Used fallback policy
  | "computed"; // Dynamically computed value
```

## Context Factory

```typescript
/**
 * Factory for creating template contexts.
 * Configures contexts based on IR and template settings.
 */
export class TemplateContextFactory {
  /**
   * Creates a context from IR and configuration.
   */
  static create(
    ir: TemplateIntermediateRepresentation,
    config: ContextConfiguration,
  ): Result<TemplateContext, FactoryError> {
    // Validate IR
    // Set up initial scope
    // Configure fallback policy
    // Initialize array bindings
  }

  /**
   * Creates a context for a specific scope path.
   */
  static createScoped(
    ir: TemplateIntermediateRepresentation,
    scopePath: TemplatePath,
    config: ContextConfiguration,
  ): Result<TemplateContext, FactoryError> {
    // Create scope at path
    // Set up context with scope
  }
}

/**
 * Configuration for template context creation.
 */
export interface ContextConfiguration {
  readonly fallbackPolicy: FallbackPolicy;
  readonly verbosityMode: VerbosityMode;
  readonly maxScopeDepth: number;
  readonly enableCaching: boolean;
  readonly customResolvers?: CustomResolver[];
}
```

## Resolution Process

### 1. Variable Resolution Flow

```mermaid
graph TD
    A[Variable: {id.full}] --> B[Parse Variable Path]
    B --> C{Current Scope?}
    C -->|Found| D[Return Value]
    C -->|Not Found| E{Parent Scopes?}
    E -->|Check Each| F[Traverse Scope Stack]
    F -->|Found| D
    F -->|Not Found| G{Array Binding?}
    G -->|Yes| H[Check Array Context]
    H -->|Found| D
    G -->|No| I{Root Scope?}
    I -->|Check| J[Search from Root]
    J -->|Found| D
    J -->|Not Found| K[Apply Fallback Policy]
    K --> L[Return Result]
```

### 2. Scope Management During Array Expansion

```typescript
// Example: Processing {@items} expansion
async function processArrayExpansion(
  template: string,
  arrayPath: string,
  context: TemplateContext,
): Result<string, ProcessingError> {
  // Parse array path
  const pathResult = TemplatePath.create(arrayPath);
  if (!pathResult.ok) return pathResult;

  // Enter array context
  const arrayContextResult = context.enterArray(pathResult.data);
  if (!arrayContextResult.ok) return arrayContextResult;

  const arrayContext = arrayContextResult.data;
  const results: string[] = [];

  // Process each element with its scope
  for (const elementContext of arrayContext.items) {
    // Element's context has array element as current scope
    const processedResult = await processTemplate(
      template,
      elementContext.context,
    );

    if (!processedResult.ok) return processedResult;
    results.push(processedResult.data);
  }

  return { ok: true, data: results.join("") };
}
```

### 3. Nested Variable Resolution

```typescript
// Example: Resolving {deeply.nested.items[0].id.full}
function resolveNestedVariable(
  variable: string,
  context: TemplateContext,
): Result<string, ResolutionError> {
  // Try current scope first
  const currentResult = context.resolve(variable);
  if (currentResult.ok) {
    return currentResult;
  }

  // If in array context, try with array element scope
  if (context.arrayBindings.length > 0) {
    const binding = context.arrayBindings[0];
    const elementPath = `${binding.marker}.${variable}`;
    const elementResult = context.resolve(elementPath);
    if (elementResult.ok) {
      return elementResult;
    }
  }

  // Fall back through scope chain
  for (const scope of context.scopeStack) {
    const scopeResult = scope.resolveRelative(
      TemplatePath.create(variable).data,
    );
    if (scopeResult.ok) {
      return { ok: true, data: String(scopeResult.data) };
    }
  }

  // Apply fallback policy
  return applyFallbackPolicy(variable, context);
}
```

## Integration with Template Processing

### 1. Template Variable Resolver Integration

```typescript
export class TemplateVariableResolver {
  resolve(
    template: string,
    context: TemplateContext,
  ): Result<string, TemplateError> {
    // Extract variables from template
    const variables = this.extractVariables(template);

    let result = template;
    for (const variable of variables) {
      // Resolve using context
      const resolved = context.resolve(variable);

      if (resolved.ok) {
        result = result.replace(
          `{${variable}}`,
          resolved.data.value,
        );
      } else if (context.fallbackPolicy.kind === "preserve") {
        // Keep original syntax
        continue;
      } else {
        // Apply fallback
        const fallback = this.getFallbackValue(
          variable,
          context.fallbackPolicy,
        );
        result = result.replace(`{${variable}}`, fallback);
      }
    }

    return { ok: true, data: result };
  }
}
```

### 2. Unified Variable Replacement Strategy

```typescript
export class UnifiedVariableReplacementStrategy {
  constructor(
    private readonly contextFactory: TemplateContextFactory,
  ) {}

  replace(
    content: string,
    ir: TemplateIntermediateRepresentation,
    config: ContextConfiguration,
  ): Result<string, ReplacementError> {
    // Create context
    const contextResult = this.contextFactory.create(ir, config);
    if (!contextResult.ok) return contextResult;

    const context = contextResult.data;

    // Process template with context
    return this.processWithContext(content, context);
  }
}
```

## Error Handling

```typescript
/**
 * Comprehensive error types for context operations.
 */
export type ContextError =
  | { kind: "InvalidScope"; path: string; reason: string }
  | { kind: "DepthExceeded"; depth: number; max: number }
  | { kind: "ArrayNotFound"; path: string }
  | { kind: "CircularReference"; path: string }
  | { kind: "InvalidConfiguration"; message: string };

export type ResolutionError =
  | { kind: "VariableNotFound"; variable: string; searched: string[] }
  | { kind: "TypeMismatch"; expected: string; actual: string }
  | { kind: "AccessError"; path: string; reason: string }
  | { kind: "ProcessingError"; stage: string; message: string };
```

## Performance Optimization

### 1. Caching Strategy

```typescript
/**
 * Cache for resolved variables within context.
 */
export interface ResolutionCache {
  /**
   * Cache resolved values per scope.
   */
  readonly cache: Map<string, Map<string, ResolvedValue>>;

  /**
   * Get cached value if available.
   */
  get(scopeId: string, variable: string): ResolvedValue | undefined;

  /**
   * Store resolved value.
   */
  set(scopeId: string, variable: string, value: ResolvedValue): void;

  /**
   * Clear cache for scope.
   */
  clearScope(scopeId: string): void;

  /**
   * Clear entire cache.
   */
  clear(): void;
}
```

### 2. Lazy Evaluation

```typescript
/**
 * Lazy evaluation for expensive computations.
 */
export interface LazyValue<T> {
  /**
   * Get value, computing if necessary.
   */
  get(): T;

  /**
   * Check if value has been computed.
   */
  isComputed(): boolean;

  /**
   * Force computation.
   */
  force(): void;
}
```

## Testing Strategy

### 1. Unit Tests

```typescript
describe("TemplateContext", () => {
  describe("resolve", () => {
    it("should resolve variable in current scope", () => {
      // Test direct resolution
    });

    it("should fall back to parent scope", () => {
      // Test scope chain traversal
    });

    it("should handle array element scope", () => {
      // Test {@items} context resolution
    });

    it("should apply fallback policy correctly", () => {
      // Test each fallback policy type
    });
  });

  describe("enterArray", () => {
    it("should create array context with element scopes", () => {
      // Test array expansion setup
    });

    it("should provide iteration metadata", () => {
      // Test $index, $first, $last variables
    });
  });
});
```

### 2. Integration Tests

```typescript
describe("Template processing with context", () => {
  it("should process nested arrays with proper scoping", () => {
    const ir = buildTestIR({
      users: [
        { name: "Alice", posts: [{ title: "Post 1" }] },
        { name: "Bob", posts: [{ title: "Post 2" }] },
      ],
    });

    const template = "{@users}{name}: {@posts}{title}{/@posts}{/@users}";

    const result = processWithContext(template, ir);
    expect(result).toBe("Alice: Post 1\nBob: Post 2");
  });
});
```

## Configuration Examples

### 1. Development Configuration

```typescript
const devConfig: ContextConfiguration = {
  fallbackPolicy: { kind: "preserve" }, // Keep placeholders visible
  verbosityMode: "debug", // Full debugging
  maxScopeDepth: 100, // Deep nesting allowed
  enableCaching: false, // Fresh resolution each time
};
```

### 2. Production Configuration

```typescript
const prodConfig: ContextConfiguration = {
  fallbackPolicy: { kind: "empty", value: "" }, // Silent failures
  verbosityMode: "silent", // Minimal output
  maxScopeDepth: 20, // Prevent deep recursion
  enableCaching: true, // Performance optimization
};
```

### 3. Strict Mode Configuration

```typescript
const strictConfig: ContextConfiguration = {
  fallbackPolicy: { kind: "error" }, // Fail on missing variables
  verbosityMode: "normal", // Standard errors
  maxScopeDepth: 50, // Reasonable depth
  enableCaching: true, // With validation
};
```

## Migration Strategy

### Phase 1: Context Implementation

- Implement core context interfaces
- Basic scope management
- Simple fallback policies

### Phase 2: Array Support

- Array context implementation
- Iteration metadata
- Nested array handling

### Phase 3: Integration

- Wire into template resolver
- Update variable replacement
- Maintain backward compatibility

### Phase 4: Optimization

- Implement caching
- Add lazy evaluation
- Performance tuning

## References

- [Intermediate Representation Architecture](../domain/architecture/domain-architecture-intermediate-representation.md)
- [Template Processing Specification](./template-processing-specification.md)
- [Variable Resolution Roadmap](./template-variable-resolution-roadmap.md)
