import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { TEST_EXTENSIONS } from "../../../../helpers/test-extensions.ts";

describe("SchemaDefinition Value Object", () => {
  describe("create", () => {
    it("should create SchemaDefinition with valid string schema", () => {
      // Arrange & Act
      const result = SchemaDefinition.create({ type: "string" });

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getKind(), "string");
      }
    });

    it("should create SchemaDefinition with object schema", () => {
      // Arrange
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name"],
      };

      // Act
      const result = SchemaDefinition.create(schema);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getKind(), "object");
      }
    });

    it("should handle schema migration errors", () => {
      // Arrange & Act
      const result = SchemaDefinition.create(null);

      // Assert
      assertEquals(result.ok, false);
    });

    it("should maintain Result pattern compliance", () => {
      // Arrange & Act
      const validResult = SchemaDefinition.create({ kind: "string" });
      const invalidResult = SchemaDefinition.create(null);

      // Assert
      assertExists(validResult);
      assertEquals(typeof validResult.ok, "boolean");
      assertExists(invalidResult);
      assertEquals(typeof invalidResult.ok, "boolean");

      if (validResult.ok) {
        assertExists(validResult.data);
        assertExists(validResult.data.getKind);
      } else {
        assertExists(validResult.error);
        assertExists(validResult.error.kind);
        assertExists(validResult.error.message);
      }
    });
  });

  describe("fromSchemaProperty", () => {
    it("should create SchemaDefinition from schema property", () => {
      // Arrange
      const schemaProperty = { kind: "string" as const };

      // Act
      const result = SchemaDefinition.fromSchemaProperty(schemaProperty);

      // Assert
      assertEquals(result.getKind(), "string");
    });
  });

  describe("createLegacy", () => {
    it("should handle legacy schema creation", () => {
      // Arrange & Act
      const result = SchemaDefinition.createLegacy({ type: "string" });

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getKind(), "string");
      }
    });
  });

  describe("getType", () => {
    it("should return type for primitive schemas", () => {
      const testCases = [
        [{ kind: "string" as const }, "string"],
        [{ kind: "number" as const }, "number"],
        [{ kind: "integer" as const }, "integer"],
        [{ kind: "boolean" as const }, "boolean"],
        [
          { kind: "array" as const, items: { kind: "string" as const } },
          "array",
        ],
        [{ kind: "object" as const, properties: {}, required: [] }, "object"],
        [{ kind: "null" as const }, "null"],
      ] as const;

      testCases.forEach(([schemaProperty, expectedType]) => {
        const schema = SchemaDefinition.fromSchemaProperty(schemaProperty);
        const result = schema.getType();
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data, expectedType);
        }
      });
    });

    it("should handle enum schemas with base type", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "enum",
        baseType: "string",
        values: ["red", "green", "blue"],
      });

      // Act
      const result = schema.getType();

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "string");
      }
    });

    it("should handle enum schemas without base type", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "enum",
        values: ["red", "green", "blue"],
      });

      // Act
      const result = schema.getType();

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "string");
      }
    });

    it("should reject ref schemas", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "ref",
        ref: "#/definitions/User",
      });

      // Act
      const result = schema.getType();

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "TypeNotDefined");
        assertExists(result.error.message);
      }
    });

    it("should reject any schemas", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "any",
      });

      // Act
      const result = schema.getType();

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "TypeNotDefined");
        assertExists(result.error.message);
      }
    });
  });

  describe("getProperties", () => {
    it("should return properties for object schemas", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "object",
        properties: {
          name: { kind: "string" },
          age: { kind: "number" },
        },
        required: [],
      });

      // Act
      const result = schema.getProperties();

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(Object.keys(result.data).length, 2);
        assertEquals(result.data.name.kind, "string");
        assertEquals(result.data.age.kind, "number");
      }
    });

    it("should reject non-object schemas", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({ kind: "string" });

      // Act
      const result = schema.getProperties();

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "PropertiesNotDefined");
        assertExists(result.error.message);
      }
    });
  });

  describe("getRequired", () => {
    it("should return required properties for object schemas", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "object",
        properties: {
          name: { kind: "string" },
          age: { kind: "number" },
        },
        required: ["name"],
      });

      // Act
      const result = schema.getRequired();

      // Assert
      assertEquals(result.length, 1);
      assertEquals(result[0], "name");
    });

    it("should return empty array for non-object schemas", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({ kind: "string" });

      // Act
      const result = schema.getRequired();

      // Assert
      assertEquals(result.length, 0);
    });
  });

  describe("template extensions", () => {
    it("should detect template extensions", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
        extensions: {
          [TEST_EXTENSIONS.TEMPLATE]: "template.md",
        },
      });

      // Act & Assert
      assertEquals(schema.hasTemplate(), true);
      const templateResult = schema.getTemplatePath();
      assertEquals(templateResult.ok, true);
      if (templateResult.ok) {
        assertEquals(templateResult.data, "template.md");
      }
    });

    it("should detect template items extensions", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "array",
        items: { kind: "string" },
        extensions: {
          [TEST_EXTENSIONS.TEMPLATE_ITEMS]: "item.md",
        },
      });

      // Act & Assert
      assertEquals(schema.hasTemplateItems(), true);
      const itemsResult = schema.getTemplateItems();
      assertEquals(itemsResult.ok, true);
      if (itemsResult.ok) {
        assertEquals(itemsResult.data, "item.md");
      }
    });

    it("should detect template format extensions", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
        extensions: {
          [TEST_EXTENSIONS.TEMPLATE_FORMAT]: "yaml",
        },
      });

      // Act & Assert
      assertEquals(schema.hasTemplateFormat(), true);
      const formatResult = schema.getTemplateFormat();
      assertEquals(formatResult.ok, true);
      if (formatResult.ok) {
        assertEquals(formatResult.data, "yaml");
      }
    });

    it("should handle schemas without template extensions", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
      });

      // Act & Assert
      assertEquals(schema.hasTemplate(), false);
      assertEquals(schema.hasTemplateItems(), false);
      assertEquals(schema.hasTemplateFormat(), false);
    });
  });

  describe("JMESPath filter", () => {
    it("should detect JMESPath filter extensions", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "object",
        properties: {},
        required: [],
        extensions: {
          [TEST_EXTENSIONS.JMESPATH_FILTER]: "items[?status == 'active']",
        },
      });

      // Act & Assert
      assertEquals(schema.hasJMESPathFilter(), true);
      const filterResult = schema.getJMESPathFilter();
      assertEquals(filterResult.ok, true);
      if (filterResult.ok) {
        assertEquals(filterResult.data, "items[?status == 'active']");
      }
    });

    it("should handle schemas without JMESPath filter", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
      });

      // Act & Assert
      assertEquals(schema.hasJMESPathFilter(), false);
    });
  });

  describe("reference handling", () => {
    it("should detect reference schemas", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "ref",
        ref: "#/definitions/User",
      });

      // Act & Assert
      assertEquals(schema.hasRef(), true);
      const refResult = schema.getRef();
      assertEquals(refResult.ok, true);
      if (refResult.ok) {
        assertEquals(refResult.data, "#/definitions/User");
      }
    });

    it("should reject getRef for non-reference schemas", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
      });

      // Act
      const result = schema.getRef();

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "RefNotDefined");
        assertExists(result.error.message);
      }
    });
  });

  describe("frontmatter and derivation", () => {
    it("should detect frontmatter part extensions", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
        extensions: {
          [TEST_EXTENSIONS.FRONTMATTER_PART]: true,
        },
      });

      // Act & Assert
      assertEquals(schema.hasFrontmatterPart(), true);
    });

    it("should detect derived from extensions", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
        extensions: {
          [TEST_EXTENSIONS.DERIVED_FROM]: "content.title",
        },
      });

      // Act & Assert
      assertEquals(schema.hasDerivedFrom(), true);
      const derivedResult = schema.getDerivedFrom();
      assertEquals(derivedResult.ok, true);
      if (derivedResult.ok) {
        assertEquals(derivedResult.data, "content.title");
      }
    });

    it("should detect derived unique flag", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
        extensions: {
          [TEST_EXTENSIONS.DERIVED_UNIQUE]: true,
        },
      });

      // Act & Assert
      assertEquals(schema.isDerivedUnique(), true);
    });
  });

  describe("array items", () => {
    it("should return items for array schemas", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "array",
        items: { kind: "string" },
      });

      // Act
      const result = schema.getItems();

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        // Check if it's a SchemaProperty (not RefSchema) before accessing kind
        if ("kind" in result.data) {
          assertEquals(result.data.kind, "string");
        }
      }
    });

    it("should reject getItems for non-array schemas", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
      });

      // Act
      const result = schema.getItems();

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ItemsNotDefined");
        assertExists(result.error.message);
      }
    });
  });

  describe("enum values", () => {
    it("should return enum values for enum schemas", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "enum",
        values: ["red", "green", "blue"],
      });

      // Act
      const result = schema.getEnumValues();

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 3);
        assertEquals(result.data[0], "red");
        assertEquals(result.data[1], "green");
        assertEquals(result.data[2], "blue");
      }
    });

    it("should reject getEnumValues for non-enum schemas", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
      });

      // Act
      const result = schema.getEnumValues();

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "EnumNotDefined");
        assertExists(result.error.message);
      }
    });
  });

  describe("getRawSchema", () => {
    it("should return the raw schema property", () => {
      // Arrange
      const schemaProperty = { kind: "string" as const };
      const schema = SchemaDefinition.fromSchemaProperty(schemaProperty);

      // Act
      const result = schema.getRawSchema();

      // Assert
      assertEquals(result, schemaProperty);
      assertEquals(result.kind, "string");
    });
  });

  describe("findProperty", () => {
    it("should find nested property in object", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "object",
        properties: {
          user: {
            kind: "object",
            properties: {
              name: { kind: "string" },
            },
            required: [],
          },
        },
        required: [],
      });

      // Act
      const result = schema.findProperty("user.name");

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "string");
      }
    });

    it("should find array items property", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "object",
        properties: {
          items: {
            kind: "array",
            items: { kind: "string" },
          },
        },
        required: [],
      });

      // Act
      const result = schema.findProperty("items.[]");

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "string");
      }
    });

    it("should handle property not found", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "object",
        properties: {
          name: { kind: "string" },
        },
        required: [],
      });

      // Act
      const result = schema.findProperty("nonexistent");

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "PropertyNotFound");
        assertExists(result.error.message);
      }
    });

    it("should handle array access on non-array", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "object",
        properties: {
          name: { kind: "string" },
        },
        required: [],
      });

      // Act
      const result = schema.findProperty("name.[]");

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "PropertyNotFound");
        assertExists(result.error.message);
      }
    });
  });

  describe("isKind", () => {
    it("should correctly identify schema kinds", () => {
      // Arrange
      const stringSchema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
      });
      const objectSchema = SchemaDefinition.fromSchemaProperty({
        kind: "object",
        properties: {},
        required: [],
      });

      // Act & Assert
      assertEquals(stringSchema.isKind("string"), true);
      assertEquals(stringSchema.isKind("object"), false);
      assertEquals(objectSchema.isKind("object"), true);
      assertEquals(objectSchema.isKind("string"), false);
    });
  });

  describe("extensions", () => {
    it("should detect and return extensions", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
        extensions: {
          description: "A test description",
          "x-custom": "custom value",
        },
      });

      // Act & Assert
      assertEquals(schema.hasExtensions(), true);
      assertEquals(schema.getDescription(), "A test description");

      const extensions = schema.getExtensions();
      assertExists(extensions);
      assertEquals(extensions.description, "A test description");
      assertEquals(extensions["x-custom"], "custom value");
    });

    it("should handle schemas without extensions", () => {
      // Arrange
      const schema = SchemaDefinition.fromSchemaProperty({
        kind: "string",
      });

      // Act & Assert
      assertEquals(schema.hasExtensions(), false);
      assertEquals(schema.getDescription(), undefined);
      assertEquals(schema.getExtensions(), undefined);
    });
  });
});
