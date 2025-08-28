# Testing Guidelines

This document provides detailed guidelines for implementing Test-Driven
Development (TDD) and writing effective tests in the Frontmatter to Schema
project.

## TDD Methodology

### The Red-Green-Refactor Cycle

#### 🔴 Red Phase - Write a Failing Test

1. **Write the smallest possible failing test**
2. **Focus on one specific behavior**
3. **Ensure the test fails for the right reason**
4. **Don't implement any production code yet**

```typescript
// Example: Red phase test
Deno.test("SchemaValidator should reject invalid schema format", () => {
  const validator = new SchemaValidator();
  const invalidSchema = {/* invalid schema object */};

  assertThrows(
    () => validator.validate(invalidSchema),
    ValidationError,
    "Schema format validation should fail",
  );
});
```

#### 🟢 Green Phase - Make the Test Pass

1. **Write the minimal code to make the test pass**
2. **Don't worry about code quality yet**
3. **Focus only on making the test green**
4. **Avoid over-engineering**

```typescript
// Example: Minimal implementation to pass the test
export class SchemaValidator {
  validate(schema: unknown): void {
    if (!schema || typeof schema !== "object") {
      throw new ValidationError("Invalid schema format");
    }
  }
}
```

#### 🔵 Refactor Phase - Improve the Code

1. **Improve code quality without breaking tests**
2. **Apply DDD principles and patterns**
3. **Ensure all tests still pass**
4. **Add proper error handling and totality**

```typescript
// Example: Refactored implementation with Result pattern
export class SchemaValidator {
  validate(schema: unknown): Result<ValidatedSchema, ValidationError> {
    if (!schema || typeof schema !== "object") {
      return {
        ok: false,
        error: new ValidationError("Invalid schema format", {
          kind: "InvalidFormat",
          input: schema,
        }),
      };
    }

    return {
      ok: true,
      data: ValidatedSchema.create(schema as SchemaObject),
    };
  }
}
```

## Test Structure and Naming

### Test File Organization

```
tests/
├── domain/
│   ├── analyzers/
│   │   └── schema_analyzer_test.ts
│   ├── models/
│   │   └── entities_test.ts
│   └── services/
│       └── template_mapper_test.ts
├── infrastructure/
│   ├── adapters/
│   │   └── file_system_adapter_test.ts
│   └── ports/
│       └── ai_analyzer_port_test.ts
└── integration/
    └── document_processing_test.ts
```

### Test Naming Conventions

#### Test File Names

- Use `*_test.ts` suffix
- Match the file being tested: `schema_analyzer.ts` → `schema_analyzer_test.ts`
- Use kebab-case following project conventions

#### Test Case Names

```typescript
// ✅ Good: Descriptive behavior-focused names
Deno.test("SchemaAnalyzer should extract frontmatter properties correctly", () => {});
Deno.test("SchemaAnalyzer should return error for invalid schema format", () => {});
Deno.test("SchemaAnalyzer should handle empty frontmatter gracefully", () => {});

// ❌ Bad: Implementation-focused or vague names
Deno.test("test analyzer", () => {});
Deno.test("SchemaAnalyzer.extract() works", () => {});
Deno.test("should work correctly", () => {});
```

## Test Writing Best Practices

### Arrange-Act-Assert Pattern

```typescript
Deno.test("TemplateMapper should apply template rules to extracted data", () => {
  // Arrange - Set up test data and dependencies
  const extractor = new MockFrontMatterExtractor();
  const templateMapper = new TemplateMapper(extractor);
  const inputData = { title: "Test", description: "Test description" };
  const template = Template.create("test-template", templateDefinition);

  // Act - Execute the behavior being tested
  const result = templateMapper.map(inputData, template);

  // Assert - Verify the expected outcome
  assert(result.ok);
  assertEquals(result.data.getTitle(), "Test");
  assertEquals(result.data.getDescription(), "Test description");
});
```

### Single Responsibility per Test

```typescript
// ✅ Good: One behavior per test
Deno.test("Document should validate path format", () => {
  const invalidPath = "invalid//path";
  assertThrows(() => Document.create(invalidPath, content));
});

Deno.test("Document should extract frontmatter successfully", () => {
  const validDocument = Document.create(validPath, contentWithFrontmatter);
  assert(validDocument.hasFrontMatter());
});

// ❌ Bad: Testing multiple behaviors
Deno.test("Document should work correctly", () => {
  // Tests both validation AND extraction - too much responsibility
});
```

### Error Testing Guidelines

```typescript
// Test error conditions explicitly
Deno.test("SchemaValidator should provide detailed error for missing required fields", () => {
  const validator = new SchemaValidator();
  const incompleteSchema = { title: "Test" }; // missing required fields

  const result = validator.validate(incompleteSchema);

  assert(!result.ok);
  assertEquals(result.error.kind, "ValidationError");
  assert(result.error.message.includes("required fields"));
});
```

## Domain-Driven Testing Approach

### Testing Entities

```typescript
Deno.test("Schema entity should enforce invariants during creation", () => {
  // Test entity invariants and business rules
  const invalidDefinition = {}; // violates business rules

  const result = Schema.create("test-schema", invalidDefinition);

  assert(!result.ok);
  assertEquals(result.error.kind, "DomainError");
});
```

### Testing Value Objects

```typescript
Deno.test("DocumentPath value object should be immutable", () => {
  const path = DocumentPath.create("/valid/path/file.md");

  assert(path.ok);
  assertEquals(path.data.getValue(), "/valid/path/file.md");

  // Should not be possible to modify
  // path.data.setValue("new-path"); // This should not exist
});
```

### Testing Domain Services

```typescript
Deno.test("TemplateMapperService should orchestrate mapping workflow", () => {
  // Test service coordination and workflow
  const mockAnalyzer = new MockSchemaAnalyzer();
  const mockValidator = new MockValidator();
  const service = new TemplateMapperService(mockAnalyzer, mockValidator);

  const result = service.processTemplate(frontMatter, schema);

  assert(result.ok);
  // Verify service orchestration occurred correctly
});
```

## Mock and Test Double Strategy

### Mocking External Dependencies

```typescript
// Create interface-based mocks
export class MockAIAnalyzer implements AIAnalyzerPort {
  private responses: Map<string, AnalysisResult> = new Map();

  setResponse(input: string, response: AnalysisResult): void {
    this.responses.set(input, response);
  }

  async analyze(
    request: AnalysisRequest,
  ): Promise<Result<AnalysisResult, AIError>> {
    const response = this.responses.get(request.content);
    if (!response) {
      return { ok: false, error: new AIError("No mock response configured") };
    }
    return { ok: true, data: response };
  }
}
```

### Stubbing Simple Dependencies

```typescript
// Simple stub for configuration
export class StubConfiguration implements Configuration {
  getApiKey(): string {
    return "test-api-key";
  }
  getTimeout(): number {
    return 1000;
  }
  isDebugMode(): boolean {
    return false;
  }
}
```

## Test Data Management

### Using Fixtures

```typescript
// Load test fixtures
const testFixtures = {
  validFrontMatter: await Deno.readTextFile(
    "tests/fixtures/valid_frontmatter.md",
  ),
  invalidSchema: JSON.parse(
    await Deno.readTextFile("tests/fixtures/invalid_schema.json"),
  ),
  expectedOutput: await Deno.readTextFile(
    "tests/fixtures/expected_output.json",
  ),
};

Deno.test("should process valid frontmatter", () => {
  const processor = new DocumentProcessor();
  const result = processor.process(testFixtures.validFrontMatter);

  assert(result.ok);
  assertEquals(JSON.stringify(result.data), testFixtures.expectedOutput);
});
```

### Builder Pattern for Test Data

```typescript
class DocumentBuilder {
  private path = "/default/path.md";
  private content = "default content";
  private frontMatter: FrontMatterContent | null = null;

  withPath(path: string): DocumentBuilder {
    this.path = path;
    return this;
  }

  withContent(content: string): DocumentBuilder {
    this.content = content;
    return this;
  }

  withFrontMatter(fm: FrontMatterContent): DocumentBuilder {
    this.frontMatter = fm;
    return this;
  }

  build(): Document {
    return Document.createWithFrontMatter(
      DocumentPath.create(this.path).data,
      this.frontMatter,
      DocumentContent.create(this.content).data,
    );
  }
}

// Usage in tests
Deno.test("should handle document with complex frontmatter", () => {
  const document = new DocumentBuilder()
    .withPath("/test/complex.md")
    .withFrontMatter(complexFrontMatter)
    .build();

  // Test with the built document
});
```

## Performance Testing Guidelines

### Test Execution Time

```typescript
Deno.test("SchemaAnalyzer should complete analysis within reasonable time", () => {
  const analyzer = new SchemaAnalyzer();
  const startTime = performance.now();

  const result = analyzer.analyze(largeFrontMatterData, complexSchema);

  const executionTime = performance.now() - startTime;
  assert(result.ok);
  assert(
    executionTime < 1000,
    `Analysis took ${executionTime}ms, expected <1000ms`,
  );
});
```

### Memory Usage Testing

```typescript
Deno.test("Document processing should not leak memory", () => {
  const initialMemory = Deno.memoryUsage().heapUsed;

  // Process many documents
  for (let i = 0; i < 1000; i++) {
    const processor = new DocumentProcessor();
    processor.process(testDocument);
  }

  // Force garbage collection if available
  if (typeof gc === "function") gc();

  const finalMemory = Deno.memoryUsage().heapUsed;
  const memoryIncrease = finalMemory - initialMemory;

  assert(
    memoryIncrease < 10_000_000,
    `Memory increased by ${memoryIncrease} bytes`,
  );
});
```

## Integration Testing Strategy

### Testing Component Integration

```typescript
Deno.test("End-to-end document processing workflow", async () => {
  // Use real implementations where possible
  const fileSystem = new DenoFileSystemAdapter();
  const frontMatterExtractor = new FrontMatterExtractorImpl();
  const schemaValidator = new SchemaValidatorImpl();
  const templateMapper = new TemplateMapperImpl();

  // Mock only external dependencies
  const mockAIAnalyzer = new MockAIAnalyzer();
  mockAIAnalyzer.setResponse(testInput, expectedAIResponse);

  const processor = new DocumentProcessor(
    fileSystem,
    mockAIAnalyzer,
    frontMatterExtractor,
    schemaValidator,
    templateMapper,
  );

  const result = await processor.processDocuments(testConfig);

  assert(result.ok);
  assertEquals(result.data.processedCount, expectedCount);
});
```

## Test Coverage Requirements

### Coverage Targets

- **Domain Logic**: 100% line coverage
- **Application Services**: 95% line coverage
- **Infrastructure**: 80% line coverage
- **Overall Project**: 85% minimum

### Coverage Analysis

```bash
# Generate coverage report
deno test --coverage=coverage --allow-read --allow-write --allow-run --allow-env

# View coverage report
deno coverage coverage --html

# Check specific file coverage
deno coverage coverage --include="src/domain"
```

### Critical Path Coverage

Ensure 100% coverage for:

- Error handling paths
- Domain invariant validation
- Business rule enforcement
- Data transformation logic

## Continuous Testing Practices

### Pre-commit Testing

```bash
# Always run before committing
deno task ci

# Quick test subset for rapid feedback
deno test tests/domain/ --allow-read
```

### Test-First Development

1. Write test for new feature
2. Run test to see it fail (Red)
3. Implement minimal feature (Green)
4. Refactor and improve (Refactor)
5. Repeat for next feature

### Regression Prevention

- Add test for every bug fix
- Test edge cases discovered in production
- Maintain high coverage of critical paths
- Regular test suite maintenance

---

This testing approach ensures high-quality, maintainable code that aligns with
TDD principles and supports the project's DDD architecture and totality goals.
