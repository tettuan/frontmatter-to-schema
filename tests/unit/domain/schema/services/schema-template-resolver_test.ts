import { assert, assertEquals } from "@std/assert";
import { SchemaTemplateResolver } from "../../../../../src/domain/schema/services/schema-template-resolver.ts";
import { Schema, SchemaId } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { DIRECTIVE_NAMES } from "../../../../../src/domain/schema/constants/directive-names.ts";

Deno.test("SchemaTemplateResolver - resolveTemplateContext with valid x-template", () => {
  const resolver = new SchemaTemplateResolver();

  const schemaId = SchemaId.create("test-schema").unwrap();
  const schemaPath = SchemaPath.create("./test-schema.json").unwrap();
  const schema = Schema.create(schemaId, schemaPath);

  const schemaData = {
    type: "object",
    [DIRECTIVE_NAMES.TEMPLATE]: "templates/container.json",
    properties: {
      title: { type: "string" }
    }
  };

  const resolvedSchema = schema.markAsResolved(schemaData);

  const result = resolver.resolveTemplateContext(resolvedSchema);

  assert(result.isOk());
  const context = result.unwrap();
  assert(context.containerTemplate);
  assertEquals(context.containerTemplate.path, "templates/container.json");
  assertEquals(context.containerTemplate.type, "container");
  assertEquals(context.itemsTemplate, null);
});

Deno.test("SchemaTemplateResolver - resolveTemplateContext with x-template and x-template-items", () => {
  const resolver = new SchemaTemplateResolver();

  const schemaId = SchemaId.create("test-schema").unwrap();
  const schemaPath = SchemaPath.create("./test-schema.json").unwrap();
  const schema = Schema.create(schemaId, schemaPath);

  const schemaData = {
    type: "object",
    [DIRECTIVE_NAMES.TEMPLATE]: "templates/container.json",
    [DIRECTIVE_NAMES.TEMPLATE_ITEMS]: "templates/items.json",
    properties: {
      items: {
        type: "array",
        items: { type: "object" }
      }
    }
  };

  const resolvedSchema = schema.markAsResolved(schemaData);

  const result = resolver.resolveTemplateContext(resolvedSchema);

  assert(result.isOk());
  const context = result.unwrap();
  assert(context.containerTemplate);
  assertEquals(context.containerTemplate.path, "templates/container.json");
  assert(context.itemsTemplate);
  assertEquals(context.itemsTemplate.path, "templates/items.json");
  assertEquals(context.itemsTemplate.type, "items");
});

Deno.test("SchemaTemplateResolver - resolveTemplateContext fails without x-template", () => {
  const resolver = new SchemaTemplateResolver();

  const schemaId = SchemaId.create("test-schema").unwrap();
  const schemaPath = SchemaPath.create("./test-schema.json").unwrap();
  const schema = Schema.create(schemaId, schemaPath);

  const schemaData = {
    type: "object",
    properties: {
      title: { type: "string" }
    }
  };

  const resolvedSchema = schema.markAsResolved(schemaData);

  const result = resolver.resolveTemplateContext(resolvedSchema);

  assert(result.isError());
  const error = result.unwrapError();
  assertEquals(error.code, "MISSING_CONTAINER_TEMPLATE");
});

Deno.test("SchemaTemplateResolver - resolveTemplateContext fails with invalid x-template", () => {
  const resolver = new SchemaTemplateResolver();

  const schemaId = SchemaId.create("test-schema").unwrap();
  const schemaPath = SchemaPath.create("./test-schema.json").unwrap();
  const schema = Schema.create(schemaId, schemaPath);

  const schemaData = {
    type: "object",
    [DIRECTIVE_NAMES.TEMPLATE]: 123 as unknown, // Invalid: not a string
    properties: {}
  } as any;

  const resolvedSchema = schema.markAsResolved(schemaData);

  const result = resolver.resolveTemplateContext(resolvedSchema);

  assert(result.isError());
  const error = result.unwrapError();
  assertEquals(error.code, "MISSING_CONTAINER_TEMPLATE");
});

Deno.test("SchemaTemplateResolver - resolveTemplateContext with unresolved schema", () => {
  const resolver = new SchemaTemplateResolver();

  const schemaId = SchemaId.create("test-schema").unwrap();
  const schemaPath = SchemaPath.create("./test-schema.json").unwrap();
  const schema = Schema.create(schemaId, schemaPath);

  const result = resolver.resolveTemplateContext(schema);

  assert(result.isError());
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_STATE");
});

Deno.test("SchemaTemplateResolver - extracts all x-* extensions", () => {
  const resolver = new SchemaTemplateResolver();

  const schemaId = SchemaId.create("test-schema").unwrap();
  const schemaPath = SchemaPath.create("./test-schema.json").unwrap();
  const schema = Schema.create(schemaId, schemaPath);

  const schemaData = {
    type: "object",
    [DIRECTIVE_NAMES.TEMPLATE]: "templates/container.json",
    [DIRECTIVE_NAMES.TEMPLATE_ITEMS]: "templates/items.json",
    [DIRECTIVE_NAMES.TEMPLATE_FORMAT]: "yaml",
    "x-custom": "custom-value",
    properties: {}
  };

  const resolvedSchema = schema.markAsResolved(schemaData);

  const result = resolver.resolveTemplateContext(resolvedSchema);

  assert(result.isOk());
  const context = result.unwrap();
  assert(context.schemaContext);
  assert(context.schemaContext.resolvedExtensions);
  assertEquals(context.schemaContext.resolvedExtensions[DIRECTIVE_NAMES.TEMPLATE], "templates/container.json");
  assertEquals(context.schemaContext.resolvedExtensions[DIRECTIVE_NAMES.TEMPLATE_ITEMS], "templates/items.json");
  assertEquals(context.schemaContext.resolvedExtensions[DIRECTIVE_NAMES.TEMPLATE_FORMAT], "yaml");
  assertEquals(context.schemaContext.resolvedExtensions["x-custom"], "custom-value");
});

Deno.test("SchemaTemplateResolver - handles invalid x-template-items gracefully", () => {
  const resolver = new SchemaTemplateResolver();

  const schemaId = SchemaId.create("test-schema").unwrap();
  const schemaPath = SchemaPath.create("./test-schema.json").unwrap();
  const schema = Schema.create(schemaId, schemaPath);

  const schemaData = {
    type: "object",
    [DIRECTIVE_NAMES.TEMPLATE]: "templates/container.json",
    [DIRECTIVE_NAMES.TEMPLATE_ITEMS]: "invalid-no-extension", // Invalid: no .json extension
    properties: {}
  };

  const resolvedSchema = schema.markAsResolved(schemaData);

  const result = resolver.resolveTemplateContext(resolvedSchema);

  // Should succeed with null itemsTemplate
  assert(result.isOk());
  const context = result.unwrap();
  assertEquals(context.itemsTemplate, null);
});
