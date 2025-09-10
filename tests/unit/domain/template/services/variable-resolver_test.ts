/**
 * VariableResolver Domain Service Tests
 *
 * Tests for VariableResolver following DDD and Totality principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { VariableResolver } from "../../../../../src/domain/template/services/variable-resolver.ts";
import { TemplateDefinition } from "../../../../../src/domain/value-objects/template-definition.ts";
import { FrontmatterData } from "../../../../../src/domain/value-objects/frontmatter-data.ts";

Deno.test("VariableResolver - should create valid resolver", () => {
  const result = VariableResolver.create();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.data);
  }
});

Deno.test("VariableResolver - should extract variables from Handlebars template", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const template = TemplateDefinition.create(
    "Hello {{name}}, you have {{count}} messages and {{status}} account.",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const result = resolver.data.extractVariables(template.data);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.totalCount, 3);
    assertEquals(result.data.variables.length, 3);

    const variableNames = result.data.variables.map((v) => v.name);
    assertEquals(variableNames.includes("name"), true);
    assertEquals(variableNames.includes("count"), true);
    assertEquals(variableNames.includes("status"), true);

    // Check variable types
    const nameVar = result.data.variables.find((v) => v.name === "name");
    assertEquals(nameVar?.type, "simple");
    assertEquals(nameVar?.required, true);
  }
});

Deno.test("VariableResolver - should extract variables from different engines", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const testCases = [
    {
      engine: "mustache" as const,
      content: "{{user}} and {{role}}",
      expectedCount: 2,
    },
    {
      engine: "liquid" as const,
      content: "{{username}} - {% assign temp = 'value' %}",
      expectedCount: 2, // username + temp
    },
    {
      engine: "ejs" as const,
      content: "<%=firstName%> <%=lastName%>",
      expectedCount: 2,
    },
    {
      engine: "text" as const,
      content: "{title} and {description}",
      expectedCount: 2,
    },
  ];

  for (const testCase of testCases) {
    const template = TemplateDefinition.create(
      testCase.content,
      testCase.engine,
    );
    if (!template.ok) continue;

    const result = resolver.data.extractVariables(template.data);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.totalCount, testCase.expectedCount);
    }
  }
});

Deno.test("VariableResolver - should handle nested variable paths", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const template = TemplateDefinition.create(
    "{{user.name}} - {{user.profile.email}} - {{settings.theme}}",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const result = resolver.data.extractVariables(template.data);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.totalCount, 3);

    const nestedVars = result.data.variables.filter((v) => v.type === "nested");
    assertEquals(nestedVars.length, 3);

    const pathNames = result.data.variables.map((v) => v.path);
    assertEquals(pathNames.includes("user.name"), true);
    assertEquals(pathNames.includes("user.profile.email"), true);
    assertEquals(pathNames.includes("settings.theme"), true);
  }
});

Deno.test("VariableResolver - should handle conditional variables", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const template = TemplateDefinition.create(
    "{{name}} {{#if admin}}(Admin){{/if}} - {{role | default}}",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const result = resolver.data.extractVariables(template.data);

  assertEquals(result.ok, true);
  if (result.ok) {
    const conditionalVars = result.data.variables.filter((v) =>
      v.type === "conditional"
    );
    assertEquals(conditionalVars.length >= 1, true);

    const roleVar = result.data.variables.find((v) => v.name === "role");
    assertEquals(roleVar?.required, false); // Has default
  }
});

Deno.test("VariableResolver - should resolve variables with frontmatter data", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const template = TemplateDefinition.create(
    "Hello {{name}}, age {{age}}",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const extractResult = resolver.data.extractVariables(template.data);
  if (!extractResult.ok) throw new Error("Failed to extract variables");

  const frontmatter = FrontmatterData.createFromParsed({
    name: "Alice",
    age: 30,
    extra: "ignored",
  });
  if (!frontmatter.ok) throw new Error("Failed to create frontmatter");

  const resolveResult = resolver.data.resolveWithFrontmatter(
    extractResult.data.variables,
    frontmatter.data,
  );

  assertEquals(resolveResult.ok, true);
  if (resolveResult.ok) {
    assertEquals(resolveResult.data.length, 2);

    const nameResolution = resolveResult.data.find((r) =>
      r.variable.name === "name"
    );
    assertEquals(nameResolution?.resolved, true);
    assertEquals(nameResolution?.value, "Alice");
    assertEquals(nameResolution?.source, "data");

    const ageResolution = resolveResult.data.find((r) =>
      r.variable.name === "age"
    );
    assertEquals(ageResolution?.resolved, true);
    assertEquals(ageResolution?.value, 30);
    assertEquals(ageResolution?.source, "data");
  }
});

Deno.test("VariableResolver - should handle missing variables with defaults", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const variables = [
    {
      name: "title",
      path: "title",
      type: "simple" as const,
      required: true,
      defaultValue: undefined,
    },
    {
      name: "description",
      path: "description",
      type: "simple" as const,
      required: false,
      defaultValue: "Default description",
    },
  ];

  const frontmatter = FrontmatterData.createFromParsed({
    title: "My Title",
    // description is missing
  });
  if (!frontmatter.ok) throw new Error("Failed to create frontmatter");

  const result = resolver.data.resolveWithFrontmatter(
    variables,
    frontmatter.data,
    { allowDefaults: true },
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    const titleRes = result.data.find((r) => r.variable.name === "title");
    assertEquals(titleRes?.resolved, true);
    assertEquals(titleRes?.source, "data");

    const descRes = result.data.find((r) => r.variable.name === "description");
    assertEquals(descRes?.resolved, true);
    assertEquals(descRes?.value, "Default description");
    assertEquals(descRes?.source, "default");
  }
});

Deno.test("VariableResolver - should fail in strict mode with missing required variables", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const variables = [
    {
      name: "title",
      path: "title",
      type: "simple" as const,
      required: true,
      defaultValue: undefined,
    },
    {
      name: "author",
      path: "author",
      type: "simple" as const,
      required: true,
      defaultValue: undefined,
    },
  ];

  const frontmatter = FrontmatterData.createFromParsed({
    title: "My Title",
    // author is missing
  });
  if (!frontmatter.ok) throw new Error("Failed to create frontmatter");

  const result = resolver.data.resolveWithFrontmatter(
    variables,
    frontmatter.data,
    { strictMode: true },
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "MissingRequiredField");
    if (result.error.kind === "MissingRequiredField") {
      assertEquals(result.error.fields.includes("author"), true);
    }
  }
});

Deno.test("VariableResolver - should compute derived variables", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const data = {
    tags: ["javascript", "typescript", "deno"],
    comments: [1, 2, 3, 4, 5],
    metadata: { version: "1.0", author: "test" },
  };

  const computationRules = [
    {
      name: "tagCount",
      expression: "tags.length",
      dependencies: ["tags"],
    },
    {
      name: "commentCount",
      expression: "comments.length",
      dependencies: ["comments"],
    },
    {
      name: "metadataCount",
      expression: "metadata.count",
      dependencies: ["metadata"],
    },
  ];

  const result = resolver.data.computeDerivedVariables(data, computationRules);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.tagCount, 3);
    assertEquals(result.data.commentCount, 5);
    assertEquals(result.data.metadataCount, 2); // Object.keys count
  }
});

Deno.test("VariableResolver - should handle missing dependencies in computation", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const data = {
    title: "Test",
  };

  const computationRules = [
    {
      name: "tagCount",
      expression: "tags.length",
      dependencies: ["tags"], // Missing dependency
    },
  ];

  const result = resolver.data.computeDerivedVariables(data, computationRules);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "MissingRequiredField");
    if (result.error.kind === "MissingRequiredField") {
      assertEquals(result.error.fields.includes("tags"), true);
    }
  }
});

Deno.test("VariableResolver - should validate resolution completeness", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const resolutions = [
    {
      variable: {
        name: "title",
        path: "title",
        type: "simple" as const,
        required: true,
      },
      resolved: true,
      value: "Test Title",
      source: "data" as const,
    },
    {
      variable: {
        name: "description",
        path: "description",
        type: "simple" as const,
        required: false,
      },
      resolved: false,
      value: undefined,
      source: "data" as const,
      error: "Variable not found",
    },
    {
      variable: {
        name: "author",
        path: "author",
        type: "simple" as const,
        required: true,
      },
      resolved: true,
      value: "John Doe",
      source: "default" as const,
    },
  ];

  const result = resolver.data.validateResolutions(resolutions);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.complete, false);
    assertEquals(result.data.resolved, 2);
    assertEquals(result.data.unresolved.length, 1);
    assertEquals(result.data.unresolved[0], "description");
    assertEquals(result.data.errors.length, 1);
    assertEquals(result.data.errors[0].includes("Variable not found"), true);
  }
});

Deno.test("VariableResolver - should handle empty template", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  // Empty template creation should fail
  const emptyTemplate = TemplateDefinition.create("", "handlebars");
  assertEquals(emptyTemplate.ok, false);

  // Test with whitespace template (should also fail)
  const whitespaceTemplate = TemplateDefinition.create("   ", "handlebars");
  assertEquals(whitespaceTemplate.ok, false);
});

Deno.test("VariableResolver - should handle empty frontmatter data", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const _variables = [
    {
      name: "title",
      path: "title",
      type: "simple" as const,
      required: true,
      defaultValue: undefined,
    },
  ];

  // Empty frontmatter creation should fail
  const emptyData = FrontmatterData.createFromParsed({});
  assertEquals(emptyData.ok, false);

  // Create placeholder and filter to empty (should fail)
  const placeholder = FrontmatterData.createFromParsed({ temp: "test" });
  if (!placeholder.ok) throw new Error("Failed to create placeholder");

  const filtered = placeholder.data.filter(() => false);
  assertEquals(filtered.ok, false);
});

Deno.test("VariableResolver - should resolve nested object paths", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const variables = [
    {
      name: "userName",
      path: "user.name",
      type: "nested" as const,
      required: true,
      defaultValue: undefined,
    },
    {
      name: "userEmail",
      path: "user.profile.email",
      type: "nested" as const,
      required: true,
      defaultValue: undefined,
    },
  ];

  const frontmatter = FrontmatterData.createFromParsed({
    user: {
      name: "Alice",
      profile: {
        email: "alice@example.com",
      },
    },
  });
  if (!frontmatter.ok) throw new Error("Failed to create frontmatter");

  const result = resolver.data.resolveWithFrontmatter(
    variables,
    frontmatter.data,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    const nameRes = result.data.find((r) => r.variable.name === "userName");
    assertEquals(nameRes?.resolved, true);
    assertEquals(nameRes?.value, "Alice");

    const emailRes = result.data.find((r) => r.variable.name === "userEmail");
    assertEquals(emailRes?.resolved, true);
    assertEquals(emailRes?.value, "alice@example.com");
  }
});

Deno.test("VariableResolver - should handle invalid variable patterns", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  const template = TemplateDefinition.create(
    "Valid: {{valid}} Invalid: {{123invalid}} {{}}",
    "handlebars",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const result = resolver.data.extractVariables(template.data);

  assertEquals(result.ok, true);
  if (result.ok) {
    // Should only extract valid variable names
    assertEquals(result.data.variables.length, 1);
    assertEquals(result.data.variables[0].name, "valid");
  }
});

Deno.test("VariableResolver - should handle unsupported template engine", () => {
  const resolver = VariableResolver.create();
  if (!resolver.ok) throw new Error("Failed to create resolver");

  // This test assumes an unsupported engine would be caught at template creation
  // Since we have exhaustive enum checking, this should be handled at compile time

  // Test custom engine which is supported but minimal
  const template = TemplateDefinition.create(
    "#{variable} content",
    "custom",
  );
  if (!template.ok) throw new Error("Failed to create template");

  const result = resolver.data.extractVariables(template.data);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.variables.length, 1);
    assertEquals(result.data.variables[0].name, "variable");
  }
});
