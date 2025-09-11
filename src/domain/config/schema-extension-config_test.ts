/**
 * Tests for SchemaExtensionConfig
 * Validates Smart Constructor pattern and configurable property functionality
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { SchemaExtensionConfig, isExtensionPropertyType } from "./schema-extension-config.ts";

describe("SchemaExtensionConfig", () => {
  describe("Smart Constructor Pattern", () => {
    it("should create config with default values", () => {
      const result = SchemaExtensionConfig.create({});
      
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getTemplateProperty(), "x-template");
        assertEquals(result.data.getDerivedFromProperty(), "x-derived-from");
        assertEquals(result.data.getDerivedUniqueProperty(), "x-derived-unique");
        assertEquals(result.data.getDerivedFlattenProperty(), "x-derived-flatten");
        assertEquals(result.data.getFrontmatterPartProperty(), "x-frontmatter-part");
      }
    });

    it("should create config with custom values", () => {
      const result = SchemaExtensionConfig.create({
        templateProperty: "custom-template",
        derivedFromProperty: "custom-derived-from",
        derivedUniqueProperty: "custom-derived-unique",
        derivedFlattenProperty: "custom-derived-flatten",
        frontmatterPartProperty: "custom-frontmatter-part",
      });
      
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getTemplateProperty(), "custom-template");
        assertEquals(result.data.getDerivedFromProperty(), "custom-derived-from");
        assertEquals(result.data.getDerivedUniqueProperty(), "custom-derived-unique");
        assertEquals(result.data.getDerivedFlattenProperty(), "custom-derived-flatten");
        assertEquals(result.data.getFrontmatterPartProperty(), "custom-frontmatter-part");
      }
    });

    it("should reject empty property names", () => {
      const result = SchemaExtensionConfig.create({
        templateProperty: "",
      });
      
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "EmptyInput");
        assertEquals(result.error.message, "templateProperty cannot be empty");
      }
    });

    it("should reject invalid property name format", () => {
      const result = SchemaExtensionConfig.create({
        templateProperty: "123-invalid",
      });
      
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
      }
    });

    it("should reject duplicate property names", () => {
      const result = SchemaExtensionConfig.create({
        templateProperty: "same-name",
        derivedFromProperty: "same-name",
      });
      
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidState");
        assertEquals(result.error.message, "All schema extension property names must be unique");
      }
    });

    it("should trim whitespace from property names", () => {
      const result = SchemaExtensionConfig.create({
        templateProperty: "  template-prop  ",
      });
      
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getTemplateProperty(), "template-prop");
      }
    });
  });

  describe("createDefault factory method", () => {
    it("should create default configuration", () => {
      const config = SchemaExtensionConfig.createDefault();
      
      assertEquals(config.getTemplateProperty(), "x-template");
      assertEquals(config.getDerivedFromProperty(), "x-derived-from");
      assertEquals(config.getDerivedUniqueProperty(), "x-derived-unique");
      assertEquals(config.getDerivedFlattenProperty(), "x-derived-flatten");
      assertEquals(config.getFrontmatterPartProperty(), "x-frontmatter-part");
    });
  });

  describe("property access methods", () => {
    it("should return all properties as readonly array", () => {
      const config = SchemaExtensionConfig.createDefault();
      const properties = config.getAllProperties();
      
      assertEquals(properties.length, 5);
      assertEquals(properties.includes("x-template"), true);
      assertEquals(properties.includes("x-derived-from"), true);
      assertEquals(properties.includes("x-derived-unique"), true);
      assertEquals(properties.includes("x-derived-flatten"), true);
      assertEquals(properties.includes("x-frontmatter-part"), true);
    });

    it("should identify extension properties", () => {
      const config = SchemaExtensionConfig.createDefault();
      
      assertEquals(config.isExtensionProperty("x-template"), true);
      assertEquals(config.isExtensionProperty("x-derived-from"), true);
      assertEquals(config.isExtensionProperty("not-extension"), false);
    });

    it("should get extension type for known properties", () => {
      const config = SchemaExtensionConfig.createDefault();
      
      const templateResult = config.getExtensionType("x-template");
      assertEquals(templateResult.ok, true);
      if (templateResult.ok) {
        assertEquals(templateResult.data, "template");
      }

      const derivedResult = config.getExtensionType("x-derived-from");
      assertEquals(derivedResult.ok, true);
      if (derivedResult.ok) {
        assertEquals(derivedResult.data, "derivedFrom");
      }
    });

    it("should return error for unknown properties", () => {
      const config = SchemaExtensionConfig.createDefault();
      
      const result = config.getExtensionType("unknown-property");
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "NotFound");
      }
    });
  });

  describe("validation map creation", () => {
    it("should create property validation map", () => {
      const config = SchemaExtensionConfig.createDefault();
      const validationMap = config.createPropertyValidationMap();
      
      assertEquals(validationMap["x-template"], "template");
      assertEquals(validationMap["x-derived-from"], "derivedFrom");
      assertEquals(validationMap["x-derived-unique"], "derivedUnique");
      assertEquals(validationMap["x-derived-flatten"], "derivedFlatten");
      assertEquals(validationMap["x-frontmatter-part"], "frontmatterPart");
    });
  });

  describe("equality and string representation", () => {
    it("should check equality correctly", () => {
      const config1 = SchemaExtensionConfig.createDefault();
      const config2 = SchemaExtensionConfig.createDefault();
      const config3 = SchemaExtensionConfig.create({
        templateProperty: "different-template",
      });
      
      assertEquals(config1.equals(config2), true);
      if (config3.ok) {
        assertEquals(config1.equals(config3.data), false);
      }
    });

    it("should provide meaningful string representation", () => {
      const config = SchemaExtensionConfig.createDefault();
      const stringRep = config.toString();
      
      assertEquals(stringRep.includes("SchemaExtensionConfig"), true);
      assertEquals(stringRep.includes("x-template"), true);
      assertEquals(stringRep.includes("x-derived-from"), true);
    });
  });
});

describe("ExtensionPropertyType type guards", () => {
  it("should validate extension property types", () => {
    assertEquals(isExtensionPropertyType("template"), true);
    assertEquals(isExtensionPropertyType("derivedFrom"), true);
    assertEquals(isExtensionPropertyType("derivedUnique"), true);
    assertEquals(isExtensionPropertyType("derivedFlatten"), true);
    assertEquals(isExtensionPropertyType("frontmatterPart"), true);
    assertEquals(isExtensionPropertyType("invalid"), false);
  });
});