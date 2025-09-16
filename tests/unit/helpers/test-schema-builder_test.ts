import { assertEquals, assertThrows } from "jsr:@std/assert";
import { TestSchemaBuilder } from "../../helpers/test-schema-builder.ts";
import {
  createExtensions,
  TEST_EXTENSIONS,
} from "../../helpers/test-extensions.ts";

Deno.test("TestSchemaBuilder", async (t) => {
  await t.step("should create object schema by default", () => {
    const schema = new TestSchemaBuilder().build();
    assertEquals(schema.kind, "object");
    if (schema.kind === "object") {
      assertEquals(schema.properties, {});
      assertEquals(schema.required, []);
    }
  });

  await t.step("should create different schema types", () => {
    const stringSchema = new TestSchemaBuilder("string").build();
    assertEquals(stringSchema.kind, "string");

    const arraySchema = new TestSchemaBuilder("array").build();
    assertEquals(arraySchema.kind, "array");

    const numberSchema = new TestSchemaBuilder("number").build();
    assertEquals(numberSchema.kind, "number");
  });

  await t.step("should add frontmatter-part extension using registry", () => {
    const schema = new TestSchemaBuilder()
      .withFrontmatterPart(true)
      .build();

    assertEquals(schema.extensions?.[TEST_EXTENSIONS.FRONTMATTER_PART], true);
  });

  await t.step("should add template extension using registry", () => {
    const schema = new TestSchemaBuilder()
      .withTemplate("{name}")
      .build();

    assertEquals(schema.extensions?.[TEST_EXTENSIONS.TEMPLATE], "{name}");
  });

  await t.step("should chain multiple extensions", () => {
    const schema = new TestSchemaBuilder()
      .withFrontmatterPart(true)
      .withTemplate("{name}")
      .withDerivedFrom("source")
      .withDerivedUnique(true)
      .withDescription("Test schema")
      .build();

    assertEquals(schema.extensions?.[TEST_EXTENSIONS.FRONTMATTER_PART], true);
    assertEquals(schema.extensions?.[TEST_EXTENSIONS.TEMPLATE], "{name}");
    assertEquals(schema.extensions?.[TEST_EXTENSIONS.DERIVED_FROM], "source");
    assertEquals(schema.extensions?.[TEST_EXTENSIONS.DERIVED_UNIQUE], true);
    assertEquals(schema.extensions?.description, "Test schema");
  });

  await t.step("should add new extension keys", () => {
    const schema = new TestSchemaBuilder()
      .withTemplateFormat("yaml")
      .withBaseProperty(true)
      .withDefaultValue("default")
      .build();

    assertEquals(schema.extensions?.[TEST_EXTENSIONS.TEMPLATE_FORMAT], "yaml");
    assertEquals(schema.extensions?.[TEST_EXTENSIONS.BASE_PROPERTY], true);
    assertEquals(schema.extensions?.[TEST_EXTENSIONS.DEFAULT_VALUE], "default");
  });

  await t.step("should add properties to object schema", () => {
    const childSchema = new TestSchemaBuilder("string").build();
    const schema = new TestSchemaBuilder()
      .withProperty("name", childSchema)
      .withRequired(["name"])
      .build();

    assertEquals(schema.kind, "object");
    if (schema.kind === "object") {
      assertEquals(schema.properties.name, childSchema);
      assertEquals(schema.required, ["name"]);
    }
  });

  await t.step(
    "should throw when adding properties to non-object schema",
    () => {
      const builder = new TestSchemaBuilder("string");
      assertThrows(
        () => builder.withProperty("name", { kind: "string" }),
        Error,
        "Cannot add properties to non-object schema",
      );
    },
  );

  await t.step("should set items for array schema", () => {
    const itemSchema = { kind: "string" as const };
    const schema = new TestSchemaBuilder("array")
      .withItems(itemSchema)
      .build();

    assertEquals(schema.kind, "array");
    if (schema.kind === "array") {
      assertEquals(schema.items, itemSchema);
    }
  });

  await t.step("should throw when setting items on non-array schema", () => {
    const builder = new TestSchemaBuilder("object");
    assertThrows(
      () => builder.withItems({ kind: "string" }),
      Error,
      "Cannot set items on non-array schema",
    );
  });

  await t.step("static factory methods should work", () => {
    const frontmatterSchema = TestSchemaBuilder.createFrontmatterSchema();
    assertEquals(
      frontmatterSchema.extensions?.[TEST_EXTENSIONS.FRONTMATTER_PART],
      true,
    );

    const templateSchema = TestSchemaBuilder.createTemplateSchema("{test}");
    assertEquals(
      templateSchema.extensions?.[TEST_EXTENSIONS.TEMPLATE],
      "{test}",
    );

    const derivedSchema = TestSchemaBuilder.createDerivedSchema("source", true);
    assertEquals(
      derivedSchema.extensions?.[TEST_EXTENSIONS.DERIVED_FROM],
      "source",
    );
    assertEquals(
      derivedSchema.extensions?.[TEST_EXTENSIONS.DERIVED_UNIQUE],
      true,
    );

    const basePropertySchema = TestSchemaBuilder.createBasePropertySchema(
      "default",
    );
    assertEquals(
      basePropertySchema.extensions?.[TEST_EXTENSIONS.BASE_PROPERTY],
      true,
    );
    assertEquals(
      basePropertySchema.extensions?.[TEST_EXTENSIONS.DEFAULT_VALUE],
      "default",
    );
  });
});

Deno.test("TEST_EXTENSIONS", async (t) => {
  await t.step("should provide all extension keys", () => {
    assertEquals(typeof TEST_EXTENSIONS.FRONTMATTER_PART, "string");
    assertEquals(typeof TEST_EXTENSIONS.TEMPLATE, "string");
    assertEquals(typeof TEST_EXTENSIONS.TEMPLATE_ITEMS, "string");
    assertEquals(typeof TEST_EXTENSIONS.DERIVED_FROM, "string");
    assertEquals(typeof TEST_EXTENSIONS.DERIVED_UNIQUE, "string");
    assertEquals(typeof TEST_EXTENSIONS.JMESPATH_FILTER, "string");
    assertEquals(typeof TEST_EXTENSIONS.TEMPLATE_FORMAT, "string");
    assertEquals(typeof TEST_EXTENSIONS.BASE_PROPERTY, "string");
    assertEquals(typeof TEST_EXTENSIONS.DEFAULT_VALUE, "string");
  });

  await t.step("should match registry values", () => {
    // These should match the actual registry values
    assertEquals(TEST_EXTENSIONS.FRONTMATTER_PART, "x-frontmatter-part");
    assertEquals(TEST_EXTENSIONS.TEMPLATE, "x-template");
    assertEquals(TEST_EXTENSIONS.TEMPLATE_ITEMS, "x-template-items");
    assertEquals(TEST_EXTENSIONS.DERIVED_FROM, "x-derived-from");
    assertEquals(TEST_EXTENSIONS.DERIVED_UNIQUE, "x-derived-unique");
    assertEquals(TEST_EXTENSIONS.JMESPATH_FILTER, "x-jmespath-filter");
    assertEquals(TEST_EXTENSIONS.TEMPLATE_FORMAT, "x-template-format");
    assertEquals(TEST_EXTENSIONS.BASE_PROPERTY, "x-base-property");
    assertEquals(TEST_EXTENSIONS.DEFAULT_VALUE, "x-default-value");
  });

  await t.step("createExtensions should create correct object", () => {
    const extensions = createExtensions({
      frontmatterPart: true,
      template: "{name}",
      description: "Test",
    });

    assertEquals(extensions[TEST_EXTENSIONS.FRONTMATTER_PART], true);
    assertEquals(extensions[TEST_EXTENSIONS.TEMPLATE], "{name}");
    assertEquals(extensions.description, "Test");
    assertEquals(extensions[TEST_EXTENSIONS.DERIVED_FROM], undefined);
  });
});
