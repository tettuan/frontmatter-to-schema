/**
 * @fileoverview Integration tests for IR Pipeline
 *
 * Tests the complete flow from directive processing through IR creation
 * to template rendering, validating the entire IR pipeline integration.
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { OutputRenderingService } from "../../src/domain/template/services/output-rendering-service.ts";
import { TemplateRenderer } from "../../src/domain/template/renderers/template-renderer.ts";
import { TemplateIRBuilder } from "../../src/domain/template/value-objects/template-intermediate-representation.ts";
import { TemplateContextBuilder } from "../../src/domain/template/value-objects/template-context.ts";
import { TemplateConfiguration } from "../../src/domain/template/value-objects/template-configuration.ts";
import { NullDomainLogger } from "../../src/domain/shared/services/domain-logger.ts";
import { Result } from "../../src/domain/shared/types/result.ts";
import { DomainError } from "../../src/domain/shared/types/errors.ts";
import type {
  DomainFileReader,
  DomainFileWriter,
} from "../../src/domain/shared/interfaces/file-operations.ts";

// Test fixtures for IR pipeline
class TestFileSystem implements DomainFileReader, DomainFileWriter {
  private files: Map<string, string> = new Map();
  private writtenFiles: Map<string, string> = new Map();

  constructor() {
    // Setup test templates
    this.files.set(
      "templates/report.json",
      `{
  "title": "{{ title }}",
  "summary": "{{ summary }}",
  "items": "{@items}"
}`,
    );

    this.files.set(
      "templates/report-item.json",
      `{
  "name": "{{ name }}",
  "status": "{{ status }}",
  "priority": "{{ priority }}"
}`,
    );

    this.files.set(
      "templates/simple.json",
      `{
  "greeting": "{{ greeting }}, {{ name }}!"
}`,
    );

    this.files.set(
      "templates/config.json",
      `{
  "version": "{{ version }}",
  "enabled": {{ enabled }},
  "features": "{@items}"
}`,
    );

    this.files.set(
      "templates/feature.json",
      `{
  "name": "{{ name }}",
  "active": {{ active }}
}`,
    );
  }

  readFileSync(path: string): string {
    const content = this.files.get(path);
    if (!content) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  readFileAsync(path: string): Promise<string> {
    return Promise.resolve(this.readFileSync(path));
  }

  read(path: string): Result<string, DomainError & { message: string }> {
    const content = this.files.get(path);
    if (!content) {
      return {
        ok: false,
        error: {
          kind: "FileNotFound" as const,
          path: path,
          message: `File not found: ${path}`,
        },
      };
    }
    return { ok: true, data: content };
  }

  write(
    path: string,
    content: string,
  ): Result<void, DomainError & { message: string }> {
    this.writtenFiles.set(path, content);
    return { ok: true, data: void 0 };
  }

  existsSync(path: string): boolean {
    return this.files.has(path);
  }

  writeFileSync(path: string, content: string): void {
    this.writtenFiles.set(path, content);
  }

  writeFileAsync(path: string, content: string): Promise<void> {
    this.writeFileSync(path, content);
    return Promise.resolve();
  }

  getWrittenFile(path: string): string | undefined {
    return this.writtenFiles.get(path);
  }

  getAllWrittenFiles(): Map<string, string> {
    return new Map(this.writtenFiles);
  }
}

Deno.test.ignore("IR Pipeline - complete flow from schema to output", () => {
  const fs = new TestFileSystem();
  const logger = new NullDomainLogger();
  const rendererResult = TemplateRenderer.create(logger);
  if (!rendererResult.ok) throw new Error("Failed to create renderer");
  const renderingServiceResult = OutputRenderingService.create(
    rendererResult.data,
    fs,
    fs,
    logger,
  );
  if (!renderingServiceResult.ok) {
    throw new Error("Failed to create rendering service");
  }
  const renderingService = renderingServiceResult.data;

  // Step 1: Create IR from schema and data
  const templateConfig: TemplateConfiguration = {
    kind: "DualTemplate",
    mainPath: "templates/report.json",
    itemsPath: "templates/report-item.json",
  };

  const mainData = {
    title: "Q4 Report",
    summary: "Quarterly performance review",
  };

  const itemsData = [
    { name: "Task Alpha", status: "Completed", priority: "High" },
    { name: "Task Beta", status: "In Progress", priority: "Medium" },
  ];

  const result = new TemplateIRBuilder()
    .setMainTemplatePath("templates/report.json")
    .setItemsTemplatePath("templates/report-item.json")
    .setOutputFormat("markdown")
    .setMainContext(mainData)
    .setItemsArray(itemsData)
    .setTemplateConfig(templateConfig)
    .setVariableMappings([])
    .setMetadata({
      stage: "integration-test",
      schemaPath: "schema/report.yaml",
      sourceFiles: ["data/report.md"],
    })
    .build();

  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Step 2: Render output from IR
  const renderResult = renderingService.renderOutputFromIR(
    result.data,
    "output/report.md",
  );

  assertEquals(renderResult.ok, true);

  // Step 3: Verify output
  const output = fs.getWrittenFile("output/report.md");
  assertExists(output);
  assertEquals(output.includes("Q4 Report"), true);
  assertEquals(output.includes("Summary: Quarterly performance review"), true);
  assertEquals(output.includes("## Task Alpha"), true);
  assertEquals(output.includes("- Status: Completed"), true);
  assertEquals(output.includes("- Priority: High"), true);
  assertEquals(output.includes("## Task Beta"), true);
  assertEquals(output.includes("- Status: In Progress"), true);
  assertEquals(output.includes("- Priority: Medium"), true);
});

Deno.test.ignore("IR Pipeline - handles simple template without items", () => {
  const fs = new TestFileSystem();
  const logger = new NullDomainLogger();
  const rendererResult = TemplateRenderer.create(logger);
  if (!rendererResult.ok) throw new Error("Failed to create renderer");
  const renderingServiceResult = OutputRenderingService.create(
    rendererResult.data,
    fs,
    fs,
    logger,
  );
  if (!renderingServiceResult.ok) {
    throw new Error("Failed to create rendering service");
  }
  const renderingService = renderingServiceResult.data;

  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/simple.json",
  };

  const buildResult = new TemplateIRBuilder()
    .setMainTemplatePath("templates/simple.json")
    .setOutputFormat("json")
    .setMainContext({ greeting: "Hello", name: "World" })
    .setTemplateConfig(templateConfig)
    .setVariableMappings([])
    .setMetadata({
      stage: "simple-test",
      schemaPath: "schema/simple.yaml",
      sourceFiles: ["data/greeting.md"],
    })
    .build();

  assertEquals(buildResult.ok, true);
  if (!buildResult.ok) return;

  const renderResult = renderingService.renderOutputFromIR(
    buildResult.data,
    "output/greeting.json",
  );

  assertEquals(renderResult.ok, true);

  const output = fs.getWrittenFile("output/greeting.json");
  assertExists(output);
  assertEquals(output.includes("Hello, World!"), true);
});

Deno.test("IR Pipeline - context transformation preserves data integrity", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "DualTemplate",
    mainPath: "templates/config.json",
    itemsPath: "templates/feature.json",
  };

  const features = [
    { name: "Feature A", active: true },
    { name: "Feature B", active: false },
    { name: "Feature C", active: true },
  ];

  const buildResult = new TemplateIRBuilder()
    .setMainTemplatePath("templates/config.json")
    .setItemsTemplatePath("templates/feature.json")
    .setOutputFormat("yaml")
    .setMainContext({ version: "2.0.0", enabled: true })
    .setItemsArray(features)
    .setTemplateConfig(templateConfig)
    .setVariableMappings([])
    .setMetadata({
      stage: "config-test",
      schemaPath: "schema/config.yaml",
      sourceFiles: ["data/config.md"],
    })
    .build();

  assertEquals(buildResult.ok, true);
  if (!buildResult.ok) return;

  const ir = buildResult.data;
  // Create context from IR
  const context = TemplateContextBuilder.fromIR(ir);

  // Verify context preserves all data
  assertEquals(context.mainVariables.version, "2.0.0");
  assertEquals(context.mainVariables.enabled, true);
  assertExists(context.itemsData);
  assertEquals(context.itemsData.length, 3);
  assertEquals(context.itemsData[0], { name: "Feature A", active: true });
  assertEquals(context.renderingOptions.format, "yaml");
  assertEquals(context.renderingOptions.expandItems, true);
  assertEquals(context.metadata.stage, "config-test");
  assertEquals(context.metadata.schemaPath, "schema/config.yaml");
});

Deno.test("IR Pipeline - item context generation", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "DualTemplate",
    mainPath: "templates/main.json",
    itemsPath: "templates/item.json",
  };

  const items = [
    { id: 1, value: "first" },
    { id: 2, value: "second" },
    { id: 3, value: "third" },
  ];

  const buildResult = new TemplateIRBuilder()
    .setMainTemplatePath("templates/main.json")
    .setItemsTemplatePath("templates/item.json")
    .setOutputFormat("json")
    .setMainContext({ title: "List" })
    .setItemsArray(items)
    .setTemplateConfig(templateConfig)
    .setVariableMappings([])
    .setMetadata({
      stage: "item-test",
      schemaPath: "schema/list.yaml",
      sourceFiles: [],
    })
    .build();

  assertEquals(buildResult.ok, true);
  if (!buildResult.ok) return;

  const ir = buildResult.data;
  const baseContext = TemplateContextBuilder.fromIR(ir);

  // Test item context generation for each item
  for (let i = 0; i < items.length; i++) {
    const itemContext = TemplateContextBuilder.forItem(
      baseContext,
      items[i],
      i,
    );

    assertEquals(itemContext.mainVariables, items[i]);
    assertEquals(itemContext.variableContext["@index"], i);
    assertEquals(itemContext.variableContext["@item"], items[i]);
    assertEquals(itemContext.variableContext["@items"], items);
    assertEquals(itemContext.variableContext["title"], "List");
    assertEquals(itemContext.renderingOptions.expandItems, false);
    assertEquals(itemContext.metadata.stage, "item-rendering");
  }
});

Deno.test.ignore("IR Pipeline - error handling in pipeline stages", () => {
  const fs = new TestFileSystem();
  const logger = new NullDomainLogger();
  const rendererResult = TemplateRenderer.create(logger);
  if (!rendererResult.ok) throw new Error("Failed to create renderer");
  const renderingServiceResult = OutputRenderingService.create(
    rendererResult.data,
    fs,
    fs,
    logger,
  );
  if (!renderingServiceResult.ok) {
    throw new Error("Failed to create rendering service");
  }
  const renderingService = renderingServiceResult.data;

  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/nonexistent.json", // Template doesn't exist
  };

  const buildResult = new TemplateIRBuilder()
    .setMainTemplatePath("templates/nonexistent.json")
    .setOutputFormat("json")
    .setMainContext({ data: "test" })
    .setTemplateConfig(templateConfig)
    .setVariableMappings([])
    .setMetadata({
      stage: "error-test",
      schemaPath: "schema/test.yaml",
      sourceFiles: [],
    })
    .build();

  assertEquals(buildResult.ok, true);
  if (!buildResult.ok) return;

  const renderResult = renderingService.renderOutputFromIR(
    buildResult.data,
    "output/error.json",
  );

  assertEquals(renderResult.ok, false);
  if (!renderResult.ok) {
    assertExists(renderResult.error.message);
    assertEquals(renderResult.error.message.includes("nonexistent.json"), true);
  }
});

Deno.test("IR Pipeline - metadata preservation through full pipeline", () => {
  const sourceFiles = [
    "data/source1.md",
    "data/source2.md",
    "data/source3.md",
  ];

  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/simple.json",
  };

  const buildResult = new TemplateIRBuilder()
    .setMainTemplatePath("templates/simple.json")
    .setOutputFormat("json")
    .setMainContext({ greeting: "Hi", name: "Test" })
    .setTemplateConfig(templateConfig)
    .setVariableMappings([])
    .setMetadata({
      stage: "metadata-test",
      schemaPath: "schema/metadata.yaml",
      sourceFiles: sourceFiles,
    })
    .build();

  assertEquals(buildResult.ok, true);
  if (!buildResult.ok) return;

  const ir = buildResult.data;
  // Verify metadata in IR
  assertEquals(ir.metadata.stage, "metadata-test");
  assertEquals(ir.metadata.schemaPath, "schema/metadata.yaml");
  assertEquals(ir.metadata.sourceFiles, sourceFiles);

  // Transform to context
  const context = TemplateContextBuilder.fromIR(ir);

  // Verify metadata in context
  assertEquals(context.metadata.stage, "metadata-test");
  assertEquals(context.metadata.schemaPath, "schema/metadata.yaml");

  // Create item context
  const itemContext = TemplateContextBuilder.forItem(
    context,
    { item: "data" },
    0,
  );

  // Verify metadata preservation with stage change
  assertEquals(itemContext.metadata.stage, "item-rendering");
  assertEquals(itemContext.metadata.schemaPath, "schema/metadata.yaml");
});
