# Template Intermediate Representation Test Strategy

## Overview

This document defines the comprehensive testing strategy for the Template
Intermediate Representation (IR) layer and Template Context system. The strategy
ensures correctness, performance, and maintainability of the enhanced variable
resolution system.

## Test Philosophy

### Core Principles

1. **Test Pyramid**: Unit → Integration → E2E with appropriate distribution
2. **Property-Based Testing**: Verify invariants with random data
3. **Regression Prevention**: Capture and test all bug scenarios
4. **Performance Validation**: Benchmark critical paths
5. **Totality**: All code paths tested, no partial functions

### Testing Goals

- **Correctness**: Verify all resolution scenarios work as designed
- **Robustness**: Handle edge cases and error conditions gracefully
- **Performance**: Ensure acceptable speed and memory usage
- **Maintainability**: Tests as documentation of behavior

## Test Categories

### 1. Unit Tests

#### IR Node Construction

```typescript
// tests/unit/template/models/ir-node.test.ts

describe("IRNode Construction", () => {
  describe("IRScalar", () => {
    it("should create scalar with string value", () => {
      const result = IRScalar.create("test.path", "value");
      assert(result.ok);
      assertEquals(result.data.kind, "scalar");
      assertEquals(result.data.value, "value");
    });

    it("should create scalar with null value", () => {
      const result = IRScalar.create("test.path", null);
      assert(result.ok);
      assertEquals(result.data.value, null);
    });

    it("should reject invalid path", () => {
      const result = IRScalar.create("", "value");
      assert(!result.ok);
      assertEquals(result.error.kind, "InvalidPath");
    });
  });

  describe("IRArray", () => {
    it("should create array with items", () => {
      const items = [
        IRScalar.create("item[0]", "first").data,
        IRScalar.create("item[1]", "second").data,
      ];
      const result = IRArray.create("items", items);
      assert(result.ok);
      assertEquals(result.data.items.length, 2);
    });

    it("should handle empty array", () => {
      const result = IRArray.create("empty", []);
      assert(result.ok);
      assertEquals(result.data.items.length, 0);
    });
  });

  describe("IRObject", () => {
    it("should create object with entries", () => {
      const entries = new Map([
        ["key1", IRScalar.create("obj.key1", "value1").data],
        ["key2", IRScalar.create("obj.key2", "value2").data],
      ]);
      const result = IRObject.create("obj", entries);
      assert(result.ok);
      assertEquals(result.data.entries.size, 2);
    });
  });
});
```

#### Template Path Parsing

```typescript
// tests/unit/template/services/template-path-parser.test.ts

describe("TemplatePath Parser", () => {
  const testCases = [
    { input: "simple", expected: [{ kind: "property", name: "simple" }] },
    {
      input: "nested.path",
      expected: [
        { kind: "property", name: "nested" },
        { kind: "property", name: "path" },
      ],
    },
    { input: "@items", expected: [{ kind: "array-marker", marker: "@items" }] },
    {
      input: "items[]",
      expected: [
        { kind: "property", name: "items" },
        { kind: "array-marker", marker: "items[]" },
      ],
    },
    {
      input: "items[0]",
      expected: [
        { kind: "property", name: "items" },
        { kind: "index", value: 0 },
      ],
    },
    {
      input: "deeply.nested.items[2].id.full",
      expected: [
        { kind: "property", name: "deeply" },
        { kind: "property", name: "nested" },
        { kind: "property", name: "items" },
        { kind: "index", value: 2 },
        { kind: "property", name: "id" },
        { kind: "property", name: "full" },
      ],
    },
  ];

  testCases.forEach(({ input, expected }) => {
    it(`should parse "${input}" correctly`, () => {
      const result = TemplatePath.create(input);
      assert(result.ok);
      assertEquals(result.data.getSegments(), expected);
    });
  });

  it("should reject empty path", () => {
    const result = TemplatePath.create("");
    assert(!result.ok);
    assertEquals(result.error.kind, "EmptyPath");
  });

  it("should reject invalid array syntax", () => {
    const result = TemplatePath.create("items[abc]");
    assert(!result.ok);
    assertEquals(result.error.kind, "InvalidArrayIndex");
  });
});
```

#### Template Context Resolution

```typescript
// tests/unit/template/services/template-context.test.ts

describe("TemplateContext", () => {
  describe("Variable Resolution", () => {
    let context: TemplateContext;
    let ir: TemplateIntermediateRepresentation;

    beforeEach(() => {
      // Setup IR with test data
      const data = {
        metadata: { version: "1.0" },
        items: [
          { id: { full: "item-1" }, name: "First" },
          { id: { full: "item-2" }, name: "Second" },
        ],
      };
      ir = buildTestIR(data);
      context = TemplateContextFactory.create(ir, {
        fallbackPolicy: { kind: "empty" },
        verbosityMode: "normal",
      }).data;
    });

    it("should resolve root level variable", () => {
      const result = context.resolve("metadata.version");
      assert(result.ok);
      assertEquals(result.data.value, "1.0");
      assertEquals(result.data.strategy, "direct");
    });

    it("should resolve with array scope", () => {
      const arrayContext = context.enterArray(
        TemplatePath.create("items").data,
      ).data;

      for (const elementContext of arrayContext.items) {
        const result = elementContext.context.resolve("id.full");
        assert(result.ok);
        assert(result.data.value.startsWith("item-"));
      }
    });

    it("should fall back to parent scope", () => {
      const arrayContext = context.enterArray(
        TemplatePath.create("items").data,
      ).data;
      const element = arrayContext.items[Symbol.iterator]().next().value;

      const result = element.context.resolve("metadata.version");
      assert(result.ok);
      assertEquals(result.data.value, "1.0");
      assertEquals(result.data.strategy, "inherited");
    });

    it("should apply fallback policy for missing variable", () => {
      const result = context.resolve("nonexistent.path");
      assert(result.ok);
      assertEquals(result.data.value, "");
      assertEquals(result.data.strategy, "fallback");
    });
  });

  describe("Array Iteration", () => {
    it("should provide iteration metadata", () => {
      const data = { items: ["a", "b", "c"] };
      const ir = buildTestIR(data);
      const context = createTestContext(ir);

      const arrayContext = context.enterArray(
        TemplatePath.create("items").data,
      ).data;

      const elements = Array.from(arrayContext.items);

      // First element
      assertEquals(elements[0].metadata.index, 0);
      assertEquals(elements[0].metadata.first, true);
      assertEquals(elements[0].metadata.last, false);

      // Last element
      assertEquals(elements[2].metadata.index, 2);
      assertEquals(elements[2].metadata.first, false);
      assertEquals(elements[2].metadata.last, true);
    });
  });
});
```

### 2. Integration Tests

#### End-to-End Variable Resolution

```typescript
// tests/integration/template-ir-resolution.test.ts

describe("Template IR Resolution Integration", () => {
  it("should resolve x-flatten-arrays with deep paths", async () => {
    // Setup
    const frontmatter = {
      traceability: {
        requirements: [
          {
            id: {
              full: "req:auth:primary-key-5d8c2a#20250909",
              level: "req",
              scope: "auth",
            },
            trace_to: {
              design: "design:auth:token-management",
              test: "test:auth:jwt-validation",
            },
          },
        ],
      },
    };

    // Process with directives
    const processed = await directiveProcessor.process(frontmatter, schema);

    // Build IR
    const ir = TemplateIntermediateBuilder.fromFrontmatterData(
      [processed],
    ).data.build().data;

    // Create context
    const context = TemplateContextFactory.create(ir, {
      fallbackPolicy: { kind: "empty" },
    }).data;

    // Template with deep path
    const template =
      "{@traceability.requirements}{id.full} → {trace_to.design}{/@traceability.requirements}";

    // Process template
    const result = await templateProcessor.process(template, context);

    // Verify
    assertEquals(
      result.data,
      "req:auth:primary-key-5d8c2a#20250909 → design:auth:token-management",
    );
  });

  it("should handle nested array expansions", async () => {
    const data = {
      users: [
        {
          name: "Alice",
          posts: [
            { title: "Post 1", tags: ["tech", "web"] },
            { title: "Post 2", tags: ["design"] },
          ],
        },
        {
          name: "Bob",
          posts: [
            { title: "Post 3", tags: ["data"] },
          ],
        },
      ],
    };

    const ir = buildIR(data);
    const context = createContext(ir);

    const template = `
{@users}
User: {name}
{@posts}
  - {title} [{@tags}{.}{/@tags}]
{/@posts}
{/@users}`;

    const result = await process(template, context);

    const expected = `
User: Alice
  - Post 1 [tech, web]
  - Post 2 [design]
User: Bob
  - Post 3 [data]`;

    assertEquals(normalize(result), normalize(expected));
  });
});
```

#### Performance Benchmarks

```typescript
// tests/integration/template-ir-performance.test.ts

describe("Template IR Performance", () => {
  it("should handle large datasets efficiently", async () => {
    // Generate large dataset
    const items = Array.from({ length: 10000 }, (_, i) => ({
      id: `item-${i}`,
      value: Math.random(),
      nested: {
        deep: {
          path: `value-${i}`,
        },
      },
    }));

    const data = { items };

    // Measure IR building
    const buildStart = performance.now();
    const ir = buildIR(data);
    const buildTime = performance.now() - buildStart;

    assert(buildTime < 100, `IR build took ${buildTime}ms`);

    // Measure resolution
    const context = createContext(ir);
    const resolveStart = performance.now();

    for (let i = 0; i < 1000; i++) {
      context.resolve(`items[${i}].nested.deep.path`);
    }

    const resolveTime = performance.now() - resolveStart;
    assert(resolveTime < 10, `1000 resolutions took ${resolveTime}ms`);
  });

  it("should maintain memory efficiency", () => {
    const beforeMemory = Deno.memoryUsage().heapUsed;

    // Create and destroy many IRs
    for (let i = 0; i < 100; i++) {
      const data = generateLargeData(1000);
      const ir = buildIR(data);
      const context = createContext(ir);
      // Use it
      context.resolve("some.path");
      // Let it be garbage collected
    }

    // Force garbage collection if possible
    if (globalThis.gc) globalThis.gc();

    const afterMemory = Deno.memoryUsage().heapUsed;
    const memoryIncrease = afterMemory - beforeMemory;

    // Should not leak more than 10MB
    assert(
      memoryIncrease < 10 * 1024 * 1024,
      `Memory increased by ${memoryIncrease / 1024 / 1024}MB`,
    );
  });
});
```

### 3. Property-Based Tests

```typescript
// tests/property/template-ir-properties.test.ts

import { fc } from "fast-check";

describe("Template IR Properties", () => {
  it("should maintain totality for any valid JSON", () => {
    fc.assert(
      fc.property(fc.json(), (jsonString) => {
        const data = JSON.parse(jsonString);
        const result = TemplateIntermediateBuilder.fromFrontmatterData([
          FrontmatterData.create(data).data,
        ]);

        // Building should always return a Result
        assert(result.ok === true || result.ok === false);

        if (result.ok) {
          const ir = result.data.build();
          // Build should always succeed for valid builder
          assert(ir.ok);
        }
      }),
    );
  });

  it("should resolve any path to a Result", () => {
    fc.assert(
      fc.property(
        fc.json(),
        fc.array(fc.string()),
        (jsonString, pathSegments) => {
          const data = JSON.parse(jsonString);
          const ir = buildIR(data);
          const context = createContext(ir);

          const path = pathSegments.join(".");
          const result = context.resolve(path);

          // Resolution should always return a Result
          assert(result.ok === true || result.ok === false);

          // If successful, should have valid metadata
          if (result.ok) {
            assert(result.data.value !== undefined);
            assert(result.data.strategy);
            assert(result.data.sourcePath);
          }
        },
      ),
    );
  });

  it("should maintain immutability", () => {
    fc.assert(
      fc.property(fc.json(), (jsonString) => {
        const data = JSON.parse(jsonString);
        const ir1 = buildIR(data);
        const ir2 = buildIR(data);

        // Same input should produce equivalent IR
        assert(deepEqual(ir1.toObject(), ir2.toObject()));

        // Modifications shouldn't affect original
        const context1 = createContext(ir1);
        const context2 = createContext(ir1);

        context1.enterArray(TemplatePath.create("any.path").data);

        // Original IR should be unchanged
        assert(deepEqual(ir1.toObject(), ir2.toObject()));
      }),
    );
  });
});
```

### 4. Regression Tests

```typescript
// tests/regression/issue-1071.test.ts

describe("Issue #1071: Deep path resolution in array expansion", () => {
  it("should resolve {id.full} within {@items}", async () => {
    // Exact scenario from bug report
    const frontmatter = {
      traceability: [
        {
          id: {
            full: "req:auth:primary-key-5d8c2a#20250909",
            level: "req",
          },
        },
      ],
    };

    const template = "{@traceability}{id.full}{/@traceability}";

    // Old behavior would return empty
    // New behavior should return the value
    const result = await processWithIR(frontmatter, template);

    assertEquals(result, "req:auth:primary-key-5d8c2a#20250909");
  });

  it("should handle x-flatten-arrays with nested resolution", async () => {
    // Complex scenario with directive processing
    const schema = {
      "x-flatten-arrays": ["traceability"],
      properties: {
        traceability: {
          type: "array",
          items: {
            type: "object",
          },
        },
      },
    };

    const files = [
      { traceability: [{ id: { full: "req-1" } }] },
      { traceability: [{ id: { full: "req-2" } }] },
    ];

    const processed = await processWithSchema(files, schema);
    const result = await renderWithTemplate(
      processed,
      "{@traceability}{id.full} {/@traceability}",
    );

    assertEquals(result, "req-1 req-2 ");
  });
});
```

### 5. E2E Tests

```typescript
// tests/e2e/examples-validation.test.ts

describe("Examples E2E Validation", () => {
  it("should process examples/3.docs correctly", async () => {
    const inputDir = "examples/3.docs";
    const outputDir = "tmp/test-output";

    // Run CLI
    const result = await runCLI([
      "process",
      "--input",
      inputDir,
      "--output",
      outputDir,
      "--schema",
      `${inputDir}/schema.json`,
    ]);

    assert(result.success);

    // Verify output
    const output = await Deno.readTextFile(`${outputDir}/output.json`);
    const parsed = JSON.parse(output);

    // Check specific values that were failing
    assert(parsed.tools.commands.length > 0);
    parsed.tools.commands.forEach((cmd) => {
      assert(cmd.id, "Each command should have an id");
      assert(!cmd.id.includes("{"), "Variables should be resolved");
    });
  });

  it("should handle all example directories", async () => {
    const examples = [
      "examples/1.simple",
      "examples/2.nested",
      "examples/3.docs",
      "examples/4.complex",
    ];

    for (const example of examples) {
      const result = await runCLI([
        "process",
        "--input",
        example,
        "--validate",
      ]);

      assert(result.success, `Failed to process ${example}`);
    }
  });
});
```

## Test Data Builders

```typescript
// tests/helpers/ir-test-builders.ts

export function buildTestIR(data: unknown): TemplateIntermediateRepresentation {
  const builder = TemplateIntermediateBuilder.fromFrontmatterData([
    FrontmatterData.create(data).data,
  ]).data;

  return builder.build().data;
}

export function createTestContext(
  ir: TemplateIntermediateRepresentation,
  config?: Partial<ContextConfiguration>,
): TemplateContext {
  return TemplateContextFactory.create(ir, {
    fallbackPolicy: { kind: "empty" },
    verbosityMode: "normal",
    maxScopeDepth: 100,
    enableCaching: false,
    ...config,
  }).data;
}

export function generateLargeData(size: number): unknown {
  return {
    items: Array.from({ length: size }, (_, i) => ({
      id: `item-${i}`,
      value: Math.random(),
      nested: {
        deep: {
          path: `value-${i}`,
        },
      },
    })),
  };
}
```

## Test Execution Strategy

### Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      - name: Unit Tests
        run: deno test tests/unit --coverage=coverage
      - name: Integration Tests
        run: deno test tests/integration
      - name: Property Tests
        run: deno test tests/property
      - name: E2E Tests
        run: deno test tests/e2e
      - name: Coverage Report
        run: deno coverage coverage --lcov > coverage.lcov
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
```

### Local Development

```bash
# Run all tests
deno task test

# Run specific category
deno task test:unit
deno task test:integration

# Run with watch mode
deno task test:watch

# Run with coverage
deno task test:coverage

# Run performance tests
deno task test:perf
```

## Coverage Requirements

### Minimum Coverage Targets

- **Overall**: 90%
- **IR Layer**: 95%
- **Template Context**: 95%
- **Path Parser**: 100%
- **Integration Points**: 85%

### Critical Paths (100% Required)

1. `TemplatePath.create()` - All path variations
2. `TemplateContext.resolve()` - All resolution strategies
3. `IRBuilder.build()` - All data types
4. `ArrayContext` iteration - All metadata

## Performance Benchmarks

### Baseline Metrics

| Operation                   | Target  | Maximum |
| --------------------------- | ------- | ------- |
| IR Build (1000 items)       | < 10ms  | 20ms    |
| Path Resolution             | < 0.1ms | 0.5ms   |
| Array Expansion (100 items) | < 5ms   | 10ms    |
| Context Creation            | < 1ms   | 2ms     |
| Memory per 1000 items       | < 1MB   | 2MB     |

### Performance Testing

```typescript
// tests/benchmarks/ir-performance.bench.ts

Deno.bench("IR Building", () => {
  const data = generateLargeData(1000);
  buildIR(data);
});

Deno.bench("Path Resolution", () => {
  const ir = setupBenchIR();
  const context = createContext(ir);
  context.resolve("deeply.nested.path.to.value");
});

Deno.bench("Array Expansion", () => {
  const ir = setupArrayIR(100);
  const context = createContext(ir);
  processTemplate("{@items}{id}{/@items}", context);
});
```

## Debugging Support

### Test Utilities

```typescript
// tests/helpers/debugging.ts

export function logIRStructure(ir: TemplateIntermediateRepresentation): void {
  console.log("IR Structure:", JSON.stringify(ir.toObject(), null, 2));
}

export function traceResolution(
  context: TemplateContext,
  path: string,
): void {
  const original = context.resolve;
  context.resolve = (p: string) => {
    console.log(`Resolving: ${p}`);
    const result = original.call(context, p);
    console.log(`Result: ${JSON.stringify(result)}`);
    return result;
  };
  context.resolve(path);
}
```

## Documentation Requirements

Each test file should include:

1. **Purpose**: What aspect is being tested
2. **Scenarios**: List of test cases covered
3. **Dependencies**: Required setup or fixtures
4. **Known Issues**: Any limitations or pending work

## Review Checklist

- [ ] All test categories implemented
- [ ] Coverage targets met
- [ ] Performance benchmarks passing
- [ ] Property-based tests running
- [ ] Regression tests for all bugs
- [ ] E2E tests for all examples
- [ ] Documentation complete
- [ ] CI pipeline configured

## References

- [IR Architecture](../domain/architecture/domain-architecture-intermediate-representation.md)
- [Template Context Specification](../architecture/template-context-specification.md)
- [Implementation Roadmap](../architecture/template-variable-resolution-roadmap.md)
- [Issue #1071](https://github.com/tettuan/frontmatter-to-schema/issues/1071)
