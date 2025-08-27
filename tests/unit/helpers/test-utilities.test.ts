/**
 * Comprehensive tests for test-utilities.ts
 * Improving coverage from 7.5% to target 95%+
 * Following AAA pattern and Totality principles
 */

import { assert, assertEquals, assertRejects } from "jsr:@std/assert";
import {
  MockAnalysisStrategy,
  PerformanceTestUtils,
  ResultAssertions,
  SampleDataGenerator,
  TestCleanup,
  TestContextFactory,
  TestDataBuilder,
  TestWithBreakdown,
} from "../../helpers/test-utilities.ts";
import { createDomainError } from "../../../src/domain/core/result.ts";

Deno.test("TestDataBuilder", async (t) => {
  await t.step("validFilePath creates valid DocumentPath", () => {
    // Act
    const path = TestDataBuilder.validFilePath("/test/file.md");

    // Assert
    assert(path);
    assertEquals(path.getValue(), "/test/file.md");
  });

  await t.step("validFilePath uses default path when not provided", () => {
    // Act
    const path = TestDataBuilder.validFilePath();

    // Assert
    assertEquals(path.getValue(), "/test/sample.md");
  });

  await t.step("markdownFilePath creates valid markdown DocumentPath", () => {
    // Act
    const path = TestDataBuilder.markdownFilePath("/test/document.md");

    // Assert
    assert(path);
    assertEquals(path.getValue(), "/test/document.md");
  });

  await t.step("markdownFilePath uses default when not provided", () => {
    // Act
    const path = TestDataBuilder.markdownFilePath();

    // Assert
    assertEquals(path.getValue(), "/test/sample.md");
  });

  await t.step("frontMatterContent creates from object", () => {
    // Arrange
    const data = { title: "Test Title", version: 1 };

    // Act
    const content = TestDataBuilder.frontMatterContent(data);

    // Assert
    assert(content);
    // FrontMatterContent doesn't have toObject method, just verify it was created
    assert(content.getValue().includes("Test Title"));
  });

  await t.step("frontMatterContent uses default when not provided", () => {
    // Act
    const content = TestDataBuilder.frontMatterContent();

    // Assert
    assert(content);
    // Verify default value is present
    assert(content.getValue().includes("Test"));
  });

  await t.step("frontMatterFromYaml creates from YAML string", () => {
    // Arrange
    const yaml = "title: Test\nversion: 2\ntags:\n  - test\n  - yaml";

    // Act
    const content = TestDataBuilder.frontMatterFromYaml(yaml);

    // Assert
    assert(content);
    // Verify YAML content is present
    assert(content.getValue().includes("title"));
    assert(content.getValue().includes("Test"));
  });

  await t.step("schemaDefinition creates valid SchemaDefinition", () => {
    // Arrange
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
    };

    // Act
    const definition = TestDataBuilder.schemaDefinition(schema);

    // Assert
    assert(definition);
    const def = definition.getDefinition() as Record<string, unknown>;
    assertEquals(def.type, "object");
  });

  await t.step("schemaDefinition uses default when not provided", () => {
    // Act
    const definition = TestDataBuilder.schemaDefinition();

    // Assert
    assert(definition);
    const def = definition.getDefinition() as Record<string, unknown>;
    assertEquals(def.type, "object");
  });

  await t.step("sourceFile creates DocumentPath", () => {
    // Act
    const path = TestDataBuilder.sourceFile(
      "/test/source.md",
      "# Content",
      { title: "Test" },
    );

    // Assert
    assert(path);
    assertEquals(path.getValue(), "/test/source.md");
  });

  await t.step("analysisResult creates valid AnalysisResult", () => {
    // Arrange
    const extractedData = { name: "TestData", value: 42 };
    const metadata = new Map<string, unknown>([
      ["key1", "value1"],
      ["key2", 123],
    ]);

    // Act
    const result = TestDataBuilder.analysisResult(
      "/test/analysis.md",
      extractedData,
      metadata,
    );

    // Assert
    assert(result);
    assertEquals(result.extractedData.name, "TestData");
    assertEquals(result.extractedData.value, 42);
    assertEquals(result.getMetadata("key1"), "value1");
    assertEquals(result.getMetadata("key2"), 123);
  });

  await t.step("analysisResult uses defaults when not provided", () => {
    // Act
    const result = TestDataBuilder.analysisResult();

    // Assert
    assert(result);
    const data = result.extractedData as { title: string };
    assertEquals(data.title, "Test");
  });
});

Deno.test("ResultAssertions", async (t) => {
  await t.step("assertSuccess returns data for successful result", () => {
    // Arrange
    const result = { ok: true as const, data: "success" };

    // Act
    const data = ResultAssertions.assertSuccess(result);

    // Assert
    assertEquals(data, "success");
  });

  await t.step("assertSuccess throws for error result", () => {
    // Arrange
    const result = {
      ok: false as const,
      error: { message: "failed" },
    };

    // Act & Assert
    try {
      ResultAssertions.assertSuccess(result);
      assert(false, "Should have thrown");
    } catch (error) {
      assert(error instanceof Error);
    }
  });

  await t.step("assertError returns error for failed result", () => {
    // Arrange
    const result = {
      ok: false as const,
      error: { message: "error", kind: "ValidationError" },
    };

    // Act
    const error = ResultAssertions.assertError(result);

    // Assert
    assertEquals(error.message, "error");
    assertEquals(error.kind, "ValidationError");
  });

  await t.step("assertError validates error kind when provided", () => {
    // Arrange
    const result = {
      ok: false as const,
      error: { message: "error", kind: "ValidationError" },
    };

    // Act
    const error = ResultAssertions.assertError(
      result,
      "ValidationError",
      "Expected validation error",
    );

    // Assert
    assertEquals(error.kind, "ValidationError");
  });

  await t.step("assertError throws for success result", () => {
    // Arrange
    const result = { ok: true as const, data: "success" };

    // Act & Assert
    try {
      ResultAssertions.assertError(result);
      assert(false, "Should have thrown");
    } catch (error) {
      assert(error instanceof Error);
    }
  });

  await t.step("assertValidationError validates ValidationError", () => {
    // Arrange
    const result = {
      ok: false as const,
      error: createDomainError({
        kind: "EmptyInput",
        field: "test",
      }),
    };

    // Act
    const error = ResultAssertions.assertValidationError(
      result,
      "EmptyInput",
    );

    // Assert
    assertEquals(error.kind, "EmptyInput");
  });

  await t.step("assertAnalysisError validates AnalysisError", () => {
    // Arrange
    const result = {
      ok: false as const,
      error: createDomainError({
        kind: "ExtractionStrategyFailed",
        strategy: "test",
        input: {},
      }),
    };

    // Act
    const error = ResultAssertions.assertAnalysisError(
      result,
      "ExtractionStrategyFailed",
    );

    // Assert
    assertEquals(error.kind, "ExtractionStrategyFailed");
  });
});

Deno.test("MockAnalysisStrategy", async (t) => {
  await t.step("execute returns success when configured", async () => {
    // Arrange
    const strategy = new MockAnalysisStrategy("test", {
      shouldSucceed: true,
      resultData: { value: 42 },
    });
    const context = TestContextFactory.basicExtraction();

    // Act
    const result = await strategy.execute("input", context);

    // Assert
    assert(result.ok);
    if (result.ok) {
      assertEquals(result.data.value, 42);
    }
  });

  await t.step("execute returns error when configured", async () => {
    // Arrange
    const strategy = new MockAnalysisStrategy("test", {
      shouldSucceed: false,
      errorKind: "SchemaValidationFailed",
    });
    const context = TestContextFactory.basicExtraction();

    // Act
    const result = await strategy.execute("input", context);

    // Assert
    assert(!result.ok);
    if (!result.ok) {
      assertEquals(result.error.kind, "SchemaValidationFailed");
    }
  });

  await t.step("setSuccess updates strategy behavior", async () => {
    // Arrange
    const strategy = new MockAnalysisStrategy("test", {
      shouldSucceed: false,
    });
    const context = TestContextFactory.basicExtraction();

    // Act
    strategy.setSuccess(true, { updated: true });
    const result = await strategy.execute("input", context);

    // Assert
    assert(result.ok);
    if (result.ok) {
      const data = result.data as { updated: boolean };
      assertEquals(data.updated, true);
    }
  });

  await t.step("setError updates strategy to fail", async () => {
    // Arrange
    const strategy = new MockAnalysisStrategy("test", {
      shouldSucceed: true,
    });
    const context = TestContextFactory.basicExtraction();

    // Act
    strategy.setError("TemplateMappingFailed");
    const result = await strategy.execute("input", context);

    // Assert
    assert(!result.ok);
    if (!result.ok) {
      assertEquals(result.error.kind, "TemplateMappingFailed");
    }
  });
});

Deno.test("TestContextFactory", async (t) => {
  await t.step("schemaAnalysis creates SchemaAnalysis context", () => {
    // Arrange
    const schema = TestDataBuilder.schemaDefinition();

    // Act
    const context = TestContextFactory.schemaAnalysis(
      schema,
      { includeMetadata: false },
      "/test/doc.md",
    );

    // Assert
    assertEquals(context.kind, "SchemaAnalysis");
    assertEquals(context.document, "/test/doc.md");
    if (context.kind === "SchemaAnalysis") {
      assert(context.schema);
      if (context.options) {
        assertEquals(context.options.includeMetadata, false);
      }
    }
  });

  await t.step("schemaAnalysis uses defaults when not provided", () => {
    // Act
    const context = TestContextFactory.schemaAnalysis();

    // Assert
    assertEquals(context.kind, "SchemaAnalysis");
    assertEquals(context.document, "/test/sample.md");
    if (context.kind === "SchemaAnalysis") {
      assert(context.schema);
      if (context.options) {
        assertEquals(context.options.includeMetadata, true);
      }
    }
  });

  await t.step("templateMapping creates TemplateMapping context", () => {
    // Arrange
    const template = { template: "custom", variables: { name: "test" } };
    const schema = TestDataBuilder.schemaDefinition();

    // Act
    const context = TestContextFactory.templateMapping(
      template,
      schema,
      "/test/template.md",
    );

    // Assert
    assertEquals(context.kind, "TemplateMapping");
    assertEquals(context.document, "/test/template.md");
    if (context.kind === "TemplateMapping") {
      assertEquals(context.template, template);
    }
  });

  await t.step("validationOnly creates ValidationOnly context", () => {
    // Arrange
    const schema = TestDataBuilder.schemaDefinition();

    // Act
    const context = TestContextFactory.validationOnly(
      schema,
      "/test/validate.md",
    );

    // Assert
    assertEquals(context.kind, "ValidationOnly");
    assertEquals(context.document, "/test/validate.md");
    if (context.kind === "ValidationOnly") {
      assert(context.schema);
    }
  });

  await t.step("basicExtraction creates BasicExtraction context", () => {
    // Act
    const context = TestContextFactory.basicExtraction(
      { includeMetadata: false },
      "/test/extract.md",
    );

    // Assert
    assertEquals(context.kind, "BasicExtraction");
    assertEquals(context.document, "/test/extract.md");
    if (context.kind === "BasicExtraction" && context.options) {
      assertEquals(context.options.includeMetadata, false);
    }
  });
});

Deno.test("SampleDataGenerator", async (t) => {
  await t.step("frontMatter generates data for different domains", () => {
    // Test each domain
    const domains = ["git", "spec", "build", "test", "docs"] as const;

    for (const domain of domains) {
      const data = SampleDataGenerator.frontMatter(domain);

      assertEquals(data.domain, domain);
      assert(data.version);
      assert(data.active);
      assert(data.action);
      assert(data.target);
      assert(data.description);
      assert(data.complexity);
      assert(Array.isArray(data.tags));
      assert(data.tags.length > 0);
    }
  });

  await t.step("markdownWithFrontMatter generates complete markdown", () => {
    // Act
    const markdown = SampleDataGenerator.markdownWithFrontMatter("git");

    // Assert
    assert(markdown.includes("---"));
    assert(markdown.includes('domain: "git"'));
    assert(markdown.includes("# Git Create Command"));
    assert(markdown.includes("## Usage"));
    assert(markdown.includes("## Options"));
    assert(markdown.includes("## Examples"));
    assert(markdown.includes("climpt-git"));
  });

  await t.step("commandSchema generates valid JSON schema", () => {
    // Act
    const schema = SampleDataGenerator.commandSchema();

    // Assert
    assertEquals(schema.type, "object");
    assert(schema.properties);
    assert(schema.properties.domain);
    assert(schema.properties.action);
    assert(schema.required);
    assert(Array.isArray(schema.required));
  });

  await t.step("commandTemplate generates template structure", () => {
    // Act
    const template = SampleDataGenerator.commandTemplate();

    // Assert
    assert(template.structure);
    assertEquals(template.structure.c1, "unknown");
    assertEquals(template.structure.c2, "unknown");
    assertEquals(template.structure.c3, "unknown");
    assert(template.structure.metadata);
    assert(template.mappingRules);
  });
});

Deno.test("PerformanceTestUtils", async (t) => {
  await t.step("measureTime measures async function execution", async () => {
    // Arrange
    const testFn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "result";
    };

    // Act
    const { result, duration } = await PerformanceTestUtils.measureTime(
      testFn,
      "Test operation",
    );

    // Assert
    assertEquals(result, "result");
    assert(duration >= 10);
    assert(duration < 100); // Should not take more than 100ms
  });

  await t.step("benchmarkFunction runs multiple iterations", async () => {
    // Arrange
    let counter = 0;
    const testFn = () => {
      counter++;
      return Promise.resolve(counter);
    };

    // Act
    const benchmark = await PerformanceTestUtils.benchmarkFunction(
      testFn,
      5,
      "Test benchmark",
    );

    // Assert
    assertEquals(benchmark.results.length, 5);
    assertEquals(benchmark.results[0], 1);
    assertEquals(benchmark.results[4], 5);
    assert(benchmark.totalTime >= 0);
    assert(benchmark.averageTime >= 0);
    assert(benchmark.minTime >= 0);
    assert(benchmark.maxTime >= benchmark.minTime);
    assert(benchmark.throughput > 0);
  });

  await t.step("assertPerformance passes when within limit", () => {
    // Act & Assert (should not throw)
    PerformanceTestUtils.assertPerformance(50, 100, "Fast operation");
  });

  await t.step("assertPerformance fails when exceeding limit", () => {
    // Act & Assert
    try {
      PerformanceTestUtils.assertPerformance(150, 100, "Slow operation");
      assert(false, "Should have thrown");
    } catch (error) {
      assert(error instanceof Error);
      assert(error.message.includes("exceeds the maximum"));
    }
  });
});

Deno.test("TestWithBreakdown", async (t) => {
  await t.step("runTest executes all phases successfully", async () => {
    // Arrange
    const test = new TestWithBreakdown("TestExample", "domain");
    let arrangeExecuted = false;
    let actExecuted = false;
    let assertExecuted = false;

    // Act
    await test.runTest(
      () => {
        arrangeExecuted = true;
      },
      () => {
        actExecuted = true;
        return "result";
      },
      (result) => {
        assertExecuted = true;
        assertEquals(result, "result");
      },
    );

    // Assert
    assert(arrangeExecuted);
    assert(actExecuted);
    assert(assertExecuted);
  });

  await t.step("runTest executes cleanup when provided", async () => {
    // Arrange
    const test = new TestWithBreakdown("TestWithCleanup");
    let cleanupExecuted = false;

    // Act
    await test.runTest(
      () => {},
      () => "result",
      () => {},
      () => {
        cleanupExecuted = true;
      },
    );

    // Assert
    assert(cleanupExecuted);
  });

  await t.step("runTest propagates arrange phase errors", async () => {
    // Arrange
    const test = new TestWithBreakdown("TestArrangeError");

    // Act & Assert
    await assertRejects(
      () =>
        test.runTest(
          () => {
            throw new Error("Arrange failed");
          },
          () => "result",
          () => {},
        ),
      Error,
      "Arrange failed",
    );
  });

  await t.step("runTest propagates act phase errors", async () => {
    // Arrange
    const test = new TestWithBreakdown("TestActError");

    // Act & Assert
    await assertRejects(
      () =>
        test.runTest(
          () => {},
          () => {
            throw new Error("Act failed");
          },
          () => {},
        ),
      Error,
      "Act failed",
    );
  });

  await t.step("runTest propagates assert phase errors", async () => {
    // Arrange
    const test = new TestWithBreakdown("TestAssertError");

    // Act & Assert
    await assertRejects(
      () =>
        test.runTest(
          () => {},
          () => "result",
          () => {
            throw new Error("Assert failed");
          },
        ),
      Error,
      "Assert failed",
    );
  });

  await t.step("runTest propagates cleanup phase errors", async () => {
    // Arrange
    const test = new TestWithBreakdown("TestCleanupError");

    // Act & Assert
    await assertRejects(
      () =>
        test.runTest(
          () => {},
          () => "result",
          () => {},
          () => {
            throw new Error("Cleanup failed");
          },
        ),
      Error,
      "Cleanup failed",
    );
  });

  await t.step("getLogger returns TestScopeLogger", () => {
    // Arrange
    const test = new TestWithBreakdown("TestLogger");

    // Act
    const logger = test.getLogger();

    // Assert
    assert(logger);
  });
});

Deno.test("TestCleanup", async (t) => {
  await t.step("register and runAll executes cleanup tasks", async () => {
    // Arrange
    let task1Executed = false;
    let task2Executed = false;

    TestCleanup.register(() => {
      task1Executed = true;
    });

    TestCleanup.register(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      task2Executed = true;
    });

    // Act
    await TestCleanup.runAll();

    // Assert
    assert(task1Executed);
    assert(task2Executed);
  });

  await t.step("runAll clears tasks after execution", async () => {
    // Arrange
    let executionCount = 0;
    TestCleanup.register(() => {
      executionCount++;
    });

    // Act
    await TestCleanup.runAll();
    await TestCleanup.runAll(); // Second call should not execute anything

    // Assert
    assertEquals(executionCount, 1);
  });

  await t.step("createTempRegistry creates and registers cleanup", async () => {
    // Arrange & Act
    const registry = TestCleanup.createTempRegistry<string>();
    const testResult = TestDataBuilder.analysisResult("/test.md", "value");
    registry.add("test", testResult);

    // Assert
    const retrieved = registry.get("test");
    assert(retrieved);
    assertEquals(retrieved.extractedData, "value");

    // Act - cleanup
    await TestCleanup.runAll();

    // Assert - registry should be cleared
    assertEquals(registry.get("test"), undefined);
  });
});
