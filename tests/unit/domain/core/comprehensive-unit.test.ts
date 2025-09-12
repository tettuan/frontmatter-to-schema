import { assertEquals, assertExists } from "jsr:@std/assert";
import type { Result } from "../../../../src/domain/core/result.ts";
import {
  createDomainError,
  flatMapResult,
  isError,
  isOk,
  mapResult,
} from "../../../../src/domain/core/result.ts";
import {
  ConfigPath,
  DocumentPath,
  FrontMatterContent,
  MappingRule,
  OutputPath,
  ProcessingOptions,
  SchemaDefinition,
  SchemaVersion,
  TemplateFormat,
} from "../../../../src/domain/models/value-objects.ts";
import { getBreakdownLogger } from "../../../helpers/breakdown-logger.ts";

// ============================================================================
// Domain Core Value Objects Comprehensive Tests
// ============================================================================

Deno.test("DDD Core - DocumentPath Value Object", async (t) => {
  const logger = getBreakdownLogger().createTestScope(
    "DocumentPath",
    "domain-core",
  );

  await t.step("Smart Constructor - Success Cases", () => {
    logger.arrange("Preparing test cases for DocumentPath");
    const testCases = [
      { input: "/docs/readme.md", expected: "/docs/readme.md" },
      { input: "./file.markdown", expected: "./file.markdown" },
      { input: "  /spaced/path.md  ", expected: "/spaced/path.md" },
      { input: "深/日本語/ファイル.md", expected: "深/日本語/ファイル.md" },
    ];

    logger.act("Testing DocumentPath creation", {
      caseCount: testCases.length,
    });
    for (const { input, expected } of testCases) {
      const result = DocumentPath.create(input);
      logger.logResult("act", result, `DocumentPath.create("${input}")`);
      assertEquals(isOk(result), true, `Failed for input: ${input}`);
      if (isOk(result)) {
        assertEquals(result.data.getValue(), expected);
      }
    }
    logger.assert("All success cases passed");
  });

  await t.step("Smart Constructor - Failure Cases", () => {
    const errorCases = [
      { input: "", expectedError: "EmptyInput" },
      { input: "   ", expectedError: "EmptyInput" },
      // Note: DocumentPath now accepts any valid file path, validation moved to domain layer
    ];

    for (const { input, expectedError } of errorCases) {
      const result = DocumentPath.create(input);
      assertEquals(isError(result), true, `Should fail for: ${input}`);
      if (isError(result)) {
        assertEquals(result.error.kind, expectedError);
      }
    }

    // Test that non-markdown files are accepted but identified correctly
    const txtResult = DocumentPath.create("/not-markdown.txt");
    assertEquals(isError(txtResult), false);
    if (!isError(txtResult)) {
      assertEquals(txtResult.data.isMarkdown(), false);
    }
  });

  await t.step("Path Manipulation Methods", () => {
    const result = DocumentPath.create("/project/docs/api/reference.md");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const path = result.data;
      assertEquals(path.getFilename(), "reference.md");
      assertEquals(path.getDirectory(), "/project/docs/api");
      assertEquals(path.getValue(), "/project/docs/api/reference.md");
    }
  });

  await t.step("Edge Cases - Root Level Files", () => {
    const result = DocumentPath.create("readme.md");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getFilename(), "readme.md");
      assertEquals(result.data.getDirectory(), ".");
    }
  });
});

Deno.test("DDD Core - SchemaDefinition Value Object", async (t) => {
  await t.step("JSON Schema Creation", () => {
    const schema = {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 },
        tags: { type: "array", items: { type: "string" } },
        published: { type: "boolean" },
      },
      required: ["title"],
    };

    const result = SchemaDefinition.create(schema, "1.0.0");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getVersion(), "1.0.0");
      assertExists(result.data.getValue());
    }
  });

  await t.step("Invalid Schema Rejection", () => {
    const invalidCases = [
      { input: null, expectedError: "EmptyInput" },
      { input: undefined, expectedError: "EmptyInput" },
      { input: "string", expectedError: "ParseError" },
      { input: 123, expectedError: "InvalidFormat" },
    ];

    for (const { input, expectedError } of invalidCases) {
      const result = SchemaDefinition.create(input, "1.0.0");
      assertEquals(isError(result), true, `Should reject ${input}`);
      if (isError(result)) {
        assertEquals(result.error.kind, expectedError);
      }
    }

    // Arrays should be properly rejected (bug has been fixed)
    const arrayResult = SchemaDefinition.create([], "1.0.0");
    assertEquals(
      isError(arrayResult),
      true,
      "Arrays should be rejected",
    );
    if (isError(arrayResult)) {
      assertEquals(arrayResult.error.kind, "InvalidFormat");
    }
  });

  await t.step("Complex Nested Schema", () => {
    const complexSchema = {
      type: "object",
      properties: {
        metadata: {
          type: "object",
          properties: {
            author: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string", format: "email" },
              },
              required: ["name"],
            },
            timestamps: {
              type: "object",
              properties: {
                created: { type: "string", format: "date-time" },
                modified: { type: "string", format: "date-time" },
              },
            },
          },
        },
        content: {
          type: "object",
          additionalProperties: true,
        },
      },
    };

    const result = SchemaDefinition.create(complexSchema, "2.0.0");
    assertEquals(isOk(result), true);
  });
});

Deno.test("DDD Core - ProcessingOptions Value Object", async (t) => {
  await t.step("Default Options", () => {
    const result = ProcessingOptions.create({});
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const options = result.data;
      assertEquals(options.isParallel(), true);
      assertEquals(options.getMaxConcurrency(), 5);
      assertEquals(options.shouldContinueOnError(), false);
    }
  });

  await t.step("Custom Options", () => {
    const result = ProcessingOptions.create({
      parallel: false,
      maxConcurrency: 10,
      continueOnError: true,
    });
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const options = result.data;
      assertEquals(options.isParallel(), false);
      assertEquals(options.getMaxConcurrency(), 10);
      assertEquals(options.shouldContinueOnError(), true);
    }
  });

  await t.step("Concurrency Validation", () => {
    const invalidCases = [
      { maxConcurrency: 0, expectedError: "OutOfRange" },
      { maxConcurrency: -1, expectedError: "OutOfRange" },
      { maxConcurrency: 101, expectedError: "OutOfRange" },
      { maxConcurrency: 1000, expectedError: "OutOfRange" },
    ];

    for (const { maxConcurrency, expectedError } of invalidCases) {
      const result = ProcessingOptions.create({ maxConcurrency });
      assertEquals(isError(result), true);
      if (isError(result)) {
        assertEquals(result.error.kind, expectedError);
      }
    }
  });

  await t.step("Valid Concurrency Range", () => {
    const validCases = [1, 5, 10, 50, 100];
    for (const maxConcurrency of validCases) {
      const result = ProcessingOptions.create({ maxConcurrency });
      assertEquals(isOk(result), true);
      if (isOk(result)) {
        assertEquals(result.data.getMaxConcurrency(), maxConcurrency);
      }
    }
  });
});

Deno.test("DDD Core - MappingRule Value Object", async (t) => {
  await t.step("Simple Mapping", () => {
    const result = MappingRule.create("source.field", "target.field");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const rule = result.data;
      assertEquals(rule.getSource(), "source.field");
      assertEquals(rule.getTarget(), "target.field");
    }
  });

  await t.step("Mapping with Transform Function", () => {
    const transform = (value: unknown): string => {
      return String(value).toUpperCase();
    };

    const result = MappingRule.create("name", "displayName", transform);
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const rule = result.data;
      const testData = { name: "john doe" };
      const transformed = rule.apply(testData);
      assertEquals(transformed, "JOHN DOE");
    }
  });

  await t.step("Deep Path Extraction", () => {
    const result = MappingRule.create("user.profile.settings.theme", "theme");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const rule = result.data;
      const data = {
        user: {
          profile: {
            settings: {
              theme: "dark",
              language: "ja",
            },
          },
        },
      };
      assertEquals(rule.apply(data), "dark");
    }
  });

  await t.step("Invalid Mapping Rules", () => {
    const invalidCases = [
      { source: "", target: "valid", expectedError: "EmptyInput" },
      { source: "valid", target: "", expectedError: "EmptyInput" },
      { source: "", target: "", expectedError: "EmptyInput" },
    ];

    for (const { source, target, expectedError } of invalidCases) {
      const result = MappingRule.create(source, target);
      assertEquals(isError(result), true);
      if (isError(result)) {
        assertEquals(result.error.kind, expectedError);
      }
    }
  });

  await t.step("Transform with Type Coercion", () => {
    const toNumber = (value: unknown): number => {
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    };

    const result = MappingRule.create("count", "totalCount", toNumber);
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const rule = result.data;
      assertEquals(rule.apply({ count: "42" }), 42);
      assertEquals(rule.apply({ count: "invalid" }), 0);
      assertEquals(rule.apply({ count: null }), 0);
    }
  });
});

Deno.test("DDD Core - TemplateFormat Value Object", async (t) => {
  await t.step("JSON Template", () => {
    const template = JSON.stringify({
      name: "{{name}}",
      items: "{{#each items}}{{.}}{{/each}}",
    });

    const result = TemplateFormat.create("json", template);
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getFormat(), "json");
      assertEquals(result.data.getTemplate(), template);
    }
  });

  await t.step("YAML Template", () => {
    const yamlTemplate = `
name: {{name}}
tags:
  {{#each tags}}
  - {{.}}
  {{/each}}
`;
    const result = TemplateFormat.create("yaml", yamlTemplate);
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getFormat(), "yaml");
    }
  });

  await t.step("Handlebars Template", () => {
    const hbsTemplate = "{{#if published}}Published: {{title}}{{/if}}";
    const result = TemplateFormat.create("handlebars", hbsTemplate);
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getFormat(), "handlebars");
    }
  });

  await t.step("Custom Template Format", () => {
    const customTemplate = "${name} - ${description}";
    const result = TemplateFormat.create("custom", customTemplate);
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getFormat(), "custom");
    }
  });

  await t.step("Invalid Template Formats", () => {
    const invalidCases = [
      { format: "xml", template: "<root/>", expectedError: "InvalidFormat" },
      { format: "json", template: "", expectedError: "EmptyInput" },
      { format: "yaml", template: "   ", expectedError: "EmptyInput" },
    ];

    for (const { format, template, expectedError } of invalidCases) {
      const result = TemplateFormat.create(format, template);
      assertEquals(isError(result), true);
      if (isError(result)) {
        assertEquals(result.error.kind, expectedError);
      }
    }
  });
});

Deno.test("DDD Core - SchemaVersion Value Object", async (t) => {
  await t.step("Valid Semantic Versions", () => {
    const validVersions = [
      "1.0.0",
      "0.0.1",
      "2.3.45",
      "999.999.999",
    ];

    for (const version of validVersions) {
      const result = SchemaVersion.create(version);
      assertEquals(isOk(result), true);
      if (isOk(result)) {
        assertEquals(result.data.toString(), version);
      }
    }
  });

  await t.step("Invalid Version Formats", () => {
    const invalidVersions = [
      { input: "1.0", expectedError: "InvalidFormat" },
      { input: "1", expectedError: "InvalidFormat" },
      { input: "v1.0.0", expectedError: "InvalidFormat" },
      { input: "1.0.0-alpha", expectedError: "InvalidFormat" },
      { input: "1.0.x", expectedError: "InvalidFormat" },
    ];

    for (const { input, expectedError } of invalidVersions) {
      const result = SchemaVersion.create(input);
      assertEquals(isError(result), true);
      if (isError(result)) {
        assertEquals(result.error.kind, expectedError);
      }
    }
  });

  await t.step("Version Compatibility Check", () => {
    const v1 = SchemaVersion.create("1.2.3");
    const v2 = SchemaVersion.create("1.5.0");
    const v3 = SchemaVersion.create("2.0.0");

    if (isOk(v1) && isOk(v2) && isOk(v3)) {
      // Same major version = compatible
      assertEquals(v1.data.isCompatibleWith(v2.data), true);
      // Different major version = incompatible
      assertEquals(v1.data.isCompatibleWith(v3.data), false);
      assertEquals(v2.data.isCompatibleWith(v3.data), false);
    }
  });
});

Deno.test("DDD Core - ConfigPath Value Object", async (t) => {
  await t.step("Valid Config Paths", () => {
    const validPaths = [
      "config.json",
      "settings.yaml",
      "config.yml",
      "app.toml",
      "/absolute/path/config.json",
      "./relative/settings.yaml",
    ];

    for (const path of validPaths) {
      const result = ConfigPath.create(path);
      assertEquals(isOk(result), true, `Should accept: ${path}`);
      if (isOk(result)) {
        assertEquals(result.data.getValue(), path);
      }
    }
  });

  await t.step("Invalid Config Paths", () => {
    const invalidPaths = [
      { input: "", expectedError: "EmptyInput" },
      { input: "   ", expectedError: "EmptyInput" },
      { input: "config.txt", expectedError: "InvalidFormat" },
      { input: "settings.xml", expectedError: "InvalidFormat" },
      { input: "noextension", expectedError: "InvalidFormat" },
    ];

    for (const { input, expectedError } of invalidPaths) {
      const result = ConfigPath.create(input);
      assertEquals(isError(result), true, `Should reject: ${input}`);
      if (isError(result)) {
        assertEquals(result.error.kind, expectedError);
      }
    }
  });

  await t.step("Path Resolution", () => {
    const result = ConfigPath.create("config.json");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const resolved = result.data.resolve("/base/path");
      assertEquals(resolved, "/base/path/config.json");
    }

    const absoluteResult = ConfigPath.create("/absolute/config.json");
    assertEquals(isOk(absoluteResult), true);
    if (isOk(absoluteResult)) {
      const resolved = absoluteResult.data.resolve("/base/path");
      assertEquals(resolved, "/absolute/config.json");
    }
  });
});

Deno.test("DDD Core - OutputPath Value Object", async (t) => {
  await t.step("Valid Output Paths", () => {
    const validPaths = [
      "output.json",
      "results.txt",
      "report.md",
      "/absolute/output.log",
      "./relative/data.csv",
    ];

    for (const path of validPaths) {
      const result = OutputPath.create(path);
      assertEquals(isOk(result), true, `Should accept: ${path}`);
      if (isOk(result)) {
        assertEquals(result.data.getValue(), path);
      }
    }
  });

  await t.step("Invalid Output Paths", () => {
    const result = OutputPath.create("");
    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "EmptyInput");
    }

    const whitespaceResult = OutputPath.create("   ");
    assertEquals(isError(whitespaceResult), true);
  });

  await t.step("Extension Modification", () => {
    const result = OutputPath.create("output.txt");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const withJson = result.data.withExtension("json");
      assertEquals(withJson.getValue(), "output.json");
    }
  });
});

Deno.test("DDD Core - FrontMatterContent Value Object", async (t) => {
  await t.step("Valid FrontMatter Content", () => {
    const yamlContent = `title: Test Article
author: John Doe
tags:
  - typescript
  - deno
published: true`;

    const result = FrontMatterContent.create(yamlContent);
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getValue(), yamlContent);
    }
  });

  await t.step("Empty FrontMatter Content", () => {
    const result = FrontMatterContent.create("");
    assertEquals(isOk(result), true, "Should allow empty frontmatter");
  });

  await t.step("JSON Conversion", () => {
    const jsonContent = '{"title": "Test", "count": 42}';
    const result = FrontMatterContent.create(jsonContent);
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const json = result.data.toJSON();
      assertExists(json);
      if (json && typeof json === "object" && "title" in json) {
        assertEquals(json.title, "Test");
      }
    }
  });
});

// ============================================================================
// Result Type Utility Tests
// ============================================================================

Deno.test("DDD Core - Result Type Utilities", async (t) => {
  await t.step("Result Mapping", () => {
    const result: Result<number, Error> = { ok: true, data: 42 };
    const mapped = mapResult(result, (n) => n * 2);

    assertEquals(isOk(mapped), true);
    if (isOk(mapped)) {
      assertEquals(mapped.data, 84);
    }
  });

  await t.step("Result FlatMapping", () => {
    const result: Result<number, Error> = { ok: true, data: 10 };
    const flatMapped = flatMapResult(
      result,
      (n) =>
        n > 5 ? { ok: true, data: n * 2 } : {
          ok: false,
          error: createDomainError(
            { kind: "OutOfRange", value: n },
            "Value out of range",
          ),
        },
    );

    assertEquals(isOk(flatMapped), true);
    if (isOk(flatMapped)) {
      assertEquals(flatMapped.data, 20);
    }
  });

  await t.step("Error Propagation in FlatMap", () => {
    const result: Result<number, Error> = { ok: true, data: 3 };
    const flatMapped = flatMapResult(
      result,
      (n) =>
        n > 5 ? { ok: true, data: n * 2 } : {
          ok: false,
          error: createDomainError(
            { kind: "OutOfRange", value: n },
            "Value out of range",
          ),
        },
    );

    assertEquals(isError(flatMapped), true);
    if (isError(flatMapped)) {
      assertEquals(flatMapped.error.kind, "OutOfRange");
    }
  });

  await t.step("Map Error Result", () => {
    const error = createDomainError(
      { kind: "EmptyInput", field: "test" },
      "test",
    );
    const result: Result<number, typeof error> = { ok: false, error };

    const mapped = mapResult(result, (n: number) => n * 2);
    assertEquals(isError(mapped), true);
    if (isError(mapped)) {
      assertEquals(mapped.error.kind, "EmptyInput");
    }
  });
});

// ============================================================================
// Error Handling and Edge Cases
// ============================================================================

Deno.test("DDD Core - Error Propagation", async (t) => {
  await t.step("Chained Error Propagation", () => {
    const result = DocumentPath.create("");
    const chained = flatMapResult(
      result,
      (path) => ConfigPath.create(path.getValue()),
    );

    assertEquals(isError(chained), true);
    if (isError(chained)) {
      assertEquals(chained.error.kind, "EmptyInput");
    }
  });

  await t.step("Multiple Validation Errors", () => {
    const invalidCases = [
      DocumentPath.create(""), // Empty path - should fail
      DocumentPath.create("   "), // Whitespace only - should fail
      ConfigPath.create("no-extension"), // No extension - should fail
    ];

    const errorCount = invalidCases.filter((r) => !r.ok).length;
    assertEquals(errorCount, 3);
  });
});

// ============================================================================
// Performance and Boundary Tests
// ============================================================================

Deno.test("DDD Core - Performance Boundaries", async (t) => {
  await t.step("Large Schema Definition", () => {
    const largeSchema: Record<string, unknown> = {
      type: "object",
      properties: {},
    };

    // Generate 100 properties
    for (let i = 0; i < 100; i++) {
      (largeSchema.properties as Record<string, unknown>)[`field_${i}`] = {
        type: "string",
        description: `Field number ${i}`,
      };
    }

    const start = performance.now();
    const result = SchemaDefinition.create(largeSchema, "1.0.0");
    const elapsed = performance.now() - start;

    assertEquals(isOk(result), true);
    // Should complete in reasonable time
    assertEquals(elapsed < 100, true, `Schema creation took ${elapsed}ms`);
  });

  await t.step("Many Mapping Rules", () => {
    const rules = [];
    for (let i = 0; i < 50; i++) {
      rules.push(MappingRule.create(`source.field${i}`, `target.field${i}`));
    }

    const allValid = rules.every(isOk);
    assertEquals(allValid, true);
  });

  await t.step("Long Path Strings", () => {
    const longPath =
      "/very/long/path/to/deep/nested/directory/structure/with/many/levels/document.md";
    const result = DocumentPath.create(longPath);
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getValue(), longPath);
      assertEquals(result.data.getFilename(), "document.md");
    }
  });
});

// ============================================================================
// Complex Integration Scenarios
// ============================================================================

Deno.test("DDD Core - Complex Value Object Interactions", async (t) => {
  await t.step("Configuration and Processing Pipeline", () => {
    // Create configuration paths
    const configPath = ConfigPath.create("config/app.json");
    const schemaPath = ConfigPath.create("schemas/main.yaml");
    const outputPath = OutputPath.create("output/results.json");

    // Create processing options
    const options = ProcessingOptions.create({
      parallel: true,
      maxConcurrency: 10,
      continueOnError: false,
    });

    // Verify all created successfully
    assertEquals(isOk(configPath), true);
    assertEquals(isOk(schemaPath), true);
    assertEquals(isOk(outputPath), true);
    assertEquals(isOk(options), true);

    if (
      isOk(configPath) && isOk(schemaPath) && isOk(outputPath) && isOk(options)
    ) {
      // Test path resolution
      const resolvedConfig = configPath.data.resolve("/project");
      const resolvedSchema = schemaPath.data.resolve("/project");

      assertEquals(resolvedConfig, "/project/config/app.json");
      assertEquals(resolvedSchema, "/project/schemas/main.yaml");

      // Test output path modification
      const jsonOutput = outputPath.data.withExtension("json");
      const yamlOutput = outputPath.data.withExtension("yaml");

      assertEquals(jsonOutput.getValue(), "output/results.json");
      assertEquals(yamlOutput.getValue(), "output/results.yaml");

      // Test processing options
      assertEquals(options.data.isParallel(), true);
      assertEquals(options.data.getMaxConcurrency(), 10);
    }
  });

  await t.step("Schema and Template Coordination", () => {
    // Create a schema that matches template expectations
    const schemaResult = SchemaDefinition.create({
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" },
        date: { type: "string", format: "date" },
      },
      required: ["title", "author"],
    }, "1.0.0");

    // Create corresponding template
    const templateResult = TemplateFormat.create(
      "json",
      JSON.stringify({
        documentTitle: "{{title}}",
        writtenBy: "{{author}}",
        publishedOn: "{{date}}",
      }),
    );

    // Create mapping rules for transformation
    const mappingRules = [
      MappingRule.create("title", "documentTitle"),
      MappingRule.create("author", "writtenBy"),
      MappingRule.create("date", "publishedOn", (value: unknown) => {
        // Transform date to ISO string
        return value ? new Date(String(value)).toISOString() : null;
      }),
    ];

    // Verify all components work together
    assertEquals(isOk(schemaResult), true);
    assertEquals(isOk(templateResult), true);
    assertEquals(mappingRules.every(isOk), true);

    if (isOk(schemaResult) && isOk(templateResult)) {
      assertEquals(schemaResult.data.getVersion(), "1.0.0");
      assertEquals(templateResult.data.getFormat(), "json");
    }
  });
});
