# Type Coercion Policy

**Version**: 1.0 **Last Updated**: 2025-10-05

## Overview

This document defines the type coercion policy for yaml-schema-mapper. The
policy is designed to balance **data integrity** (preventing data loss) with
**flexibility** (accepting common data format variations).

## Core Principles

### 1. Safe-by-Default with Preservation

- **Safe conversions are applied automatically** (e.g., `[true]` → `true`,
  `"42"` → `42`)
- **Ambiguous or lossy conversions preserve original values** (e.g.,
  `[true, false]` remains as-is)
- **Data validation is the responsibility of the application layer**, not this
  mapper

### 2. Transparency Through Logging

- All type coercions generate warning logs
- Preserved values (due to ambiguity) generate warning logs
- Logs include: path, schema type, input type, input value, output value,
  strategy

### 3. Configurability

- Default behavior is "safe + preserve"
- Applications can opt into stricter validation via configuration
- Future schema directives (e.g., `x-strict-value`) can enforce validation at
  schema level

## Type Conversion Layers

### Layer 1: Safe Conversions (Always Applied)

These conversions are **lossless** and **semantically clear**:

| From                 | To             | Example           | Strategy              |
| -------------------- | -------------- | ----------------- | --------------------- |
| Single-element array | Scalar         | `[true]` → `true` | `array-unwrap`        |
| Numeric string       | number/integer | `"42"` → `42`     | `string-to-number`    |
| Boolean string       | boolean        | `"true"` → `true` | `string-to-boolean`   |
| Primitive            | string         | `42` → `"42"`     | `primitive-to-string` |

**Configuration:**

```typescript
{
  allowSafeConversions: true; // Default
}
```

**Examples:**

```typescript
// Single-element array unwrapping
Schema: { type: "boolean" }
Input:  { value: [true] }
Output: { value: true }
Log:    [WARN] Array unwrapped to boolean at path "value"

// Numeric string parsing
Schema: { type: "number" }
Input:  { count: "42" }
Output: { count: 42 }
Log:    [WARN] String parsed to number at path "count"

// Boolean string parsing
Schema: { type: "boolean" }
Input:  { active: "true" }
Output: { active: true }
Log:    [WARN] String parsed to boolean at path "active"
```

### Layer 2: Semantic Conversions (Optional, Disabled by Default)

These conversions **change semantic meaning** but are commonly accepted:

| From           | To      | Example       | Strategy               | Risk     |
| -------------- | ------- | ------------- | ---------------------- | -------- |
| null/undefined | string  | `null` → `""` | `null-to-empty-string` | Semantic |
| boolean        | number  | `true` → `1`  | `boolean-to-number`    | Semantic |
| null           | array   | `null` → `[]` | `null-to-empty-array`  | Semantic |
| 0/1            | boolean | `1` → `true`  | `number-to-boolean`    | Semantic |

**Configuration:**

```typescript
{
  allowSemanticConversions: false,  // Default
  semanticConversionRules: [        // Whitelist when enabled
    'null-to-empty-string',
    'boolean-to-number'
  ]
}
```

**Examples:**

```typescript
// Null to empty string (when enabled)
Schema: { type: "string" }
Input:  { name: null }
Output: { name: "" }
Log:    [WARN] Null coerced to empty string at path "name"

// Boolean to number (when enabled)
Schema: { type: "integer" }
Input:  { flag: true }
Output: { flag: 1 }
Log:    [WARN] Boolean coerced to number at path "flag"
```

### Layer 3: Preservation Strategy (Default for Ambiguous Cases)

When conversion is **ambiguous or lossy**, the original value is **preserved**:

| From                | To           | Example                     | Action   | Reason                  |
| ------------------- | ------------ | --------------------------- | -------- | ----------------------- |
| Multi-element array | Scalar       | `[true, false]` → preserved | PRESERVE | Ambiguous which element |
| Non-numeric string  | number       | `"abc123"` → preserved      | PRESERVE | Cannot parse            |
| Float               | integer      | `3.14` → preserved          | PRESERVE | Precision loss          |
| Complex type        | Incompatible | `{}` → `boolean`            | PRESERVE | Type mismatch           |

**Configuration:**

```typescript
{
  invalidConversionAction: "preserve"; // Default: 'preserve' | 'error' | 'fallback'
}
```

**Examples:**

```typescript
// Multi-element array preservation
Schema: { type: "boolean" }
Input:  { value: [true, false] }
Output: { value: [true, false] }  // Preserved as-is
Log:    [WARN] Multi-element array cannot be unwrapped to boolean at path "value"

// Invalid string preservation
Schema: { type: "integer" }
Input:  { count: "abc123" }
Output: { count: "abc123" }  // Preserved as-is
Log:    [WARN] Cannot parse string to integer at path "count"

// Float to integer preservation
Schema: { type: "integer" }
Input:  { value: 3.14 }
Output: { value: 3.14 }  // Preserved as-is
Log:    [WARN] Float value preserved (precision loss if truncated) at path "value"
```

## Conversion Safety Matrix

| Schema Type | Input Type | Input Value    | Conversion | Safety    | Output         | Default Action             |
| ----------- | ---------- | -------------- | ---------- | --------- | -------------- | -------------------------- |
| boolean     | array[1]   | `[true]`       | unwrap     | SAFE      | `true`         | ✅ Convert                 |
| boolean     | array[2+]  | `[true,false]` | N/A        | AMBIGUOUS | `[true,false]` | ⚠️ Preserve                |
| boolean     | string     | `"true"`       | parse      | SAFE      | `true`         | ✅ Convert                 |
| boolean     | string     | `"yes"`        | N/A        | AMBIGUOUS | `"yes"`        | ⚠️ Preserve                |
| boolean     | number     | `1`            | semantic   | SEMANTIC  | `true`         | ⚠️ Preserve (needs opt-in) |
| integer     | string     | `"42"`         | parse      | SAFE      | `42`           | ✅ Convert                 |
| integer     | string     | `"abc123"`     | N/A        | INVALID   | `"abc123"`     | ⚠️ Preserve                |
| integer     | number     | `3.14`         | truncate   | LOSSY     | `3.14`         | ⚠️ Preserve                |
| integer     | boolean    | `true`         | semantic   | SEMANTIC  | `true`         | ⚠️ Preserve (needs opt-in) |
| string      | number     | `42`           | stringify  | SAFE      | `"42"`         | ✅ Convert                 |
| string      | null       | `null`         | semantic   | SEMANTIC  | `null`         | ⚠️ Preserve (needs opt-in) |
| number      | string     | `"42"`         | parse      | SAFE      | `42`           | ✅ Convert                 |
| number      | boolean    | `true`         | semantic   | SEMANTIC  | `true`         | ⚠️ Preserve (needs opt-in) |
| array       | scalar     | `"text"`       | wrap       | SAFE      | `["text"]`     | ✅ Convert                 |
| array       | null       | `null`         | semantic   | SEMANTIC  | `null`         | ⚠️ Preserve (needs opt-in) |

## Configuration Options

### Default Configuration (Recommended)

```typescript
{
  // Layer 1: Safe conversions
  allowSafeConversions: true,

  // Layer 2: Semantic conversions
  allowSemanticConversions: false,
  semanticConversionRules: [],

  // Layer 3: Preservation
  invalidConversionAction: 'preserve',  // 'preserve' | 'error' | 'fallback'

  // Logging
  warnOnCoercion: true,
  logLevel: 'warn'  // 'debug' | 'warn' | 'error' | 'silent'
}
```

### Strict Configuration (Validation-Heavy Applications)

```typescript
{
  allowSafeConversions: true,
  allowSemanticConversions: false,
  invalidConversionAction: 'error',  // Throw errors instead of preserving
  warnOnCoercion: true,
  logLevel: 'error'
}
```

### Lenient Configuration (Legacy Data Migration)

```typescript
{
  allowSafeConversions: true,
  allowSemanticConversions: true,
  semanticConversionRules: [
    'null-to-empty-string',
    'boolean-to-number',
    'number-to-boolean',
    'null-to-empty-array'
  ],
  invalidConversionAction: 'preserve',
  warnOnCoercion: true,
  logLevel: 'warn'
}
```

## Logging Format

### Warning Log Example

```
[yaml-schema-mapper WARN] Type coercion applied
  Path: options.input_file
  Schema type: boolean
  Input type: array (single-element)
  Input value: [true]
  Output value: true
  Strategy: array-unwrap
  Recommendation: Adjust source data to match schema type
```

### Error Log Example (Strict Mode)

```
[yaml-schema-mapper ERROR] Type coercion failed
  Path: options.input_file
  Schema type: boolean
  Input type: array (multi-element)
  Input value: [true, false]
  Reason: Ambiguous - cannot determine which element to use
  Action: Rejected (strict mode enabled)
```

### Preservation Log Example

```
[yaml-schema-mapper WARN] Value preserved (conversion ambiguous)
  Path: options.count
  Schema type: integer
  Input type: string
  Input value: "abc123"
  Reason: Cannot parse non-numeric string to integer
  Action: Preserved as-is
  Recommendation: Fix source data or enable semantic conversion
```

## Validation Responsibility

**yaml-schema-mapper is NOT responsible for strict data validation.**

### What yaml-schema-mapper DOES:

- ✅ Apply safe type conversions
- ✅ Preserve ambiguous values with warnings
- ✅ Log all transformations for transparency
- ✅ Provide configuration options for different use cases

### What yaml-schema-mapper DOES NOT DO:

- ❌ Enforce strict type validation by default
- ❌ Throw errors for type mismatches (unless configured)
- ❌ Make decisions about which element to select from multi-element arrays

### Application Layer Responsibility

Applications using yaml-schema-mapper should implement validation logic if
needed:

**Option 1: Post-processing validation**

```typescript
const result = mapDataToSchema({ schema, data, options });

if (result.isOk()) {
  const { data: mappedData, warnings } = result.unwrap();

  // Application-level validation
  for (const warning of warnings) {
    if (warning.code === "TYPE_COERCION") {
      // Decide: accept, reject, or prompt user
    }
  }
}
```

**Option 2: Schema directive (future enhancement)**

```json
{
  "properties": {
    "count": {
      "type": "integer",
      "x-strict-value": true // Reject non-integer values
    }
  }
}
```

**Option 3: Strict configuration**

```typescript
const result = mapDataToSchema({
  schema,
  data,
  options: {
    invalidConversionAction: "error", // Throw errors instead of preserving
  },
});
```

## Decision Log

### Decision 1: Default to Preserve (Not Error)

- **Rationale**: Prevents data loss; allows applications to handle validation
- **Trade-off**: Schema violations may propagate downstream
- **Mitigation**: Comprehensive warning logs; optional strict mode

### Decision 2: Single-Element Array Unwrapping is Safe

- **Rationale**: Common pattern in YAML/JSON processing; follows Postel's Law
- **Evidence**: 39% of patterns in analysis required safe conversions
- **Condition**: Only for scalar schema types; with warning log

### Decision 3: Multi-Element Array Preservation

- **Rationale**: Ambiguous which element to select; prevents unexpected data
  loss
- **Alternative**: Could use first element with warning (opt-in via config)
- **Recommendation**: Fix source data or use array schema type

### Decision 4: Semantic Conversions Require Opt-In

- **Rationale**: Changes semantic meaning (e.g., `null` → `""`, `true` → `1`)
- **Risk**: May mask data quality issues
- **Use Case**: Legacy data migration, specific application requirements

### Decision 5: No "yes"/"no" Boolean Parsing by Default

- **Rationale**: Language-dependent; ambiguous in international contexts
- **Alternative**: Applications can implement via custom preprocessing
- **Strict parsing**: Only `"true"` and `"false"` (case-insensitive)

## Examples

### Example 1: Issue #1310 Resolution

**Input:**

```json
{
  "schema": {
    "properties": {
      "input_file": { "type": "boolean", "x-map-from": "file" }
    }
  },
  "data": {
    "file": [true]
  }
}
```

**Output (Default Configuration):**

```json
{
  "data": {
    "input_file": true
  },
  "warnings": [
    {
      "code": "TYPE_COERCION",
      "message": "Single-element array unwrapped to boolean",
      "path": "input_file",
      "details": {
        "inputValue": [true],
        "outputValue": true,
        "strategy": "array-unwrap"
      }
    }
  ]
}
```

### Example 2: Multi-Element Array Preservation

**Input:**

```json
{
  "schema": {
    "properties": {
      "value": { "type": "boolean" }
    }
  },
  "data": {
    "value": [true, false]
  }
}
```

**Output (Default Configuration):**

```json
{
  "data": {
    "value": [true, false]
  },
  "warnings": [
    {
      "code": "AMBIGUOUS_CONVERSION",
      "message": "Multi-element array cannot be unwrapped to boolean",
      "path": "value",
      "details": {
        "inputValue": [true, false],
        "outputValue": [true, false],
        "reason": "Ambiguous which element to select",
        "recommendation": "Fix source data or change schema type to array"
      }
    }
  ]
}
```

### Example 3: Invalid String Preservation

**Input:**

```json
{
  "schema": {
    "properties": {
      "count": { "type": "integer" }
    }
  },
  "data": {
    "count": "abc123"
  }
}
```

**Output (Default Configuration):**

```json
{
  "data": {
    "count": "abc123"
  },
  "warnings": [
    {
      "code": "INVALID_CONVERSION",
      "message": "Cannot parse non-numeric string to integer",
      "path": "count",
      "details": {
        "inputValue": "abc123",
        "outputValue": "abc123",
        "reason": "String does not represent a valid number",
        "recommendation": "Fix source data or change schema type to string"
      }
    }
  ]
}
```

## Implementation Checklist

- [ ] Implement safe conversions (Layer 1)
  - [ ] Single-element array unwrapping
  - [ ] Numeric string parsing
  - [ ] Boolean string parsing (`"true"`/`"false"` only)
  - [ ] Primitive to string conversion
- [ ] Implement preservation strategy (Layer 3)
  - [ ] Multi-element array preservation
  - [ ] Invalid string preservation
  - [ ] Float to integer preservation
  - [ ] Complex type preservation
- [ ] Implement semantic conversions (Layer 2, opt-in)
  - [ ] Null to empty string
  - [ ] Boolean to number
  - [ ] Number to boolean (0/1 only)
  - [ ] Null to empty array
- [ ] Implement configuration options
  - [ ] `allowSafeConversions`
  - [ ] `allowSemanticConversions`
  - [ ] `semanticConversionRules`
  - [ ] `invalidConversionAction`
  - [ ] `warnOnCoercion`
  - [ ] `logLevel`
- [ ] Implement comprehensive logging
  - [ ] Warning logs for all coercions
  - [ ] Error logs for strict mode
  - [ ] Preservation logs for ambiguous cases
  - [ ] Include path, types, values, strategy, recommendations
- [ ] Add test coverage
  - [ ] Safe conversions (10+ test cases)
  - [ ] Preservation cases (10+ test cases)
  - [ ] Semantic conversions (6+ test cases)
  - [ ] Configuration options (5+ test cases)
  - [ ] Error handling (strict mode, 5+ test cases)
- [ ] Update documentation
  - [ ] README.md examples
  - [ ] API documentation
  - [ ] Migration guide from current behavior

## References

- **Issue #1310**: Template variables wrapped in arrays
- **Pattern Analysis**: `/tmp/type-coercion-patterns.json` (100 patterns)
- **Requirements Document**: `/tmp/type-coercion-requirements.md`
- **Postel's Law**: "Be liberal in what you accept, be conservative in what you
  send"
- **Total Functions**: Prefer Result types over exceptions for error handling

## Version History

- **1.0 (2025-10-05)**: Initial policy definition
  - Established safe/semantic/preservation layers
  - Default: safe conversions + preservation
  - Validation responsibility delegated to applications
