/**
 * Comprehensive tests for Schema Injection Layer
 * Addressing critical test coverage gap (4.4% -> 100%)
 * Issue #401: Critical test coverage improvements
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  type ActiveSchema,
  isFailedSchema,
  isLoadedSchema,
  isLoadingSchema,
  isNoSchema,
  PromptContext,
  RuntimeSchemaInjector,
  SchemaContext,
  SchemaInjectionContainer,
  TemplateContext,
} from "../../../../src/domain/core/schema-injection.ts";

Deno.test("SchemaContext", async (t) => {
  await t.step("should create valid schema context successfully", () => {
    const schema = { type: "object", properties: { name: { type: "string" } } };
    const rules = [{ required: ["name"] }];

    const result = SchemaContext.create("test-schema", schema, rules);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.id, "test-schema");
      assertEquals(result.data.schema, schema);
      assertEquals(result.data.validationRules, rules);
      assertExists(result.data.createdAt);
    }
  });

  await t.step("should create schema context without validation rules", () => {
    const schema = { type: "string" };

    const result = SchemaContext.create("simple-schema", schema);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.id, "simple-schema");
      assertEquals(result.data.schema, schema);
      assertEquals(result.data.validationRules, []);
    }
  });

  await t.step("should trim whitespace from schema ID", () => {
    const schema = { type: "number" };

    const result = SchemaContext.create("  spaced-id  ", schema);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.id, "spaced-id");
    }
  });

  await t.step("should reject empty schema ID", () => {
    const schema = { type: "boolean" };

    const result = SchemaContext.create("", schema);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should reject whitespace-only schema ID", () => {
    const schema = { type: "array" };

    const result = SchemaContext.create("   ", schema);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should reject null schema", () => {
    const result = SchemaContext.create("test-id", null);

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
    const result = SchemaContext.create("test-id", undefined);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
      if (result.error.kind === "InvalidFormat") {
        assertEquals(result.error.input, "undefined");
      }
    }
  });

  await t.step("should detect expired schema context", async () => {
    const schema = { type: "object" };
    const result = SchemaContext.create("test", schema);

    assertEquals(result.ok, true);
    if (result.ok) {
      const context = result.data;

      // Should not be expired immediately
      assertEquals(context.isExpired(3600000), false);

      // Wait a bit then check with very small max age
      await new Promise((resolve) => setTimeout(resolve, 10));
      assertEquals(context.isExpired(5), true);
    }
  });

  await t.step("should use default max age for expiration check", () => {
    const schema = { type: "string" };
    const result = SchemaContext.create("test", schema);

    assertEquals(result.ok, true);
    if (result.ok) {
      const context = result.data;

      // Should not be expired with default max age (1 hour)
      assertEquals(context.isExpired(), false);
    }
  });
});

Deno.test("TemplateContext", async (t) => {
  await t.step(
    "should create template context with default JSON format",
    () => {
      const template = { output: "{{name}}" };

      const result = TemplateContext.create("test-template", template);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.id, "test-template");
        assertEquals(result.data.template, template);
        assertEquals(result.data.format, "json");
        assertExists(result.data.createdAt);
      }
    },
  );

  await t.step("should create template context with specified format", () => {
    const template = "name: {{name}}";

    const result = TemplateContext.create("yaml-template", template, "yaml");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.id, "yaml-template");
      assertEquals(result.data.template, template);
      assertEquals(result.data.format, "yaml");
    }
  });

  await t.step("should create template context with XML format", () => {
    const template = "<person><name>{{name}}</name></person>";

    const result = TemplateContext.create("xml-template", template, "xml");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.format, "xml");
    }
  });

  await t.step("should trim whitespace from template ID", () => {
    const template = { greeting: "Hello {{name}}" };

    const result = TemplateContext.create("  template-id  ", template);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.id, "template-id");
    }
  });

  await t.step("should reject empty template ID", () => {
    const template = { output: "test" };

    const result = TemplateContext.create("", template);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should reject null template", () => {
    const result = TemplateContext.create("test-id", null);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
      if (result.error.kind === "InvalidFormat") {
        assertEquals(result.error.input, "null");
        assertEquals(result.error.expectedFormat, "valid template object");
      }
    }
  });

  await t.step("should reject undefined template", () => {
    const result = TemplateContext.create("test-id", undefined);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });
});

Deno.test("PromptContext", async (t) => {
  await t.step("should create prompt context successfully", () => {
    const extractionPrompt = "Extract: {{data}}";
    const mappingPrompt = "Map: {{source}} to {{template}}";

    const result = PromptContext.create(extractionPrompt, mappingPrompt);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.extractionPrompt, extractionPrompt);
      assertEquals(result.data.mappingPrompt, mappingPrompt);
      assertExists(result.data.createdAt);
    }
  });

  await t.step("should trim whitespace from prompts", () => {
    const extractionPrompt = "  Extract data: {{input}}  ";
    const mappingPrompt = "  Map to template: {{output}}  ";

    const result = PromptContext.create(extractionPrompt, mappingPrompt);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.extractionPrompt, "Extract data: {{input}}");
      assertEquals(result.data.mappingPrompt, "Map to template: {{output}}");
    }
  });

  await t.step("should reject empty extraction prompt", () => {
    const result = PromptContext.create("", "Valid mapping prompt");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
      if (result.error.kind === "EmptyInput") {
        assertEquals(result.error.field, "extractionPrompt");
      }
    }
  });

  await t.step("should reject whitespace-only extraction prompt", () => {
    const result = PromptContext.create("   ", "Valid mapping prompt");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
      if (result.error.kind === "EmptyInput") {
        assertEquals(result.error.field, "extractionPrompt");
      }
    }
  });

  await t.step("should reject empty mapping prompt", () => {
    const result = PromptContext.create("Valid extraction prompt", "");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
      if (result.error.kind === "EmptyInput") {
        assertEquals(result.error.field, "mappingPrompt");
      }
    }
  });

  await t.step("should reject whitespace-only mapping prompt", () => {
    const result = PromptContext.create("Valid extraction prompt", "   ");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
      if (result.error.kind === "EmptyInput") {
        assertEquals(result.error.field, "mappingPrompt");
      }
    }
  });
});

Deno.test("RuntimeSchemaInjector", async (t) => {
  await t.step("should start with no active schema", () => {
    const injector = new RuntimeSchemaInjector();

    const currentSchema = injector.getCurrentSchema();

    assertEquals(currentSchema.kind, "None");
  });

  await t.step("should inject schema successfully", () => {
    const injector = new RuntimeSchemaInjector();
    const schema = { type: "object", properties: { name: { type: "string" } } };

    const result = injector.injectSchema("test-schema", schema);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.id, "test-schema");
      assertEquals(result.data.schema, schema);
    }
  });

  await t.step("should inject template successfully", () => {
    const injector = new RuntimeSchemaInjector();
    const template = { greeting: "Hello {{name}}" };

    const result = injector.injectTemplate("test-template", template, "json");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.id, "test-template");
      assertEquals(result.data.template, template);
      assertEquals(result.data.format, "json");
    }
  });

  await t.step("should inject prompts successfully", () => {
    const injector = new RuntimeSchemaInjector();
    const extractionPrompt = "Extract: {{data}}";
    const mappingPrompt = "Map: {{source}} to {{template}}";

    const result = injector.injectPrompts(
      "test-prompts",
      extractionPrompt,
      mappingPrompt,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.extractionPrompt, extractionPrompt);
      assertEquals(result.data.mappingPrompt, mappingPrompt);
    }
  });

  await t.step("should fail to activate without schema", () => {
    const injector = new RuntimeSchemaInjector();

    const result = injector.activate("missing-schema");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "NotFound");
      if (result.error.kind === "NotFound") {
        assertEquals(result.error.resource, "schema");
        assertEquals(result.error.name, "missing-schema");
      }
    }
  });

  await t.step("should fail to activate without template", () => {
    const injector = new RuntimeSchemaInjector();
    const schema = { type: "string" };

    injector.injectSchema("test", schema);
    const result = injector.activate("test");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "NotFound");
      if (result.error.kind === "NotFound") {
        assertEquals(result.error.resource, "template");
        assertEquals(result.error.name, "test");
      }
    }
  });

  await t.step("should fail to activate without prompts", () => {
    const injector = new RuntimeSchemaInjector();
    const schema = { type: "string" };
    const template = { output: "{{value}}" };

    injector.injectSchema("test", schema);
    injector.injectTemplate("test", template);
    const result = injector.activate("test");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "NotFound");
      if (result.error.kind === "NotFound") {
        assertEquals(result.error.resource, "prompts");
        assertEquals(result.error.name, "test");
      }
    }
  });

  await t.step(
    "should activate complete schema configuration successfully",
    () => {
      const injector = new RuntimeSchemaInjector();
      const schema = { type: "object" };
      const template = { result: "{{output}}" };
      const extractionPrompt = "Extract: {{data}}";
      const mappingPrompt = "Map: {{source}}";

      injector.injectSchema("complete", schema);
      injector.injectTemplate("complete", template);
      injector.injectPrompts("complete", extractionPrompt, mappingPrompt);

      const result = injector.activate("complete");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "Loaded");
        if (result.data.kind === "Loaded") {
          assertEquals(result.data.name, "complete");
          assertEquals(result.data.schemaContext.schema, schema);
          assertEquals(result.data.templateContext.template, template);
          assertEquals(
            result.data.promptContext.extractionPrompt,
            extractionPrompt,
          );
          assertExists(result.data.activatedAt);
        }
      }
    },
  );

  await t.step("should update current schema after activation", () => {
    const injector = new RuntimeSchemaInjector();
    const schema = { type: "array" };
    const template = { items: "{{list}}" };

    injector.injectSchema("active", schema);
    injector.injectTemplate("active", template);
    injector.injectPrompts("active", "Extract {{data}}", "Map {{source}}");

    injector.activate("active");
    const currentSchema = injector.getCurrentSchema();

    assertEquals(currentSchema.kind, "Loaded");
    if (currentSchema.kind === "Loaded") {
      assertEquals(currentSchema.name, "active");
    }
  });

  await t.step("should set failed state when activation fails", () => {
    const injector = new RuntimeSchemaInjector();

    injector.activate("nonexistent");
    const currentSchema = injector.getCurrentSchema();

    assertEquals(currentSchema.kind, "Failed");
    if (currentSchema.kind === "Failed") {
      assertEquals(currentSchema.name, "nonexistent");
      assertEquals(currentSchema.error.kind, "NotFound");
      assertExists(currentSchema.failedAt);
    }
  });

  await t.step("should list available schemas", () => {
    const injector = new RuntimeSchemaInjector();

    injector.injectSchema("schema1", { type: "string" });
    injector.injectSchema("schema2", { type: "number" });

    const available = injector.listAvailableSchemas();

    assertEquals(available.length, 2);
    assertEquals(available.includes("schema1"), true);
    assertEquals(available.includes("schema2"), true);
  });

  await t.step("should clear specific schema from all caches", () => {
    const injector = new RuntimeSchemaInjector();
    const schema = { type: "boolean" };
    const template = { value: "{{bool}}" };

    injector.injectSchema("to-clear", schema);
    injector.injectTemplate("to-clear", template);
    injector.injectPrompts("to-clear", "Extract", "Map");
    injector.activate("to-clear");

    assertEquals(injector.getCurrentSchema().kind, "Loaded");

    injector.clearSchema("to-clear");

    assertEquals(injector.getCurrentSchema().kind, "None");
    assertEquals(injector.listAvailableSchemas().length, 0);
  });

  await t.step(
    "should not affect current schema when clearing different schema",
    () => {
      const injector = new RuntimeSchemaInjector();

      injector.injectSchema("active", { type: "object" });
      injector.injectTemplate("active", { output: "test" });
      injector.injectPrompts("active", "Extract", "Map");
      injector.activate("active");

      injector.injectSchema("other", { type: "string" });

      injector.clearSchema("other");

      assertEquals(injector.getCurrentSchema().kind, "Loaded");
    },
  );

  await t.step("should clear all schemas and reset state", () => {
    const injector = new RuntimeSchemaInjector();

    injector.injectSchema("test1", { type: "string" });
    injector.injectSchema("test2", { type: "number" });
    injector.injectTemplate("test1", { value: "{{str}}" });
    injector.injectTemplate("test2", { value: "{{num}}" });
    injector.injectPrompts("test1", "Extract1", "Map1");
    injector.injectPrompts("test2", "Extract2", "Map2");
    injector.activate("test1");

    injector.clearAll();

    assertEquals(injector.getCurrentSchema().kind, "None");
    assertEquals(injector.listAvailableSchemas().length, 0);
  });
});

Deno.test("SchemaInjectionContainer", async (t) => {
  await t.step("should bind and resolve values successfully", () => {
    const container = new SchemaInjectionContainer();
    const testValue = { name: "test", value: 42 };

    const bindResult = container.bind("test-binding", testValue);
    assertEquals(bindResult.ok, true);
    const result = container.resolve<typeof testValue>("test-binding");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, testValue);
    }
  });

  await t.step("should bind different types of values", () => {
    const container = new SchemaInjectionContainer();

    assertEquals(container.bind("string-key", "string value").ok, true);
    assertEquals(container.bind("number-key", 123).ok, true);
    assertEquals(container.bind("boolean-key", true).ok, true);
    assertEquals(container.bind("object-key", { prop: "value" }).ok, true);
    assertEquals(container.bind("array-key", [1, 2, 3]).ok, true);

    const stringResult = container.resolve<string>("string-key");
    const numberResult = container.resolve<number>("number-key");
    const booleanResult = container.resolve<boolean>("boolean-key");
    const objectResult = container.resolve<object>("object-key");
    const arrayResult = container.resolve<number[]>("array-key");

    assertEquals(stringResult.ok, true);
    assertEquals(numberResult.ok, true);
    assertEquals(booleanResult.ok, true);
    assertEquals(objectResult.ok, true);
    assertEquals(arrayResult.ok, true);
  });

  await t.step("should trim whitespace from binding keys", () => {
    const container = new SchemaInjectionContainer();
    const testValue = "trimmed";

    const bindResult = container.bind("  spaced-key  ", testValue);
    assertEquals(bindResult.ok, true);
    const result = container.resolve<string>("spaced-key");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, testValue);
    }
  });

  await t.step("should return error for empty binding key", () => {
    const container = new SchemaInjectionContainer();

    const result = container.bind("", "value");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
      if (result.error.kind === "EmptyInput") {
        assertEquals(result.error.field, "key");
      }
    }
  });

  await t.step("should return error for whitespace-only binding key", () => {
    const container = new SchemaInjectionContainer();

    const result = container.bind("   ", "value");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
      if (result.error.kind === "EmptyInput") {
        assertEquals(result.error.field, "key");
      }
    }
  });

  await t.step("should fail to resolve non-existent binding", () => {
    const container = new SchemaInjectionContainer();

    const result = container.resolve<string>("non-existent");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "NotFound");
      if (result.error.kind === "NotFound") {
        assertEquals(result.error.resource, "binding");
        assertEquals(result.error.key, "non-existent");
      }
    }
  });

  await t.step("should check if key is bound", () => {
    const container = new SchemaInjectionContainer();

    const bindResult = container.bind("existing", "value");
    assertEquals(bindResult.ok, true);

    assertEquals(container.has("existing"), true);
    assertEquals(container.has("non-existing"), false);
  });

  await t.step("should unbind specific keys", () => {
    const container = new SchemaInjectionContainer();

    assertEquals(container.bind("key1", "value1").ok, true);
    assertEquals(container.bind("key2", "value2").ok, true);

    assertEquals(container.has("key1"), true);
    assertEquals(container.has("key2"), true);

    container.unbind("key1");

    assertEquals(container.has("key1"), false);
    assertEquals(container.has("key2"), true);
  });

  await t.step("should clear all bindings", () => {
    const container = new SchemaInjectionContainer();

    assertEquals(container.bind("key1", "value1").ok, true);
    assertEquals(container.bind("key2", "value2").ok, true);
    assertEquals(container.bind("key3", "value3").ok, true);

    assertEquals(container.keys().length, 3);

    container.clear();

    assertEquals(container.keys().length, 0);
    assertEquals(container.has("key1"), false);
  });

  await t.step("should return all binding keys", () => {
    const container = new SchemaInjectionContainer();

    assertEquals(container.bind("alpha", 1).ok, true);
    assertEquals(container.bind("beta", 2).ok, true);
    assertEquals(container.bind("gamma", 3).ok, true);

    const keys = container.keys();

    assertEquals(keys.length, 3);
    assertEquals(keys.includes("alpha"), true);
    assertEquals(keys.includes("beta"), true);
    assertEquals(keys.includes("gamma"), true);
  });

  await t.step("should handle binding overwrites", () => {
    const container = new SchemaInjectionContainer();

    assertEquals(container.bind("overwrite", "original").ok, true);
    assertEquals(container.resolve<string>("overwrite").ok, true);

    assertEquals(container.bind("overwrite", "updated").ok, true);
    const result = container.resolve<string>("overwrite");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, "updated");
    }
  });
});

Deno.test("ActiveSchema Type Guards", async (t) => {
  await t.step("should identify loaded schema", () => {
    const injector = new RuntimeSchemaInjector();

    injector.injectSchema("test", { type: "string" });
    injector.injectTemplate("test", { output: "{{value}}" });
    injector.injectPrompts("test", "Extract", "Map");
    injector.activate("test");

    const schema = injector.getCurrentSchema();

    assertEquals(isLoadedSchema(schema), true);
    assertEquals(isLoadingSchema(schema), false);
    assertEquals(isFailedSchema(schema), false);
    assertEquals(isNoSchema(schema), false);
  });

  await t.step("should identify failed schema", () => {
    const injector = new RuntimeSchemaInjector();

    injector.activate("nonexistent");
    const schema = injector.getCurrentSchema();

    assertEquals(isLoadedSchema(schema), false);
    assertEquals(isLoadingSchema(schema), false);
    assertEquals(isFailedSchema(schema), true);
    assertEquals(isNoSchema(schema), false);
  });

  await t.step("should identify no schema", () => {
    const injector = new RuntimeSchemaInjector();

    const schema = injector.getCurrentSchema();

    assertEquals(isLoadedSchema(schema), false);
    assertEquals(isLoadingSchema(schema), false);
    assertEquals(isFailedSchema(schema), false);
    assertEquals(isNoSchema(schema), true);
  });

  await t.step("should handle loading schema state", () => {
    const loadingSchema: ActiveSchema = {
      kind: "Loading",
      name: "loading-test",
      startedAt: new Date(),
    };

    assertEquals(isLoadedSchema(loadingSchema), false);
    assertEquals(isLoadingSchema(loadingSchema), true);
    assertEquals(isFailedSchema(loadingSchema), false);
    assertEquals(isNoSchema(loadingSchema), false);
  });
});

Deno.test("Schema Injection Integration", async (t) => {
  await t.step("should handle complex multi-schema workflow", () => {
    const injector = new RuntimeSchemaInjector();
    const container = new SchemaInjectionContainer();

    // Set up multiple schemas
    const userSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        age: { type: "number" },
      },
    };
    const postSchema = {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        author: { type: "string" },
      },
    };

    const userTemplate = {
      greeting: "Hello {{name}}",
      contact: "Email: {{email}}",
      profile: "Age: {{age}}",
    };
    const postTemplate = {
      heading: "{{title}}",
      body: "{{content}}",
      byline: "By {{author}}",
    };

    // Inject schemas
    injector.injectSchema("user", userSchema);
    injector.injectSchema("post", postSchema);
    injector.injectTemplate("user", userTemplate);
    injector.injectTemplate("post", postTemplate);
    injector.injectPrompts(
      "user",
      "Extract user: {{data}}",
      "Map user: {{source}}",
    );
    injector.injectPrompts(
      "post",
      "Extract post: {{data}}",
      "Map post: {{source}}",
    );

    // Bind to container
    assertEquals(container.bind("userInjector", injector).ok, true);

    // Test activation switching
    const userResult = injector.activate("user");
    assertEquals(userResult.ok, true);
    assertEquals(injector.getCurrentSchema().kind, "Loaded");

    const postResult = injector.activate("post");
    assertEquals(postResult.ok, true);
    if (postResult.ok && postResult.data.kind === "Loaded") {
      assertEquals(postResult.data.name, "post");
      assertEquals(postResult.data.schemaContext.schema, postSchema);
    }

    // Verify container resolution
    const resolvedInjector = container.resolve<RuntimeSchemaInjector>(
      "userInjector",
    );
    assertEquals(resolvedInjector.ok, true);

    const availableSchemas = injector.listAvailableSchemas();
    assertEquals(availableSchemas.length, 2);
    assertEquals(availableSchemas.includes("user"), true);
    assertEquals(availableSchemas.includes("post"), true);
  });

  await t.step("should handle schema expiration and cleanup", async () => {
    const schema = { type: "object" };

    // Test expiration
    const contextResult = SchemaContext.create("expiring", schema);
    assertEquals(contextResult.ok, true);

    if (contextResult.ok) {
      const context = contextResult.data;
      // Wait then check expiration
      await new Promise((resolve) => setTimeout(resolve, 10));
      assertEquals(context.isExpired(5), true); // Expired with very small max age
      assertEquals(context.isExpired(86400000), false); // Not expired (24 hours)
    }

    // Test cleanup
    const injector = new RuntimeSchemaInjector();
    injector.injectSchema("temp", schema);
    injector.injectTemplate("temp", { output: "test" });
    injector.injectPrompts("temp", "Extract", "Map");
    injector.activate("temp");

    assertEquals(injector.getCurrentSchema().kind, "Loaded");

    injector.clearSchema("temp");
    assertEquals(injector.getCurrentSchema().kind, "None");
  });

  await t.step("should handle error states and recovery", () => {
    const injector = new RuntimeSchemaInjector();

    // Trigger various failure states
    const missingSchemaResult = injector.activate("missing-schema");
    assertEquals(missingSchemaResult.ok, false);
    assertEquals(injector.getCurrentSchema().kind, "Failed");

    injector.injectSchema("partial", { type: "string" });
    const missingTemplateResult = injector.activate("partial");
    assertEquals(missingTemplateResult.ok, false);
    assertEquals(injector.getCurrentSchema().kind, "Failed");

    // Recovery by providing complete configuration
    injector.injectTemplate("partial", { value: "{{str}}" });
    injector.injectPrompts("partial", "Extract", "Map");
    const recoveryResult = injector.activate("partial");
    assertEquals(recoveryResult.ok, true);
    assertEquals(injector.getCurrentSchema().kind, "Loaded");
  });
});
