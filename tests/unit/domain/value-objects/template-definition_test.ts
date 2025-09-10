/**
 * TemplateDefinition Value Object Tests
 *
 * Tests for TemplateDefinition Smart Constructor and validation
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { TemplateDefinition } from "../../../../src/domain/value-objects/template-definition.ts";

Deno.test("TemplateDefinition - should create valid Handlebars template", () => {
  const content = "<h1>{{title}}</h1><p>Hello {{name}}!</p>";
  const result = TemplateDefinition.create(content, "handlebars", {
    name: "greeting",
    description: "A greeting template",
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getContent(), content);
    assertEquals(result.data.getEngine(), "handlebars");
    assertEquals(result.data.getName(), "greeting");
    assertEquals(result.data.getDescription(), "A greeting template");
  }
});

Deno.test("TemplateDefinition - should create valid Mustache template", () => {
  const content = "<div>{{#items}}<span>{{name}}</span>{{/items}}</div>";
  const result = TemplateDefinition.create(content, "mustache");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getEngine(), "mustache");
    assertEquals(result.data.getContent(), content);
  }
});

Deno.test("TemplateDefinition - should create valid Liquid template", () => {
  const content = "{% for item in items %}{{ item.name }}{% endfor %}";
  const result = TemplateDefinition.create(content, "liquid");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getEngine(), "liquid");
  }
});

Deno.test("TemplateDefinition - should create valid EJS template", () => {
  const content =
    "<h1><%= title %></h1><% for(let i=0; i<items.length; i++) { %><p><%= items[i] %></p><% } %>";
  const result = TemplateDefinition.create(content, "ejs");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getEngine(), "ejs");
  }
});

Deno.test("TemplateDefinition - should create valid HTML template", () => {
  const content =
    "<html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>";
  const result = TemplateDefinition.create(content, "html");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getEngine(), "html");
  }
});

Deno.test("TemplateDefinition - should create valid text template", () => {
  const content = "Hello world!\nThis is a plain text template.";
  const result = TemplateDefinition.create(content, "text");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getEngine(), "text");
  }
});

Deno.test("TemplateDefinition - should reject empty content", () => {
  const result = TemplateDefinition.create("", "handlebars");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
    assertExists(result.error.message);
  }
});

Deno.test("TemplateDefinition - should reject whitespace-only content", () => {
  const result = TemplateDefinition.create("   ", "handlebars");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
  }
});

Deno.test("TemplateDefinition - should reject invalid engine", () => {
  const result = TemplateDefinition.create("content", "invalid" as never);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("TemplateDefinition - should reject unbalanced Handlebars braces", () => {
  const content = "<h1>{{title}</h1><p>{{name}}</p>";
  const result = TemplateDefinition.create(content, "handlebars");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("TemplateDefinition - should reject unbalanced Mustache braces", () => {
  const content = "<div>{{#items}<span>{{name}}</span>{{/items}}</div>";
  const result = TemplateDefinition.create(content, "mustache");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("TemplateDefinition - should reject unbalanced Liquid tags", () => {
  const content = "{% for item in items {{ item.name }}";
  const result = TemplateDefinition.create(content, "liquid");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("TemplateDefinition - should reject unbalanced EJS tags", () => {
  const content =
    "<h1><%= title <% for(let i=0; i<items.length; i++) { %><p><%= items[i] %></p>";
  const result = TemplateDefinition.create(content, "ejs");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("TemplateDefinition - should validate metadata", () => {
  const content = "<h1>{{title}}</h1>";
  const metadata = {
    name: "test-template",
    description: "A test template",
    version: "1.0.0",
    author: "Test Author",
    tags: ["test", "demo"],
    variables: ["title", "content"],
  };

  const result = TemplateDefinition.create(content, "handlebars", metadata);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getName(), "test-template");
    assertEquals(result.data.getDescription(), "A test template");
    assertEquals(result.data.getVersion(), "1.0.0");
    assertEquals(result.data.getTags(), ["test", "demo"]);
    assertEquals(result.data.getVariables(), ["title", "content"]);
  }
});

Deno.test("TemplateDefinition - should reject invalid metadata name", () => {
  const content = "<h1>{{title}}</h1>";
  const result = TemplateDefinition.create(content, "handlebars", { name: "" });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("TemplateDefinition - should reject invalid metadata tags", () => {
  const content = "<h1>{{title}}</h1>";
  const result = TemplateDefinition.create(content, "handlebars", {
    tags: ["valid", "", "another"] as unknown as readonly string[],
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("TemplateDefinition - should reject invalid metadata variables", () => {
  const content = "<h1>{{title}}</h1>";
  const result = TemplateDefinition.create(content, "handlebars", {
    variables: ["valid", "", "another"] as unknown as readonly string[],
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("TemplateDefinition - should extract Handlebars variables", () => {
  const content =
    "<h1>{{title}}</h1><p>Hello {{name}}!</p><div>{{content}}</div>";
  const result = TemplateDefinition.create(content, "handlebars");

  if (result.ok) {
    const variables = result.data.extractVariables();
    assertEquals(variables, ["content", "name", "title"]);
  }
});

Deno.test("TemplateDefinition - should extract Mustache variables", () => {
  const content = "{{greeting}} {{name}}! {{#items}}{{value}}{{/items}}";
  const result = TemplateDefinition.create(content, "mustache");

  if (result.ok) {
    const variables = result.data.extractVariables();
    assertEquals(variables, ["greeting", "name", "value"]);
  }
});

Deno.test("TemplateDefinition - should extract EJS variables", () => {
  const content = "<h1><%= title %></h1><p><%= message %></p>";
  const result = TemplateDefinition.create(content, "ejs");

  if (result.ok) {
    const variables = result.data.extractVariables();
    assertEquals(variables, ["message", "title"]);
  }
});

Deno.test("TemplateDefinition - should check for tags and variables", () => {
  const content = "<h1>{{title}}</h1>";
  const metadata = {
    tags: ["web", "html"],
    variables: ["title", "content"],
  };
  const result = TemplateDefinition.create(content, "handlebars", metadata);

  if (result.ok) {
    assertEquals(result.data.hasTag("web"), true);
    assertEquals(result.data.hasTag("missing"), false);
    assertEquals(result.data.hasVariable("title"), true);
    assertEquals(result.data.hasVariable("missing"), false);
  }
});

Deno.test("TemplateDefinition - should check template properties", () => {
  const content = "<h1>{{title}}</h1><p>Some content here</p>";
  const result = TemplateDefinition.create(content, "handlebars");

  if (result.ok) {
    assertEquals(result.data.contains("title"), true);
    assertEquals(result.data.contains("missing"), false);
    assertEquals(result.data.getLength(), content.length);
    assertEquals(result.data.isEmpty(), false);
  }
});

Deno.test("TemplateDefinition - should update metadata", () => {
  const content = "<h1>{{title}}</h1>";
  const result = TemplateDefinition.create(content, "handlebars", {
    name: "original",
  });

  if (result.ok) {
    const updatedResult = result.data.withMetadata({
      name: "updated",
      description: "Updated template",
    });

    assertEquals(updatedResult.ok, true);
    if (updatedResult.ok) {
      assertEquals(updatedResult.data.getName(), "updated");
      assertEquals(updatedResult.data.getDescription(), "Updated template");
    }
  }
});

Deno.test("TemplateDefinition - should have string representation", () => {
  const content = "<h1>{{title}}</h1>";
  const metadata = { name: "test-template" };
  const result = TemplateDefinition.create(content, "handlebars", metadata);

  if (result.ok) {
    assertEquals(
      result.data.toString(),
      `TemplateDefinition(handlebars, "test-template", ${content.length} chars)`,
    );
  }

  const unnamedResult = TemplateDefinition.create(content, "handlebars");
  if (unnamedResult.ok) {
    assertEquals(
      unnamedResult.data.toString(),
      `TemplateDefinition(handlebars, "unnamed", ${content.length} chars)`,
    );
  }
});
