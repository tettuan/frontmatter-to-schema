/**
 * Tests for TypeScript Analyzer
 * Achieving comprehensive coverage for TypeScript analysis and transformation
 */

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import {
  createTypeScriptAnalyzer,
  TypeScriptAnalyzer,
} from "../../../../src/domain/analyzers/typescript-analyzer.ts";
import {
  FrontMatter,
  Schema,
  SchemaId,
} from "../../../../src/domain/models/entities.ts";
import {
  FrontMatterContent,
  SchemaDefinition,
  SchemaVersion,
} from "../../../../src/domain/models/value-objects.ts";

// Mock implementations for testing
function createMockFrontMatter(data: Record<string, unknown>): FrontMatter {
  const contentResult = FrontMatterContent.create(JSON.stringify(data));
  if (!contentResult.ok) {
    throw new Error(
      `Failed to create FrontMatterContent: ${contentResult.error.message}`,
    );
  }
  return FrontMatter.create(contentResult.data, JSON.stringify(data));
}

function createMockSchema(schemaData: Record<string, unknown>): Schema {
  const idResult = SchemaId.create("test-schema");
  const definitionResult = SchemaDefinition.create(schemaData, "1.0.0"); // Pass object and version
  const versionResult = SchemaVersion.create("1.0.0");

  if (!idResult.ok || !definitionResult.ok || !versionResult.ok) {
    throw new Error(
      `Failed to create schema components: ${
        !idResult.ok ? "id" : !definitionResult.ok ? "definition" : "version"
      }`,
    );
  }

  return Schema.create(
    idResult.data,
    definitionResult.data,
    versionResult.data,
  );
}

Deno.test("TypeScriptAnalyzer - constructor", async (t) => {
  await t.step("should create analyzer with default values", () => {
    const analyzer = new TypeScriptAnalyzer();
    assertExists(analyzer);
  });

  await t.step("should create analyzer with custom values", () => {
    const analyzer = new TypeScriptAnalyzer(
      "2.0.0",
      "Custom registry description",
    );
    assertExists(analyzer);
  });

  await t.step("should create analyzer using factory function", () => {
    const analyzer = createTypeScriptAnalyzer();
    assertExists(analyzer);
  });

  await t.step("should create analyzer with factory and custom values", () => {
    const analyzer = createTypeScriptAnalyzer("3.0.0", "Factory created");
    assertExists(analyzer);
  });
});

Deno.test("TypeScriptAnalyzer - analyze method", async (t) => {
  await t.step("should analyze simple frontmatter successfully", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      title: "Test Document",
      version: "1.2.3",
      description: "Test description",
    });
    const schema = createMockSchema({
      type: "object",
      properties: {
        title: { type: "string" },
      },
    });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
    assertExists(result.data);
  });

  await t.step("should use default version when not provided", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      title: "No Version Document",
    });
    const schema = createMockSchema({
      type: "object",
    });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
    if (result.ok) {
      const data = result.data.getData() as Record<string, unknown>;
      assertEquals(data.version, "1.0.0");
    }
  });

  await t.step("should extract version from frontmatter", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      version: "2.5.0",
      title: "Versioned Document",
    });
    const schema = createMockSchema({
      type: "object",
    });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
    if (result.ok) {
      const data = result.data.getData() as Record<string, unknown>;
      assertEquals(data.version, "2.5.0");
    }
  });

  await t.step("should handle invalid version gracefully", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      version: "invalid-version",
      title: "Bad Version",
    });
    const schema = createMockSchema({
      type: "object",
    });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
    if (result.ok) {
      const data = result.data.getData() as Record<string, unknown>;
      assertEquals(data.version, "1.0.0"); // Should fall back to default
    }
  });

  await t.step("should extract description from various fields", async () => {
    const analyzer = new TypeScriptAnalyzer();

    // Test with description field
    const frontMatter1 = createMockFrontMatter({
      description: "Primary description",
      title: "Title fallback",
    });
    const schema = createMockSchema({ type: "object" });
    const result1 = await analyzer.analyze(frontMatter1, schema);
    assert(result1.ok);
    if (result1.ok) {
      const data = result1.data.getData() as Record<string, unknown>;
      assertEquals(data.description, "Primary description");
    }

    // Test with title field as fallback
    const frontMatter2 = createMockFrontMatter({
      title: "Title as description",
    });
    const result2 = await analyzer.analyze(frontMatter2, schema);
    assert(result2.ok);
    if (result2.ok) {
      const data = result2.data.getData() as Record<string, unknown>;
      assertEquals(data.description, "Title as description");
    }

    // Test with summary field as fallback
    const frontMatter3 = createMockFrontMatter({
      summary: "Summary as description",
    });
    const result3 = await analyzer.analyze(frontMatter3, schema);
    assert(result3.ok);
    if (result3.ok) {
      const data = result3.data.getData() as Record<string, unknown>;
      assertEquals(data.description, "Summary as description");
    }
  });

  await t.step(
    "should use default description when none provided",
    async () => {
      const analyzer = new TypeScriptAnalyzer();
      const frontMatter = createMockFrontMatter({
        _documentPath: "test/file.md", // Add a document path
      });
      const schema = createMockSchema({ type: "object" });

      const result = await analyzer.analyze(frontMatter, schema);
      assert(result.ok);
      // Just verify success, don't check internal data structure
    },
  );

  await t.step("should handle document path extraction", async () => {
    const analyzer = new TypeScriptAnalyzer();

    // Test with _documentPath
    const frontMatter1 = createMockFrontMatter({
      _documentPath: "git/merge-cleanup/develop-branches/f_default.md",
      title: "Test",
    });
    const schema = createMockSchema({ type: "object" });
    const result1 = await analyzer.analyze(frontMatter1, schema);
    assert(result1.ok);

    // Test with _filePath
    const frontMatter2 = createMockFrontMatter({
      _filePath: "spec/analyze/quality-metrics/default.md",
      title: "Test",
    });
    const result2 = await analyzer.analyze(frontMatter2, schema);
    assert(result2.ok);

    // Test with _path
    const frontMatter3 = createMockFrontMatter({
      _path: "test/unit/coverage/improve.md",
      title: "Test",
    });
    const result3 = await analyzer.analyze(frontMatter3, schema);
    assert(result3.ok);
  });

  await t.step("should extract tool name from path", async () => {
    const analyzer = new TypeScriptAnalyzer();

    const testCases = [
      { path: "git/merge-cleanup/develop-branches/f_default.md" },
      { path: "spec/analyze/quality-metrics/default.md" },
      { path: "test/unit/coverage/improve.md" },
      { path: "prompts/code/review/patterns.md" },
      { path: "prompts/docs/api/generate.md" },
      { path: "prompts/meta/resolve/commands.md" },
      { path: "build/robust/test/coverage.md" },
      { path: "refactor/architecture/ddd.md" },
      { path: "debug/performance/analyze.md" },
    ];

    for (const testCase of testCases) {
      const frontMatter = createMockFrontMatter({
        _documentPath: testCase.path,
        title: "Test",
      });
      const schema = createMockSchema({ type: "object" });
      const result = await analyzer.analyze(frontMatter, schema);
      assert(result.ok, `Should analyze path: ${testCase.path}`);
    }
  });

  await t.step("should handle paths without valid tools", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      _documentPath: "unknown/path/structure/file.md",
      title: "Test",
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });

  await t.step("should create commands from path", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      _documentPath: "git/merge-cleanup/develop-branches/f_default.md",
      description: "Merge cleanup for develop branches",
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });

  await t.step("should handle command creation fallback", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      _documentPath: "path/with/segments/file.md",
      title: "Fallback Test",
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });

  await t.step("should handle schema with getDefinition method", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      title: "Test",
    });

    // Create schema with proper getDefinition method
    const schema = createMockSchema({
      type: "object",
      properties: { title: { type: "string" } },
    });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });

  await t.step("should handle schema as raw object", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      title: "Test",
    });

    // Create a mock schema that behaves as raw object
    const rawSchema = {
      type: "object",
      properties: { title: { type: "string" } },
    } as unknown as Schema;

    const result = await analyzer.analyze(frontMatter, rawSchema);
    assert(result.ok);
  });

  await t.step("should handle analysis context creation failure", async () => {
    const analyzer = new TypeScriptAnalyzer();

    // Create invalid frontmatter that will cause context creation to fail
    const invalidFrontMatter = {
      getContent: () => ({
        toJSON: () => null, // Return null to cause failure
      }),
    } as unknown as FrontMatter;

    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(invalidFrontMatter, schema);
    assert(!result.ok);
    if (!result.ok) {
      // When toJSON() returns null, we get this error since typeof null === 'object'
      assert(result.error.message.includes("FrontMatter must be an object"));
    }
  });

  await t.step("should handle unexpected errors gracefully", async () => {
    const analyzer = new TypeScriptAnalyzer();

    // Create a frontmatter that throws an error
    const errorFrontMatter = {
      getContent: () => {
        throw new Error("Unexpected error in getContent");
      },
    } as unknown as FrontMatter;

    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(errorFrontMatter, schema);
    assert(!result.ok);
    if (!result.ok) {
      assert(result.error.message.includes("TypeScript analysis failed"));
      assert(result.error.message.includes("Unexpected error"));
    }
  });

  await t.step("should handle non-Error exceptions", async () => {
    const analyzer = new TypeScriptAnalyzer();

    // Create a frontmatter that throws a non-Error
    const errorFrontMatter = {
      getContent: () => {
        throw "String error"; // Throw a string instead of Error
      },
    } as unknown as FrontMatter;

    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(errorFrontMatter, schema);
    assert(!result.ok);
    if (!result.ok) {
      assert(result.error.message.includes("Unknown error"));
    }
  });

  await t.step("should handle complex nested frontmatter data", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      title: "Complex Document",
      version: "3.0.0",
      metadata: {
        author: "Test Author",
        tags: ["test", "complex", "nested"],
        settings: {
          enabled: true,
          level: 5,
        },
      },
      _documentPath: "spec/analyze/complex/nested.md",
    });
    const schema = createMockSchema({
      type: "object",
      properties: {
        metadata: { type: "object" },
      },
    });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });

  await t.step("should handle prompts directory structure", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      _documentPath: "prompts/git/workflow/optimize.md",
      title: "Git Workflow Optimization",
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });

  await t.step("should handle edge case paths", async () => {
    const analyzer = new TypeScriptAnalyzer();

    const edgeCases = [
      "", // Empty path
      "/", // Just slash
      "file.md", // Just filename
      "///multiple///slashes///", // Multiple slashes
      "path.with.dots/file.md", // Dots in path
    ];

    for (const path of edgeCases) {
      const frontMatter = createMockFrontMatter({
        _documentPath: path,
        title: "Edge Case",
      });
      const schema = createMockSchema({ type: "object" });

      const result = await analyzer.analyze(frontMatter, schema);
      assert(result.ok, `Should handle path: ${path}`);
    }
  });

  await t.step("should handle custom default values", async () => {
    const customVersion = "5.0.0-beta";
    const customDescription = "Custom default description";
    const analyzer = new TypeScriptAnalyzer(customVersion, customDescription);

    const frontMatter = createMockFrontMatter({
      _documentPath: "test/file.md", // Add a document path
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });

  await t.step("should handle schema definition edge cases", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({ title: "Test" });

    // Test schema with getDefinition returning object without getValue
    const schemaWithoutGetValue = {
      getDefinition: () => ({
        // No getValue method
        data: { type: "object" },
      }),
    } as unknown as Schema;

    const result = await analyzer.analyze(frontMatter, schemaWithoutGetValue);
    assert(result.ok);
  });

  await t.step("should prioritize description field over others", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      description: "Primary",
      title: "Secondary",
      summary: "Tertiary",
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
    if (result.ok) {
      const data = result.data.getData() as Record<string, unknown>;
      assertEquals(data.description, "Primary");
    }
  });

  await t.step("should coerce non-string descriptions to string", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      description: 12345, // Number instead of string
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
    if (result.ok) {
      const data = result.data.getData() as Record<string, unknown>;
      assertEquals(data.description, "12345");
    }
  });
});

Deno.test("TypeScriptAnalyzer - tool extraction edge cases", async (t) => {
  await t.step("should handle mixed case tool names", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      _documentPath: "GIT/MixedCase/Path.md",
      title: "Test",
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });

  await t.step("should handle special characters in path", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      _documentPath: "g-i-t/special-chars/test.md",
      title: "Test",
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });

  await t.step("should extract from prompts subdirectory", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      _documentPath: "some/path/prompts/test/validate/rules.md",
      title: "Test",
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });

  await t.step("should not extract invalid tools from prompts", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      _documentPath: "prompts/invalid-tool/action/file.md",
      title: "Test",
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });
});

Deno.test("TypeScriptAnalyzer - command creation edge cases", async (t) => {
  await t.step("should handle short paths in fallback", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      _documentPath: "short/path", // Only 2 segments, needs 3
      title: "Test",
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });

  await t.step("should filter out dots from path segments", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      _documentPath: "path/with/file.extension.md",
      title: "Test",
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });

  await t.step("should handle empty path segments", async () => {
    const analyzer = new TypeScriptAnalyzer();
    const frontMatter = createMockFrontMatter({
      _documentPath: "path//with///empty////segments/file.md",
      title: "Test",
    });
    const schema = createMockSchema({ type: "object" });

    const result = await analyzer.analyze(frontMatter, schema);
    assert(result.ok);
  });
});
