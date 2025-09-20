/**
 * @fileoverview Directive Validator Test Suite
 * @description Comprehensive tests for schema directive validation
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
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

  describe("x-extract-from Directive Validation", () => {
    it("should validate correct x-extract-from directive", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {
          "x-extract-from": "id.full",
        },
      };

      const result = validator.validateProperty(property, "test.property");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });

    it("should detect invalid path format in x-extract-from", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {
          "x-extract-from": "id..full", // Invalid: consecutive dots
        },
      };

      const result = validator.validateProperty(property, "test.property");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "InvalidPath");
        if (result.data.errors[0].kind === "InvalidPath") {
          assertEquals(
            result.data.errors[0].reason,
            "Consecutive dots are not allowed",
          );
        }
      }
    });

    it("should detect type mismatch in x-extract-from value", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {
          "x-extract-from": 123, // Should be string
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

    it("should validate array notation in paths", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-extract-from": "items[].id",
        },
      };

      const result = validator.validateProperty(property, "test.array");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });

    it("should detect malformed array notation", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-extract-from": "items[].wrong[]notation", // Invalid: multiple array notations
        },
      };

      const result = validator.validateProperty(property, "test.array");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "InvalidPath");
      }
    });
  });

  describe("x-frontmatter-part Directive Validation", () => {
    it("should validate correct x-frontmatter-part directive", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-frontmatter-part": true,
          "x-extract-from": "items[].data",
        },
      };

      const result = validator.validateProperty(property, "test.frontmatter");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });

    it("should detect type mismatch for x-frontmatter-part", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-frontmatter-part": "true", // Should be boolean
        },
      };

      const result = validator.validateProperty(property, "test.frontmatter");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "TypeMismatch");
        if (result.data.errors[0].kind === "TypeMismatch") {
          assertEquals(result.data.errors[0].expected, "boolean");
          assertEquals(result.data.errors[0].actual, "string");
        }
      }
    });

    it("should warn when x-frontmatter-part is used with non-array type", () => {
      const property: SchemaProperty = {
        kind: "string", // Should be array
        extensions: {
          "x-frontmatter-part": true,
        },
      };

      const result = validator.validateProperty(property, "test.frontmatter");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.warnings.length, 1);
        assertEquals(result.data.warnings[0].kind, "TypeMismatch");
        if (result.data.warnings[0].kind === "TypeMismatch") {
          assertEquals(result.data.warnings[0].expected, "array");
          assertEquals(result.data.warnings[0].actual, "string");
        }
      }
    });

    it("should warn when x-frontmatter-part is true but no x-extract-from", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-frontmatter-part": true,
          // Missing x-extract-from
        },
      };

      const result = validator.validateProperty(property, "test.frontmatter");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.warnings.length, 1);
        assertEquals(result.data.warnings[0].kind, "MissingRequiredDirective");
        if (result.data.warnings[0].kind === "MissingRequiredDirective") {
          assertEquals(result.data.warnings[0].directive, "x-extract-from");
        }
      }
    });
  });

  describe("x-derived-from Directive Validation", () => {
    it("should validate correct x-derived-from directive", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-derived-from": "commands[].c1",
        },
      };

      const result = validator.validateProperty(property, "test.derived");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });

    it("should detect invalid x-derived-from path", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-derived-from": ".invalid.path", // Starts with dot
        },
      };

      const result = validator.validateProperty(property, "test.derived");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "InvalidPath");
      }
    });

    it("should detect type mismatch in x-derived-from", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-derived-from": ["not", "a", "string"], // Should be string
        },
      };

      const result = validator.validateProperty(property, "test.derived");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "TypeMismatch");
        if (result.data.errors[0].kind === "TypeMismatch") {
          assertEquals(result.data.errors[0].expected, "string");
          assertEquals(result.data.errors[0].actual, "object");
        }
      }
    });
  });

  describe("Directive Combination Validation", () => {
    it("should warn when both x-extract-from and x-derived-from are present", () => {
      const property: SchemaProperty = {
        kind: "array",
        items: { kind: "string" },
        extensions: {
          "x-extract-from": "source.data",
          "x-derived-from": "other.data", // Conflicting
        },
      };

      const result = validator.validateProperty(property, "test.conflict");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.warnings.length, 1);
        assertEquals(result.data.warnings[0].kind, "ConflictingDirectives");
        if (result.data.warnings[0].kind === "ConflictingDirectives") {
          assertEquals(
            result.data.warnings[0].directives.includes("x-extract-from"),
            true,
          );
          assertEquals(
            result.data.warnings[0].directives.includes("x-derived-from"),
            true,
          );
        }
      }
    });

    it("should warn when x-template-items is used without x-template", () => {
      const property: SchemaProperty = {
        kind: "object",
        properties: {},
        required: [],
        extensions: {
          "x-template-items": "item_template.json",
          // Missing x-template
        },
      };

      const result = validator.validateProperty(property, "test.template");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.warnings.length, 1);
        assertEquals(result.data.warnings[0].kind, "MissingRequiredDirective");
        if (result.data.warnings[0].kind === "MissingRequiredDirective") {
          assertEquals(result.data.warnings[0].directive, "x-template");
        }
      }
    });

    it("should validate correct template directive combination", () => {
      const property: SchemaProperty = {
        kind: "object",
        properties: {},
        required: [],
        extensions: {
          "x-template": "main_template.json",
          "x-template-items": "item_template.json",
        },
      };

      const result = validator.validateProperty(property, "test.template");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
      }
    });
  });

  describe("Circular Reference Detection", () => {
    it("should detect simple circular reference", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {
          "x-extract-from": "test.property", // References itself
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

    it("should not detect false positives for valid references", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {
          "x-extract-from": "other.property", // Valid reference
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

  describe("Schema-wide Validation", () => {
    it("should validate entire schema structure", () => {
      const schema = {
        kind: "object",
        properties: {
          validProperty: {
            kind: "string",
            extensions: {
              "x-extract-from": "source.data",
            },
          },
          invalidProperty: {
            kind: "array",
            extensions: {
              "x-extract-from": "invalid..path",
            },
          },
        },
      };

      const result = validator.validateSchema(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        assertEquals(result.data.errors[0].kind, "InvalidPath");
      }
    });

    it("should validate nested schema properties", () => {
      const schema = {
        kind: "object",
        properties: {
          parent: {
            kind: "object",
            properties: {
              child: {
                kind: "string",
                extensions: {
                  "x-extract-from": "nested.data",
                },
              },
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

    it("should validate array items schema", () => {
      const schema = {
        kind: "object",
        properties: {
          items: {
            kind: "array",
            items: {
              kind: "object",
              extensions: {
                "x-extract-from": "item.data",
              },
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

  describe("Error Messages and Context", () => {
    it("should provide detailed error context", () => {
      const property: SchemaProperty = {
        kind: "string",
        extensions: {
          "x-extract-from": "",
        },
      };

      const result = validator.validateProperty(property, "test.empty.path");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, false);
        assertEquals(result.data.errors.length, 1);
        const error = result.data.errors[0];
        assertEquals(error.kind, "InvalidPath");
        if (error.kind === "InvalidPath") {
          assertEquals(error.path, "");
          assertEquals(error.reason, "Path cannot be empty");
        }
      }
    });

    it("should handle properties without extensions", () => {
      const property: SchemaProperty = {
        kind: "string",
        // No extensions
      };

      const result = validator.validateProperty(property, "test.simple");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
        assertEquals(result.data.warnings.length, 0);
      }
    });

    it("should handle malformed schema gracefully", () => {
      const invalidSchema = {
        // Missing required properties
        invalidStructure: "not an object",
      };

      const result = validator.validateSchema(invalidSchema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true); // No extensions to validate
        assertEquals(result.data.errors.length, 0);
      }
    });
  });

  describe("Performance with Complex Schemas", () => {
    it("should handle large schemas efficiently", () => {
      const largeSchema = {
        kind: "object",
        properties: {} as Record<string, unknown>,
      };

      // Create 100 properties with various directives
      for (let i = 0; i < 100; i++) {
        (largeSchema.properties as Record<string, unknown>)[`property${i}`] = {
          kind: "string",
          extensions: {
            "x-extract-from": `source.data${i}`,
          },
        };
      }

      const startTime = Date.now();
      const result = validator.validateSchema(largeSchema);
      const duration = Date.now() - startTime;

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
      }
      // Should complete within reasonable time (< 100ms for 100 properties)
      assertEquals(duration < 100, true);
    });
  });
});
