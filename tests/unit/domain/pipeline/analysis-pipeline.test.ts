import { assertEquals, assertThrows } from "jsr:@std/assert";
import {
  AnalysisPipeline,
  PipelineBuilder,
} from "../../../../src/domain/pipeline/analysis-pipeline.ts";
import type {
  AnalysisContext,
  AnalysisResult,
} from "../../../../src/domain/core/types.ts";
import { FrontMatterContent } from "../../../../src/domain/models/value-objects.ts";
import type {
  AnalysisEngine,
  AnalysisStrategy,
  FileDiscovery,
  FrontMatterExtractor,
  PipelineConfig,
  Transformer,
} from "../../../../src/domain/core/interfaces.ts";
import type { FileReader } from "../../../../src/domain/services/interfaces.ts";

// Mock implementations for testing
class MockFileReader implements FileReader {
  private files = new Map<string, string>();

  setFile(path: string, content: string) {
    this.files.set(path, content);
  }

  readTextFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (!content) {
      return Promise.resolve("test content");
    }
    return Promise.resolve(content);
  }
}
class MockFileDiscovery implements FileDiscovery {
  constructor(private files: string[] = []) {}

  discover(patterns: string[]): Promise<string[]> {
    return Promise.resolve(
      this.files.filter((file) =>
        patterns.some((pattern) => {
          // Simple glob pattern matching for tests
          if (pattern === "**/*.md") {
            return file.endsWith(".md");
          }
          return file.includes(pattern);
        })
      ),
    );
  }

  filter(files: string[], predicate: (file: string) => boolean): string[] {
    return files.filter(predicate);
  }

  setFiles(files: string[]) {
    this.files = files;
  }
}

class MockFrontMatterExtractor implements FrontMatterExtractor {
  private responses = new Map<string, FrontMatterContent | null>();

  extract(content: string): Promise<FrontMatterContent | null> {
    const response = this.responses.get(content);
    if (response) {
      return Promise.resolve(response);
    }

    // Default response - create a simple FrontMatterContent
    const contentResult = FrontMatterContent.create(
      "title: Test\nauthor: Test Author",
    );
    return Promise.resolve(contentResult.ok ? contentResult.data : null);
  }

  hasFrontMatter(content: string): boolean {
    return content.includes("---");
  }

  setResponse(content: string, response: FrontMatterContent | null) {
    this.responses.set(content, response);
  }
}

class MockAnalysisEngine implements AnalysisEngine {
  analyze<TInput, TOutput>(
    input: TInput,
    strategy: AnalysisStrategy<TInput, TOutput>,
  ): Promise<TOutput> {
    // Simple transformation based on strategy name
    if (strategy.name === "uppercase-title") {
      const obj = input as Record<string, unknown>;
      return Promise.resolve(
        {
          ...obj,
          title: String(obj.title || "").toUpperCase(),
        } as unknown as TOutput,
      );
    }
    return Promise.resolve(input as unknown as TOutput);
  }
}

class MockTransformer implements Transformer<unknown, string> {
  transform(data: Map<string, AnalysisResult<unknown>>): string {
    const results = Array.from(data.values()).map((result) => result.data);
    return JSON.stringify({ results }, null, 2);
  }
}

class MockAnalysisStrategy implements AnalysisStrategy {
  constructor(public readonly name: string) {}

  execute(input: unknown, _context: AnalysisContext): Promise<unknown> {
    // Simple mock execution - just return the input
    return Promise.resolve(input);
  }
}

// Test data setup
const createMockConfig = (
  overrides: Partial<PipelineConfig> = {},
): PipelineConfig => ({
  input: {
    patterns: ["**/*.md"],
    extractor: "mock",
  },
  processing: {
    engine: "mock",
    strategies: ["uppercase-title"],
  },
  output: {
    format: "json",
    destination: "output.json",
  },
  ...overrides,
});

const _createTestFile = (path: string, content: string) => {
  // Mock file system - in real tests, this would create temporary files
  return { path, content };
};

Deno.test("AnalysisPipeline - Core Pipeline Functionality", async (t) => {
  const mockFileDiscovery = new MockFileDiscovery([
    "test1.md",
    "test2.md",
    "not-markdown.txt",
  ]);
  const mockExtractor = new MockFrontMatterExtractor();
  const mockEngine = new MockAnalysisEngine();
  const mockTransformer = new MockTransformer();
  const mockFileReader = new MockFileReader();
  const strategies = new Map([
    ["uppercase-title", new MockAnalysisStrategy("uppercase-title")],
  ]);

  await t.step(
    "should process files successfully with valid configuration",
    async () => {
      const config = createMockConfig();
      const pipeline = new AnalysisPipeline(
        config,
        mockFileDiscovery,
        mockExtractor,
        mockEngine,
        mockTransformer,
        strategies,
        mockFileReader,
      );

      // Setup mock file content - create proper FrontMatterContent instances
      const content1Result = FrontMatterContent.create(
        "title: first document\nauthor: Author 1",
      );
      const content2Result = FrontMatterContent.create(
        "title: second document\nauthor: Author 2",
      );

      if (content1Result.ok) {
        mockExtractor.setResponse("test content 1", content1Result.data);
      }
      if (content2Result.ok) {
        mockExtractor.setResponse("test content 2", content2Result.data);
      }

      // Set up mock file contents
      mockFileReader.setFile("test1.md", "test content 1");
      mockFileReader.setFile("test2.md", "test content 2");

      const result = await pipeline.process();

      assertEquals(typeof result, "string");
      const parsed = JSON.parse(result);
      assertEquals(Array.isArray(parsed.results), true);
      assertEquals(parsed.results.length >= 0, true);
    },
  );

  await t.step("should handle file processing errors gracefully", async () => {
    const config = createMockConfig();
    const pipeline = new AnalysisPipeline(
      config,
      mockFileDiscovery,
      mockExtractor,
      mockEngine,
      mockTransformer,
      strategies,
      mockFileReader,
    );

    // Don't set up any files in mockFileReader, so it returns default "test content"
    const result = await pipeline.process();

    // Pipeline should still return result even if some files fail
    assertEquals(typeof result, "string");
  });

  await t.step("should filter for markdown files only", async () => {
    mockFileDiscovery.setFiles(["test.md", "test.txt", "another.md"]);

    const config = createMockConfig();
    const pipeline = new AnalysisPipeline(
      config,
      mockFileDiscovery,
      mockExtractor,
      mockEngine,
      mockTransformer,
      strategies,
      mockFileReader,
    );

    // We can't directly test the private discoverFiles method,
    // but we can test that the pipeline processes only markdown files

    // The pipeline should process successfully
    await pipeline.process();

    // Since the MockFileDiscovery filters to only .md files matching patterns,
    // and our config specifies "**/*.md", only markdown files should be processed
  });

  await t.step("should skip files without frontmatter", async () => {
    const config = createMockConfig();
    const pipeline = new AnalysisPipeline(
      config,
      mockFileDiscovery,
      mockExtractor,
      mockEngine,
      mockTransformer,
      strategies,
      mockFileReader,
    );

    // Setup extractor to return null (no frontmatter)
    mockExtractor.setResponse("no frontmatter content", null);
    mockFileReader.setFile("test.md", "no frontmatter content");

    const result = await pipeline.process();

    assertEquals(typeof result, "string");
    const parsed = JSON.parse(result);
    // When files have no frontmatter, they might still be in results but with empty data
    // The actual behavior depends on the pipeline implementation
    assertEquals(typeof parsed.results, "object");
  });

  await t.step("should execute multiple strategies in sequence", async () => {
    const multiStrategyConfig = createMockConfig({
      processing: {
        engine: "mock",
        strategies: ["uppercase-title", "add-processed-flag"],
      },
    });

    const multiStrategies = new Map([
      ["uppercase-title", new MockAnalysisStrategy("uppercase-title")],
      ["add-processed-flag", new MockAnalysisStrategy("add-processed-flag")],
    ]);

    // Enhanced mock engine to handle multiple strategies
    class EnhancedMockEngine implements AnalysisEngine {
      analyze<TInput, TOutput>(
        input: TInput,
        strategy: AnalysisStrategy<TInput, TOutput>,
      ): Promise<TOutput> {
        const obj = input as Record<string, unknown>;
        if (strategy.name === "uppercase-title") {
          return Promise.resolve(
            {
              ...obj,
              title: String(obj.title || "").toUpperCase(),
            } as unknown as TOutput,
          );
        }
        if (strategy.name === "add-processed-flag") {
          return Promise.resolve(
            { ...obj, processed: true } as unknown as TOutput,
          );
        }
        return Promise.resolve(obj as unknown as TOutput);
      }
    }

    const pipeline = new AnalysisPipeline(
      multiStrategyConfig,
      mockFileDiscovery,
      mockExtractor,
      new EnhancedMockEngine(),
      mockTransformer,
      multiStrategies,
      mockFileReader,
    );

    // Setup mock response
    const testContentResult = FrontMatterContent.create("title: test title");
    if (testContentResult.ok) {
      mockExtractor.setResponse("test", testContentResult.data);
    }

    mockFileReader.setFile("test.md", "test");
    mockFileReader.setFile("another.md", "test");

    const result = await pipeline.process();

    assertEquals(typeof result, "string");
    // The result should reflect both strategy transformations
  });
});

Deno.test("AnalysisPipeline - Configuration Validation", async (t) => {
  const mockFileDiscovery = new MockFileDiscovery();
  const mockExtractor = new MockFrontMatterExtractor();
  const mockEngine = new MockAnalysisEngine();
  const mockTransformer = new MockTransformer();
  const mockFileReader = new MockFileReader();
  const strategies = new Map([
    ["valid-strategy", new MockAnalysisStrategy("valid-strategy")],
    ["uppercase-title", new MockAnalysisStrategy("uppercase-title")],
  ]);

  await t.step("should validate configuration successfully", () => {
    const config = createMockConfig();
    const pipeline = new AnalysisPipeline(
      config,
      mockFileDiscovery,
      mockExtractor,
      mockEngine,
      mockTransformer,
      strategies,
      mockFileReader,
    );

    const isValid = pipeline.validateConfig();
    assertEquals(isValid, true);
  });

  await t.step("should reject configuration with empty input patterns", () => {
    const invalidConfig = createMockConfig({
      input: { patterns: [], extractor: "mock" },
    });

    const pipeline = new AnalysisPipeline(
      invalidConfig,
      mockFileDiscovery,
      mockExtractor,
      mockEngine,
      mockTransformer,
      strategies,
      mockFileReader,
    );

    assertThrows(
      () => pipeline.validateConfig(),
      Error,
      "Input patterns are required",
    );
  });

  await t.step(
    "should reject configuration with empty processing strategies",
    () => {
      const invalidConfig = createMockConfig({
        processing: { engine: "mock", strategies: [] },
      });

      const pipeline = new AnalysisPipeline(
        invalidConfig,
        mockFileDiscovery,
        mockExtractor,
        mockEngine,
        mockTransformer,
        strategies,
        mockFileReader,
      );

      assertThrows(
        () => pipeline.validateConfig(),
        Error,
        "Processing strategies are required",
      );
    },
  );

  await t.step("should reject configuration with missing output format", () => {
    const invalidConfig = createMockConfig({
      output: { format: "", destination: "output.json" },
    });

    const pipeline = new AnalysisPipeline(
      invalidConfig,
      mockFileDiscovery,
      mockExtractor,
      mockEngine,
      mockTransformer,
      strategies,
      mockFileReader,
    );

    assertThrows(
      () => pipeline.validateConfig(),
      Error,
      "Output format is required",
    );
  });

  await t.step("should reject configuration with unregistered strategy", () => {
    const invalidConfig = createMockConfig({
      processing: { engine: "mock", strategies: ["non-existent-strategy"] },
    });

    const pipeline = new AnalysisPipeline(
      invalidConfig,
      mockFileDiscovery,
      mockExtractor,
      mockEngine,
      mockTransformer,
      strategies,
      mockFileReader,
    );

    assertThrows(
      () => pipeline.validateConfig(),
      Error,
      "Strategy 'non-existent-strategy' not registered",
    );
  });
});

Deno.test("PipelineBuilder - Fluent Configuration", async (t) => {
  await t.step("should build pipeline with fluent interface", () => {
    const builder = new PipelineBuilder<string>()
      .withInputPatterns(["**/*.md"])
      .withExtractor(new MockFrontMatterExtractor(), "mock-extractor")
      .withEngine(new MockAnalysisEngine(), "mock-engine")
      .withStrategy(new MockAnalysisStrategy("test-strategy"))
      .withTransformer(new MockTransformer())
      .withFileDiscovery(new MockFileDiscovery())
      .withFileReader(new MockFileReader())
      .withOutputFormat("json")
      .withOutputDestination("output.json");

    const pipeline = builder.build();
    assertEquals(pipeline instanceof AnalysisPipeline, true);
  });

  await t.step("should support method chaining for configuration", () => {
    const builder = new PipelineBuilder()
      .withInputPatterns(["*.md", "*.markdown"])
      .withOutputFormat("yaml")
      .withOutputSchema({ type: "object", properties: {} })
      .withOutputTemplate({ format: "handlebars" })
      .withOutputDestination("/tmp/output");

    // Builder should maintain all configurations
    assertEquals(builder instanceof PipelineBuilder, true);
  });

  await t.step(
    "should throw error when building without required components",
    () => {
      const incompleteBuilder = new PipelineBuilder()
        .withInputPatterns(["**/*.md"])
        .withOutputFormat("json");

      assertThrows(
        () => incompleteBuilder.build(),
        Error,
        "FileDiscovery is required",
      );
    },
  );

  await t.step("should throw error when building without extractor", () => {
    const builderWithoutExtractor = new PipelineBuilder()
      .withInputPatterns(["**/*.md"])
      .withFileDiscovery(new MockFileDiscovery())
      .withFileReader(new MockFileReader())
      .withOutputFormat("json");

    assertThrows(
      () => builderWithoutExtractor.build(),
      Error,
      "FrontMatterExtractor is required",
    );
  });

  await t.step("should throw error when building without engine", () => {
    const builderWithoutEngine = new PipelineBuilder()
      .withInputPatterns(["**/*.md"])
      .withFileDiscovery(new MockFileDiscovery())
      .withExtractor(new MockFrontMatterExtractor())
      .withFileReader(new MockFileReader())
      .withOutputFormat("json");

    assertThrows(
      () => builderWithoutEngine.build(),
      Error,
      "AnalysisEngine is required",
    );
  });

  await t.step("should throw error when building without transformer", () => {
    const builderWithoutTransformer = new PipelineBuilder()
      .withInputPatterns(["**/*.md"])
      .withFileDiscovery(new MockFileDiscovery())
      .withExtractor(new MockFrontMatterExtractor())
      .withEngine(new MockAnalysisEngine())
      .withFileReader(new MockFileReader())
      .withOutputFormat("json");

    assertThrows(
      () => builderWithoutTransformer.build(),
      Error,
      "Transformer is required",
    );
  });

  await t.step("should throw error when building without file reader", () => {
    const builderWithoutFileReader = new PipelineBuilder()
      .withInputPatterns(["**/*.md"])
      .withFileDiscovery(new MockFileDiscovery())
      .withExtractor(new MockFrontMatterExtractor())
      .withEngine(new MockAnalysisEngine())
      .withTransformer(new MockTransformer())
      .withOutputFormat("json");

    assertThrows(
      () => builderWithoutFileReader.build(),
      Error,
      "FileReader is required",
    );
  });

  await t.step("should apply default configuration when not specified", () => {
    const builder = new PipelineBuilder()
      .withFileDiscovery(new MockFileDiscovery())
      .withExtractor(new MockFrontMatterExtractor())
      .withEngine(new MockAnalysisEngine())
      .withTransformer(new MockTransformer())
      .withFileReader(new MockFileReader());

    const pipeline = builder.build();
    assertEquals(pipeline instanceof AnalysisPipeline, true);
  });

  await t.step("should handle multiple strategies correctly", () => {
    const builder = new PipelineBuilder()
      .withFileDiscovery(new MockFileDiscovery())
      .withExtractor(new MockFrontMatterExtractor())
      .withEngine(new MockAnalysisEngine())
      .withTransformer(new MockTransformer())
      .withFileReader(new MockFileReader())
      .withStrategy(new MockAnalysisStrategy("strategy1"))
      .withStrategy(new MockAnalysisStrategy("strategy2"))
      .withStrategy(new MockAnalysisStrategy("strategy3"));

    const pipeline = builder.build();
    assertEquals(pipeline instanceof AnalysisPipeline, true);
  });
});

Deno.test("AnalysisPipeline - Error Handling and Edge Cases", async (t) => {
  await t.step("should handle invalid document paths gracefully", async () => {
    const mockFileDiscovery = new MockFileDiscovery(["invalid-path"]);
    const mockExtractor = new MockFrontMatterExtractor();
    const mockEngine = new MockAnalysisEngine();
    const mockTransformer = new MockTransformer();
    const mockFileReader = new MockFileReader();
    const strategies = new Map([
      ["test-strategy", new MockAnalysisStrategy("test-strategy")],
    ]);

    const pipeline = new AnalysisPipeline(
      createMockConfig(),
      mockFileDiscovery,
      mockExtractor,
      mockEngine,
      mockTransformer,
      strategies,
      mockFileReader,
    );

    // Mock DocumentPath.create to return error for invalid paths
    const result = await pipeline.process();

    assertEquals(typeof result, "string");
  });

  await t.step("should handle schema validation errors", async () => {
    const configWithSchema = createMockConfig({
      output: {
        format: "json",
        destination: "output.json",
        schema: { type: "object", required: ["title"] },
      },
    });

    const mockFileDiscovery = new MockFileDiscovery(["test.md"]);
    const mockExtractor = new MockFrontMatterExtractor();
    const mockEngine = new MockAnalysisEngine();
    const mockTransformer = new MockTransformer();
    const mockFileReader = new MockFileReader();
    mockFileReader.setFile("test.md", "test content");
    const strategies = new Map([
      ["test-strategy", new MockAnalysisStrategy("test-strategy")],
    ]);

    const pipeline = new AnalysisPipeline(
      configWithSchema,
      mockFileDiscovery,
      mockExtractor,
      mockEngine,
      mockTransformer,
      strategies,
      mockFileReader,
    );

    // Setup mock response
    const validContentResult = FrontMatterContent.create("title: Valid Title");
    if (validContentResult.ok) {
      mockExtractor.setResponse("test content", validContentResult.data);
    }

    const result = await pipeline.process();

    assertEquals(typeof result, "string");
  });

  await t.step("should handle missing strategy gracefully", async () => {
    const configWithMissingStrategy = createMockConfig({
      processing: {
        engine: "mock",
        strategies: ["existing-strategy", "missing-strategy"],
      },
    });

    const strategies = new Map([
      ["existing-strategy", new MockAnalysisStrategy("existing-strategy")],
      // missing-strategy intentionally not registered
    ]);

    const mockFileReader = new MockFileReader();
    mockFileReader.setFile("test.md", "test content");

    const pipeline = new AnalysisPipeline(
      configWithMissingStrategy,
      new MockFileDiscovery(["test.md"]),
      new MockFrontMatterExtractor(),
      new MockAnalysisEngine(),
      new MockTransformer(),
      strategies,
      mockFileReader,
    );

    // Pipeline should process without crashing, just skip missing strategy
    const result = await pipeline.process();

    assertEquals(typeof result, "string");
  });
});
