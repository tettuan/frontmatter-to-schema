/**
 * @fileoverview Directive Validator Test Suite - Updated for Issue #1005
 * @description Comprehensive tests for schema directive validation (deprecated directives removed)
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { DirectiveValidator } from "../../../../../src/domain/schema/validators/directive-validator.ts";
import { SchemaProperty } from "../../../../../src/domain/schema/value-objects/schema-property-types.ts";

describe("DirectiveValidator", () => {
  const validator = DirectiveValidator.create();

  describe("Smart Constructor", () => {
    it("should create validator instance", () => {
      const validator = DirectiveValidator.create();
      assertExists(validator);
    });
  });

  describe("x-frontmatter-part Directive Validation", () => {
    it("should validate correct x-frontmatter-part directive", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-frontmatter-part": true,
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });

    it("should warn when x-frontmatter-part is used on non-array type", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {
          "x-frontmatter-part": true,
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.warnings.length, 1);
        assertEquals(result.data.warnings[0].kind, "TypeMismatch");
      }
    });

    it("should detect type mismatch in x-frontmatter-part value", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-frontmatter-part": "true", // Should be boolean
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "TypeMismatch");
      }
    });
  });

  describe("x-derived-from Directive Validation", () => {
    it("should validate correct x-derived-from directive", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {
          "x-derived-from": "computed.value",
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });

    it("should detect invalid path format in x-derived-from", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {
          "x-derived-from": "..invalid.path",
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "InvalidPath");
      }
    });
  });

  describe("x-template Directive Validation", () => {
    it("should validate correct x-template directive", () => {
      const property: SchemaProperty = {
        kind: "object",
        properties: {},
        required: [],
        extensions: {
          "x-template": "template.json",
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });

    it("should detect type mismatch in x-template value", () => {
      const property: SchemaProperty = {
        kind: "object",
        properties: {},
        required: [],
        extensions: {
          "x-template": 123, // Should be string
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "TypeMismatch");
      }
    });
  });

  describe("x-template-items Directive Validation", () => {
    it("should validate correct x-template-items directive", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-template": "template.json",
          "x-template-items": "item-template.json",
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });

    it("should warn when x-template-items is present without x-template", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-template-items": "item-template.json",
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.warnings.length, 1);
        assertEquals(result.data.warnings[0].kind, "MissingRequiredDirective");
      }
    });
  });

  describe("Circular Reference Detection", () => {
    it("should detect circular references in x-derived-from", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {
          "x-derived-from": "test.property", // References itself
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "CircularReference");
      }
    });

    it("should allow non-circular references", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {
          "x-derived-from": "other.property", // Valid reference
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });
  });

  describe("x-flatten-arrays Directive Validation", () => {
    it("should validate correct x-flatten-arrays directive", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-frontmatter-part": true,
          "x-flatten-arrays": "traceability",
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });

    it("should error on invalid x-flatten-arrays type", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-flatten-arrays": 123, // Should be string
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "TypeMismatch");
        if (result.data.errors[0].kind === "TypeMismatch") {
          assertEquals(result.data.errors[0].expected, "string");
          assertEquals(result.data.errors[0].actual, "number");
        }
      }
    });

    it("should error on invalid property path", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-flatten-arrays": "..invalid.path", // Invalid path
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "InvalidPath");
      }
    });

    it("should warn when x-flatten-arrays is used without x-frontmatter-part", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-flatten-arrays": "traceability",
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.warnings.length, 1);
        assertEquals(result.data.warnings[0].kind, "MissingRequiredDirective");
        if (result.data.warnings[0].kind === "MissingRequiredDirective") {
          assertEquals(result.data.warnings[0].directive, "x-frontmatter-part");
        }
      }
    });

    it("should warn when x-flatten-arrays is used on non-array type", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {
          "x-flatten-arrays": "traceability",
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.warnings.length, 2); // Type warning + missing frontmatter-part
        assertEquals(result.data.warnings[0].kind, "TypeMismatch");
        if (result.data.warnings[0].kind === "TypeMismatch") {
          assertEquals(result.data.warnings[0].expected, "array");
          assertEquals(result.data.warnings[0].actual, "string");
        }
      }
    });

    it("should allow empty string path", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-frontmatter-part": true,
          "x-flatten-arrays": "",
        },
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "InvalidPath");
      }
    });
  });

  describe("Schema-wide Validation", () => {
    it("should validate complex schema with multiple directives", () => {
      const schema = {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            extensions: {
              "x-template": "metadata-template.json",
            },
          },
          content: {
            type: "array",
            extensions: {
              "x-frontmatter-part": true,
            },
          },
          computed: {
            type: "string",
            extensions: {
              "x-derived-from": "metadata.title",
            },
          },
        },
      };

      const result = validator.validateSchema(schema);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });
  });

  describe("Performance and Edge Cases", () => {
    it("should handle empty schema properties", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {},
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });

    it("should handle properties without extensions", () => {
      const property: SchemaProperty = {
        kind: "string",
      };

      const result = validator.validateProperty(property, "test.property");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });
  });
});
