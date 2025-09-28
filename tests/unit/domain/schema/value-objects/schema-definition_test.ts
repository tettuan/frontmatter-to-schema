import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { isErr, isOk } from "../../../../../src/domain/shared/types/result.ts";

describe("SchemaDefinition", () => {
  describe("create method", () => {
    it("should create a valid SchemaDefinition with basic object schema", () => {
      const schema = {
        type: "object",
        properties: { name: { type: "string" } },
      };
      const result = SchemaDefinition.create(schema);

      assertEquals(isOk(result), true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.getKind(), "object");
      }
    });

    it("should reject null input", () => {
      const result = SchemaDefinition.create(null);
      assertEquals(isErr(result), true);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertEquals(result.error.message, "Schema must be an object");
      }
    });

    it("should reject non-object input", () => {
      const result = SchemaDefinition.create("not an object");
      assertEquals(isErr(result), true);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertEquals(result.error.message, "Schema must be an object");
      }
    });

    it("should reject schema without type property", () => {
      const result = SchemaDefinition.create({ properties: {} });
      assertEquals(isErr(result), true);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertEquals(result.error.message, "Schema must have a type property");
      }
    });

    it("should reject schema with non-string type", () => {
      const result = SchemaDefinition.create({ type: 123 });
      assertEquals(isErr(result), true);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertEquals(result.error.message, "Schema must have a type property");
      }
    });

    it("should accept schema with array type", () => {
      const schema = { type: "array", items: { type: "string" } };
      const result = SchemaDefinition.create(schema);
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(result.data.getKind(), "array");
      }
    });

    it("should accept schema with string type", () => {
      const result = SchemaDefinition.create({ type: "string" });
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(result.data.getKind(), "string");
      }
    });

    it("should accept schema with extensions", () => {
      const schema = {
        type: "object",
        "x-template": "template.json",
        "x-template-format": "json",
        "x-frontmatter-part": true,
      };
      const result = SchemaDefinition.create(schema);
      assertEquals(isOk(result), true);
    });
  });

  describe("createLegacy method", () => {
    it("should create a SchemaDefinition using legacy method", () => {
      const schema = { type: "object" };
      const result = SchemaDefinition.createLegacy(schema);
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(result.data.getKind(), "object");
      }
    });
  });

  describe("fromSchemaProperty method", () => {
    it("should create a SchemaDefinition directly", () => {
      const schema = { type: "object", properties: { id: { type: "number" } } };
      const definition = SchemaDefinition.fromSchemaProperty(schema);
      assertExists(definition);
      assertEquals(definition.getKind(), "object");
    });
  });

  describe("getKind method", () => {
    it("should return the schema type", () => {
      const schema = { type: "array" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.getKind(), "array");
      }
    });
  });

  describe("getType method", () => {
    it("should return the schema type as Result", () => {
      const schema = { type: "boolean" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const typeResult = result.data.getType();
        assertEquals(isOk(typeResult), true);
        if (typeResult.ok) {
          assertEquals(typeResult.data, "boolean");
        }
      }
    });
  });

  describe("getProperties method", () => {
    it("should return properties for object schema", () => {
      const properties = { name: { type: "string" }, age: { type: "number" } };
      const schema = { type: "object", properties };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const propsResult = result.data.getProperties();
        assertEquals(isOk(propsResult), true);
        if (propsResult.ok) {
          assertEquals(propsResult.data, properties);
        }
      }
    });

    it("should return error for non-object schema", () => {
      const schema = { type: "string" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const propsResult = result.data.getProperties();
        assertEquals(isErr(propsResult), true);
        if (!propsResult.ok) {
          assertEquals(propsResult.error.kind, "PropertiesNotDefined");
          assertEquals(
            propsResult.error.message,
            "Schema is not an object type or has no properties",
          );
        }
      }
    });

    it("should return error for object schema without properties", () => {
      const schema = { type: "object" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const propsResult = result.data.getProperties();
        assertEquals(isErr(propsResult), true);
        if (!propsResult.ok) {
          assertEquals(propsResult.error.kind, "PropertiesNotDefined");
        }
      }
    });
  });

  describe("getProperty method", () => {
    it("should return a specific property", () => {
      const schema = {
        type: "object",
        properties: { name: { type: "string" }, age: { type: "number" } },
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const propResult = result.data.getProperty("name");
        assertEquals(isOk(propResult), true);
        if (propResult.ok) {
          assertEquals(propResult.data, { type: "string" });
        }
      }
    });

    it("should return error for non-existent property", () => {
      const schema = {
        type: "object",
        properties: { name: { type: "string" } },
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const propResult = result.data.getProperty("missing");
        assertEquals(isErr(propResult), true);
        if (!propResult.ok) {
          assertEquals(propResult.error.kind, "PropertyNotFound");
          assertEquals(propResult.error.message, "Property missing not found");
        }
      }
    });

    it("should return error for schema without properties", () => {
      const schema = { type: "object" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const propResult = result.data.getProperty("any");
        assertEquals(isErr(propResult), true);
        if (!propResult.ok) {
          assertEquals(propResult.error.kind, "PropertyNotFound");
        }
      }
    });
  });

  describe("hasProperty method", () => {
    it("should return true for existing property", () => {
      const schema = {
        type: "object",
        properties: { name: { type: "string" } },
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.hasProperty("name"), true);
      }
    });

    it("should return false for non-existing property", () => {
      const schema = {
        type: "object",
        properties: { name: { type: "string" } },
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.hasProperty("age"), false);
      }
    });

    it("should return false for schema without properties", () => {
      const schema = { type: "object" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.hasProperty("any"), false);
      }
    });
  });

  describe("getExtension method", () => {
    it("should return extension value when present", () => {
      const schema = {
        type: "object",
        "x-template": "template.json",
        "x-custom": { value: 123 },
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const extResult = result.data.getExtension("x-template");
        assertEquals(isOk(extResult), true);
        if (extResult.ok) {
          assertEquals(extResult.data, "template.json");
        }

        const customResult = result.data.getExtension("x-custom");
        assertEquals(isOk(customResult), true);
        if (customResult.ok) {
          assertEquals(customResult.data, { value: 123 });
        }
      }
    });

    it("should return error for non-existent extension", () => {
      const schema = { type: "object" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const extResult = result.data.getExtension("x-missing");
        assertEquals(isErr(extResult), true);
        if (!extResult.ok) {
          assertEquals(extResult.error.kind, "InvalidSchema");
          assertEquals(
            extResult.error.message,
            "Extension x-missing not found",
          );
        }
      }
    });
  });

  describe("hasExtension method", () => {
    it("should return true for existing extension", () => {
      const schema = {
        type: "object",
        "x-template": "template.json",
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.hasExtension("x-template"), true);
      }
    });

    it("should return false for non-existing extension", () => {
      const schema = { type: "object" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.hasExtension("x-missing"), false);
      }
    });

    it("should return true for standard properties like type", () => {
      const schema = { type: "object" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.hasExtension("type"), true);
      }
    });
  });

  describe("toRaw, getRawSchema, and getRawSchemaObject methods", () => {
    it("should return the original schema object", () => {
      const schema = {
        type: "object",
        properties: { id: { type: "string" } },
        "x-template": "template.json",
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.toRaw(), schema);
        assertEquals(result.data.getRawSchema(), schema);
        assertEquals(result.data.getRawSchemaObject(), schema);
      }
    });
  });

  describe("getTemplatePath method", () => {
    it("should return template path when x-template is string", () => {
      const schema = {
        type: "object",
        "x-template": "templates/main.json",
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const templateResult = result.data.getTemplatePath();
        assertEquals(isOk(templateResult), true);
        if (templateResult.ok) {
          assertEquals(templateResult.data, "templates/main.json");
        }
      }
    });

    it("should return error when x-template is not defined", () => {
      const schema = { type: "object" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const templateResult = result.data.getTemplatePath();
        assertEquals(isErr(templateResult), true);
        if (!templateResult.ok) {
          assertEquals(templateResult.error.kind, "TemplateNotDefined");
          assertEquals(
            templateResult.error.message,
            "x-template extension not found",
          );
        }
      }
    });

    it("should return error when x-template is not a string", () => {
      const schema = {
        type: "object",
        "x-template": { path: "template.json" },
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const templateResult = result.data.getTemplatePath();
        assertEquals(isErr(templateResult), true);
        if (!templateResult.ok) {
          assertEquals(templateResult.error.kind, "TemplateNotDefined");
        }
      }
    });
  });

  describe("getTemplateFormat method", () => {
    it("should return json format", () => {
      const schema = {
        type: "object",
        "x-template-format": "json",
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const formatResult = result.data.getTemplateFormat();
        assertEquals(isOk(formatResult), true);
        if (formatResult.ok) {
          assertEquals(formatResult.data, "json");
        }
      }
    });

    it("should return yaml format", () => {
      const schema = {
        type: "object",
        "x-template-format": "yaml",
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const formatResult = result.data.getTemplateFormat();
        assertEquals(isOk(formatResult), true);
        if (formatResult.ok) {
          assertEquals(formatResult.data, "yaml");
        }
      }
    });

    it("should return markdown format", () => {
      const schema = {
        type: "object",
        "x-template-format": "markdown",
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const formatResult = result.data.getTemplateFormat();
        assertEquals(isOk(formatResult), true);
        if (formatResult.ok) {
          assertEquals(formatResult.data, "markdown");
        }
      }
    });

    it("should return default json format when not specified", () => {
      const schema = { type: "object" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const formatResult = result.data.getTemplateFormat();
        assertEquals(isOk(formatResult), true);
        if (formatResult.ok) {
          assertEquals(formatResult.data, "json");
        }
      }
    });

    it("should return default json format for invalid format", () => {
      const schema = {
        type: "object",
        "x-template-format": "invalid",
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const formatResult = result.data.getTemplateFormat();
        assertEquals(isOk(formatResult), true);
        if (formatResult.ok) {
          assertEquals(formatResult.data, "json");
        }
      }
    });
  });

  describe("hasFrontmatterPart method", () => {
    it("should return true when x-frontmatter-part is true", () => {
      const schema = {
        type: "object",
        "x-frontmatter-part": true,
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.hasFrontmatterPart(), true);
      }
    });

    it("should return false when x-frontmatter-part is false", () => {
      const schema = {
        type: "object",
        "x-frontmatter-part": false,
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.hasFrontmatterPart(), false);
      }
    });

    it("should return false when x-frontmatter-part is not defined", () => {
      const schema = { type: "object" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.hasFrontmatterPart(), false);
      }
    });

    it("should return false when x-frontmatter-part is not boolean", () => {
      const schema = {
        type: "object",
        "x-frontmatter-part": "true",
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.hasFrontmatterPart(), false);
      }
    });
  });

  describe("getDerivedFrom method", () => {
    it("should return derived from value when string", () => {
      const schema = {
        type: "object",
        "x-derived-from": "base-schema",
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const derivedResult = result.data.getDerivedFrom();
        assertEquals(isOk(derivedResult), true);
        if (derivedResult.ok) {
          assertEquals(derivedResult.data, "base-schema");
        }
      }
    });

    it("should return error when x-derived-from not defined", () => {
      const schema = { type: "object" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const derivedResult = result.data.getDerivedFrom();
        assertEquals(isErr(derivedResult), true);
        if (!derivedResult.ok) {
          assertEquals(derivedResult.error.kind, "DerivedFromNotDefined");
          assertEquals(
            derivedResult.error.message,
            "x-derived-from extension not found",
          );
        }
      }
    });

    it("should return error when x-derived-from not string", () => {
      const schema = {
        type: "object",
        "x-derived-from": { base: "schema" },
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        const derivedResult = result.data.getDerivedFrom();
        assertEquals(isErr(derivedResult), true);
        if (!derivedResult.ok) {
          assertEquals(derivedResult.error.kind, "DerivedFromNotDefined");
        }
      }
    });
  });

  describe("isDerivedUnique method", () => {
    it("should return true when x-derived-unique is true", () => {
      const schema = {
        type: "object",
        "x-derived-unique": true,
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.isDerivedUnique(), true);
      }
    });

    it("should return false when x-derived-unique is false", () => {
      const schema = {
        type: "object",
        "x-derived-unique": false,
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.isDerivedUnique(), false);
      }
    });

    it("should return false when x-derived-unique not defined", () => {
      const schema = { type: "object" };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.isDerivedUnique(), false);
      }
    });

    it("should return false when x-derived-unique not boolean", () => {
      const schema = {
        type: "object",
        "x-derived-unique": "true",
      };
      const result = SchemaDefinition.create(schema);
      if (result.ok) {
        assertEquals(result.data.isDerivedUnique(), false);
      }
    });
  });
});
