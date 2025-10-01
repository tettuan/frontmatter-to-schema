import { assertEquals, assertExists } from "@std/assert";
import { SchemaDirectiveProcessor } from "../../../../../src/domain/schema/services/schema-directive-processor.ts";
import { ProcessingError } from "../../../../../src/domain/shared/types/errors.ts";

// Mock FileSystemPort for testing
class MockFileSystemPort {
  private files: Map<string, string> = new Map();
  private shouldError = false;
  private errorType = "FILE_NOT_FOUND";

  setFileContent(path: string, content: string): void {
    this.files.set(path, content);
  }

  setShouldError(shouldError: boolean, errorType = "FILE_NOT_FOUND"): void {
    this.shouldError = shouldError;
    this.errorType = errorType;
  }

  async readTextFile(path: string) {
    await Promise.resolve(); // Satisfy async requirement

    if (this.shouldError) {
      return {
        isError: () => true,
        unwrapError: () => ({
          code: this.errorType,
          message: `Error reading ${path}`,
        }),
        isOk: () => false,
        unwrap: () => {
          throw new Error("Cannot unwrap error result");
        },
      };
    }

    const content = this.files.get(path);
    if (content === undefined) {
      return {
        isError: () => true,
        unwrapError: () => ({
          code: "FILE_NOT_FOUND",
          message: `File not found: ${path}`,
        }),
        isOk: () => false,
        unwrap: () => {
          throw new Error("Cannot unwrap error result");
        },
      };
    }

    return {
      isError: () => false,
      unwrapError: () => {
        throw new Error("Cannot unwrap ok result");
      },
      isOk: () => true,
      unwrap: () => content,
    };
  }
}

Deno.test("SchemaDirectiveProcessor - create with valid FileSystemPort", () => {
  const mockFileSystem = new MockFileSystemPort();
  const result = SchemaDirectiveProcessor.create(mockFileSystem as any);

  assertEquals(result.isOk(), true);
  assertExists(result.unwrap());
});

Deno.test("SchemaDirectiveProcessor - create fails with null FileSystemPort", () => {
  const result = SchemaDirectiveProcessor.create(null as any);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "INVALID_DEPENDENCY");
  assertEquals(
    error.message,
    "FileSystemPort is required for schema directive processing",
  );
});

Deno.test("SchemaDirectiveProcessor - loadSchemaData with valid JSON schema", async () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const schemaPath = "/test/schema.json";
  const schemaContent = JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string" },
      version: { type: "string", default: "1.0.0" },
    },
  });

  mockFileSystem.setFileContent(schemaPath, schemaContent);

  const result = await processor.loadSchemaData(schemaPath);

  assertEquals(result.isOk(), true);
  const schema = result.unwrap();
  assertEquals(schema.type, "object");
  assertEquals((schema.properties as any).title.type, "string");
});

Deno.test("SchemaDirectiveProcessor - loadSchemaData with file read error", async () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  mockFileSystem.setShouldError(true, "PERMISSION_DENIED");

  const result = await processor.loadSchemaData("/test/nonexistent.json");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "SCHEMA_READ_ERROR");
});

Deno.test("SchemaDirectiveProcessor - loadSchemaData with invalid JSON", async () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const schemaPath = "/test/invalid.json";
  mockFileSystem.setFileContent(schemaPath, "{ invalid json }");

  const result = await processor.loadSchemaData(schemaPath);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "SCHEMA_PARSE_ERROR");
});

Deno.test("SchemaDirectiveProcessor - loadSchemaData with invalid path", async () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const result = await processor.loadSchemaData("");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "INVALID_SCHEMA_PATH");
});

Deno.test("SchemaDirectiveProcessor - applySchemaDirectives with x-derived-from", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    commands: [
      { c1: "git", c2: "status" },
      { c1: "git", c2: "add" },
      { c1: "npm", c2: "install" },
    ],
  };

  const schema = {
    properties: {
      tools: {
        "x-derived-from": "commands[].c1",
        "x-derived-unique": true,
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  assertEquals(Array.isArray(processed.tools), true);
  assertEquals((processed.tools as string[]).includes("git"), true);
  assertEquals((processed.tools as string[]).includes("npm"), true);
  assertEquals((processed.tools as string[]).length, 2); // unique values only
});

Deno.test("SchemaDirectiveProcessor - applySchemaDirectives with x-derived-from without unique", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    commands: [
      { c1: "git", c2: "status" },
      { c1: "git", c2: "add" },
      { c1: "npm", c2: "install" },
    ],
  };

  const schema = {
    properties: {
      allCommands: {
        "x-derived-from": "commands[].c1",
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  assertEquals(Array.isArray(processed.allCommands), true);
  assertEquals((processed.allCommands as string[]).length, 3); // all values including duplicates
});

Deno.test("SchemaDirectiveProcessor - applySchemaDirectives with schema defaults", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    title: "Test Document",
  };

  const schema = {
    properties: {
      version: {
        type: "string",
        default: "1.0.0",
      },
      description: {
        type: "string",
        default: "Default description",
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  assertEquals(processed.version, "1.0.0");
  assertEquals(processed.description, "Default description");
  assertEquals(processed.title, "Test Document"); // preserved
});

Deno.test("SchemaDirectiveProcessor - applySchemaDirectives with existing values", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    version: "2.0.0",
    description: "Custom description",
  };

  const schema = {
    properties: {
      version: {
        type: "string",
        default: "1.0.0",
      },
      description: {
        type: "string",
        default: "Default description",
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  assertEquals(processed.version, "2.0.0"); // existing value preserved
  assertEquals(processed.description, "Custom description"); // existing value preserved
});

Deno.test("SchemaDirectiveProcessor - applySchemaDirectives with nested properties", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    items: [
      { name: "item1", category: "tools" },
      { name: "item2", category: "docs" },
      { name: "item3", category: "tools" },
    ],
  };

  const schema = {
    properties: {
      metadata: {
        properties: {
          categories: {
            "x-derived-from": "items[].category",
            "x-derived-unique": true,
          },
        },
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  assertEquals(Array.isArray((processed.metadata as any)?.categories), true);
  const categories = ((processed.metadata as any)?.categories) as string[];
  assertEquals(categories.includes("tools"), true);
  assertEquals(categories.includes("docs"), true);
  assertEquals(categories.length, 2);
});

Deno.test("SchemaDirectiveProcessor - applySchemaDirectives with invalid data type", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const result = processor.applySchemaDirectives("invalid data" as any, {});

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "INVALID_DATA_TYPE");
});

Deno.test("SchemaDirectiveProcessor - applySchemaDirectives with invalid schema type", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const result = processor.applySchemaDirectives({}, "invalid schema" as any);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "INVALID_SCHEMA_TYPE");
});

Deno.test("SchemaDirectiveProcessor - applySchemaDirectives with empty schema", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = { test: "value" };
  const schema = {};

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  assertEquals(processed.test, "value");
});

Deno.test("SchemaDirectiveProcessor - no items fallback (Issue #1230)", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    items: [
      { tool: "git", version: "2.34" },
      { tool: "npm", version: "8.19" },
    ],
  };

  const schema = {
    properties: {
      toolNames: {
        "x-derived-from": "nonexistent[].tool",
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  // Issue #1230: Should NOT fall back to 'items' array
  // When path 'nonexistent' doesn't exist, should return empty array
  assertEquals(Array.isArray(processed.toolNames), true);
  const toolNames = processed.toolNames as string[];
  assertEquals(toolNames.length, 0);
});

Deno.test("SchemaDirectiveProcessor - comprehensive error handling", async () => {
  const mockFileSystem = new MockFileSystemPort();

  // Test processor creation with undefined
  const undefinedResult = SchemaDirectiveProcessor.create(undefined as any);
  assertEquals(undefinedResult.isError(), true);

  // Test with valid processor
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  // Test loadSchemaData with various invalid inputs
  const nullPathResult = await processor.loadSchemaData(null as any);
  assertEquals(nullPathResult.isError(), true);

  const undefinedPathResult = await processor.loadSchemaData(undefined as any);
  assertEquals(undefinedPathResult.isError(), true);

  // Test applySchemaDirectives with null/undefined inputs
  const nullDataResult = processor.applySchemaDirectives(null as any, {});
  assertEquals(nullDataResult.isError(), true);

  const nullSchemaResult = processor.applySchemaDirectives({}, null as any);
  assertEquals(nullSchemaResult.isError(), true);
});

Deno.test("SchemaDirectiveProcessor - totality principle compliance", async () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  // All methods should return Result types, never throw exceptions
  const tests = [
    () => processor.loadSchemaData("/nonexistent"),
    () => processor.loadSchemaData(""),
    () => processor.loadSchemaData("/valid/path"),
    () => processor.applySchemaDirectives({}, {}),
    () =>
      processor.applySchemaDirectives({ test: "value" }, { properties: {} }),
    () => processor.applySchemaDirectives("invalid" as any, {}),
    () => processor.applySchemaDirectives({}, "invalid" as any),
  ];

  for (const test of tests) {
    try {
      const result = await test();
      // Should always return a Result, never throw
      assertEquals(typeof result.isOk, "function");
      assertEquals(typeof result.isError, "function");
    } catch (error) {
      // Should never reach here in totality-compliant code
      throw new Error(`Method threw exception: ${error}`);
    }
  }
});

Deno.test("SchemaDirectiveProcessor - complex directive processing", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    tools: {
      commands: [
        { c1: "git", c2: "status", category: "vcs" },
        { c1: "npm", c2: "install", category: "package" },
        { c1: "git", c2: "add", category: "vcs" },
      ],
    },
    config: {
      settings: [
        { name: "editor", value: "vscode" },
        { name: "theme", value: "dark" },
      ],
    },
  };

  const schema = {
    properties: {
      commandList: {
        "x-derived-from": "tools.commands[].c1",
        "x-derived-unique": true,
      },
      categories: {
        "x-derived-from": "tools.commands[].category",
        "x-derived-unique": true,
      },
      settingNames: {
        "x-derived-from": "config.settings[].name",
      },
      version: {
        type: "string",
        default: "1.0.0",
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();

  // Check derived command list
  assertEquals(Array.isArray(processed.commandList), true);
  const commands = processed.commandList as string[];
  assertEquals(commands.includes("git"), true);
  assertEquals(commands.includes("npm"), true);
  assertEquals(commands.length, 2); // unique values

  // Check derived categories
  assertEquals(Array.isArray(processed.categories), true);
  const categories = processed.categories as string[];
  assertEquals(categories.includes("vcs"), true);
  assertEquals(categories.includes("package"), true);
  assertEquals(categories.length, 2);

  // Check setting names (not unique)
  assertEquals(Array.isArray(processed.settingNames), true);
  const settings = processed.settingNames as string[];
  assertEquals(settings.length, 2);

  // Check default value
  assertEquals(processed.version, "1.0.0");
});

Deno.test("SchemaDirectiveProcessor - flatten nested arrays in x-derived-from (Issue #1217)", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  // Simulate articles with topics array (Issue #1217 scenario)
  const data = {
    articles: [
      { title: "Article 1", topics: ["claudecode", "DDD", "totality"] },
      { title: "Article 2", topics: ["climpt", "C3L"] },
      { title: "Article 3", topics: ["cursor", "AI"] },
      { title: "Article 4", topics: ["claudecode", "hooks"] }, // duplicate "claudecode"
    ],
  };

  const schema = {
    properties: {
      topics: {
        "x-derived-from": "articles[].topics",
        "x-derived-unique": true,
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();

  // Should flatten nested arrays and apply uniqueness
  assertEquals(Array.isArray(processed.topics), true);
  const topics = processed.topics as string[];

  // Each individual topic should be a separate array element
  assertEquals(topics.includes("claudecode"), true);
  assertEquals(topics.includes("DDD"), true);
  assertEquals(topics.includes("totality"), true);
  assertEquals(topics.includes("climpt"), true);
  assertEquals(topics.includes("C3L"), true);
  assertEquals(topics.includes("cursor"), true);
  assertEquals(topics.includes("AI"), true);
  assertEquals(topics.includes("hooks"), true);

  // Should have exactly 8 unique topics (not comma-separated strings)
  assertEquals(topics.length, 8);

  // Should NOT contain comma-separated strings like "claudecode,DDD,totality"
  assertEquals(topics.some((t) => t.includes(",")), false);
});

// NOTE: x-jmespath-filter tests moved to Phase1DirectiveProcessor tests
// Per requirements.ja.md line 376, x-jmespath-filter is a Phase 1 directive
// that runs per-file before aggregation, not in Phase 2 SchemaDirectiveProcessor.
//
// See: tests/unit/domain/directives/services/phase1-directive-processor_test.ts

Deno.test("SchemaDirectiveProcessor - x-flatten-arrays directive (Issue #1233)", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    tags: [[["deep1", "deep2"]], ["nested1", "nested2"], "single"],
  };

  const schema = {
    properties: {
      tags: {
        "x-flatten-arrays": "tags",
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();

  // Should flatten all nested arrays
  assertEquals(Array.isArray(processed.tags), true);
  const flattened = processed.tags as string[];
  assertEquals(flattened.length, 5);
  assertEquals(flattened.includes("deep1"), true);
  assertEquals(flattened.includes("deep2"), true);
  assertEquals(flattened.includes("nested1"), true);
  assertEquals(flattened.includes("nested2"), true);
  assertEquals(flattened.includes("single"), true);
});

Deno.test("SchemaDirectiveProcessor - x-flatten-arrays with empty value", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    tags: null,
  };

  const schema = {
    properties: {
      tags: {
        "x-flatten-arrays": "tags",
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();

  // Should set to empty array when value is null/undefined
  assertEquals(Array.isArray(processed.tags), true);
  assertEquals((processed.tags as unknown[]).length, 0);
});

Deno.test("SchemaDirectiveProcessor - combined directives (Issue #1233)", () => {
  const mockFileSystem = new MockFileSystemPort();
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  // Test with combined x-derived-from, x-flatten-arrays, and x-jmespath-filter
  const data = {
    articles: [
      { topics: ["A", "B"], priority: "high" },
      { topics: ["C"], priority: "low" },
      { topics: ["D", "E"], priority: "high" },
    ],
  };

  const schema = {
    properties: {
      highPriorityTopics: {
        "x-derived-from": "articles[].topics",
        "x-derived-unique": true,
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();

  // Should have derived and flattened topics
  assertEquals(Array.isArray(processed.highPriorityTopics), true);
  const topics = processed.highPriorityTopics as string[];
  assertEquals(topics.length, 5);
  assertEquals(topics.includes("A"), true);
  assertEquals(topics.includes("B"), true);
  assertEquals(topics.includes("C"), true);
  assertEquals(topics.includes("D"), true);
  assertEquals(topics.includes("E"), true);
});
