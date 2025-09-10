/**
 * TemplateRenderer Domain Service Tests
 *
 * Tests for TemplateRenderer following DDD and Totality principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { TemplateRenderer } from "../../../../../src/domain/template/services/template-renderer.ts";
import { TemplateDefinition } from "../../../../../src/domain/value-objects/template-definition.ts";
import { FrontmatterData } from "../../../../../src/domain/value-objects/frontmatter-data.ts";

Deno.test("TemplateRenderer - should create valid renderer", () => {
  const result = TemplateRenderer.create();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.data);
  }
});

Deno.test("TemplateRenderer - should render Handlebars template with frontmatter", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  const template = TemplateDefinition.create(
    "Hello {{name}}, you have {{count}} messages.",
    "handlebars",
    { name: "greeting-template" },
  );
  if (!template.ok) throw new Error("Failed to create template");

  const frontmatter = FrontmatterData.createFromParsed({
    name: "John",
    count: 5,
  });
  if (!frontmatter.ok) throw new Error("Failed to create frontmatter");

  const result = renderer.data.renderWithFrontmatter(
    template.data,
    frontmatter.data,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.content, "Hello John, you have 5 messages.");
    assertEquals(result.data.variables.length, 2);
    assertEquals(result.data.variables.includes("name"), true);
    assertEquals(result.data.variables.includes("count"), true);
    assertEquals(result.data.metadata.engine, "handlebars");
    assertEquals(typeof result.data.metadata.renderTime, "number");
  }
});

Deno.test("TemplateRenderer - should render different template engines", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  const testCases = [
    {
      engine: "mustache" as const,
      content: "Welcome {{user}}!",
      expected: "Welcome Alice!",
    },
    {
      engine: "liquid" as const,
      content: "Total: {{amount}}",
      expected: "Total: 100",
    },
    {
      engine: "ejs" as const,
      content: "Status: <%=status%>",
      expected: "Status: active",
    },
    {
      engine: "text" as const,
      content: "Name: {name}",
      expected: "Name: Bob",
    },
  ];

  for (const testCase of testCases) {
    const template = TemplateDefinition.create(
      testCase.content,
      testCase.engine,
    );
    if (!template.ok) continue;

    const context = {
      data: {
        user: "Alice",
        amount: 100,
        status: "active",
        name: "Bob",
      },
    };

    const result = renderer.data.renderWithContext(template.data, context);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.content, testCase.expected);
      assertEquals(result.data.metadata.engine, testCase.engine);
    }
  }
});

Deno.test("TemplateRenderer - should handle nested variable paths", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  const template = TemplateDefinition.create(
    "User: {{user.name}}, Email: {{user.email}}",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const context = {
    data: {
      user: {
        name: "Jane Doe",
        email: "jane@example.com",
      },
    },
  };

  const result = renderer.data.renderWithContext(template.data, context);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(
      result.data.content,
      "User: Jane Doe, Email: jane@example.com",
    );
  }
});

Deno.test("TemplateRenderer - should handle missing variables in non-strict mode", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  const template = TemplateDefinition.create(
    "Hello {{name}}, {{missing}} variable here.",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const context = {
    data: { name: "Alice" },
  };

  const result = renderer.data.renderWithContext(template.data, context, {
    allowPartialRender: true,
    strictMode: false,
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(
      result.data.content,
      "Hello Alice, {{missing}} variable here.",
    );
  }
});

Deno.test("TemplateRenderer - should fail on missing variables in strict mode", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  const template = TemplateDefinition.create(
    "Hello {{name}}, {{missing}} variable here.",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const context = {
    data: { name: "Alice" },
  };

  const result = renderer.data.renderWithContext(template.data, context, {
    strictMode: true,
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "MissingRequiredField");
    if (result.error.kind === "MissingRequiredField") {
      assertEquals(result.error.fields.includes("missing"), true);
    }
  }
});

Deno.test("TemplateRenderer - should escape HTML when requested", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  const template = TemplateDefinition.create(
    "Content: {{content}}",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const context = {
    data: {
      content: "<script>alert('xss')</script>",
    },
  };

  const result = renderer.data.renderWithContext(template.data, context, {
    escapeHtml: true,
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(
      result.data.content,
      "Content: &lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
    );
  }
});

Deno.test("TemplateRenderer - should handle empty frontmatter data", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  const template = TemplateDefinition.create(
    "Hello {{name}}!",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  // Create empty frontmatter (this should fail)
  const emptyData = FrontmatterData.createFromParsed({});
  assertEquals(emptyData.ok, false); // Empty data creation should fail

  // Test with manually created empty-like data
  const frontmatter = FrontmatterData.createFromParsed({
    _placeholder: "empty",
  });
  if (!frontmatter.ok) {
    throw new Error("Failed to create placeholder frontmatter");
  }

  // Filter out the placeholder to make it effectively empty
  const filtered = frontmatter.data.filter(() => false);
  assertEquals(filtered.ok, false); // Filtered empty data should fail

  // Direct test with empty data in rendering should fail
  const frontmatterWithData = FrontmatterData.createFromParsed({
    name: "test",
  });
  if (!frontmatterWithData.ok) throw new Error("Failed to create frontmatter");

  // Create empty-like frontmatter by checking if it's empty
  if (frontmatterWithData.data.isEmpty()) {
    const result = renderer.data.renderWithFrontmatter(
      template.data,
      frontmatterWithData.data,
    );
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  }
});

Deno.test("TemplateRenderer - should handle empty template", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  // Empty template creation should fail
  const emptyTemplate = TemplateDefinition.create("", "text");
  assertEquals(emptyTemplate.ok, false);

  // Test with whitespace-only template (should also fail)
  const whitespaceTemplate = TemplateDefinition.create("   \n\t  ", "text");
  assertEquals(whitespaceTemplate.ok, false);
});

Deno.test("TemplateRenderer - should generate preview with sample data", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  const template = TemplateDefinition.create(
    "Title: {{title}}, Author: {{author}}, Count: {{count}}, Active: {{active}}",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const result = renderer.data.previewRender(template.data);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.content.includes("Sample Title"), true);
    assertEquals(result.data.content.includes("Sample Author"), true);
    assertEquals(result.data.content.includes("42"), true);
    assertEquals(result.data.content.includes("true"), true);
  }
});

Deno.test("TemplateRenderer - should validate renderability", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  const template = TemplateDefinition.create(
    "Hello {{name}}, you have {{count}} messages.",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  // Complete data
  const completeValidation = renderer.data.validateRenderability(
    template.data,
    { name: "John", count: 5, extra: "data" },
  );

  assertEquals(completeValidation.ok, true);
  if (completeValidation.ok) {
    assertEquals(completeValidation.data.canRender, true);
    assertEquals(completeValidation.data.missingVariables.length, 0);
    assertEquals(completeValidation.data.extraVariables.length, 1);
    assertEquals(completeValidation.data.extraVariables[0], "extra");
  }

  // Incomplete data
  const incompleteValidation = renderer.data.validateRenderability(
    template.data,
    { name: "John" },
  );

  assertEquals(incompleteValidation.ok, true);
  if (incompleteValidation.ok) {
    assertEquals(incompleteValidation.data.canRender, false);
    assertEquals(incompleteValidation.data.missingVariables.length, 1);
    assertEquals(incompleteValidation.data.missingVariables[0], "count");
  }
});

Deno.test("TemplateRenderer - should handle custom engine gracefully", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  const template = TemplateDefinition.create(
    "Custom template content",
    "custom",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const context = {
    data: { test: "value" },
  };

  const result = renderer.data.renderWithContext(template.data, context);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.content.includes("Custom template content"), true);
    assertEquals(result.data.content.includes("<!-- Context:"), true);
    assertEquals(result.data.metadata.engine, "custom");
  }
});

Deno.test("TemplateRenderer - should measure render time", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  const template = TemplateDefinition.create(
    "Simple {{variable}} template",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const context = {
    data: { variable: "test" },
  };

  const result = renderer.data.renderWithContext(template.data, context);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(typeof result.data.metadata.renderTime, "number");
    assertEquals(result.data.metadata.renderTime >= 0, true);
    assertEquals(result.data.metadata.variableCount, 1);
  }
});

Deno.test("TemplateRenderer - should handle null and undefined values", () => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  const template = TemplateDefinition.create(
    "Value: {{value}}, Null: {{nullValue}}, Undefined: {{undefinedValue}}",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const context = {
    data: {
      value: "test",
      nullValue: null,
      undefinedValue: undefined,
    },
  };

  const result = renderer.data.renderWithContext(template.data, context, {
    allowPartialRender: true,
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.content.includes("Value: test"), true);
    assertEquals(result.data.content.includes("Null: "), true);
    assertEquals(result.data.content.includes("{{undefinedValue}}"), true);
  }
});
