import { assertEquals } from "@std/assert";
import { ok } from "../../../domain/shared/types/result.ts";
import { PrepareDataCommand } from "./prepare-data-command.ts";
import { PipelineStateFactory } from "../types/pipeline-state.ts";
import { CommandExecutionContext } from "./pipeline-command.ts";
import { Schema } from "../../../domain/schema/entities/schema.ts";

// Mock context for testing
const createMockContext = (
  extractItemsDataResult?: any,
): CommandExecutionContext => ({
  loadSchema: () =>
    Promise.resolve(
      ok({} as Schema),
    ),
  resolveTemplatePaths: () => ok({}),
  transformDocuments: () => Promise.resolve(ok([])),
  extractItemsData: (schema, processedData) => {
    if (extractItemsDataResult) {
      return extractItemsDataResult;
    }
    // Extract default values from schema if available
    const schemaObj = schema as any;
    const schemaDefaults = schemaObj?.properties
      ? Object.entries(schemaObj.properties).reduce(
        (acc: any, [key, value]: [string, any]) => {
          if (value.default !== undefined) {
            acc[key] = value.default;
          }
          return acc;
        },
        {},
      )
      : {};

    // Merge defaults with processed data
    const dataWithDefaults = processedData.map((item: any) => ({
      ...schemaDefaults,
      ...item,
    }));

    return Promise.resolve(ok(dataWithDefaults));
  },
  renderOutput: () => Promise.resolve(ok(void 0)),
});

const createTestConfig = () => ({
  inputPattern: "*.md",
  outputPath: "output.json",
  schemaPath: "schema.json",
  templateConfig: {
    kind: "explicit" as const,
    templatePath: "template.hbs",
  },
  verbosityConfig: {
    kind: "verbose" as const,
    enabled: true as const,
  },
});

Deno.test("PrepareDataCommand - should apply schema default values to data", async () => {
  const schema = {
    properties: {
      version: { type: "string", default: "1.0.0" },
      description: { type: "string", default: "Default description" },
      author: { type: "string", default: "Unknown" },
    },
  };

  const processedDocuments = [
    { title: "Document 1", version: "2.0.0" }, // Has version, should keep it
    { title: "Document 2" }, // No version, should use default
  ];

  const config = createTestConfig();
  const state = PipelineStateFactory.createDataPreparing(
    config,
    schema as any,
    "template.hbs",
    { kind: "not-defined" as const },
    "json",
    processedDocuments,
  );

  const command = new PrepareDataCommand(createMockContext());
  const result = await command.execute(state);

  assertEquals(result.ok, true);
  if (result.ok && result.data.kind === "output-rendering") {
    // Main data should be the original processed documents
    assertEquals(result.data.mainData.length, 2);
    const mainData = result.data.mainData as any[];
    assertEquals(mainData[0].title, "Document 1");
    assertEquals(mainData[0].version, "2.0.0");
    assertEquals(mainData[1].title, "Document 2");
  }
});

Deno.test("PrepareDataCommand - should preserve frontmatter values over defaults", async () => {
  const schema = {
    properties: {
      version: { type: "string", default: "1.0.0" },
      description: { type: "string", default: "Default description" },
    },
  };

  const processedDocuments = [
    {
      title: "Test Document",
      version: "3.0.0", // Should override default
      description: "Custom description", // Should override default
    },
  ];

  const config = createTestConfig();
  const state = PipelineStateFactory.createDataPreparing(
    config,
    schema as any,
    "template.hbs",
    { kind: "not-defined" as const },
    "json",
    processedDocuments,
  );

  const command = new PrepareDataCommand(createMockContext());
  const result = await command.execute(state);

  assertEquals(result.ok, true);
  if (result.ok && result.data.kind === "output-rendering") {
    const mainData = result.data.mainData as any[];
    assertEquals(mainData[0].version, "3.0.0");
    assertEquals(mainData[0].description, "Custom description");
  }
});

Deno.test("PrepareDataCommand - should handle items data with defaults", async () => {
  const schema = {
    properties: {
      items: {
        type: "array",
        items: {
          properties: {
            status: { type: "string", default: "pending" },
            priority: { type: "number", default: 1 },
          },
        },
      },
    },
  };

  const processedDocuments = [
    {
      title: "Task List",
      items: [
        { name: "Task 1", status: "completed" }, // Has status
        { name: "Task 2" }, // No status, should use default
      ],
    },
  ];

  const itemsData = [
    { name: "Task 1", status: "completed", priority: 1 },
    { name: "Task 2", status: "pending", priority: 1 },
  ];

  const config = createTestConfig();
  const state = PipelineStateFactory.createDataPreparing(
    config,
    schema as any,
    "template.hbs",
    { kind: "defined", path: "items-template.hbs" },
    "json",
    processedDocuments,
  );

  const mockContext = createMockContext(ok(itemsData));
  const command = new PrepareDataCommand(mockContext);
  const result = await command.execute(state);

  assertEquals(result.ok, true);
  if (result.ok && result.data.kind === "output-rendering") {
    assertEquals(result.data.itemsData.kind, "available");
    if (result.data.itemsData.kind === "available") {
      assertEquals(result.data.itemsData.data.length, 2);
      const items = result.data.itemsData.data as any[];
      assertEquals(items[0].status, "completed");
      assertEquals(items[1].status, "pending");
    }
  }
});

Deno.test("PrepareDataCommand - should fail when not in data-preparing state", async () => {
  const config = createTestConfig();
  const state = PipelineStateFactory.createInitializing(config);

  const command = new PrepareDataCommand(createMockContext());
  const result = await command.execute(state);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ConfigurationError");
    assertEquals(
      result.error.message,
      "Configuration error: Cannot execute PrepareDataCommand from initializing state",
    );
  }
});

Deno.test("PrepareDataCommand - should handle empty main data validation failure", async () => {
  const config = createTestConfig();
  const state = PipelineStateFactory.createDataPreparing(
    config,
    {} as any,
    "template.hbs",
    { kind: "not-defined" as const },
    "json",
    [], // Empty array should fail validation
  );

  const command = new PrepareDataCommand(createMockContext());
  const result = await command.execute(state);

  assertEquals(result.ok, true);
  if (result.ok && result.data.kind === "failed") {
    assertEquals(result.data.error.kind, "ConfigurationError");
    assertEquals(
      (result.data.error as any).message,
      "Configuration error: Main data cannot be empty",
    );
  }
});
