import { assertEquals, assertInstanceOf } from "jsr:@std/assert";
import { Template, TemplateData } from "../../../../../src/domain/template/entities/template.ts";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";
import { TemplateError } from "../../../../../src/domain/shared/types/errors.ts";

// Test data factory functions
function createValidTemplateData(): TemplateData {
  return {
    content: {
      title: "Test Template",
      metadata: {
        version: "1.0",
        author: "Test Author",
      },
      items: [],
    },
    format: "json" as const,
  };
}

function createItemsTemplateData(): TemplateData {
  return {
    content: {
      title: "Items Template",
      commands: "{@items}",
      nested: {
        list: ["{@items}", "static_item"],
      },
    },
    format: "json" as const,
  };
}

function createVariableTemplateData(): TemplateData {
  return {
    content: {
      title: "${metadata.title}",
      description: "Template for ${entity.name}",
      config: {
        version: "${app.version}",
        debug: "${settings.debug}",
      },
    },
    format: "json" as const,
  };
}

Deno.test("Template - create with valid data", () => {
  const path = TemplatePath.create("test_template.json").unwrap();
  const data = createValidTemplateData();

  const result = Template.create(path, data);

  assertEquals(result.isOk(), true);
  const template = result.unwrap();
  assertEquals(template.getPath(), path);
  assertEquals(template.getFormat(), "json");
});

Deno.test("Template - create with invalid data", () => {
  const path = TemplatePath.create("test_template.json").unwrap();
  const invalidData: TemplateData = {
    content: null as any,
    format: "json",
  };

  const result = Template.create(path, invalidData);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_TEMPLATE_DATA");
});

Deno.test("Template - getContent returns copy of template content", () => {
  const path = TemplatePath.create("test_template.json").unwrap();
  const data = createValidTemplateData();
  const template = Template.create(path, data).unwrap();

  const content = template.getContent();

  assertEquals(content.title, "Test Template");
  assertEquals((content.metadata as any).version, "1.0");

  // Verify it's a copy, not the original
  content.title = "Modified";
  assertEquals(template.getContent().title, "Test Template");
});

Deno.test("Template - hasProperty checks for property existence", () => {
  const path = TemplatePath.create("test_template.json").unwrap();
  const data = createValidTemplateData();
  const template = Template.create(path, data).unwrap();

  assertEquals(template.hasProperty("title"), true);
  assertEquals(template.hasProperty("metadata.version"), true);
  assertEquals(template.hasProperty("metadata.author"), true);
  assertEquals(template.hasProperty("nonexistent"), false);
  assertEquals(template.hasProperty("metadata.nonexistent"), false);
});

Deno.test("Template - getNestedProperty retrieves nested values", () => {
  const path = TemplatePath.create("test_template.json").unwrap();
  const data = createValidTemplateData();
  const template = Template.create(path, data).unwrap();

  assertEquals(template.getNestedProperty("title"), "Test Template");
  assertEquals(template.getNestedProperty("metadata.version"), "1.0");
  assertEquals(template.getNestedProperty("metadata.author"), "Test Author");
  assertEquals(template.getNestedProperty("nonexistent"), undefined);
  assertEquals(template.getNestedProperty("metadata.nonexistent"), undefined);
});

Deno.test("Template - hasItemsExpansion detects {@items} patterns", () => {
  const path = TemplatePath.create("test_template.json").unwrap();

  // Template without items expansion
  const regularTemplate = Template.create(path, createValidTemplateData()).unwrap();
  assertEquals(regularTemplate.hasItemsExpansion(), false);

  // Template with items expansion
  const itemsTemplate = Template.create(path, createItemsTemplateData()).unwrap();
  assertEquals(itemsTemplate.hasItemsExpansion(), true);
});

Deno.test("Template - isItemsTemplate uses both path and content heuristics", () => {
  // Test with items content pattern
  const regularPath = TemplatePath.create("regular_template.json").unwrap();
  const itemsTemplate = Template.create(regularPath, createItemsTemplateData()).unwrap();
  assertEquals(itemsTemplate.isItemsTemplate(), true);

  // Test with items path pattern
  const itemsPath = TemplatePath.create("registry_command_template.json").unwrap();
  const regularTemplate = Template.create(itemsPath, createValidTemplateData()).unwrap();
  assertEquals(regularTemplate.isItemsTemplate(), true);

  // Test with neither pattern
  const normalTemplate = Template.create(regularPath, createValidTemplateData()).unwrap();
  assertEquals(normalTemplate.isItemsTemplate(), false);
});

Deno.test("Template - resolveVariables substitutes variables correctly", () => {
  const path = TemplatePath.create("variable_template.json").unwrap();
  const data = createVariableTemplateData();
  const template = Template.create(path, data).unwrap();

  const variables = {
    metadata: { title: "Resolved Title" },
    entity: { name: "TestEntity" },
    app: { version: "2.0.1" },
    settings: { debug: true },
  };

  const result = template.resolveVariables(variables);

  assertEquals(result.isOk(), true);
  const resolved = result.unwrap();

  assertEquals(resolved.getNestedProperty("title"), "Resolved Title");
  assertEquals(resolved.getNestedProperty("description"), "Template for TestEntity");
  assertEquals(resolved.getNestedProperty("config.version"), "2.0.1");
  assertEquals(resolved.getNestedProperty("config.debug"), "true");
});

Deno.test("Template - resolveVariables handles missing variables gracefully", () => {
  const path = TemplatePath.create("variable_template.json").unwrap();
  const data = createVariableTemplateData();
  const template = Template.create(path, data).unwrap();

  const partialVariables = {
    metadata: { title: "Resolved Title" },
    // Missing entity and app variables
  };

  const result = template.resolveVariables(partialVariables);

  assertEquals(result.isOk(), true);
  const resolved = result.unwrap();

  assertEquals(resolved.getNestedProperty("title"), "Resolved Title");
  assertEquals(resolved.getNestedProperty("description"), "Template for ${entity.name}");
  assertEquals(resolved.getNestedProperty("config.version"), "${app.version}");
});

Deno.test("Template - resolveVariables handles nested arrays", () => {
  const path = TemplatePath.create("array_template.json").unwrap();
  const data: TemplateData = {
    content: {
      items: [
        "${item.name}",
        { type: "${item.type}", value: "${item.value}" },
        "static_item",
      ],
    },
    format: "json",
  };
  const template = Template.create(path, data).unwrap();

  const variables = {
    item: { name: "TestItem", type: "string", value: "test_value" },
  };

  const result = template.resolveVariables(variables);

  assertEquals(result.isOk(), true);
  const resolved = result.unwrap();

  const items = resolved.getNestedProperty("items") as unknown[];
  assertEquals(items[0], "TestItem");
  assertEquals((items[1] as any).type, "string");
  assertEquals((items[1] as any).value, "test_value");
  assertEquals(items[2], "static_item");
});

Deno.test("Template - resolveVariables with error handling", () => {
  const path = TemplatePath.create("template.json").unwrap();
  const data: TemplateData = {
    content: { test: "value" },
    format: "json",
  };
  const template = Template.create(path, data).unwrap();

  // Create a scenario that would cause resolution error (circular reference)
  const circularVariables: any = {};
  circularVariables.self = circularVariables;

  const result = template.resolveVariables(circularVariables);

  // Should handle gracefully and not crash
  assertEquals(result.isOk(), true);
});

Deno.test("Template - toString provides meaningful representation", () => {
  const path = TemplatePath.create("test_template.json").unwrap();
  const data = createValidTemplateData();
  const template = Template.create(path, data).unwrap();

  const str = template.toString();

  assertEquals(str.includes("test_template.json"), true);
  assertEquals(str.includes("json"), true);
  assertEquals(str.includes("container template"), true);
});

Deno.test("Template - toString identifies items template", () => {
  const path = TemplatePath.create("items_template.json").unwrap();
  const data = createItemsTemplateData();
  const template = Template.create(path, data).unwrap();

  const str = template.toString();

  assertEquals(str.includes("items template"), true);
});

Deno.test("Template - equals compares templates by path", () => {
  const path1 = TemplatePath.create("template1.json").unwrap();
  const path2 = TemplatePath.create("template2.json").unwrap();
  const data = createValidTemplateData();

  const template1a = Template.create(path1, data).unwrap();
  const template1b = Template.create(path1, data).unwrap();
  const template2 = Template.create(path2, data).unwrap();

  assertEquals(template1a.equals(template1b), true);
  assertEquals(template1a.equals(template2), false);
});

Deno.test("Template - complex variable resolution scenario", () => {
  const path = TemplatePath.create("complex_template.json").unwrap();
  const data: TemplateData = {
    content: {
      header: {
        title: "${document.title}",
        metadata: {
          version: "${app.version}",
          created: "${timestamp}",
        },
      },
      body: [
        {
          section: "${section.name}",
          content: "${section.content}",
        },
        "Static content",
        "${footer.text}",
      ],
    },
    format: "json",
  };
  const template = Template.create(path, data).unwrap();

  const variables = {
    document: { title: "Complex Document" },
    app: { version: "3.0.0" },
    timestamp: "2024-01-01T00:00:00Z",
    section: { name: "Introduction", content: "Welcome to the document" },
    footer: { text: "End of document" },
  };

  const result = template.resolveVariables(variables);

  assertEquals(result.isOk(), true);
  const resolved = result.unwrap();

  assertEquals(resolved.getNestedProperty("header.title"), "Complex Document");
  assertEquals(resolved.getNestedProperty("header.metadata.version"), "3.0.0");
  assertEquals(resolved.getNestedProperty("header.metadata.created"), "2024-01-01T00:00:00Z");

  const body = resolved.getNestedProperty("body") as unknown[];
  assertEquals((body[0] as any).section, "Introduction");
  assertEquals((body[0] as any).content, "Welcome to the document");
  assertEquals(body[1], "Static content");
  assertEquals(body[2], "End of document");
});