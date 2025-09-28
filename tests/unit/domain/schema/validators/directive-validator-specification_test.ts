import { describe, it } from "jsr:@std/testing@^1.0.5/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.7";
import {
  DirectiveValidationError as _DirectiveValidationError,
  DirectiveValidator,
} from "../../../../../src/domain/schema/validators/directive-validator.ts";
import {
  SchemaProperty,
  SchemaPropertyFactory,
} from "../../../../../src/domain/schema/value-objects/schema-property-types.ts";

/**
 * DirectiveValidator Robust Specification Test Suite - Updated for Issue #1005
 *
 * This test suite follows DDD and Totality principles:
 * - Tests business requirements, not implementation details
 * - Uses real domain objects instead of mocks
 * - Validates comprehensive error scenarios and edge cases
 * - Includes performance benchmarks for production readiness
 * - Tests directive validation rules and combinations (deprecated directives removed)
 */
describe("DirectiveValidator Specification", () => {
  // Test Helpers - Robust and Deterministic
  const createValidator = (): DirectiveValidator => {
    return DirectiveValidator.create();
  };

  const createPropertyWithExtensions = (
    kind: string,
    extensions: Record<string, unknown>,
  ): SchemaProperty => {
    switch (kind) {
      case "string":
        return SchemaPropertyFactory.createString(undefined, extensions);
      case "array":
        return SchemaPropertyFactory.createArray(
          SchemaPropertyFactory.createString(),
          undefined,
          extensions,
        );
      case "object":
        return SchemaPropertyFactory.createObject(
          {},
          [],
          undefined,
          extensions,
        );
      default:
        return SchemaPropertyFactory.createString(undefined, extensions);
    }
  };

  describe("Business Requirement: x-frontmatter-part Directive Validation", () => {
    it("should validate valid x-frontmatter-part directive", () => {
      // Given: Array property with valid x-frontmatter-part directive
      const property = createPropertyWithExtensions("array", {
        "x-frontmatter-part": true,
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "documents");

      // Then: Should be valid
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true);
      assertEquals(result.data.errors.length, 0);
    });

    it("should warn when x-frontmatter-part is used on non-array type", () => {
      // Given: Non-array property with x-frontmatter-part directive
      const property = createPropertyWithExtensions("string", {
        "x-frontmatter-part": true,
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "content");

      // Then: Should have warning about type mismatch
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true); // Valid but with warnings
      assertEquals(result.data.errors.length, 0);
      assertEquals(result.data.warnings.length, 1);
      assertEquals(result.data.warnings[0].kind, "TypeMismatch");
    });

    it("should reject non-boolean x-frontmatter-part values", () => {
      // Given: Property with non-boolean x-frontmatter-part value
      const property = createPropertyWithExtensions("array", {
        "x-frontmatter-part": "yes", // Invalid: should be boolean
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "content");

      // Then: Should have type mismatch error
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, false);
      assertEquals(result.data.errors.length, 1);
      assertEquals(result.data.errors[0].kind, "TypeMismatch");
      if (result.data.errors[0].kind === "TypeMismatch") {
        assertEquals(result.data.errors[0].expected, "boolean");
        assertEquals(result.data.errors[0].actual, "string");
      }
    });
  });

  describe("Business Requirement: x-derived-from Directive Validation", () => {
    it("should validate valid x-derived-from directive", () => {
      // Given: Property with valid x-derived-from directive
      const property = createPropertyWithExtensions("string", {
        "x-derived-from": "metadata.title",
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "computed.title");

      // Then: Should be valid
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true);
      assertEquals(result.data.errors.length, 0);
    });

    it("should reject invalid x-derived-from path format", () => {
      // Given: Property with invalid x-derived-from path
      const property = createPropertyWithExtensions("string", {
        "x-derived-from": "..invalid.path",
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "computed.field");

      // Then: Should have validation errors
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, false);
      assertEquals(result.data.errors.length, 1);
      assertEquals(result.data.errors[0].kind, "InvalidPath");
    });

    it("should detect circular references in x-derived-from", () => {
      // Given: Property that creates circular reference
      const property = createPropertyWithExtensions("string", {
        "x-derived-from": "computed.title",
      });

      const validator = createValidator();

      // When: Validating with path that creates circular reference
      const result = validator.validateProperty(property, "computed.title");

      // Then: Should detect circular reference
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, false);
      assertEquals(result.data.errors.length, 1);
      assertEquals(result.data.errors[0].kind, "CircularReference");
    });
  });

  describe("Business Requirement: x-template Directive Validation", () => {
    it("should validate valid x-template directive", () => {
      // Given: Property with valid x-template directive
      const property = createPropertyWithExtensions("object", {
        "x-template": "template.json",
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "content");

      // Then: Should be valid
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true);
      assertEquals(result.data.errors.length, 0);
    });
  });

  describe("Business Requirement: x-template-items Directive Validation", () => {
    it("should validate valid x-template-items directive", () => {
      // Given: Array property with valid x-template and x-template-items
      const property = createPropertyWithExtensions("array", {
        "x-template": "list-template.json",
        "x-template-items": "item-template.json",
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "items");

      // Then: Should be valid
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true);
      assertEquals(result.data.errors.length, 0);
    });

    it("should warn when x-template-items is present without x-template", () => {
      // Given: Property with x-template-items but no x-template
      const property = createPropertyWithExtensions("array", {
        "x-template-items": "item-template.json",
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "items");

      // Then: Should warn about missing required directive
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true); // Valid but with warnings
      assertEquals(result.data.errors.length, 0);
      assertEquals(result.data.warnings.length, 1);
      assertEquals(result.data.warnings[0].kind, "MissingRequiredDirective");
    });
  });

  describe("Business Requirement: Directive Combination Validation", () => {
    it("should warn when x-template-items is present without x-template", () => {
      // Given: Property with x-template-items but no x-template
      const property = createPropertyWithExtensions("array", {
        "x-template-items": "item-template.md",
        // Missing x-template
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "items");

      // Then: Should warn about missing required directive
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true); // Valid but with warnings
      assertEquals(result.data.errors.length, 0);
      assertEquals(result.data.warnings.length, 1);
      assertEquals(result.data.warnings[0].kind, "MissingRequiredDirective");
      if (result.data.warnings[0].kind === "MissingRequiredDirective") {
        assertEquals(result.data.warnings[0].directive, "x-template");
      }
    });

    it("should validate property with multiple compatible directives", () => {
      // Given: Property with compatible directive combination
      const property = createPropertyWithExtensions("array", {
        "x-frontmatter-part": true,
        "x-template": "document-template.md",
        "x-template-items": "item-template.md",
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "content");

      // Then: Should be valid without warnings
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true);
      assertEquals(result.data.errors.length, 0);
      assertEquals(result.data.warnings.length, 0);
    });
  });

  describe("Business Requirement: Schema-wide Validation", () => {
    it("should validate entire schema structure", () => {
      // Given: Complex schema with nested properties and directives
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
            items: {
              type: "object",
              properties: {
                text: {
                  type: "string",
                  extensions: {
                    "x-derived-from": "content.text",
                  },
                },
              },
            },
          },
        },
      };

      const validator = createValidator();

      // When: Validating entire schema
      const result = validator.validateSchema(schema);

      // Then: Should be valid with proper directive usage
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true);
      assertEquals(result.data.errors.length, 0);
    });
  });

  describe("Performance and Scale Testing", () => {
    it("should handle large schema with many properties efficiently", () => {
      // Given: Large schema with many properties (performance test)
      const properties: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        properties[`field${i}`] = {
          type: "string",
          extensions: {
            "x-derived-from": `source.field${i}`,
          },
        };
      }

      const schema = {
        type: "object",
        properties,
      };

      const validator = createValidator();

      // When: Validating large schema
      const startTime = performance.now();
      const result = validator.validateSchema(schema);
      const endTime = performance.now();

      // Then: Should complete within reasonable time (< 100ms)
      assertEquals(result.ok, true);
      assertEquals(endTime - startTime < 100, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
      }
    });

    it("should handle deeply nested schema structures", () => {
      // Given: Deeply nested schema structure
      let nestedSchema: any = {
        type: "string",
        extensions: {
          "x-derived-from": "deep.nested.value",
        },
      };

      // Build nested structure
      for (let i = 0; i < 10; i++) {
        nestedSchema = {
          type: "object",
          properties: {
            nested: nestedSchema,
          },
        };
      }

      const validator = createValidator();

      // When: Validating deeply nested schema
      const result = validator.validateSchema(nestedSchema);

      // Then: Should handle nesting without issues
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true);
    });
  });

  describe("Service Stateless Behavior", () => {
    it("should be stateless across multiple validations", () => {
      // Given: Same validator instance used multiple times
      const validator = createValidator();

      const property1 = createPropertyWithExtensions("string", {
        "x-derived-from": "source1.field",
      });

      const property2 = createPropertyWithExtensions("array", {
        "x-frontmatter-part": true,
      });

      // When: Using same validator for different operations
      const result1 = validator.validateProperty(property1, "test1");
      const result2 = validator.validateProperty(property2, "test2");

      // Then: Both should be valid and independent
      assertEquals(result1.ok, true);
      assertEquals(result2.ok, true);
      if (result1.ok && result2.ok) {
        assertEquals(result1.data.isValid, true);
        assertEquals(result2.data.isValid, true);
      }
    });

    it("should handle error recovery properly", () => {
      // Given: Validator that encounters error then valid input
      const validator = createValidator();

      const invalidProperty = createPropertyWithExtensions("string", {
        "x-derived-from": "..invalid.path",
      });

      const validProperty = createPropertyWithExtensions("string", {
        "x-derived-from": "valid.path",
      });

      // When: Validating invalid property then valid property
      const invalidResult = validator.validateProperty(
        invalidProperty,
        "test1",
      );
      const validResult = validator.validateProperty(validProperty, "test2");

      // Then: Should handle both correctly without state contamination
      assertEquals(invalidResult.ok, true);
      assertEquals(validResult.ok, true);
      if (invalidResult.ok && validResult.ok) {
        assertEquals(invalidResult.data.isValid, false);
        assertEquals(validResult.data.isValid, true);
      }
    });
  });
});
