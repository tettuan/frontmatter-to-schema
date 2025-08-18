import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  GenericAnalysisEngine,
  RobustSchemaAnalyzer,
  RobustTemplateMapper,
  ContextualAnalysisProcessor,
  AnalysisEngineFactory,
  FrontMatterExtractionStrategy,
  SchemaMappingStrategy,
} from "../../../src/domain/core/analysis-engine.ts";
import {
  type AnalysisContext,
  FrontMatterContent,
  SchemaDefinition,
  type ValidFilePath,
} from "../../../src/domain/core/types.ts";
import { type Result, type AnalysisError, createDomainError } from "../../../src/domain/core/result.ts";

// Test helper functions
const createTestFrontMatterContent = (data: Record<string, unknown>) => {
  const result = FrontMatterContent.fromObject(data);
  if (!result.ok) throw new Error("Failed to create test FrontMatterContent");
  return result.data;
};

const createTestSchemaDefinition = (schema: unknown) => {
  const result = SchemaDefinition.create(schema);
  if (!result.ok) throw new Error("Failed to create test SchemaDefinition");
  return result.data;
};

// Mock Analysis Strategy for testing
class MockAnalysisStrategy {
  readonly name = "MockAnalysisStrategy";
  private shouldSucceed: boolean;
  private resultData: any;

  constructor(shouldSucceed = true, resultData = "mock result") {
    this.shouldSucceed = shouldSucceed;
    this.resultData = resultData;
  }

  async execute(
    input: any,
    context: AnalysisContext,
  ): Promise<Result<any, any>> {
    if (this.shouldSucceed) {
      return { ok: true, data: this.resultData };
    }
    return {
      ok: false,
      error: createDomainError({
        kind: "ExtractionStrategyFailed",
        strategy: this.name,
        input,
      }),
    };
  }
}

Deno.test({
  name: "GenericAnalysisEngine", 
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async (t) => {
  await t.step("should analyze successfully with valid input and strategy", async () => {
    const engine = new GenericAnalysisEngine();
    const strategy = new MockAnalysisStrategy(true, "success result");
    
    const result = await engine.analyze("test input", strategy);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, "success result");
    }
  });

  await t.step("should reject null input", async () => {
    const engine = new GenericAnalysisEngine();
    const strategy = new MockAnalysisStrategy(true, "should not reach");
    
    const result = await engine.analyze(null, strategy);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ExtractionStrategyFailed");
    }
  });

  await t.step("should reject undefined input", async () => {
    const engine = new GenericAnalysisEngine();
    const strategy = new MockAnalysisStrategy(true, "should not reach");
    
    const result = await engine.analyze(undefined, strategy);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ExtractionStrategyFailed");
    }
  });

  await t.step("should propagate strategy execution error", async () => {
    const engine = new GenericAnalysisEngine();
    const strategy = new MockAnalysisStrategy(false);
    
    const result = await engine.analyze("test input", strategy);
    
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
    const slowStrategy = {
      name: "SlowStrategy",
      async execute(_input: any, _context: any): Promise<Result<string, AnalysisError & { message: string }>> {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { ok: true, data: "should timeout" };
      }
    };
    
    const result = await engine.analyze("test input", slowStrategy);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "AnalysisTimeout");
      // Type assertion needed for accessing timeoutMs property
      assertEquals((result.error as any).timeoutMs, 100);
    }
  }});

  await t.step("should handle strategy execution exception", async () => {
    const engine = new GenericAnalysisEngine();
    
    const throwingStrategy = {
      name: "ThrowingStrategy",
      async execute(_input: any, _context: any): Promise<any> {
        throw new Error("Strategy execution failed");
      }
    };
    
    const result = await engine.analyze("test input", throwingStrategy);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ExtractionStrategyFailed");
    }
  });
}});

Deno.test("RobustSchemaAnalyzer", async (t) => {
  await t.step("should process data successfully with valid schema", async () => {
    const analyzer = new RobustSchemaAnalyzer<any, any>();
    const data = createTestFrontMatterContent({ title: "Test", count: 42 });
    const schema = createTestSchemaDefinition({ type: "object" });
    
    const result = await analyzer.process(data, schema);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as any).title, "Test");
      assertEquals((result.data as any).count, 42);
    }
  });

  await t.step("should fail when schema validation fails", async () => {
    const analyzer = new RobustSchemaAnalyzer<any, any>();
    const data = createTestFrontMatterContent({ title: "Test" });
    
    // Create a schema that will fail validation (simulate validation failure)
    const invalidSchema = new (class {
      constructor(public schema: any) {}
      validate(_data: unknown) {
        return {
          ok: false,
          error: createDomainError({ kind: "EmptyInput" })
        };
      }
    })({ type: "object" });
    
    const result = await analyzer.process(data, invalidSchema as any);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "SchemaValidationFailed");
    }
  });
});

Deno.test("RobustTemplateMapper", async (t) => {
  await t.step("should map source to template successfully", () => {
    const mapper = new RobustTemplateMapper<any, any>();
    const source = { title: "Test", count: 42 };
    const template = {
      structure: { 
        name: "default",
        value: "default_value",
        category: "test"
      }
    };
    
    const result = mapper.map(source, template);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      // Should merge source with template structure
      assertEquals((result.data as any).title, "Test");
      assertEquals((result.data as any).count, 42);
      assertEquals((result.data as any).name, "default");
      assertEquals((result.data as any).category, "test");
    }
  });

  await t.step("should reject null source", () => {
    const mapper = new RobustTemplateMapper<any, any>();
    const template = { structure: { name: "default" } };
    
    const result = mapper.map(null, template);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "TemplateMappingFailed");
    }
  });

  await t.step("should reject undefined source", () => {
    const mapper = new RobustTemplateMapper<any, any>();
    const template = { structure: { name: "default" } };
    
    const result = mapper.map(undefined, template);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "TemplateMappingFailed");
    }
  });

  await t.step("should handle non-object source", () => {
    const mapper = new RobustTemplateMapper<any, any>();
    const template = { structure: { name: "default" } };
    
    const result = mapper.map("primitive value", template);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as any).name, "default");
    }
  });
});

Deno.test("ContextualAnalysisProcessor", async (t) => {
  const mockEngine = new GenericAnalysisEngine();
  const mockSchemaAnalyzer = new RobustSchemaAnalyzer<any, any>();
  const mockTemplateMapper = new RobustTemplateMapper<any, any>();
  
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
      schema,
      options: { includeMetadata: true }
    };
    
    const result = await processor.processWithContext(data, context);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as any).title, "Test");
    }
  });

  await t.step("should process TemplateMapping context without schema", async () => {
    const processor = new ContextualAnalysisProcessor(
      mockEngine,
      mockSchemaAnalyzer,
      mockTemplateMapper,
    );
    
    const data = createTestFrontMatterContent({ title: "Test" });
    const context: AnalysisContext = {
      kind: "TemplateMapping",
      template: { structure: { name: "default" } }
    };
    
    const result = await processor.processWithContext(data, context);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as any).title, "Test");
      assertEquals((result.data as any).name, "default");
    }
  });

  await t.step("should process TemplateMapping context with schema", async () => {
    const processor = new ContextualAnalysisProcessor(
      mockEngine,
      mockSchemaAnalyzer,
      mockTemplateMapper,
    );
    
    const data = createTestFrontMatterContent({ title: "Test" });
    const schema = createTestSchemaDefinition({ type: "object" });
    const context: AnalysisContext = {
      kind: "TemplateMapping",
      template: { structure: { name: "default" } },
      schema
    };
    
    const result = await processor.processWithContext(data, context);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as any).title, "Test");
      assertEquals((result.data as any).name, "default");
    }
  });

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
      schema
    };
    
    const result = await processor.processWithContext(data, context);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as any).title, "Test");
    }
  });

  await t.step("should process BasicExtraction context", async () => {
    const processor = new ContextualAnalysisProcessor(
      mockEngine,
      mockSchemaAnalyzer,
      mockTemplateMapper,
    );
    
    const data = createTestFrontMatterContent({ title: "Test", author: "John" });
    const context: AnalysisContext = {
      kind: "BasicExtraction",
      options: { includeMetadata: true }
    };
    
    const result = await processor.processWithContext(data, context);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as any).title, "Test");
      assertEquals((result.data as any).author, "John");
      assertEquals((result.data as any).extractionMetadata.keyCount, 2);
      assertEquals((result.data as any).extractionMetadata.includeMetadata, true);
      assertEquals(typeof (result.data as any).extractionMetadata.extractedAt, "string");
    }
  });

  await t.step("should handle BasicExtraction context without includeMetadata", async () => {
    const processor = new ContextualAnalysisProcessor(
      mockEngine,
      mockSchemaAnalyzer,
      mockTemplateMapper,
    );
    
    const data = createTestFrontMatterContent({ title: "Test" });
    const context: AnalysisContext = {
      kind: "BasicExtraction",
      options: {}
    };
    
    const result = await processor.processWithContext(data, context);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as any).extractionMetadata.includeMetadata, false);
    }
  });
});

Deno.test("AnalysisEngineFactory", async (t) => {
  await t.step("should create default components", () => {
    const { engine, processor } = AnalysisEngineFactory.createDefault();
    
    assertEquals(engine instanceof GenericAnalysisEngine, true);
    assertEquals(processor instanceof ContextualAnalysisProcessor, true);
  });

  await t.step("should create components with custom timeout", () => {
    const { engine, processor } = AnalysisEngineFactory.createWithTimeout(5000);
    
    assertEquals(engine instanceof GenericAnalysisEngine, true);
    assertEquals(processor instanceof ContextualAnalysisProcessor, true);
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
      options: {}
    };
    
    const result = await strategy.execute(markdown, context);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as any).get("title"), "Test Document");
      assertEquals((result.data as any).get("author"), "John Doe");
    }
  });

  await t.step("should fail when no frontmatter present", async () => {
    const strategy = new FrontMatterExtractionStrategy();
    const markdown = `# Just a regular markdown file

No frontmatter here.`;
    
    const context: AnalysisContext = {
      kind: "BasicExtraction",
      options: {}
    };
    
    const result = await strategy.execute(markdown, context);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ExtractionStrategyFailed");
      assertEquals((result.error as any).strategy, "FrontMatterExtractionStrategy");
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
      options: {}
    };
    
    const result = await strategy.execute(markdown, context);
    
    assertEquals(result.ok, true); // Our simple parser should still work
    if (result.ok) {
      // The line without colon should be ignored
      assertEquals((result.data as any).size(), 0);
    }
  });

  await t.step("should truncate long input in error message", async () => {
    const strategy = new FrontMatterExtractionStrategy();
    const longMarkdown = "a".repeat(200); // Long content without frontmatter
    
    const context: AnalysisContext = {
      kind: "BasicExtraction",
      options: {}
    };
    
    const result = await strategy.execute(longMarkdown, context);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ExtractionStrategyFailed");
      // Should truncate input in error
      assertEquals((result.error as any).input.length, 103); // 100 + "..."
    }
  });
});

Deno.test("SchemaMappingStrategy", async (t) => {
  await t.step("should map frontmatter content with valid schema context", async () => {
    const schema = createTestSchemaDefinition({ type: "object" });
    const strategy = new SchemaMappingStrategy(schema);
    const data = createTestFrontMatterContent({ title: "Test", count: 42 });
    
    const context: AnalysisContext = {
      kind: "SchemaAnalysis",
      schema,
      options: {}
    };
    
    const result = await strategy.execute(data, context);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data as any).title, "Test");
      assertEquals((result.data as any).count, 42);
    }
  });

  await t.step("should fail with invalid analysis context", async () => {
    const schema = createTestSchemaDefinition({ type: "object" });
    const strategy = new SchemaMappingStrategy(schema);
    const data = createTestFrontMatterContent({ title: "Test" });
    
    const context: AnalysisContext = {
      kind: "BasicExtraction",
      options: {}
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
    const { engine, processor } = AnalysisEngineFactory.createDefault();
    
    // Create test data
    const data = createTestFrontMatterContent({
      title: "Integration Test",
      author: "Test Author",
      version: 1
    });
    
    const schema = createTestSchemaDefinition({
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" },
        version: { type: "number" }
      }
    });
    
    // Test SchemaAnalysis workflow
    const schemaContext: AnalysisContext = {
      kind: "SchemaAnalysis",
      schema,
      options: { includeMetadata: true, validateResults: true }
    };
    
    const schemaResult = await processor.processWithContext(data, schemaContext);
    
    assertEquals(schemaResult.ok, true);
    if (schemaResult.ok) {
      const data = schemaResult.data as any;
      assertEquals(data.title, "Integration Test");
      assertEquals(data.author, "Test Author");
      assertEquals(data.version, 1);
    }
    
    // Test TemplateMapping workflow
    const templateContext: AnalysisContext = {
      kind: "TemplateMapping",
      template: {
        structure: {
          name: "processed_document",
          category: "test",
          processed: true
        }
      },
      schema
    };
    
    const templateResult = await processor.processWithContext(data, templateContext);
    
    assertEquals(templateResult.ok, true);
    if (templateResult.ok) {
      const data = templateResult.data as any;
      assertEquals(data.title, "Integration Test");
      assertEquals(data.name, "processed_document");
      assertEquals(data.category, "test");
      assertEquals(data.processed, true);
    }
  });

  await t.step("should handle end-to-end FrontMatter extraction workflow", async () => {
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
      options: { includeMetadata: true }
    };
    
    // Extract frontmatter
    const extractionResult = await strategy.execute(markdown, context);
    
    assertEquals(extractionResult.ok, true);
    if (extractionResult.ok) {
      // Verify extraction
      assertEquals(extractionResult.data.get("title"), "E2E Test");
      assertEquals(extractionResult.data.get("description"), "End-to-end testing");
      assertEquals(extractionResult.data.get("published"), true);
      
      // Process with ContextualAnalysisProcessor
      const { processor } = AnalysisEngineFactory.createDefault();
      const processResult = await processor.processWithContext(extractionResult.data, context);
      
      assertEquals(processResult.ok, true);
      if (processResult.ok) {
        const data = processResult.data as any;
        assertEquals(data.title, "E2E Test");
        assertEquals(data.extractionMetadata.keyCount, 4); // title, description, tags, published
        assertEquals(typeof data.extractionMetadata.extractedAt, "string");
      }
    }
  });
});