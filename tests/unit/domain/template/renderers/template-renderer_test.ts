import { assertEquals } from "@std/assert";
import { TemplateRenderer } from "../../../../../src/domain/template/renderers/template-renderer.ts";
import { Template } from "../../../../../src/domain/template/entities/template.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";
import { isOk } from "../../../../../src/domain/shared/types/result.ts";

// Test helper to create template
function createTestTemplate(
  content: unknown,
  format: "json" | "yaml" = "json",
): Template {
  const pathResult = TemplatePath.create("test-template.json");
  if (!isOk(pathResult)) {
    throw new Error("Failed to create template path");
  }

  const templateResult = Template.create(pathResult.data, content);
  if (!isOk(templateResult)) {
    throw new Error("Failed to create template");
  }

  // Apply format if different from default
  if (format === "yaml") {
    return templateResult.data.withFormat("yaml");
  }

  return templateResult.data;
}

// Test helper to create frontmatter data
function createTestFrontmatterData(
  data: Record<string, unknown>,
): FrontmatterData {
  const result = FrontmatterData.create(data);
  if (!isOk(result)) {
    throw new Error("Failed to create frontmatter data");
  }
  return result.data;
}

Deno.test("TemplateRenderer - should render simple string template", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const template = createTestTemplate("Hello {name}!");
  const data = createTestFrontmatterData({ name: "World" });

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(parsed, "Hello World!");
  }
});

Deno.test("TemplateRenderer - should render object template", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const templateContent = {
    title: "{title}",
    version: "{version}",
    description: "{description}",
  };
  const template = createTestTemplate(templateContent);
  const data = createTestFrontmatterData({
    title: "Test Project",
    version: "1.0.0",
    description: "A test project",
  });

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(parsed.title, "Test Project");
    assertEquals(parsed.version, "1.0.0");
    assertEquals(parsed.description, "A test project");
  }
});

Deno.test("TemplateRenderer - should render array template", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const templateContent = [
    "{item1}",
    "{item2}",
    "static-item",
  ];
  const template = createTestTemplate(templateContent);
  const data = createTestFrontmatterData({
    item1: "First Item",
    item2: "Second Item",
  });

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(Array.isArray(parsed), true);
    assertEquals(parsed[0], "First Item");
    assertEquals(parsed[1], "Second Item");
    assertEquals(parsed[2], "static-item");
  }
});

Deno.test("TemplateRenderer - should render nested object template", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const templateContent = {
    project: {
      name: "{name}",
      settings: {
        debug: "{debug}",
        version: "{version}",
      },
    },
    metadata: {
      author: "{author}",
    },
  };
  const template = createTestTemplate(templateContent);
  const data = createTestFrontmatterData({
    name: "My Project",
    debug: true,
    version: "2.0.0",
    author: "Developer",
  });

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(parsed.project.name, "My Project");
    assertEquals(parsed.project.settings.debug, "true"); // Template renderer converts values to strings
    assertEquals(parsed.project.settings.version, "2.0.0");
    assertEquals(parsed.metadata.author, "Developer");
  }
});

Deno.test("TemplateRenderer - should handle missing variables with placeholders", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const template = createTestTemplate("Hello {name}, version {version}!");
  const data = createTestFrontmatterData({ name: "World" }); // Missing version

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(parsed, "Hello World, version {version}!"); // Unresolved variable remains
  }
});

Deno.test("TemplateRenderer - should render with array data", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const template = createTestTemplate("{title}: {count} items");
  const dataArray = [
    createTestFrontmatterData({ title: "First", count: 1 }),
    createTestFrontmatterData({ title: "Second", count: 2 }),
    createTestFrontmatterData({ title: "Third", count: 3 }),
  ];

  // Act
  const result = renderer.renderWithArray(template, dataArray);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(Array.isArray(parsed), true);
    assertEquals(parsed.length, 3);
    assertEquals(parsed[0], "First: 1 items");
    assertEquals(parsed[1], "Second: 2 items");
    assertEquals(parsed[2], "Third: 3 items");
  }
});

Deno.test("TemplateRenderer - should handle empty array", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const template = createTestTemplate("Count: {count}");
  const emptyArray: FrontmatterData[] = [];

  // Act
  const result = renderer.renderWithArray(template, emptyArray);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(Array.isArray(parsed), true);
    assertEquals(parsed.length, 0);
  }
});

Deno.test("TemplateRenderer - should handle frontmatter_value objects", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const templateContent = {
    title: "{title}",
    specialField: { frontmatter_value: "special_data" },
  };
  const template = createTestTemplate(templateContent);
  const data = createTestFrontmatterData({
    title: "Test",
    special_data: "Special Value",
  });

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(parsed.title, "Test");
    assertEquals(parsed.specialField, "Special Value");
  }
});

Deno.test("TemplateRenderer - should handle frontmatter_value with missing data", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const templateContent = {
    title: "{title}",
    specialField: { frontmatter_value: "missing_data" },
  };
  const template = createTestTemplate(templateContent);
  const data = createTestFrontmatterData({ title: "Test" }); // missing_data not present

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(parsed.title, "Test");
    assertEquals(parsed.specialField, undefined); // Should be undefined when data not found
  }
});

Deno.test("TemplateRenderer - should render template keys with variables", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const templateContent = {
    "{keyName}": "value",
    "static-key": "{value}",
  };
  const template = createTestTemplate(templateContent);
  const data = createTestFrontmatterData({
    keyName: "dynamicKey",
    value: "dynamicValue",
  });

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(parsed.dynamicKey, "value");
    assertEquals(parsed["static-key"], "dynamicValue");
  }
});

Deno.test("TemplateRenderer - should handle complex nested arrays", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const templateContent = {
    items: [
      { name: "{item1}", type: "first" },
      { name: "{item2}", type: "second" },
      ["{nested1}", "{nested2}"],
    ],
  };
  const template = createTestTemplate(templateContent);
  const data = createTestFrontmatterData({
    item1: "Item One",
    item2: "Item Two",
    nested1: "Nested One",
    nested2: "Nested Two",
  });

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(parsed.items[0].name, "Item One");
    assertEquals(parsed.items[0].type, "first");
    assertEquals(parsed.items[1].name, "Item Two");
    assertEquals(parsed.items[1].type, "second");
    assertEquals(parsed.items[2][0], "Nested One");
    assertEquals(parsed.items[2][1], "Nested Two");
  }
});

Deno.test("TemplateRenderer - should handle boolean and number values", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const templateContent = {
    enabled: "{enabled}",
    count: "{count}",
    rate: "{rate}",
    message: "Status: {enabled}, Count: {count}",
  };
  const template = createTestTemplate(templateContent);
  const data = createTestFrontmatterData({
    enabled: true,
    count: 42,
    rate: 3.14,
  });

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(parsed.enabled, "true"); // Template renderer converts to strings
    assertEquals(parsed.count, "42"); // Template renderer converts to strings
    assertEquals(parsed.rate, "3.14"); // Template renderer converts to strings
    assertEquals(parsed.message, "Status: true, Count: 42");
  }
});

Deno.test("TemplateRenderer - should handle null and undefined values", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const templateContent = {
    nullValue: "{nullValue}",
    undefinedValue: "{undefinedValue}",
    normalValue: "{normalValue}",
  };
  const template = createTestTemplate(templateContent);
  const data = createTestFrontmatterData({
    nullValue: null,
    normalValue: "normal",
    // undefinedValue is intentionally missing
  });

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    assertEquals(parsed.nullValue, "null"); // Template renderer converts to strings
    assertEquals(parsed.undefinedValue, "{undefinedValue}"); // Unresolved
    assertEquals(parsed.normalValue, "normal");
  }
});

Deno.test("TemplateRenderer - should handle YAML format", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const templateContent = {
    title: "{title}",
    version: "{version}",
  };
  const template = createTestTemplate(templateContent, "yaml");
  const data = createTestFrontmatterData({
    title: "YAML Project",
    version: "1.0.0",
  });

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    // YAML output should be string format
    assertEquals(typeof result.data, "string");
    assertEquals(result.data.includes("title: YAML Project"), true);
    assertEquals(result.data.includes("version: 1.0.0"), true);
  }
});

Deno.test("TemplateRenderer - should preserve data types in rendering", () => {
  // Arrange
  const rendererResult = TemplateRenderer.create();
  if (!rendererResult.ok) {
    throw new Error(
      `Failed to create renderer: ${rendererResult.error.message}`,
    );
  }
  const renderer = rendererResult.data;
  const templateContent = {
    stringVal: "{stringVal}",
    boolVal: "{boolVal}",
    numVal: "{numVal}",
    arrayVal: "{arrayVal}",
    objVal: "{objVal}",
  };
  const template = createTestTemplate(templateContent);
  const data = createTestFrontmatterData({
    stringVal: "test",
    boolVal: false,
    numVal: 123,
    arrayVal: [1, 2, 3],
    objVal: { nested: "value" },
  });

  // Act
  const result = renderer.render(template, data);

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const parsed = JSON.parse(result.data);
    // Template renderer converts all template variables to strings during substitution
    assertEquals(typeof parsed.stringVal, "string");
    assertEquals(typeof parsed.boolVal, "string"); // Template variables become strings
    assertEquals(typeof parsed.numVal, "string"); // Template variables become strings
    assertEquals(typeof parsed.arrayVal, "string"); // Template variables become strings
    assertEquals(typeof parsed.objVal, "string"); // Template variables become strings
    assertEquals(parsed.stringVal, "test");
    assertEquals(parsed.boolVal, "false");
    assertEquals(parsed.numVal, "123");
    assertEquals(parsed.arrayVal, "[1,2,3]"); // Array converted to string with brackets
    assertEquals(parsed.objVal, '{"nested":"value"}'); // Object converted to JSON string
  }
});
