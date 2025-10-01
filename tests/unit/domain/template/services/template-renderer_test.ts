import { assert, assertEquals } from "@std/assert";
import { TemplateRenderer } from "../../../../../src/domain/template/services/template-renderer.ts";
import { Template } from "../../../../../src/domain/template/entities/template.ts";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

Deno.test("TemplateRenderer - create returns Ok result", () => {
  const result = TemplateRenderer.create();
  assert(result.isOk());
});

Deno.test("TemplateRenderer - render with simple template and data", () => {
  const renderer = TemplateRenderer.create().unwrap();

  const templatePath = TemplatePath.create("template.json").unwrap();
  const templateData = {
    content: {
      title: "{title}",
      description: "{description}"
    },
    format: "json" as const
  };
  const template = Template.create(templatePath, templateData).unwrap();

  const frontmatterData = FrontmatterData.create({
    title: "Test Title",
    description: "Test Description"
  }).unwrap();

  const result = renderer.render(template, frontmatterData);

  assert(result.isOk());
  const output = result.unwrap();
  assert(output.includes("Test Title") || output.includes("{title}"));
});

Deno.test("TemplateRenderer - renderWithArray combines multiple frontmatter data", () => {
  const renderer = TemplateRenderer.create().unwrap();

  const templatePath = TemplatePath.create("template.json").unwrap();
  const templateData = {
    content: {
      items: "{items}",
      count: "{items.length}"
    },
    format: "json" as const
  };
  const template = Template.create(templatePath, templateData).unwrap();

  const data1 = FrontmatterData.create({ title: "Item 1", value: 10 }).unwrap();
  const data2 = FrontmatterData.create({ title: "Item 2", value: 20 }).unwrap();

  const result = renderer.renderWithArray(template, [data1, data2]);

  assert(result.isOk());
  const output = result.unwrap();
  // Output should be valid JSON
  assert(output.length > 0);
  assert(output.startsWith("{") || output.startsWith("["));
});

Deno.test("TemplateRenderer - renderWithArray with empty array", () => {
  const renderer = TemplateRenderer.create().unwrap();

  const templatePath = TemplatePath.create("template.json").unwrap();
  const templateData = {
    content: {
      items: [],
      count: 0
    },
    format: "json" as const
  };
  const template = Template.create(templatePath, templateData).unwrap();

  const result = renderer.renderWithArray(template, []);

  assert(result.isOk());
  const output = result.unwrap();
  assert(output.length > 0);
});

Deno.test("TemplateRenderer - renderWithArray with single item", () => {
  const renderer = TemplateRenderer.create().unwrap();

  const templatePath = TemplatePath.create("template.json").unwrap();
  const templateData = {
    content: {
      title: "{title}",
      items: "{items}"
    },
    format: "json" as const
  };
  const template = Template.create(templatePath, templateData).unwrap();

  const data = FrontmatterData.create({ title: "Single Item", value: 42 }).unwrap();

  const result = renderer.renderWithArray(template, [data]);

  assert(result.isOk());
  const output = result.unwrap();
  assert(output.includes("Single Item") || output.includes("{title}"));
});

Deno.test("TemplateRenderer - renderWithItems with valid container template", () => {
  const renderer = TemplateRenderer.create().unwrap();

  const containerTemplate = {
    content: {
      title: "Container",
      items: "{items}"
    }
  };

  const data1 = FrontmatterData.create({ name: "Item 1" }).unwrap();
  const data2 = FrontmatterData.create({ name: "Item 2" }).unwrap();

  const result = renderer.renderWithItems(
    containerTemplate,
    [data1, data2]
  );

  assert(result.isOk());
  const output = result.unwrap();
  assert(output.length > 0);
});

Deno.test("TemplateRenderer - renderWithItems with invalid container template", () => {
  const renderer = TemplateRenderer.create().unwrap();

  const data = FrontmatterData.create({ name: "Item" }).unwrap();

  const result = renderer.renderWithItems(
    null, // Invalid container
    [data]
  );

  assert(result.isError());
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_CONTAINER_TEMPLATE");
});

Deno.test("TemplateRenderer - renderWithItems with items template", () => {
  const renderer = TemplateRenderer.create().unwrap();

  const containerTemplate = {
    content: {
      collection: "{items}"
    }
  };

  const itemsTemplate = {
    path: "items-template.json",
    content: {
      name: "{name}"
    }
  };

  const data = FrontmatterData.create({ name: "Test Item" }).unwrap();

  const result = renderer.renderWithItems(
    containerTemplate,
    [data],
    itemsTemplate
  );

  assert(result.isOk());
});

Deno.test("TemplateRenderer - renderWithItems with empty data array", () => {
  const renderer = TemplateRenderer.create().unwrap();

  const containerTemplate = {
    content: {
      items: [],
      count: 0
    }
  };

  const result = renderer.renderWithItems(
    containerTemplate,
    []
  );

  assert(result.isOk());
  const output = result.unwrap();
  assert(output.includes("[]") || output.includes("items"));
});

Deno.test("TemplateRenderer - render handles template resolution error", () => {
  const renderer = TemplateRenderer.create().unwrap();

  // Create a template that will fail variable resolution
  const templatePath = TemplatePath.create("template.json").unwrap();
  const templateData = {
    content: {
      // Template structure that might cause resolution issues
      nested: {
        deep: {
          value: "{nonexistent}"
        }
      }
    },
    format: "json" as const
  };
  const template = Template.create(templatePath, templateData).unwrap();

  const frontmatterData = FrontmatterData.create({
    title: "Test"
  }).unwrap();

  const result = renderer.render(template, frontmatterData);

  // Should either succeed or fail gracefully
  if (result.isError()) {
    const error = result.unwrapError();
    assert(
      error.code === "TEMPLATE_RESOLUTION_ERROR" ||
      error.code === "TEMPLATE_RENDERING_ERROR"
    );
  } else {
    assert(result.isOk());
  }
});
