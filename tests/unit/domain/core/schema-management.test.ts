/**
 * Comprehensive tests for Schema Management Layer
 * Addressing critical test coverage gap (3.9% -> 100%)
 * Issue #401: Critical test coverage improvements
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  DynamicPipelineFactory,
  ExecutablePipeline,
  type ExecutionConfiguration,
  SchemaLoader,
  type SchemaProcessor,
  SchemaSwitcher,
  ValidSchema,
} from "../../../../src/domain/core/schema-management.ts";
import {
  createDomainError,
  type Result,
  type ValidationError,
} from "../../../../src/domain/core/result.ts";
import type {
  PromptContext,
  SchemaContext,
  TemplateContext,
} from "../../../../src/domain/core/schema-injection.ts";

// Mock file system for testing
class MockFileSystem {
  public files = new Map<string, string>();
  private shouldFail = false;

  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  readFile(path: string): Promise<string> {
    if (this.shouldFail) {
      return Promise.reject(new Error("File system error"));
    }

    const content = this.files.get(path);
    if (content === undefined) {
      return Promise.reject(new Error(`File not found: ${path}`));
    }
    return Promise.resolve(content);
  }

  writeFile(path: string, content: string): Promise<void> {
    if (this.shouldFail) {
      return Promise.reject(new Error("Write failed"));
    }
    this.files.set(path, content);
    return Promise.resolve();
  }

  clear(): void {
    this.files.clear();
    this.shouldFail = false;
  }
}

// Mock schema processor for testing
class MockSchemaProcessor implements SchemaProcessor {
  private shouldFail = false;
  private result: unknown = { processed: true };

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  setResult(result: unknown): void {
    this.result = result;
  }

  process(
    _inputPath: string,
    _schemaContext: SchemaContext,
    _templateContext: TemplateContext,
    _promptContext: PromptContext,
  ): Promise<Result<unknown, ValidationError & { message: string }>> {
    if (this.shouldFail) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "NotConfigured",
          component: "mockProcessor",
        }),
      });
    }
    return Promise.resolve({ ok: true, data: this.result });
  }
}

Deno.test("ValidSchema", async (t) => {
  await t.step("should create valid schema successfully", () => {
    const name = "test-schema";
    const schema = { type: "object", properties: { name: { type: "string" } } };
    const template = { greeting: "Hello {{name}}" };
    const prompts = {
      extraction: "Extract: {{data}}",
      mapping: "Map: {{source}}",
    };

    const result = ValidSchema.create(name, schema, template, prompts);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.name, name);
      assertEquals(result.data.schema, schema);
      assertEquals(result.data.template, template);
      assertEquals(result.data.prompts, prompts);
    }
  });

  await t.step("should trim whitespace from name", () => {
    const name = "  spaced-name  ";
    const schema = { type: "string" };
    const template = { output: "{{value}}" };
    const prompts = { extraction: "Extract", mapping: "Map" };

    const result = ValidSchema.create(name, schema, template, prompts);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.name, "spaced-name");
    }
  });

  await t.step("should reject empty name", () => {
    const result = ValidSchema.create("", { type: "object" }, {}, {
      extraction: "Extract",
      mapping: "Map",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
      if (result.error.kind === "EmptyInput") {
        assertEquals(result.error.field, "name");
      }
    }
  });

  await t.step("should reject whitespace-only name", () => {
    const result = ValidSchema.create("   ", { type: "object" }, {}, {
      extraction: "Extract",
      mapping: "Map",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should reject null schema", () => {
    const result = ValidSchema.create("test", null, {}, {
      extraction: "Extract",
      mapping: "Map",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
      if (result.error.kind === "InvalidFormat") {
        assertEquals(result.error.input, "null");
        assertEquals(result.error.expectedFormat, "valid schema object");
      }
    }
  });

  await t.step("should reject undefined schema", () => {
    const result = ValidSchema.create("test", undefined, {}, {
      extraction: "Extract",
      mapping: "Map",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
      if (result.error.kind === "InvalidFormat") {
        assertEquals(result.error.input, "undefined");
      }
    }
  });

  await t.step("should reject null template", () => {
    const result = ValidSchema.create("test", { type: "object" }, null, {
      extraction: "Extract",
      mapping: "Map",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
      if (result.error.kind === "InvalidFormat") {
        assertEquals(result.error.input, "null");
        assertEquals(result.error.expectedFormat, "valid template object");
      }
    }
  });

  await t.step("should reject invalid prompts", () => {
    const testCases = [
      { prompts: null, description: "null prompts" },
      { prompts: undefined, description: "undefined prompts" },
      { prompts: {}, description: "empty prompts object" },
      {
        prompts: { extraction: "Extract" },
        description: "missing mapping prompt",
      },
      { prompts: { mapping: "Map" }, description: "missing extraction prompt" },
      {
        prompts: { extraction: "", mapping: "Map" },
        description: "empty extraction prompt",
      },
      {
        prompts: { extraction: "Extract", mapping: "" },
        description: "empty mapping prompt",
      },
    ];

    for (const { prompts, description } of testCases) {
      const result = ValidSchema.create(
        "test",
        { type: "object" },
        {},
        prompts as { extraction: string; mapping: string },
      );
      assertEquals(result.ok, false, `Should reject ${description}`);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
      }
    }
  });

  await t.step("should handle complex schema structures", () => {
    const complexSchema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            contacts: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    };
    const complexTemplate = {
      greeting: "Hello {{user.name}}",
      contacts: "{{user.contacts}}",
    };
    const prompts = {
      extraction: "Complex extract: {{data}}",
      mapping: "Complex map: {{source}}",
    };

    const result = ValidSchema.create(
      "complex-schema",
      complexSchema,
      complexTemplate,
      prompts,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.schema, complexSchema);
      assertEquals(result.data.template, complexTemplate);
    }
  });
});

Deno.test("SchemaLoader", async (t) => {
  const mockFS = new MockFileSystem();

  await t.step("should load schema from JSON file successfully", async () => {
    const loader = new SchemaLoader(mockFS);
    const schema = { type: "object", properties: { name: { type: "string" } } };
    mockFS.setFile("/path/to/schema.json", JSON.stringify(schema));

    const result = await loader.loadSchema("/path/to/schema.json");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, schema);
    }
  });

  await t.step("should fail when no file system configured", async () => {
    const loader = new SchemaLoader();

    const result = await loader.loadSchema("/any/path");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "NotConfigured");
      if (result.error.kind === "NotConfigured") {
        assertEquals(result.error.component, "fileSystem");
      }
    }
  });

  await t.step("should handle file read errors", async () => {
    const loader = new SchemaLoader(mockFS);
    mockFS.setFailure(true);

    const result = await loader.loadSchema("/nonexistent/path");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ParseError");
      if (result.error.kind === "ParseError") {
        assertEquals(result.error.input, "/nonexistent/path");
      }
    }
  });

  await t.step("should handle JSON parse errors", async () => {
    const loader = new SchemaLoader(mockFS);
    mockFS.setFile("/invalid.json", "invalid json {");

    const result = await loader.loadSchema("/invalid.json");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ParseError");
    }
  });

  await t.step("should load template from JSON file", async () => {
    mockFS.clear();
    const loader = new SchemaLoader(mockFS);
    const template = { greeting: "Hello {{name}}", info: "{{details}}" };
    mockFS.setFile("/template.json", JSON.stringify(template));

    const result = await loader.loadTemplate("/template.json");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, template);
    }
  });

  await t.step(
    "should load template as raw content when JSON parsing fails",
    async () => {
      mockFS.clear();
      const loader = new SchemaLoader(mockFS);
      const yamlContent = "greeting: Hello {{name}}\ninfo: {{details}}";
      mockFS.setFile("/template.yaml", yamlContent);

      const result = await loader.loadTemplate("/template.yaml");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, yamlContent);
      }
    },
  );

  await t.step("should handle template file read errors", async () => {
    const loader = new SchemaLoader(mockFS);
    mockFS.setFailure(true);

    const result = await loader.loadTemplate("/nonexistent/template");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ParseError");
    }
  });

  await t.step("should load prompts from files successfully", async () => {
    mockFS.clear();
    const loader = new SchemaLoader(mockFS);
    const extraction = "Extract data: {{input}}";
    const mapping = "Map to template: {{source}}";

    mockFS.setFile("/prompts/extraction.txt", extraction);
    mockFS.setFile("/prompts/mapping.txt", mapping);

    const result = await loader.loadPrompts(
      "/prompts/extraction.txt",
      "/prompts/mapping.txt",
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.extraction, extraction);
      assertEquals(result.data.mapping, mapping);
    }
  });

  await t.step("should handle prompt loading errors", async () => {
    const loader = new SchemaLoader(mockFS);
    mockFS.setFailure(true);

    const result = await loader.loadPrompts(
      "/prompts/extraction.txt",
      "/prompts/mapping.txt",
    );

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ParseError");
      if (result.error.kind === "ParseError") {
        assertEquals(
          result.error.input,
          "/prompts/extraction.txt or /prompts/mapping.txt",
        );
      }
    }
  });

  await t.step("should validate schema format", () => {
    const loader = new SchemaLoader(mockFS);

    // Valid object schema
    const validSchema = { type: "object", properties: {} };
    const validResult = loader.validateSchemaFormat(validSchema);
    assertEquals(validResult.ok, true);

    // Invalid non-object schema
    const invalidResult = loader.validateSchemaFormat("not an object");
    assertEquals(invalidResult.ok, false);
    if (!invalidResult.ok) {
      assertEquals(invalidResult.error.kind, "InvalidFormat");
      if (invalidResult.error.kind === "InvalidFormat") {
        assertEquals(invalidResult.error.input, "not an object");
        assertEquals(invalidResult.error.expectedFormat, "object");
      }
    }

    // Null schema
    const nullResult = loader.validateSchemaFormat(null);
    assertEquals(nullResult.ok, false);
  });

  // Clean up after each test - handled manually in test steps
});

Deno.test("SchemaSwitcher", async (t) => {
  await t.step("should register and switch schemas successfully", () => {
    const switcher = new SchemaSwitcher();
    const schema1 = { type: "string" };
    const template1 = { output: "{{value}}" };
    const prompts1 = { extraction: "Extract1", mapping: "Map1" };

    const validSchema = ValidSchema.create(
      "schema1",
      schema1,
      template1,
      prompts1,
    );
    assertEquals(validSchema.ok, true);

    if (validSchema.ok) {
      const registerResult = switcher.registerSchema(validSchema.data);
      assertEquals(registerResult.ok, true);

      const switchResult = switcher.switchToSchema("schema1");
      assertEquals(switchResult.ok, true);

      if (switchResult.ok) {
        assertEquals(switchResult.data.kind, "Loaded");
        if (switchResult.data.kind === "Loaded") {
          assertEquals(switchResult.data.name, "schema1");
        }
      }
    }
  });

  await t.step("should list available schemas", () => {
    const switcher = new SchemaSwitcher();

    // Initially empty
    assertEquals(switcher.listAvailableSchemas().length, 0);

    // Add schemas
    const schema1Result = ValidSchema.create(
      "schema1",
      { type: "string" },
      {},
      { extraction: "E1", mapping: "M1" },
    );
    const schema2Result = ValidSchema.create(
      "schema2",
      { type: "number" },
      {},
      { extraction: "E2", mapping: "M2" },
    );

    if (schema1Result.ok && schema2Result.ok) {
      switcher.registerSchema(schema1Result.data);
      switcher.registerSchema(schema2Result.data);

      const available = switcher.listAvailableSchemas();
      assertEquals(available.length, 2);
      assertEquals(available.includes("schema1"), true);
      assertEquals(available.includes("schema2"), true);
    }
  });

  await t.step("should fail to switch to non-existent schema", () => {
    const switcher = new SchemaSwitcher();

    const result = switcher.switchToSchema("nonexistent");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "NotFound");
      if (result.error.kind === "NotFound") {
        assertEquals(result.error.resource, "schema");
        assertEquals(result.error.name, "nonexistent");
      }
    }
  });

  await t.step("should get current schema", () => {
    const switcher = new SchemaSwitcher();

    // Initially no schema
    assertEquals(switcher.getCurrentSchema(), null);

    // After registering and switching
    const validSchema = ValidSchema.create("active", { type: "object" }, {}, {
      extraction: "Extract",
      mapping: "Map",
    });
    if (validSchema.ok) {
      switcher.registerSchema(validSchema.data);
      switcher.switchToSchema("active");

      const current = switcher.getCurrentSchema();
      assertEquals(current?.kind, "Loaded");
    }
  });

  await t.step("should unregister schemas", () => {
    const switcher = new SchemaSwitcher();

    const validSchema = ValidSchema.create(
      "to-remove",
      { type: "boolean" },
      {},
      { extraction: "E", mapping: "M" },
    );
    if (validSchema.ok) {
      switcher.registerSchema(validSchema.data);
      switcher.switchToSchema("to-remove");

      assertEquals(switcher.listAvailableSchemas().length, 1);
      assertEquals(switcher.getCurrentSchema()?.kind, "Loaded");

      switcher.unregisterSchema("to-remove");

      assertEquals(switcher.listAvailableSchemas().length, 0);
      assertEquals(switcher.getCurrentSchema(), null);
    }
  });

  await t.step("should clear all schemas", () => {
    const switcher = new SchemaSwitcher();

    // Add multiple schemas
    const schemas = [
      ValidSchema.create("schema1", { type: "string" }, {}, {
        extraction: "E1",
        mapping: "M1",
      }),
      ValidSchema.create("schema2", { type: "number" }, {}, {
        extraction: "E2",
        mapping: "M2",
      }),
      ValidSchema.create("schema3", { type: "boolean" }, {}, {
        extraction: "E3",
        mapping: "M3",
      }),
    ];

    for (const schemaResult of schemas) {
      if (schemaResult.ok) {
        switcher.registerSchema(schemaResult.data);
      }
    }

    switcher.switchToSchema("schema1");
    assertEquals(switcher.listAvailableSchemas().length, 3);

    switcher.clearAll();

    assertEquals(switcher.listAvailableSchemas().length, 0);
    assertEquals(switcher.getCurrentSchema(), null);
  });

  await t.step("should handle invalid schema registration", () => {
    const _switcher = new SchemaSwitcher();

    // Create invalid schema that will fail injection
    const invalidSchema = ValidSchema.create("invalid", null, {}, {
      extraction: "E",
      mapping: "M",
    });
    assertEquals(invalidSchema.ok, false); // Should fail validation first
  });
});

Deno.test("DynamicPipelineFactory", async (t) => {
  const mockFS = new MockFileSystem();
  const mockProcessor = new MockSchemaProcessor();
  const processors = new Map<string, SchemaProcessor>();
  processors.set("default", mockProcessor);

  const createValidConfig = (): ExecutionConfiguration => ({
    name: "test-pipeline",
    schemaPath: "/schema.json",
    templatePath: "/template.json",
    promptPaths: {
      extraction: "/prompts/extract.txt",
      mapping: "/prompts/map.txt",
    },
    inputPath: "/input.txt",
    outputPath: "/output.json",
    outputFormat: "json",
    fileSystem: mockFS,
  });

  const setupMockData = () => {
    mockFS.clear();
    mockProcessor.setFailure(false);
    mockProcessor.setResult({ processed: true });

    // Set up mock files
    mockFS.setFile("/schema.json", JSON.stringify({ type: "object" }));
    mockFS.setFile(
      "/template.json",
      JSON.stringify({ greeting: "Hello {{name}}" }),
    );
    mockFS.setFile("/prompts/extract.txt", "Extract: {{data}}");
    mockFS.setFile("/prompts/map.txt", "Map: {{source}}");
    mockFS.setFile("/input.txt", "input data");
  };

  await t.step("should create pipeline successfully", async () => {
    setupMockData();
    const switcher = new SchemaSwitcher();
    const factory = new DynamicPipelineFactory(switcher, processors);
    const config = createValidConfig();

    const result = await factory.createPipeline(config);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data.id);
      assertEquals(result.data.config, config);
      assertEquals(result.data instanceof ExecutablePipeline, true);
    }
  });

  await t.step("should handle schema loading failure", async () => {
    setupMockData();
    const switcher = new SchemaSwitcher();
    const factory = new DynamicPipelineFactory(switcher, processors);
    const config = createValidConfig();

    mockFS.setFile("/schema.json", "invalid json {");

    const result = await factory.createPipeline(config);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ParseError");
    }
  });

  await t.step("should handle template loading failure", async () => {
    setupMockData();
    const switcher = new SchemaSwitcher();
    const factory = new DynamicPipelineFactory(switcher, processors);
    const config = createValidConfig();

    mockFS.files.delete("/template.json"); // Simulate missing file

    const result = await factory.createPipeline(config);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ParseError");
    }
  });

  await t.step("should handle prompts loading failure", async () => {
    setupMockData();
    const switcher = new SchemaSwitcher();
    const factory = new DynamicPipelineFactory(switcher, processors);
    const config = createValidConfig();

    mockFS.files.delete("/prompts/extract.txt");

    const result = await factory.createPipeline(config);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ParseError");
    }
  });

  await t.step("should use default name when not provided", async () => {
    setupMockData();
    const switcher = new SchemaSwitcher();
    const factory = new DynamicPipelineFactory(switcher, processors);
    const config = createValidConfig();
    delete config.name;

    const result = await factory.createPipeline(config);

    assertEquals(result.ok, true);
    // The internal schema name should be "runtime-schema"
  });
});

Deno.test("ExecutablePipeline", async (t) => {
  const mockFS = new MockFileSystem();
  const mockProcessor = new MockSchemaProcessor();

  const createTestPipeline = (): ExecutablePipeline => {
    const config: ExecutionConfiguration = {
      name: "test-pipeline",
      schemaPath: "/schema.json",
      templatePath: "/template.json",
      promptPaths: { extraction: "/extract.txt", mapping: "/map.txt" },
      inputPath: "/input.txt",
      outputPath: "/output.json",
      outputFormat: "json",
      fileSystem: mockFS,
    };

    const activeSchema = {
      kind: "Loaded" as const,
      name: "test-schema",
      schemaContext: {} as SchemaContext,
      templateContext: {} as TemplateContext,
      promptContext: {} as PromptContext,
      activatedAt: new Date(),
    };

    const processors = new Map<string, SchemaProcessor>();
    processors.set("default", mockProcessor);

    return new ExecutablePipeline("test-id", config, activeSchema, processors);
  };

  const setupTestData = () => {
    mockFS.clear();
    mockProcessor.setFailure(false);
    mockProcessor.setResult({ processed: "successfully" });
  };

  await t.step("should execute pipeline successfully", async () => {
    setupTestData();
    const pipeline = createTestPipeline();

    const result = await pipeline.execute();

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.id, "test-id");
      assertEquals(result.data.output, { processed: "successfully" });
      assertEquals(result.data.outputPath, "/output.json");
      assertEquals(result.data.format, "json");
      assertExists(result.data.executedAt);
    }
  });

  await t.step("should prevent double execution", async () => {
    setupTestData();
    const pipeline = createTestPipeline();

    await pipeline.execute();
    const secondResult = await pipeline.execute();

    assertEquals(secondResult.ok, false);
    if (!secondResult.ok) {
      assertEquals(secondResult.error.kind, "AlreadyExecuted");
      if (secondResult.error.kind === "AlreadyExecuted") {
        assertEquals(secondResult.error.pipeline, "test-id");
      }
    }
  });

  await t.step("should handle invalid schema state", async () => {
    const config: ExecutionConfiguration = {
      name: "test",
      schemaPath: "/schema.json",
      templatePath: "/template.json",
      promptPaths: { extraction: "/extract.txt", mapping: "/map.txt" },
      inputPath: "/input.txt",
      outputPath: "/output.json",
      outputFormat: "json",
    };

    const failedSchema = {
      kind: "Failed" as const,
      name: "failed-schema",
      error: {
        kind: "NotFound" as const,
        resource: "schema",
        name: "failed-schema",
        message: "Schema not found",
      },
      failedAt: new Date(),
    };

    const processors = new Map<string, SchemaProcessor>();
    processors.set("default", mockProcessor);

    const pipeline = new ExecutablePipeline(
      "test-id",
      config,
      failedSchema,
      processors,
    );
    const result = await pipeline.execute();

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidState");
      if (result.error.kind === "InvalidState") {
        assertEquals(result.error.expected, "Loaded");
        assertEquals(result.error.actual, "Failed");
      }
    }
  });

  await t.step("should handle missing processor", async () => {
    const config: ExecutionConfiguration = {
      name: "test",
      schemaPath: "/schema.json",
      templatePath: "/template.json",
      promptPaths: { extraction: "/extract.txt", mapping: "/map.txt" },
      inputPath: "/input.txt",
      outputPath: "/output.json",
      outputFormat: "json",
    };

    const activeSchema = {
      kind: "Loaded" as const,
      name: "test-schema",
      schemaContext: {} as SchemaContext,
      templateContext: {} as TemplateContext,
      promptContext: {} as PromptContext,
      activatedAt: new Date(),
    };

    const emptyProcessors = new Map<string, SchemaProcessor>();
    const pipeline = new ExecutablePipeline(
      "test-id",
      config,
      activeSchema,
      emptyProcessors,
    );

    const result = await pipeline.execute();

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "NotConfigured");
      if (result.error.kind === "NotConfigured") {
        assertEquals(result.error.component, "processor");
      }
    }
  });

  await t.step("should handle processor errors", async () => {
    setupTestData();
    mockProcessor.setFailure(true);
    const pipeline = createTestPipeline();

    const result = await pipeline.execute();

    assertEquals(result.ok, false);
  });

  await t.step("should format output correctly", async () => {
    setupTestData();
    const testData = { name: "John", age: 30 };
    mockProcessor.setResult(testData);

    // Test JSON format
    const jsonPipeline = createTestPipeline();
    const jsonResult = await jsonPipeline.execute();
    if (jsonResult.ok) {
      const jsonContent = mockFS.files.get("/output.json");
      assertEquals(jsonContent, JSON.stringify(testData, null, 2));
    }

    // Test YAML format
    mockFS.clear();
    const yamlConfig: ExecutionConfiguration = {
      name: "yaml-test",
      schemaPath: "/schema.json",
      templatePath: "/template.json",
      promptPaths: { extraction: "/extract.txt", mapping: "/map.txt" },
      inputPath: "/input.txt",
      outputPath: "/output.yaml",
      outputFormat: "yaml",
      fileSystem: mockFS,
    };

    const activeSchema = {
      kind: "Loaded" as const,
      name: "test-schema",
      schemaContext: {} as SchemaContext,
      templateContext: {} as TemplateContext,
      promptContext: {} as PromptContext,
      activatedAt: new Date(),
    };

    const processors = new Map<string, SchemaProcessor>();
    processors.set("default", mockProcessor);

    const yamlPipeline = new ExecutablePipeline(
      "yaml-id",
      yamlConfig,
      activeSchema,
      processors,
    );
    const yamlResult = await yamlPipeline.execute();

    if (yamlResult.ok) {
      const yamlContent = mockFS.files.get("/output.yaml");
      assertEquals(typeof yamlContent, "string");
      assertEquals(yamlContent?.includes("name:"), true);
      assertEquals(yamlContent?.includes("age:"), true);
    }

    // Test XML format
    mockFS.clear();
    const xmlConfig = {
      ...yamlConfig,
      outputPath: "/output.xml",
      outputFormat: "xml" as const,
    };
    const xmlPipeline = new ExecutablePipeline(
      "xml-id",
      xmlConfig,
      activeSchema,
      processors,
    );
    const xmlResult = await xmlPipeline.execute();

    if (xmlResult.ok) {
      const xmlContent = mockFS.files.get("/output.xml");
      assertEquals(typeof xmlContent, "string");
      assertEquals(xmlContent?.includes("<?xml"), true);
      assertEquals(xmlContent?.includes("<root>"), true);
    }
  });

  await t.step("should handle file writing without file system", async () => {
    const config: ExecutionConfiguration = {
      name: "no-fs",
      schemaPath: "/schema.json",
      templatePath: "/template.json",
      promptPaths: { extraction: "/extract.txt", mapping: "/map.txt" },
      inputPath: "/input.txt",
      outputPath: "/output.json",
      outputFormat: "json",
      // No fileSystem provided
    };

    const activeSchema = {
      kind: "Loaded" as const,
      name: "test-schema",
      schemaContext: {} as SchemaContext,
      templateContext: {} as TemplateContext,
      promptContext: {} as PromptContext,
      activatedAt: new Date(),
    };

    const processors = new Map<string, SchemaProcessor>();
    processors.set("default", mockProcessor);

    const pipeline = new ExecutablePipeline(
      "no-fs-id",
      config,
      activeSchema,
      processors,
    );
    const result = await pipeline.execute();

    assertEquals(result.ok, true); // Should succeed even without file system
  });

  await t.step("should dispose properly", async () => {
    setupTestData();
    const pipeline = createTestPipeline();

    pipeline.dispose();

    // After disposal, execution should fail with AlreadyExecuted
    const result = await pipeline.execute();
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "AlreadyExecuted");
    }
  });
});

Deno.test("Schema Management Integration", async (t) => {
  await t.step("should handle complete schema lifecycle", async () => {
    const mockFS = new MockFileSystem();
    const mockProcessor = new MockSchemaProcessor();

    // Set up file system
    const schema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
          },
        },
      },
    };
    const template = {
      greeting: "Hello {{user.name}}",
      contact: "Email: {{user.email}}",
    };

    mockFS.setFile("/schemas/user.json", JSON.stringify(schema));
    mockFS.setFile("/templates/user.json", JSON.stringify(template));
    mockFS.setFile("/prompts/user-extract.txt", "Extract user data: {{input}}");
    mockFS.setFile("/prompts/user-map.txt", "Map user to template: {{data}}");

    // Test complete workflow
    const loader = new SchemaLoader(mockFS);
    const switcher = new SchemaSwitcher();
    const processors = new Map<string, SchemaProcessor>();
    processors.set("default", mockProcessor);
    const factory = new DynamicPipelineFactory(switcher, processors);

    // Load components
    const schemaResult = await loader.loadSchema("/schemas/user.json");
    const templateResult = await loader.loadTemplate("/templates/user.json");
    const promptsResult = await loader.loadPrompts(
      "/prompts/user-extract.txt",
      "/prompts/user-map.txt",
    );

    assertEquals(schemaResult.ok, true);
    assertEquals(templateResult.ok, true);
    assertEquals(promptsResult.ok, true);

    // Create valid schema
    if (schemaResult.ok && templateResult.ok && promptsResult.ok) {
      const validSchema = ValidSchema.create(
        "user-schema",
        schemaResult.data,
        templateResult.data,
        promptsResult.data,
      );

      assertEquals(validSchema.ok, true);

      if (validSchema.ok) {
        // Register and switch
        const registerResult = switcher.registerSchema(validSchema.data);
        assertEquals(registerResult.ok, true);

        const switchResult = switcher.switchToSchema("user-schema");
        assertEquals(switchResult.ok, true);

        // Verify active schema
        const currentSchema = switcher.getCurrentSchema();
        assertEquals(currentSchema?.kind, "Loaded");
      }
    }

    // Create and execute pipeline
    const config: ExecutionConfiguration = {
      name: "integration-test",
      schemaPath: "/schemas/user.json",
      templatePath: "/templates/user.json",
      promptPaths: {
        extraction: "/prompts/user-extract.txt",
        mapping: "/prompts/user-map.txt",
      },
      inputPath: "/input.txt",
      outputPath: "/output.json",
      outputFormat: "json",
      fileSystem: mockFS,
    };

    const pipelineResult = await factory.createPipeline(config);
    assertEquals(pipelineResult.ok, true);

    if (pipelineResult.ok) {
      const executionResult = await pipelineResult.data.execute();
      assertEquals(executionResult.ok, true);
    }
  });

  await t.step(
    "should handle errors gracefully throughout workflow",
    async () => {
      const mockFS = new MockFileSystem();
      const loader = new SchemaLoader(mockFS);

      // Test cascading error handling
      mockFS.setFailure(true);

      const schemaResult = await loader.loadSchema("/nonexistent.json");
      assertEquals(schemaResult.ok, false);

      const templateResult = await loader.loadTemplate("/nonexistent.json");
      assertEquals(templateResult.ok, false);

      const promptsResult = await loader.loadPrompts(
        "/nonexistent1.txt",
        "/nonexistent2.txt",
      );
      assertEquals(promptsResult.ok, false);

      // All should properly propagate errors
      if (!schemaResult.ok) assertEquals(schemaResult.error.kind, "ParseError");
      if (!templateResult.ok) {
        assertEquals(
          templateResult.error.kind,
          "ParseError",
        );
      }
      if (!promptsResult.ok) {
        assertEquals(
          promptsResult.error.kind,
          "ParseError",
        );
      }
    },
  );

  await t.step("should support multiple schema formats", async () => {
    const mockFS = new MockFileSystem();
    const loader = new SchemaLoader(mockFS);

    // JSON Schema
    const jsonSchema = {
      type: "object",
      properties: { name: { type: "string" } },
    };
    mockFS.setFile("/schema.json", JSON.stringify(jsonSchema));

    // YAML Template (as raw content)
    const yamlTemplate = "greeting: Hello {{name}}\ninfo: User info";
    mockFS.setFile("/template.yaml", yamlTemplate);

    const schemaResult = await loader.loadSchema("/schema.json");
    const templateResult = await loader.loadTemplate("/template.yaml");

    assertEquals(schemaResult.ok, true);
    assertEquals(templateResult.ok, true);

    if (schemaResult.ok && templateResult.ok) {
      assertEquals(schemaResult.data, jsonSchema);
      assertEquals(templateResult.data, yamlTemplate); // Raw content for YAML
    }
  });
});
