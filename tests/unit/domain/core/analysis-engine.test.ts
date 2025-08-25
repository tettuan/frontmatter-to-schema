import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  type AnalysisEngine,
  type AnalysisStrategy,
  ContextualAnalysisProcessor,
  FrontMatterExtractionStrategy,
  GenericAnalysisEngine,
  RobustSchemaAnalyzer,
  RobustTemplateMapper,
  SchemaMappingStrategy,
} from "../../../../src/domain/core/analysis-engine.ts";
import {
  ComponentDomain,
  FactoryConfigurationBuilder,
} from "../../../../src/domain/core/component-factory.ts";
import type { AnalysisContext } from "../../../../src/domain/core/types.ts";
import {
  FrontMatterContent,
} from "../../../../src/domain/models/value-objects.ts";
import { SchemaDefinition } from "../../../../src/domain/models/schema.ts";
import {
  type AnalysisError,
  createDomainError,
  type Result,
} from "../../../../src/domain/core/result.ts";

// Test helper functions
const createTestFrontMatterContent = (data: Record<string, unknown>) => {
  const result = FrontMatterContent.fromObject(data);
  if (!result.ok) throw new Error("Failed to create test FrontMatterContent");
  return result.data;
};

const createTestSchemaDefinition = (schema: unknown) => {
  const result = SchemaDefinition.create(schema, "json");
  if (!result.ok) throw new Error("Failed to create test SchemaDefinition");
  return result.data;
};

// Mock Analysis Strategy for testing
class MockAnalysisStrategy {
  readonly name = "MockAnalysisStrategy";
  private shouldSucceed: boolean;
  private resultData: unknown;

  constructor(shouldSucceed = true, resultData: unknown = "mock result") {
    this.shouldSucceed = shouldSucceed;
    this.resultData = resultData;
  }

  execute(
    input: unknown,
    _context: AnalysisContext,
  ): Promise<Result<unknown, unknown>> {
    if (this.shouldSucceed) {
      return Promise.resolve({ ok: true, data: this.resultData });
    }
    return Promise.resolve({
      ok: false,
      error: createDomainError({
        kind: "ExtractionStrategyFailed",
        strategy: this.name,
        input,
      }),
    });
  }
}

Deno.test({
  name: "GenericAnalysisEngine",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async (t) => {
    await t.step(
      "should analyze successfully with valid input and strategy",
      async () => {
        const engine = new GenericAnalysisEngine();
        const strategy = new MockAnalysisStrategy(true, "success result");

        const result = await engine.analyze(
          "test input",
          strategy as AnalysisStrategy<unknown, unknown>,
        );

        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data, "success result");
        }
      },
    );

    await t.step("should reject null input", async () => {
      const engine = new GenericAnalysisEngine();
      const strategy = new MockAnalysisStrategy(true, "should not reach");

      const result = await engine.analyze(
        null,
        strategy as AnalysisStrategy<unknown, unknown>,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ExtractionStrategyFailed");
      }
    });

    await t.step("should reject undefined input", async () => {
      const engine = new GenericAnalysisEngine();
      const strategy = new MockAnalysisStrategy(true, "should not reach");

      const result = await engine.analyze(
        undefined,
        strategy as AnalysisStrategy<unknown, unknown>,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ExtractionStrategyFailed");
      }
    });

    await t.step("should propagate strategy execution error", async () => {
      const engine = new GenericAnalysisEngine();
      const strategy = new MockAnalysisStrategy(false);

      const result = await engine.analyze(
        "test input",
        strategy as AnalysisStrategy<unknown, unknown>,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ExtractionStrategyFailed");
      }
    });

    await t.step({
      name: "should handle timeout",
      sanitizeResources: false,
      sanitizeOps: false,
      fn: async () => {
        const engine = new GenericAnalysisEngine(100); // 100ms timeout

        // Mock strategy that takes longer than timeout
        const slowStrategy: AnalysisStrategy<unknown, string> = {
          name: "SlowStrategy",
          async execute(
            _input: unknown,
            _context: unknown,
          ): Promise<Result<string, AnalysisError & { message: string }>> {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return { ok: true, data: "should timeout" };
          },
        };

        const result = await engine.analyze("test input", slowStrategy);

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "AnalysisTimeout");
          // Type assertion needed for accessing timeoutMs property
          assertEquals((result.error as { timeoutMs: number }).timeoutMs, 100);
        }
      },
    });

    await t.step("should handle strategy execution exception", async () => {
      const engine = new GenericAnalysisEngine();

      const throwingStrategy: AnalysisStrategy<unknown, unknown> = {
        name: "ThrowingStrategy",
        execute(
          _input: unknown,
          _context: unknown,
        ): Promise<Result<unknown, AnalysisError & { message: string }>> {
          return Promise.reject(new Error("Strategy execution failed"));
        },
      };

      const result = await engine.analyze("test input", throwingStrategy);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ExtractionStrategyFailed");
      }
    });
  },
});

Deno.test("RobustSchemaAnalyzer", async (t) => {
  await t.step(
    "should process data successfully with valid schema",
    async () => {
      const analyzer = new RobustSchemaAnalyzer<
        Record<string, unknown>,
        Record<string, unknown>
      >();
      const data = createTestFrontMatterContent({ title: "Test", count: 42 });
      const schema = createTestSchemaDefinition({ type: "object" });

      const result = await analyzer.process(
        data,
        schema as SchemaDefinition,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals((result.data as Record<string, unknown>).title, "Test");
        assertEquals((result.data as Record<string, unknown>).count, 42);
      }
    },
  );

  await t.step("should fail when schema validation fails", async () => {
    const analyzer = new RobustSchemaAnalyzer<
      Record<string, unknown>,
      Record<string, unknown>
    >();
    const data = createTestFrontMatterContent({ title: "Test" });

    // Create a schema that will fail validation (simulate validation failure)
    const invalidSchema = new (class {
      constructor(public schema: Record<string, unknown>) {}
      validate(_data: unknown) {
        return {
          ok: false,
          error: createDomainError({ kind: "EmptyInput" }),
        };
      }
    })({ type: "object" });

    const result = await analyzer.process(
      data,
      invalidSchema as unknown as SchemaDefinition,
    );

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "SchemaValidationFailed");
    }
  });
});

Deno.test("RobustTemplateMapper", async (t) => {
  await t.step("should map source to template successfully", async () => {
    const mapper = new RobustTemplateMapper<
      Record<string, unknown>,
      Record<string, unknown>
    >();
    const source = { title: "Test", count: 42 };
    const template = {
      structure: {
        name: "default",
        value: "default_value",
        category: "test",
      },
    };

    const result = await mapper.map(source, template) as {
      structure: { name: string; value: string; category: string };
    };

    // The new map method returns the template directly
    assertEquals(result.structure.name, "default");
    assertEquals(result.structure.value, "default_value");
    assertEquals(result.structure.category, "test");
  });

  await t.step("should handle null source", async () => {
    const mapper = new RobustTemplateMapper<
      Record<string, unknown>,
      Record<string, unknown>
    >();
    const template = { template: "default", variables: { name: "default" } };

    const result = await mapper.map(
      null as unknown as Record<string, unknown>,
      template,
    ) as { structure: { name: string } };

    // The new map method just returns the template
    assertEquals(result.structure.name, "default");
  });

  await t.step("should handle undefined source", async () => {
    const mapper = new RobustTemplateMapper<
      Record<string, unknown>,
      Record<string, unknown>
    >();
    const template = { template: "default", variables: { name: "default" } };

    const result = await mapper.map(
      undefined as unknown as Record<string, unknown>,
      template,
    ) as { structure: { name: string } };

    // The new map method just returns the template
    assertEquals(result.structure.name, "default");
  });

  await t.step("should handle non-object source", async () => {
    const mapper = new RobustTemplateMapper<
      Record<string, unknown>,
      Record<string, unknown>
    >();
    const template = { template: "default", variables: { name: "default" } };

    const result = await mapper.map(
      "primitive value" as unknown as Record<string, unknown>,
      template,
    ) as { structure: { name: string } };

    // The new map method just returns the template
    assertEquals(result.structure.name, "default");
  });
});

Deno.test("ContextualAnalysisProcessor", async (t) => {
  const mockEngine = new GenericAnalysisEngine();
  const mockSchemaAnalyzer = new RobustSchemaAnalyzer<
    Record<string, unknown>,
    Record<string, unknown>
  >();
  const mockTemplateMapper = new RobustTemplateMapper<
    Record<string, unknown>,
    Record<string, unknown>
  >();

  await t.step("should process SchemaAnalysis context", async () => {
    const processor = new ContextualAnalysisProcessor(
      mockEngine,
      mockSchemaAnalyzer,
      mockTemplateMapper,
    );

    const data = createTestFrontMatterContent({ title: "Test" });
    const schema = createTestSchemaDefinition({ type: "object" });
    const context: AnalysisContext = {
      kind: "SchemaAnalysis",
      document: "test",
      schema,
      options: { includeMetadata: true },
    };

    const result = await processor.processWithContext(data, context);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as Record<string, unknown>).title, "Test");
    }
  });

  await t.step(
    "should process TemplateMapping context without schema",
    async () => {
      const processor = new ContextualAnalysisProcessor(
        mockEngine,
        mockSchemaAnalyzer,
        mockTemplateMapper,
      );

      const data = createTestFrontMatterContent({ title: "Test" });
      const context: AnalysisContext = {
        kind: "TemplateMapping",
        document: "test",
        template: { template: "default", variables: { name: "default" } },
      };

      const result = await processor.processWithContext(data, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals((result.data as Record<string, unknown>).title, "Test");
        assertEquals((result.data as Record<string, unknown>).name, "default");
      }
    },
  );

  await t.step(
    "should process TemplateMapping context with schema",
    async () => {
      const processor = new ContextualAnalysisProcessor(
        mockEngine,
        mockSchemaAnalyzer,
        mockTemplateMapper,
      );

      const data = createTestFrontMatterContent({ title: "Test" });
      const schema = createTestSchemaDefinition({ type: "object" });
      const context: AnalysisContext = {
        kind: "TemplateMapping",
        document: "test",
        template: { template: "default", variables: { name: "default" } },
        schema,
      };

      const result = await processor.processWithContext(data, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals((result.data as Record<string, unknown>).title, "Test");
        assertEquals((result.data as Record<string, unknown>).name, "default");
      }
    },
  );

  await t.step("should process ValidationOnly context", async () => {
    const processor = new ContextualAnalysisProcessor(
      mockEngine,
      mockSchemaAnalyzer,
      mockTemplateMapper,
    );

    const data = createTestFrontMatterContent({ title: "Test" });
    const schema = createTestSchemaDefinition({ type: "object" });
    const context: AnalysisContext = {
      kind: "ValidationOnly",
      document: "/test/sample.md",
      schema: {
        validate: (data: unknown) => ({ ok: true, data }),
        schema: schema.getDefinition(),
      },
    };

    const result = await processor.processWithContext(data, context);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as Record<string, unknown>).title, "Test");
    }
  });

  await t.step("should process BasicExtraction context", async () => {
    const processor = new ContextualAnalysisProcessor(
      mockEngine,
      mockSchemaAnalyzer,
      mockTemplateMapper,
    );

    const data = createTestFrontMatterContent({
      title: "Test",
      author: "John",
    });
    const context: AnalysisContext = {
      kind: "BasicExtraction",
      document: "test",
      options: { includeMetadata: true },
    };

    const result = await processor.processWithContext(data, context);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as Record<string, unknown>).title, "Test");
      assertEquals((result.data as Record<string, unknown>).author, "John");
      const metadata = (result.data as Record<string, unknown>)
        .extractionMetadata as Record<string, unknown>;
      assertEquals(metadata.keyCount, 2);
      assertEquals(metadata.includeMetadata, true);
      assertEquals(typeof metadata.extractedAt, "string");
    }
  });

  await t.step(
    "should handle BasicExtraction context without includeMetadata",
    async () => {
      const processor = new ContextualAnalysisProcessor(
        mockEngine,
        mockSchemaAnalyzer,
        mockTemplateMapper,
      );

      const data = createTestFrontMatterContent({ title: "Test" });
      const context: AnalysisContext = {
        kind: "BasicExtraction",
        document: "test",
        options: {},
      };

      const result = await processor.processWithContext(data, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const metadata = (result.data as Record<string, unknown>)
          .extractionMetadata as Record<string, unknown>;
        assertEquals(metadata.includeMetadata, false);
      }
    },
  );
});

Deno.test("AnalysisDomainFactory via FactoryConfigurationBuilder", async (t) => {
  await t.step("should create default components", () => {
    const factory = FactoryConfigurationBuilder.createDefault();
    const components = factory.createDomainComponents(
      ComponentDomain.Analysis,
    ) as {
      engine: AnalysisEngine;
      processor: ContextualAnalysisProcessor;
    };

    assertEquals(components.engine instanceof GenericAnalysisEngine, true);
    assertEquals(
      components.processor instanceof ContextualAnalysisProcessor,
      true,
    );
  });

  await t.step("should create components with custom configuration", () => {
    const factory = new FactoryConfigurationBuilder()
      .withAnalysisDomain()
      .build();
    const components = factory.createDomainComponents(
      ComponentDomain.Analysis,
    ) as {
      engine: AnalysisEngine;
      processor: ContextualAnalysisProcessor;
    };

    assertEquals(components.engine instanceof GenericAnalysisEngine, true);
    assertEquals(
      components.processor instanceof ContextualAnalysisProcessor,
      true,
    );
  });
});

Deno.test("FrontMatterExtractionStrategy", async (t) => {
  await t.step("should extract frontmatter from markdown content", async () => {
    const strategy = new FrontMatterExtractionStrategy();
    const markdown = `---
title: Test Document
author: John Doe
---

# Content`;

    const context: AnalysisContext = {
      kind: "BasicExtraction",
      document: "test",
      options: {},
    };

    const result = await strategy.execute(markdown, context);

    assertEquals(result.ok, true);
    if (result.ok) {
      const frontMatter = result.data as unknown as {
        get: (key: string) => unknown;
      };
      assertEquals(frontMatter.get("title"), "Test Document");
      assertEquals(frontMatter.get("author"), "John Doe");
    }
  });

  await t.step("should fail when no frontmatter present", async () => {
    const strategy = new FrontMatterExtractionStrategy();
    const markdown = `# Just a regular markdown file

No frontmatter here.`;

    const context: AnalysisContext = {
      kind: "BasicExtraction",
      document: "test",
      options: {},
    };

    const result = await strategy.execute(markdown, context);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ExtractionStrategyFailed");
      assertEquals(
        (result.error as AnalysisError & {
          strategy?: string;
          input?: string;
          timeoutMs?: number;
        }).strategy,
        "FrontMatterExtractionStrategy",
      );
    }
  });

  await t.step("should handle YAML parsing error", async () => {
    const strategy = new FrontMatterExtractionStrategy();
    const markdown = `---
title Test Document (missing colon)
---

# Content`;

    const context: AnalysisContext = {
      kind: "BasicExtraction",
      document: "test",
      options: {},
    };

    const result = await strategy.execute(markdown, context);

    assertEquals(result.ok, true); // Our simple parser should still work
    if (result.ok) {
      // The line without colon should be ignored
      const frontMatter = result.data as unknown as { size: () => number };
      assertEquals(frontMatter.size(), 0);
    }
  });

  await t.step("should truncate long input in error message", async () => {
    const strategy = new FrontMatterExtractionStrategy();
    const longMarkdown = "a".repeat(200); // Long content without frontmatter

    const context: AnalysisContext = {
      kind: "BasicExtraction",
      document: "test",
      options: {},
    };

    const result = await strategy.execute(longMarkdown, context);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ExtractionStrategyFailed");
      // Should truncate input in error
      const errorWithInput = result.error as AnalysisError & {
        strategy?: string;
        input?: string;
        timeoutMs?: number;
      };
      assertEquals(errorWithInput.input?.length, 103); // 100 + "..."
    }
  });
});

Deno.test("SchemaMappingStrategy", async (t) => {
  await t.step(
    "should map frontmatter content with valid schema context",
    async () => {
      const schema = createTestSchemaDefinition({ type: "object" });
      const strategy = new SchemaMappingStrategy(schema);
      const data = createTestFrontMatterContent({ title: "Test", count: 42 });

      const context: AnalysisContext = {
        kind: "SchemaAnalysis",
        document: "test",
        schema,
        options: {},
      };

      const result = await strategy.execute(data, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals((result.data as Record<string, unknown>).title, "Test");
        assertEquals((result.data as Record<string, unknown>).count, 42);
      }
    },
  );

  await t.step("should fail with invalid analysis context", async () => {
    const schema = createTestSchemaDefinition({ type: "object" });
    const strategy = new SchemaMappingStrategy(schema);
    const data = createTestFrontMatterContent({ title: "Test" });

    const context: AnalysisContext = {
      kind: "BasicExtraction",
      document: "test",
      options: {},
    };

    const result = await strategy.execute(data, context);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidAnalysisContext");
    }
  });
});

Deno.test("Integration: Complete Analysis Workflow", async (t) => {
  await t.step("should perform complete analysis workflow", async () => {
    // Create components
    const factory = FactoryConfigurationBuilder.createDefault();
    const components = factory.createDomainComponents(
      ComponentDomain.Analysis,
    ) as {
      engine: AnalysisEngine;
      processor: ContextualAnalysisProcessor;
    };
    const { engine: _engine, processor } = components;

    // Create test data
    const data = createTestFrontMatterContent({
      title: "Integration Test",
      author: "Test Author",
      version: 1,
    });

    const schema = createTestSchemaDefinition({
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" },
        version: { type: "number" },
      },
    });

    // Test SchemaAnalysis workflow
    const schemaContext: AnalysisContext = {
      kind: "SchemaAnalysis",
      document: "test",
      schema,
      options: { includeMetadata: true, validateResults: true },
    };

    const schemaResult = await processor.processWithContext(
      data,
      schemaContext,
    );

    assertEquals(schemaResult.ok, true);
    if (schemaResult.ok) {
      const data = schemaResult.data as Record<string, unknown>;
      assertEquals(data.title, "Integration Test");
      assertEquals(data.author, "Test Author");
      assertEquals(data.version, 1);
    }

    // Test TemplateMapping workflow
    const templateContext: AnalysisContext = {
      kind: "TemplateMapping",
      document: "test",
      template: {
        template: "test template",
        structure: {
          name: "processed_document",
          category: "test",
          processed: true,
        },
      },
      schema,
    };

    const templateResult = await processor.processWithContext(
      data,
      templateContext,
    );

    assertEquals(templateResult.ok, true);
    if (templateResult.ok) {
      const data = templateResult.data as Record<string, unknown>;
      assertEquals(data.title, "Integration Test");
      assertEquals(data.name, "processed_document");
      assertEquals(data.category, "test");
      assertEquals(data.processed, true);
    }
  });

  await t.step(
    "should handle end-to-end FrontMatter extraction workflow",
    async () => {
      const strategy = new FrontMatterExtractionStrategy();
      const markdown = `---
title: E2E Test
description: End-to-end testing
tags: ["test", "integration"]
published: true
---

# Test Content

This is the markdown content.`;

      const context: AnalysisContext = {
        kind: "BasicExtraction",
        document: "test",
        options: { includeMetadata: true },
      };

      // Extract frontmatter
      const extractionResult = await strategy.execute(markdown, context);

      assertEquals(extractionResult.ok, true);
      if (extractionResult.ok) {
        // Verify extraction
        assertEquals(extractionResult.data.get("title"), "E2E Test");
        assertEquals(
          extractionResult.data.get("description"),
          "End-to-end testing",
        );
        assertEquals(extractionResult.data.get("published"), true);

        // Process with ContextualAnalysisProcessor
        const factory = FactoryConfigurationBuilder.createDefault();
        const components = factory.createDomainComponents(
          ComponentDomain.Analysis,
        ) as {
          processor: ContextualAnalysisProcessor;
        };
        const { processor } = components;
        const processResult = await processor.processWithContext(
          extractionResult.data,
          context,
        );

        assertEquals(processResult.ok, true);
        if (processResult.ok) {
          const data = processResult.data as Record<string, unknown>;
          assertEquals(data.title, "E2E Test");
          const metadata = data.extractionMetadata as Record<string, unknown>;
          assertEquals(metadata.keyCount, 4); // title, description, tags, published
          assertEquals(typeof metadata.extractedAt, "string");
        }
      }
    },
  );
});
