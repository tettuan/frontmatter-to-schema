import { assertEquals } from "jsr:@std/assert";
import {
  ItemsProcessor,
  ItemsTemplateLoader,
} from "../../../../../src/domain/template/services/items-processor.ts";
import { ItemsDetector } from "../../../../../src/domain/template/services/items-detector.ts";
import { ItemsExpander } from "../../../../../src/domain/template/services/items-expander.ts";
import { Template } from "../../../../../src/domain/template/entities/template.ts";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";
import { Result } from "../../../../../src/domain/shared/types/result.ts";
import { TemplateError } from "../../../../../src/domain/shared/types/errors.ts";

// Mock template loader for testing
class MockTemplateLoader implements ItemsTemplateLoader {
  private templates: Map<string, Template> = new Map();
  private loadErrors: Map<string, TemplateError> = new Map();

  addTemplate(path: string, template: Template): void {
    this.templates.set(path, template);
  }

  addLoadError(path: string, error: TemplateError): void {
    this.loadErrors.set(path, error);
  }

  loadTemplate(path: TemplatePath): Promise<Result<Template, TemplateError>> {
    const pathString = path.toString();

    if (this.loadErrors.has(pathString)) {
      return Promise.resolve(Result.error(this.loadErrors.get(pathString)!));
    }

    const template = this.templates.get(pathString);
    if (!template) {
      return Promise.resolve(Result.error(
        new TemplateError(
          `Template not found: ${pathString}`,
          "TEMPLATE_NOT_FOUND",
          { path: pathString },
        ),
      ));
    }

    return Promise.resolve(Result.ok(template));
  }
}

// Helper function to create test templates
function createTestTemplate(
  content: Record<string, unknown>,
  path = "test-template.json",
) {
  const pathResult = TemplatePath.create(path);
  if (pathResult.isError()) {
    throw new Error("Failed to create test template path");
  }

  const templateResult = Template.create(pathResult.unwrap(), {
    content,
    format: "json",
  });
  if (templateResult.isError()) {
    throw new Error("Failed to create test template");
  }

  return templateResult.unwrap();
}

Deno.test("ItemsProcessor - create instance", () => {
  const detector = ItemsDetector.create();
  const expander = ItemsExpander.create();
  const loader = new MockTemplateLoader();

  const processor = ItemsProcessor.create(detector, expander, loader);

  assertEquals(typeof processor, "object");
  assertEquals(processor.constructor.name, "ItemsProcessor");
});

Deno.test("ItemsProcessor - process template without {@items}", async () => {
  const detector = ItemsDetector.create();
  const expander = ItemsExpander.create();
  const loader = new MockTemplateLoader();
  const processor = ItemsProcessor.create(detector, expander, loader);

  const containerTemplate = createTestTemplate({
    title: "Simple Template",
    content: "No items here",
  });

  const context = {
    containerTemplate,
    arrayData: [{ id: 1 }, { id: 2 }],
    globalVariables: {},
  };

  const result = await processor.processItems(context);

  assertEquals(result.isOk(), true);
  const processing = result.unwrap();
  assertEquals(processing.wasExpanded, false);
  assertEquals(processing.detectionResult.hasItems, false);
  assertEquals(processing.processedTemplate, containerTemplate);
});

Deno.test("ItemsProcessor - process template with {@items} and x-template-items", async () => {
  const detector = ItemsDetector.create();
  const expander = ItemsExpander.create();
  const loader = new MockTemplateLoader();
  const processor = ItemsProcessor.create(detector, expander, loader);

  const containerTemplate = createTestTemplate({
    title: "Commands List",
    commands: "{@items}",
  }, "container.json");

  const itemsTemplate = createTestTemplate({
    id: "${id}",
    name: "${name}",
  }, "item-template.json");

  loader.addTemplate("item-template.json", itemsTemplate);

  const itemsTemplateRef = ItemsProcessor.createTemplateReference(
    "item-template.json",
  );

  const context = {
    containerTemplate,
    itemsTemplateRef,
    arrayData: [
      { id: "cmd1", name: "First Command" },
      { id: "cmd2", name: "Second Command" },
    ],
    globalVariables: { version: "1.0" },
  };

  const result = await processor.processItems(context);

  assertEquals(result.isOk(), true);
  const processing = result.unwrap();
  assertEquals(processing.wasExpanded, true);
  assertEquals(processing.detectionResult.hasItems, true);
  assertEquals(processing.expansionResult?.expandedItemCount, 2);

  const commands = processing.processedTemplate.getContent().commands as any[];
  assertEquals(commands.length, 2);
  assertEquals(commands[0].id, "cmd1");
  assertEquals(commands[1].name, "Second Command");
});

Deno.test("ItemsProcessor - process template with {@items} but no x-template-items", async () => {
  const detector = ItemsDetector.create();
  const expander = ItemsExpander.create();
  const loader = new MockTemplateLoader();
  const processor = ItemsProcessor.create(detector, expander, loader);

  const containerTemplate = createTestTemplate({
    title: "Commands List",
    commands: "{@items}",
  });

  const context = {
    containerTemplate,
    // No itemsTemplateRef provided
    arrayData: [{ id: "cmd1" }, { id: "cmd2" }],
    globalVariables: {},
  };

  const result = await processor.processItems(context);

  assertEquals(result.isOk(), true);
  const processing = result.unwrap();
  assertEquals(processing.wasExpanded, false); // Not expanded without x-template-items
  assertEquals(processing.detectionResult.hasItems, true);

  // {@items} should remain unexpanded
  const content = processing.processedTemplate.getContent();
  assertEquals(content.commands, "{@items}");
});

Deno.test("ItemsProcessor - handle template loading error", async () => {
  const detector = ItemsDetector.create();
  const expander = ItemsExpander.create();
  const loader = new MockTemplateLoader();
  const processor = ItemsProcessor.create(detector, expander, loader);

  const containerTemplate = createTestTemplate({
    commands: "{@items}",
  });

  loader.addLoadError(
    "missing-template.json",
    new TemplateError("File not found", "TEMPLATE_NOT_FOUND", {}),
  );

  const itemsTemplateRef = ItemsProcessor.createTemplateReference(
    "missing-template.json",
  );

  const context = {
    containerTemplate,
    itemsTemplateRef,
    arrayData: [{ id: 1 }],
    globalVariables: {},
  };

  const result = await processor.processItems(context);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "TEMPLATE_LOAD_ERROR");
});

Deno.test("ItemsProcessor - handle invalid processing context", async () => {
  const detector = ItemsDetector.create();
  const expander = ItemsExpander.create();
  const loader = new MockTemplateLoader();
  const processor = ItemsProcessor.create(detector, expander, loader);

  const context = {
    containerTemplate: null as any,
    arrayData: [],
    globalVariables: {},
  };

  const result = await processor.processItems(context);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_PROCESSING_CONTEXT");
});

Deno.test("ItemsProcessor - handle non-array data", async () => {
  const detector = ItemsDetector.create();
  const expander = ItemsExpander.create();
  const loader = new MockTemplateLoader();
  const processor = ItemsProcessor.create(detector, expander, loader);

  const containerTemplate = createTestTemplate({
    commands: "{@items}",
  });

  const context = {
    containerTemplate,
    arrayData: "not an array" as any,
    globalVariables: {},
  };

  const result = await processor.processItems(context);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_PROCESSING_CONTEXT");
});

Deno.test("ItemsProcessor - requiresItemsProcessing returns true for templates with {@items}", () => {
  const detector = ItemsDetector.create();
  const expander = ItemsExpander.create();
  const loader = new MockTemplateLoader();
  const processor = ItemsProcessor.create(detector, expander, loader);

  const templateWithItems = createTestTemplate({
    commands: "{@items}",
  });

  const templateWithoutItems = createTestTemplate({
    content: "No items here",
  });

  assertEquals(processor.requiresItemsProcessing(templateWithItems), true);
  assertEquals(processor.requiresItemsProcessing(templateWithoutItems), false);
});

Deno.test("ItemsProcessor - createTemplateReference creates correct reference", () => {
  const ref1 = ItemsProcessor.createTemplateReference("item-template.json");
  assertEquals(ref1.source, "x-template-items");
  assertEquals(ref1.templatePath, "item-template.json");
  assertEquals(ref1.isRequired, true);

  const ref2 = ItemsProcessor.createTemplateReference(
    "main-template.json",
    "x-template",
  );
  assertEquals(ref2.source, "x-template");
  assertEquals(ref2.templatePath, "main-template.json");
  assertEquals(ref2.isRequired, false);
});

Deno.test("ItemsProcessor - handle complex nested {@items} processing", async () => {
  const detector = ItemsDetector.create();
  const expander = ItemsExpander.create();
  const loader = new MockTemplateLoader();
  const processor = ItemsProcessor.create(detector, expander, loader);

  const containerTemplate = createTestTemplate({
    sections: {
      commands: "{@items}",
      metadata: {
        count: 3,
      },
    },
  });

  const itemsTemplate = createTestTemplate({
    cmd: "${command}",
    desc: "${description}",
    index: "${$index}",
  }, "command-item.json");

  loader.addTemplate("command-item.json", itemsTemplate);

  const itemsTemplateRef = ItemsProcessor.createTemplateReference(
    "command-item.json",
  );

  const context = {
    containerTemplate,
    itemsTemplateRef,
    arrayData: [
      { command: "ls", description: "List files" },
      { command: "cd", description: "Change directory" },
    ],
    globalVariables: { version: "2.0" },
  };

  const result = await processor.processItems(context);

  assertEquals(result.isOk(), true);
  const processing = result.unwrap();
  assertEquals(processing.wasExpanded, true);

  const sections = processing.processedTemplate.getContent().sections as any;
  assertEquals(sections.metadata.count, 3);

  const commands = sections.commands as any[];
  assertEquals(commands.length, 2);
  assertEquals(commands[0].cmd, "ls");
  assertEquals(commands[0].index, "0");
  assertEquals(commands[1].desc, "Change directory");
});

Deno.test("ItemsProcessor - handle empty array data", async () => {
  const detector = ItemsDetector.create();
  const expander = ItemsExpander.create();
  const loader = new MockTemplateLoader();
  const processor = ItemsProcessor.create(detector, expander, loader);

  const containerTemplate = createTestTemplate({
    items: "{@items}",
  });

  const itemsTemplate = createTestTemplate({
    value: "${value}",
  }, "empty-items.json");

  loader.addTemplate("empty-items.json", itemsTemplate);

  const itemsTemplateRef = ItemsProcessor.createTemplateReference(
    "empty-items.json",
  );

  const context = {
    containerTemplate,
    itemsTemplateRef,
    arrayData: [],
    globalVariables: {},
  };

  const result = await processor.processItems(context);

  assertEquals(result.isOk(), true);
  const processing = result.unwrap();
  assertEquals(processing.wasExpanded, true);
  assertEquals(processing.expansionResult?.expandedItemCount, 0);

  const items = processing.processedTemplate.getContent().items as any[];
  assertEquals(Array.isArray(items), true);
  assertEquals(items.length, 0);
});

Deno.test("ItemsProcessor - handle multiple {@items} patterns (validation error)", async () => {
  const detector = ItemsDetector.create();
  const expander = ItemsExpander.create();
  const loader = new MockTemplateLoader();
  const processor = ItemsProcessor.create(detector, expander, loader);

  const containerTemplate = createTestTemplate({
    content: "{@items} and another {@items}", // Invalid: multiple patterns in same context
  });

  const context = {
    containerTemplate,
    arrayData: [{ id: 1 }],
    globalVariables: {},
  };

  const result = await processor.processItems(context);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_ITEMS_PATTERNS");
});

Deno.test("ItemsProcessor - handle invalid template path", async () => {
  const detector = ItemsDetector.create();
  const expander = ItemsExpander.create();
  const loader = new MockTemplateLoader();
  const processor = ItemsProcessor.create(detector, expander, loader);

  const containerTemplate = createTestTemplate({
    commands: "{@items}",
  });

  const itemsTemplateRef = ItemsProcessor.createTemplateReference(""); // Invalid empty path

  const context = {
    containerTemplate,
    itemsTemplateRef,
    arrayData: [{ id: 1 }],
    globalVariables: {},
  };

  const result = await processor.processItems(context);

  assertEquals(result.isError(), true);
  // Should fail due to invalid template path (empty path creates EMPTY_PATH error)
  assertEquals(
    result.unwrapError().code === "EMPTY_PATH" ||
      result.unwrapError().code === "TEMPLATE_LOAD_ERROR" ||
      result.unwrapError().code === "INVALID_TEMPLATE_PATH",
    true,
  );
});
