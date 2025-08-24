# Totality Principle: Type-Safe Code Design Guidelines

## Core Philosophy

**Convert partial functions to total functions** and eliminate "impossible
states" using the type system.

## Basic Patterns

### Pattern 1: Discriminated Union

```typescript
// ❌ Bad: Representing state with optional properties
interface BadState {
  a?: X;
  b?: Y;
}

// ✅ Good: Representing state with tagged unions
type GoodState = { kind: "A"; data: X } | { kind: "B"; data: Y };
```

### Pattern 2: Smart Constructor

```typescript
// ❌ Bad: Allowing unrestricted values
type Rate = number;

// ❌ Bad: Expressing constraints with enum values
enum LayerType {
  PROJECT = "project",
  ISSUE = "issue",
  TASK = "task",
}

// ✅ Good: Constrained value type
class ValidRate {
  private constructor(readonly value: number) {}
  static create(
    n: number,
  ): Result<ValidRate, ValidationError & { message: string }> {
    if (0 <= n && n <= 1) {
      return { ok: true, data: new ValidRate(n) };
    }
    return {
      ok: false,
      error: createError({ kind: "OutOfRange", value: n, min: 0, max: 1 }),
    };
  }
}

// ✅ Good: Expressing constraints with configuration rules
class LayerTypePattern {
  private constructor(readonly pattern: RegExp) {}
  static create(
    patternString: string,
  ): Result<LayerTypePattern, ValidationError & { message: string }> {
    try {
      return {
        ok: true,
        data: new LayerTypePattern(new RegExp(patternString)),
      };
    } catch {
      return {
        ok: false,
        error: createError({ kind: "InvalidRegex", pattern: patternString }),
      };
    }
  }
  test(value: string): boolean {
    return this.pattern.test(value);
  }
}

class LayerType {
  private constructor(readonly value: string) {}
  static create(
    value: string,
    pattern: LayerTypePattern,
  ): Result<LayerType, ValidationError & { message: string }> {
    if (pattern.test(value)) {
      return { ok: true, data: new LayerType(value) };
    }
    return {
      ok: false,
      error: createError({
        kind: "PatternMismatch",
        value,
        pattern: pattern.pattern.source,
      }),
    };
  }
  getValue(): string {
    return this.value;
  }
}
```

### Pattern 3: Error Value Conversion with Result Type

```typescript
type Result<T, E> = { ok: true; data: T } | { ok: false; error: E };

// Common error type definition
type ValidationError =
  | { kind: "OutOfRange"; value: unknown; min?: number; max?: number }
  | { kind: "InvalidRegex"; pattern: string }
  | { kind: "PatternMismatch"; value: string; pattern: string }
  | { kind: "ParseError"; input: string }
  | { kind: "EmptyInput" }
  | { kind: "TooLong"; value: string; maxLength: number };

// Error creation helper
const createError = (
  error: ValidationError,
  customMessage?: string,
): ValidationError & { message: string } => ({
  ...error,
  message: customMessage || getDefaultMessage(error),
});

const getDefaultMessage = (error: ValidationError): string => {
  switch (error.kind) {
    case "OutOfRange":
      return `Value ${error.value} is out of range ${error.min ?? "?"}-${
        error.max ?? "?"
      }`;
    case "InvalidRegex":
      return `Invalid regex pattern: ${error.pattern}`;
    case "PatternMismatch":
      return `Value "${error.value}" does not match pattern ${error.pattern}`;
    case "ParseError":
      return `Cannot parse "${error.input}"`;
    case "EmptyInput":
      return "Input cannot be empty";
    case "TooLong":
      return `Value "${error.value}" exceeds maximum length of ${error.maxLength}`;
  }
};
```

## Human Design Perspective

### 🧠 Business Rule Analysis

Design perspectives that humans should clarify before applying totality:

1. **State enumeration**: List all "valid states" that data can take
2. **Transition definition**: Identify valid change patterns between states
3. **Constraint clarification**: Identify value ranges, combination
   restrictions, dependencies
4. **Exception cases**: Determine handling policies for error states, boundary
   values, and abnormal scenarios

### 📋 Business Rule Collection Template

Recommended format for presenting business rules to Claude:

```markdown
## Domain Rule Definition

### 1. Entity States

- **[Entity Name]** possible states:
  - State A: [conditions/description]
  - State B: [conditions/description]
  - ❌ Invalid state: [impossible combinations]

### 2. Value Constraints

- **[Property Name]**: [type] - [constraint conditions]
  - Example: `discount rate: number - between 0 and 1`
  - Example: `inventory count: number - non-negative integer`

### 3. State Transition Rules

- [State A] → [State B]: [transition condition]
- [State B] → [State C]: [transition condition]
- ❌ Prohibited transition: [State X] → [State Y]

### 4. Business Exceptions

- **Normal case**: [expected behavior]
- **Abnormal case**: [error condition] → [response method]
```

### Human-Defined Type Configuration List

- [`docs/breakdown/overview/totality-type.ja.yml`](./totality-type.ja.yml)

### Concrete Application Examples

- **Smart Constructor Implementation Example for LayerType and DirectiveType**
  (planned)
  - TYPE design is defined by domain-driven design
  - For detailed domain design, refer to [#file:domain_core](../../domain_core/)
  - Type safety implementation patterns in core domains

### Example Template

```markdown
## Discount System Rules

### 1. Discount States

- **Percentage discount**: Has discount rate (0-100%) and maximum amount
- **Fixed amount discount**: Has fixed amount
- ❌ Invalid state: Both discounts exist simultaneously, neither exists

### 2. Value Constraints

- **Discount rate**: number - between 0 and 1
- **Maximum amount**: number - 0 or greater
- **Fixed amount**: number - 0 or greater

### 3. Calculation Rules

- Percentage discount: min(product price × discount rate, maximum amount)
- Fixed amount discount: min(fixed amount, product price)
```

## Error Handling Compression Techniques

### 1. Common Error Type Usage

```typescript
// ❌ Redundant: Individual error types for each class
class A {
  static create(): Result<A, { kind: "AError"; message: string }>;
}
class B {
  static create(): Result<B, { kind: "BError"; message: string }>;
}

// ✅ Concise: Common error type
class A {
  static create(): Result<A, ValidationError & { message: string }>;
}
class B {
  static create(): Result<B, ValidationError & { message: string }>;
}
```

### 2. Error Creation Helper Usage

```typescript
// ❌ Redundant: Creating error objects every time
return {
  ok: false,
  error: { kind: "EmptyInput", message: "Input cannot be empty" },
};

// ✅ Concise: Using helper
return { ok: false, error: createError({ kind: "EmptyInput" }) };
```

### 3. Builder Pattern Usage

```typescript
// For complex validations
class ValidatedValue<T> {
  static builder<T>() {
    return new ValidationBuilder<T>();
  }
}

class ValidationBuilder<T> {
  private validators: Array<(input: T) => ValidationError | null> = [];

  notEmpty() {
    this.validators.push((input) => !input ? { kind: "EmptyInput" } : null);
    return this;
  }

  pattern(regex: RegExp) {
    this.validators.push((input) =>
      !regex.test(String(input))
        ? {
          kind: "PatternMismatch",
          value: String(input),
          pattern: regex.source,
        }
        : null
    );
    return this;
  }

  build(
    input: T,
  ): Result<ValidatedValue<T>, ValidationError & { message: string }> {
    for (const validator of this.validators) {
      const error = validator(input);
      if (error) return { ok: false, error: createError(error) };
    }
    return { ok: true, data: new ValidatedValue(input) };
  }
}

// Usage example
const result = ValidatedValue.builder<string>()
  .notEmpty()
  .pattern(/^[a-z]+$/)
  .build("test");
```

## Implementation Checklist

### 🚫 Prohibited Patterns

- Type coercion using `as Type`
- State representation with optional properties `{ a?: X; b?: Y }`
- Careless use of `any`/`unknown`
- Exception-based control flow

### ✅ Recommended Patterns

- Tagged unions: `{ kind: string; ... }`
- Result type: `{ ok: boolean; ... }`
- Smart Constructor: `private constructor + static create`
- Exhaustive branching with `switch` statements

## Step-by-Step Application Process

1. **Business rule collection**: Organize domain information using the template
   above
2. **Type definition modification**: Optional → Discriminated Union
3. **Return value modification**: `T | null` → `Result<T, E>`
4. **Branch modification**: `if (obj.prop)` → `switch (obj.kind)`
5. **Verification addition**: Confirm compiler's exhaustiveness checking

## Quality Indicators

- [ ] Business rules are reflected in type definitions
- [ ] Invalid states detected at compile time
- [ ] `switch` statements don't need `default` case
- [ ] Type assertion usage minimized
- [ ] Function return values are predictable

## Implementation Instructions for Claude

### Instruction Interpretation

When asked to "improve code by applying the totality principle":

1. **Business rule confirmation**: Request rule presentation using the template
   above
2. **Identify partial functions**: Identify functions that return
   `undefined`/`null` or use type assertions, convert to Result type
3. **Improve type definitions**: Optional properties → Discriminated Union
4. **Improve error handling**: Exceptions → Result type
5. **Improve branching**: `if` chains → `switch` statements

### Business Rule Question Examples

```
Please provide the following information:
1. What states can [Entity] take?
2. What properties are required for each state?
3. Are there transition rules between states?
4. Are there value constraints (range, format)?
5. Are there impossible combinations or prohibited states?
```

### Priority Order

1. Business rule understanding (domain knowledge)
2. Type safety (compile-time verification)
3. Exhaustiveness (handling all cases)
4. Readability (self-explanatory)
5. Maintainability (ease of change)

### Implementation Template

```typescript
// State definition (reflecting business rules)
type State = { kind: "A"; data: X } | { kind: "B"; data: Y };

// Processing function (exhaustive for all states)
function handle(
  state: State,
): Result<Output, ValidationError & { message: string }> {
  switch (state.kind) {
    case "A":
      return { ok: true, data: processA(state.data) };
    case "B":
      return { ok: true, data: processB(state.data) };
  }
}

// Constrained value (limited by business rules)
class ValidValue<T> {
  private constructor(readonly value: T) {}
  static create<T>(
    input: T,
    validator: (input: T) => ValidationError | null,
  ): Result<ValidValue<T>, ValidationError & { message: string }> {
    const error = validator(input);
    if (error) {
      return { ok: false, error: createError(error) };
    }
    return { ok: true, data: new ValidValue(input) };
  }
}

// Usage example
const result = ValidValue.create(
  "test",
  (input) => input.length === 0 ? { kind: "EmptyInput" } : null,
);
```

**Goal**: Design where business rules are reflected in types, the compiler
detects invalid states, and `switch` statements don't require `default` cases.
