# YAML Schema Mapper

A standalone, generic module for transforming raw YAML frontmatter data into
schema-compliant data structures.

## Features

- **Property Name Mapping**: Maps property names using exact match,
  case-insensitive, heuristics, and custom `x-map-from` directives
- **Type Coercion**: Safe type conversions with ambiguous value preservation
  (see [Type Coercion Policy](./docs/type-coercion-policy.md))
- **Warning System**: Detailed warnings for all transformations and preserved
  values
- **Union Type Support**: Handles multiple type possibilities
- **Nested Object Handling**: Recursively processes nested objects and arrays
- **Zero Dependencies**: Completely standalone, no parent project dependencies

**Note**: This mapper focuses on **data transformation**, not strict validation.
For validation requirements, use application-level checks or future schema
directives.

## Installation

```bash
deno add @frontmatter-to-schema/yaml-schema-mapper
```

## Usage

### Basic Example

```typescript
import { mapDataToSchema } from "@frontmatter-to-schema/yaml-schema-mapper";

const result = mapDataToSchema({
  schema: {
    type: "object",
    properties: {
      input_file: {
        type: "boolean",
        "x-map-from": "file",
      },
      stdin: {
        type: "boolean",
      },
    },
  },
  data: {
    file: [false],
    stdin: [true],
  },
  options: {
    coerceTypes: true,
  },
});

if (result.isOk()) {
  const mapped = result.unwrap();
  console.log(mapped.data);
  // Output: { input_file: false, stdin: true }

  console.log(mapped.warnings);
  // Output: [{code: "TYPE_COERCION", message: "Array coerced to boolean (first element)", ...}]
}
```

### Property Name Mapping

The mapper supports multiple strategies for mapping property names:

1. **Exact match** (highest priority)
2. **x-map-from directive** (explicit mapping)
3. **Case-insensitive match**
4. **Heuristic matching** (snake_case ↔ camelCase ↔ kebab-case ↔ PascalCase)

```typescript
// Example: Heuristic matching
const result = mapDataToSchema({
  schema: {
    properties: {
      fileName: { type: "string" },
    },
  },
  data: {
    file_name: "test.txt", // Automatically mapped to fileName
  },
});
```

### Type Coercion

The mapper applies **safe type conversions** by default while **preserving
ambiguous values**:

```typescript
// Single-element array unwrapping (safe)
const result1 = mapDataToSchema({
  schema: {
    properties: {
      enabled: { type: "boolean" },
    },
  },
  data: {
    enabled: [true], // Coerced to: true
  },
});

// String to number parsing (safe)
const result2 = mapDataToSchema({
  schema: {
    properties: {
      count: { type: "number" },
    },
  },
  data: {
    count: "42", // Coerced to: 42
  },
});

// Boolean string parsing (safe - "true"/"false" only)
const result3 = mapDataToSchema({
  schema: {
    properties: {
      active: { type: "boolean" },
    },
  },
  data: {
    active: "true", // Coerced to: true
  },
});

// Multi-element array preservation (ambiguous)
const result4 = mapDataToSchema({
  schema: {
    properties: {
      value: { type: "boolean" },
    },
  },
  data: {
    value: [true, false], // Preserved as-is with warning
  },
});

// Invalid string preservation (cannot parse)
const result5 = mapDataToSchema({
  schema: {
    properties: {
      count: { type: "integer" },
    },
  },
  data: {
    count: "abc123", // Preserved as-is with warning
  },
});
```

**See [Type Coercion Policy](./docs/type-coercion-policy.md) for detailed
conversion rules and configuration options.**

### Fallback Mapping

```typescript
const result = mapDataToSchema({
  schema: {
    properties: {
      displayName: {
        type: "string",
        "x-map-from": ["fullName", "name", "userName"], // Try in order
      },
    },
  },
  data: {
    name: "John", // Uses "name" since "fullName" not available
  },
});
```

### Nested Objects

```typescript
const result = mapDataToSchema({
  schema: {
    properties: {
      options: {
        type: "object",
        properties: {
          input_file: {
            type: "boolean",
            "x-map-from": "file",
          },
        },
      },
    },
  },
  data: {
    options: {
      file: [false],
    },
  },
});
// Result: { options: { input_file: false } }
```

### Array of Objects

```typescript
const result = mapDataToSchema({
  schema: {
    properties: {
      commands: {
        type: "array",
        items: {
          type: "object",
          properties: {
            command: {
              type: "string",
              "x-map-from": "cmd",
            },
          },
        },
      },
    },
  },
  data: {
    commands: [
      { cmd: "git" },
      { cmd: "npm" },
    ],
  },
});
```

## Configuration Options

```typescript
interface MapperOptions {
  strict?: boolean; // Reject additional properties (default: false)
  coerceTypes?: boolean; // Apply safe type coercion (default: true)

  // Type coercion policy (see docs/type-coercion-policy.md)
  allowSafeConversions?: boolean; // Safe conversions (default: true)
  allowSemanticConversions?: boolean; // Semantic conversions (default: false)
  semanticConversionRules?: string[]; // Whitelist for semantic conversions
  invalidConversionAction?: "preserve" | "error" | "fallback"; // Default: "preserve"

  maxDepth?: number; // Maximum nesting depth (default: 20)
  warnOnCoercion?: boolean; // Warn on type coercions (default: true)
  logLevel?: "debug" | "warn" | "error" | "silent"; // Default: "warn"
  unicodeNormalization?: "NFC" | "NFD" | "none"; // Unicode normalization (default: "none")
}
```

**See [Type Coercion Policy](./docs/type-coercion-policy.md) for detailed
configuration examples and conversion rules.**

### Configuration Examples

#### Example 1: Default Behavior (Safe + Preserve)

```typescript
const result = mapDataToSchema({
  schema: {
    properties: {
      enabled: { type: "boolean" },
      count: { type: "integer" }
    }
  },
  data: {
    enabled: [true],      // Safe: [true] → true
    count: [1, 2, 3]      // Ambiguous: preserved with warning
  }
  // No options needed - uses safe defaults
});

// Result:
// { enabled: true, count: [1, 2, 3] }
// Warnings: TYPE_COERCION for enabled, AMBIGUOUS_CONVERSION for count
```

#### Example 2: Strict Mode (Error on Ambiguous)

```typescript
const result = mapDataToSchema({
  schema: {
    properties: {
      value: { type: "boolean" }
    }
  },
  data: {
    value: [true, false]
  },
  options: {
    invalidConversionAction: "error"  // Reject ambiguous conversions
  }
});

// Result: error severity warning
```

#### Example 3: Semantic Conversions (Data Migration)

```typescript
const result = mapDataToSchema({
  schema: {
    properties: {
      name: { type: "string" },
      active: { type: "boolean" },
      score: { type: "integer" }
    }
  },
  data: {
    name: null,
    active: 1,
    score: true
  },
  options: {
    allowSemanticConversions: true,
    semanticConversionRules: [
      "null-to-empty-string",
      "number-to-boolean",
      "boolean-to-number"
    ]
  }
});

// Result:
// { name: "", active: true, score: 1 }
```

#### Example 4: Fallback Mode (Use Default Values)

```typescript
const result = mapDataToSchema({
  schema: {
    properties: {
      value: { type: "boolean" },
      count: { type: "integer" }
    }
  },
  data: {
    value: [true, false],
    count: 3.14
  },
  options: {
    invalidConversionAction: "fallback"  // Use type defaults
  }
});

// Result:
// { value: false, count: 3 }  // boolean default, truncated integer
```

#### Example 5: Silent Mode (Suppress Warnings)

```typescript
const result = mapDataToSchema({
  schema: {
    properties: {
      value: { type: "boolean" }
    }
  },
  data: {
    value: [true]
  },
  options: {
    warnOnCoercion: false,
    logLevel: "silent"
  }
});

// Result: { value: true }
// No warnings
```

## Warning System

The mapper provides detailed warnings for non-fatal issues:

```typescript
const result = mapDataToSchema({
  schema: {
    properties: {
      count: { type: "integer" },
    },
  },
  data: {
    count: 42.7,
  },
});

// Warning example:
// {
//   code: "PRECISION_LOSS",
//   message: "Precision loss: count (42.7 → 42)",
//   path: "count",
//   severity: "warning",
//   details: {
//     originalValue: 42.7,
//     transformedValue: 42,
//     suggestion: "Use integer values if precision is important"
//   }
// }
```

### Warning Codes

- **Property mapping**: `PROPERTY_AMBIGUOUS`, `PROPERTY_NOT_IN_SCHEMA`,
  `EMOJI_PROPERTY`, `UNICODE_NORMALIZATION`, `EMPTY_PROPERTY_NAME`
- **Type transformation**: `TYPE_COERCION`, `DATA_LOSS`, `PRECISION_LOSS`,
  `NAN_CONVERSION`
- **Structure**: `DEPTH_LIMIT`, `CIRCULAR_REFERENCE`
- **Validation**: `ADDITIONAL_PROPERTY`

## Validation

The mapper validates data against JSON Schema constraints:

```typescript
// Required properties
const result1 = mapDataToSchema({
  schema: {
    properties: {
      title: { type: "string" },
    },
    required: ["title"],
  },
  data: {},
});
// Warning: Missing required property: title

// Enum validation
const result2 = mapDataToSchema({
  schema: {
    properties: {
      status: {
        type: "string",
        enum: ["active", "inactive"],
      },
    },
  },
  data: {
    status: "invalid",
  },
});
// Warning: Invalid enum value

// Pattern (regex) validation
const result3 = mapDataToSchema({
  schema: {
    properties: {
      email: {
        type: "string",
        pattern: "^[a-z]+@[a-z]+\\.[a-z]+$",
      },
    },
  },
  data: {
    email: "invalid-email",
  },
});
// Warning: Pattern validation failed
```

## Error Handling

The module uses the Result pattern for total error handling:

```typescript
const result = mapDataToSchema(config);

if (result.isOk()) {
  const { data, warnings, metadata } = result.unwrap();
  // Handle success
} else {
  const error = result.unwrapError();
  console.error(error.message, error.code, error.path);
  // Handle error
}
```

## Metadata

Transformation metadata is provided in the result:

```typescript
interface TransformationMetadata {
  propertiesMapped: number; // Number of properties successfully mapped
  typesCoerced: number; // Number of type coercions applied
  propertiesDropped: number; // Number of properties dropped (strict mode)
}
```

## Non-Goals

The following are explicitly NOT supported (require explicit `x-map-from`):

- Automatic prefix stripping (`_id` → `id`)
- Namespace stripping (`meta:title` → `title`)
- Abbreviation expansion (`desc` → `description`)
- Plural/singular conversion (`tags` → `tag`)
- Hex/octal/binary string parsing

## Development

```bash
# Run tests
deno task test

# Run tests with coverage
deno task test:coverage

# Generate coverage report
deno task coverage
```

## License

MIT
