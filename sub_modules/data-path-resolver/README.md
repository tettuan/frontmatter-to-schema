# Data Path Resolver

A TypeScript/Deno module for resolving path expressions in data structures with advanced array expansion support. This module provides dot notation, array indexing, and array expansion (`items[]`) for efficient data extraction from complex nested structures.

## Features

- **Dot Notation**: Access nested objects with `user.profile.name`
- **Array Indexing**: Access specific elements with `items[0]`
- **Array Expansion**: Collect from all elements with `items[].name`
- **Double Expansion**: Flatten nested arrays with `articles[].tags[]`
- **Type Safety**: Full TypeScript support with `Result<T, E>` pattern
- **Error Handling**: Comprehensive error codes with context for debugging
- **Totality Principle**: No exceptions thrown, all errors returned as values
- **Independence**: Zero dependencies on domain logic

## Installation

```bash
# Import directly in your Deno project
import { DataPathResolver } from "./sub_modules/data-path-resolver/mod.ts";
```

## Quick Start

### Basic Usage

```typescript
import { DataPathResolver } from "./sub_modules/data-path-resolver/mod.ts";

const data = {
  user: {
    name: "Alice",
    profile: {
      email: "alice@example.com"
    }
  },
  items: ["apple", "banana", "cherry"]
};

const resolver = new DataPathResolver(data);

// Simple property access
const nameResult = resolver.resolve("user.name");
if (nameResult.isOk()) {
  console.log(nameResult.unwrap()); // "Alice"
}

// Array index access
const itemResult = resolver.resolve("items[0]");
console.log(itemResult.unwrap()); // "apple"

// Check if path exists
if (resolver.exists("user.profile.email")) {
  console.log("Email exists!");
}
```

### Array Expansion

```typescript
const data = {
  users: [
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 }
  ]
};

const resolver = new DataPathResolver(data);

// Collect property from all array elements
const names = resolver.resolve("users[].name");
console.log(names.unwrap()); // ["Alice", "Bob"]

// Use resolveAsArray for guaranteed array result
const agesResult = resolver.resolveAsArray("users[].age");
console.log(agesResult.unwrap()); // [30, 25]
```

### Double Expansion (Nested Arrays)

```typescript
const data = {
  articles: [
    { tags: ["AI", "ML"] },
    { tags: ["Web", "TypeScript"] }
  ]
};

const resolver = new DataPathResolver(data);

// Flatten nested arrays automatically
const allTags = resolver.resolve("articles[].tags[]");
console.log(allTags.unwrap()); // ["AI", "ML", "Web", "TypeScript"]
```

## API Reference

### DataPathResolver

Main class for path resolution.

```typescript
class DataPathResolver {
  constructor(data: unknown);

  resolve<T = unknown>(path: string): Result<T, PathError>;
  resolveAsArray<T = unknown>(path: string): Result<T[], PathError>;
  exists(path: string): boolean;
}
```

#### `resolve<T>(path: string): Result<T, PathError>`

Resolves a path expression to its value(s).

- **Parameters**: `path` - Path expression (e.g., `"items[].name"`)
- **Returns**: `Result<T, PathError>` containing the resolved value or error

**Behavior**:
- If path contains `[]`, returns array (even for single result)
- If path doesn't contain `[]`, returns single value
- If path doesn't exist, returns `PathNotFoundError`

#### `resolveAsArray<T>(path: string): Result<T[], PathError>`

Resolves a path and ensures the result is an array.

- **Parameters**: `path` - Path expression
- **Returns**: `Result<T[], PathError>` containing an array (empty if nothing found)

**Behavior**:
- `"items[].name"` → returns array as-is
- `"user.name"` → wraps in array: `[value]`
- Non-existent path → returns `[]` (empty array)

#### `exists(path: string): boolean`

Checks if a path exists in the data.

- **Parameters**: `path` - Path expression to check
- **Returns**: `true` if path resolves successfully

## Path Syntax

### Supported Notations

| Notation | Example | Description | Return Type |
|----------|---------|-------------|-------------|
| **Dot Notation** | `user.profile.name` | Nested property access | Single value |
| **Array Index** | `items[0]` | Specific element access | Single value |
| **Array Expansion** | `items[]` | Collect all elements | Array |
| **Property Expansion** | `items[].name` | Collect property from each element | Array |
| **Double Expansion** | `items[].tags[]` | Flatten nested arrays | Array |
| **Complex Path** | `tools.commands[].options.input[0]` | Combined operations | Value (type varies) |

### Expansion Rules

```typescript
// Rule 1: [] expects an array
"items[]"         // Error if items is not an array

// Rule 2: [] always returns an array
"items[].name"    // Always returns array (even if single element)

// Rule 3: Double [] performs deep flattening
"items[].tags[]"  // [[A,B], [C]] → [A,B,C]

// Rule 4: Without [], returns single value
"items[0].name"   // Returns single value, not array

// Rule 5: Missing elements are skipped
"items[].name"    // Skips elements without 'name' property
```

## Error Handling

The module uses the `Result<T, E>` pattern for error handling:

```typescript
const result = resolver.resolve("user.profile.name");

// Success case
if (result.isOk()) {
  const value = result.unwrap();
  console.log(value);
}

// Error case
if (result.isError()) {
  const error = result.unwrapError();
  console.error(`Error [${error.code}]: ${error.message}`);
  console.error(`Path: ${error.path}`);
}

// Pattern matching style
result.match({
  ok: (value) => console.log("Found:", value),
  error: (err) => console.error("Error:", err.message)
});
```

### Error Codes

| Error Code | Condition | Recommended Action |
|------------|-----------|-------------------|
| `PATH_NOT_FOUND` | Path doesn't exist | Use default value |
| `INVALID_PATH_SYNTAX` | Invalid path syntax | Report validation error |
| `INVALID_STRUCTURE` | Invalid data structure | Report data validation error |
| `ARRAY_EXPECTED` | Expected array but got different type | Report schema definition error |
| `INDEX_OUT_OF_BOUNDS` | Index out of range | Treat as `PATH_NOT_FOUND` |

## Use Cases

### 1. x-derived-from Directive Processing

```typescript
import { DataPathResolver } from "./sub_modules/data-path-resolver/mod.ts";

function extractValuesFromPath(
  data: Record<string, unknown>,
  path: string
): Result<string[], ProcessingError> {
  const resolver = new DataPathResolver(data);
  const result = resolver.resolveAsArray<unknown>(path);

  if (result.isError()) {
    return Result.error(new ProcessingError(
      `Failed to resolve path '${path}'`,
      "PATH_RESOLUTION_ERROR"
    ));
  }

  // Convert to strings as required by x-derived-from
  const values = result.unwrap().map(v => String(v));
  return Result.ok(values);
}
```

### 2. Template Variable Resolution

```typescript
import { DataPathResolver } from "./sub_modules/data-path-resolver/mod.ts";

class TemplateVariableResolver {
  private resolver: DataPathResolver;

  constructor(data: Record<string, unknown>) {
    this.resolver = new DataPathResolver(data);
  }

  resolve(path: string): Result<unknown, TemplateError> {
    const result = this.resolver.resolve(path);

    if (result.isError()) {
      return Result.error(new TemplateError(
        `Variable not found: ${path}`,
        "VARIABLE_NOT_FOUND"
      ));
    }

    return Result.ok(result.unwrap());
  }
}
```

### 3. YAML Array Flattening (Issue #1217)

```typescript
const data = {
  articles: [
    { topics: ["AI", "Cursor"] },
    { topics: ["Claude"] }
  ]
};

const resolver = new DataPathResolver(data);

// Use double expansion to flatten
const result = resolver.resolve("articles[].topics[]");
console.log(result.unwrap()); // ["AI", "Cursor", "Claude"]
```

## Development

### Running Tests

```bash
# Run all tests
deno task test

# Run with coverage
deno task test:coverage

# Watch mode
deno task test:watch
```

### Code Quality

```bash
# Lint code
deno task lint

# Format code
deno task fmt

# Type check
deno task check
```

## Examples

See the `tests/` directory for comprehensive usage examples:

- `tests/data-path-resolver_test.ts` - Basic path resolution
- `tests/array-expansion_test.ts` - Array expansion examples
- `tests/error-handling_test.ts` - Error handling patterns
- `tests/edge-cases_test.ts` - Edge cases and performance tests

## Performance

- **Throughput**: 1,000+ operations per second
- **Latency**: <1ms for simple paths (≤3 levels)
- **Memory**: No caching in initial implementation (YAGNI principle)

## Limitations

- **Read-only**: Data modification is not supported
- **No Circular Reference Detection**: Assumes acyclic data structures
- **No Advanced Queries**: No regex, XPath, or JSONPath-like features
- **JSON-compatible Types Only**: Functions and symbols are not supported

## Documentation

- **requirements.ja.md**: Requirements specification (Japanese)
- **architecture.ja.md**: Architecture design (Japanese)
- **API.md**: Complete API reference (English)

## License

MIT License - see LICENSE file for details.

## Contributing

1. Create a branch with prefix `sub_module/data-path-resolver/`
2. Add tests for your changes
3. Ensure all tests pass (`deno task test`)
4. Ensure coverage ≥ 90% (`deno task test:coverage`)
5. Submit a pull request

Please ensure your code follows the existing style and adheres to the Totality principle (no exceptions, use `Result<T, E>`).
