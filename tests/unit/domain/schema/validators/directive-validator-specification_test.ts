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
 * DirectiveValidator Robust Specification Test Suite
 *
 * This test suite follows DDD and Totality principles:
 * - Tests business requirements, not implementation details
 * - Uses real domain objects instead of mocks
 * - Validates comprehensive error scenarios and edge cases
 * - Includes performance benchmarks for production readiness
 * - Tests directive validation rules and combinations
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

  describe("Business Requirement: x-extract-from Directive Validation", () => {
    it("should validate valid x-extract-from directive", () => {
      // Given: Property with valid x-extract-from directive
      const property = createPropertyWithExtensions("string", {
        "x-extract-from": "metadata.author",
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "target.field");

      // Then: Should be valid
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true);
      assertEquals(result.data.errors.length, 0);
    });

    it("should reject invalid x-extract-from path format", () => {
      // Given: Property with invalid x-extract-from path
      const property = createPropertyWithExtensions("string", {
        "x-extract-from": "..invalid.path", // Invalid: starts with dots
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "target.field");

      // Then: Should have validation errors
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, false);
      assertEquals(result.data.errors.length, 1);
      assertEquals(result.data.errors[0].kind, "InvalidPath");
      if (result.data.errors[0].kind === "InvalidPath") {
        assertEquals(result.data.errors[0].path, "..invalid.path");
      }
    });

    it("should reject non-string x-extract-from values", () => {
      // Given: Property with non-string x-extract-from value
      const property = createPropertyWithExtensions("string", {
        "x-extract-from": 123, // Invalid: should be string
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "target.field");

      // Then: Should have type mismatch error
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, false);
      assertEquals(result.data.errors.length, 1);
      assertEquals(result.data.errors[0].kind, "TypeMismatch");
      if (result.data.errors[0].kind === "TypeMismatch") {
        assertEquals(result.data.errors[0].expected, "string");
        assertEquals(result.data.errors[0].actual, "number");
      }
    });

    it("should detect circular references in x-extract-from", () => {
      // Given: Property that creates circular reference
      const property = createPropertyWithExtensions("string", {
        "x-extract-from": "metadata.title", // Will create circular ref
      });

      const validator = createValidator();

      // When: Validating with path that creates circular reference
      const result = validator.validateProperty(property, "metadata");

      // Then: Should detect circular reference
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, false);
      assertEquals(result.data.errors.length, 1);
      assertEquals(result.data.errors[0].kind, "CircularReference");
      if (result.data.errors[0].kind === "CircularReference") {
        assertEquals(result.data.errors[0].path, "metadata");
      }
    });
  });

  describe("Business Requirement: x-frontmatter-part Directive Validation", () => {
    it("should validate valid x-frontmatter-part directive", () => {
      // Given: Array property with valid x-frontmatter-part directive
      const property = createPropertyWithExtensions("array", {
        "x-frontmatter-part": true,
        "x-extract-from": "items[].content",
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

    it("should warn when x-frontmatter-part is true without x-extract-from", () => {
      // Given: Array property with x-frontmatter-part but no x-extract-from
      const property = createPropertyWithExtensions("array", {
        "x-frontmatter-part": true,
        // Missing x-extract-from
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "documents");

      // Then: Should warn about missing required directive
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true); // Valid but with warnings
      assertEquals(result.data.errors.length, 0);
      assertEquals(result.data.warnings.length, 1);
      assertEquals(result.data.warnings[0].kind, "MissingRequiredDirective");
      if (result.data.warnings[0].kind === "MissingRequiredDirective") {
        assertEquals(result.data.warnings[0].directive, "x-extract-from");
      }
    });

    it("should reject non-boolean x-frontmatter-part values", () => {
      // Given: Property with non-boolean x-frontmatter-part value
      const property = createPropertyWithExtensions("array", {
        "x-frontmatter-part": "yes", // Invalid: should be boolean
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "documents");

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
        "x-derived-from": "source.title",
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "derived.field");

      // Then: Should be valid
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true);
      assertEquals(result.data.errors.length, 0);
    });

    it("should reject invalid x-derived-from path format", () => {
      // Given: Property with invalid x-derived-from path
      const property = createPropertyWithExtensions("string", {
        "x-derived-from": "invalid..path", // Invalid: consecutive dots
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "derived.field");

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
        "x-derived-from": "config.setting",
      });

      const validator = createValidator();

      // When: Validating with path that creates circular reference
      const result = validator.validateProperty(property, "config");

      // Then: Should detect circular reference
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, false);
      assertEquals(result.data.errors.length, 1);
      assertEquals(result.data.errors[0].kind, "CircularReference");
    });
  });

  describe("Business Requirement: Directive Combination Validation", () => {
    it("should warn when both x-extract-from and x-derived-from are present", () => {
      // Given: Property with conflicting directives
      const property = createPropertyWithExtensions("string", {
        "x-extract-from": "source.field",
        "x-derived-from": "derived.field",
      });

      const validator = createValidator();

      // When: Validating the property
      const result = validator.validateProperty(property, "target.field");

      // Then: Should warn about conflicting directives
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true); // Valid but with warnings
      assertEquals(result.data.errors.length, 0);
      assertEquals(result.data.warnings.length, 1);
      assertEquals(result.data.warnings[0].kind, "ConflictingDirectives");
      if (result.data.warnings[0].kind === "ConflictingDirectives") {
        assertEquals(result.data.warnings[0].directives.length, 2);
        assertEquals(
          result.data.warnings[0].directives.includes("x-extract-from"),
          true,
        );
        assertEquals(
          result.data.warnings[0].directives.includes("x-derived-from"),
          true,
        );
      }
    });

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
        "x-extract-from": "documents[].content",
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

  describe("Business Requirement: Path Format Validation", () => {
    it("should validate correct path formats", () => {
      // Given: Properties with various valid path formats
      const testCases = [
        "simple",
        "nested.path",
        "deep.nested.path",
        "array[]",
        "nested.array[]",
        "array[].property",
        "deep.array[].nested.property",
      ];

      const validator = createValidator();

      for (const path of testCases) {
        // When: Validating property with each path format
        const property = createPropertyWithExtensions("string", {
          "x-extract-from": path,
        });

        const result = validator.validateProperty(property, "test.field");

        // Then: Should be valid
        assertExists(result.ok);
        if (!result.ok) continue;

        assertEquals(
          result.data.isValid,
          true,
          `Path "${path}" should be valid`,
        );
      }
    });

    it("should reject invalid path formats", () => {
      // Given: Properties with various invalid path formats
      const testCases = [
        "", // Empty path
        ".", // Single dot
        ".path", // Starts with dot
        "path.", // Ends with dot
        "path..nested", // Double dots
        "path with space", // Contains space
      ];

      const validator = createValidator();

      for (const path of testCases) {
        // When: Validating property with each invalid path format
        const property = createPropertyWithExtensions("string", {
          "x-extract-from": path,
        });

        const result = validator.validateProperty(property, "test.field");

        // Then: Should have validation errors
        assertExists(result.ok);
        if (!result.ok) continue;

        assertEquals(
          result.data.isValid,
          false,
          `Path "${path}" should be invalid`,
        );
        assertEquals(
          result.data.errors.length > 0,
          true,
          `Path "${path}" should have errors`,
        );
        assertEquals(result.data.errors[0].kind, "InvalidPath");
      }
    });
  });

  describe("Business Requirement: Schema-wide Validation", () => {
    it("should validate entire schema structure", () => {
      // Given: Complex schema with nested properties and directives
      const schema = {
        type: "object",
        properties: {
          title: {
            type: "string",
            extensions: {
              "x-derived-from": "metadata.title",
            },
          },
          content: {
            type: "array",
            extensions: {
              "x-frontmatter-part": true,
              "x-extract-from": "documents[].content",
            },
            items: {
              type: "object",
              properties: {
                text: {
                  type: "string",
                  extensions: {
                    "x-extract-from": "raw.text",
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

      // Then: Should validate all nested properties
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true);
      assertEquals(result.data.errors.length, 0);
    });

    it("should detect multiple validation issues across schema", () => {
      // Given: Schema with multiple validation issues
      const schema = {
        type: "object",
        properties: {
          invalid1: {
            type: "string",
            extensions: {
              "x-extract-from": "..invalid.path", // Invalid path
            },
          },
          invalid2: {
            type: "string",
            extensions: {
              "x-frontmatter-part": "not-boolean", // Wrong type
            },
          },
          conflicting: {
            type: "string",
            extensions: {
              "x-extract-from": "source1",
              "x-derived-from": "source2", // Conflicting directives
            },
          },
        },
      };

      const validator = createValidator();

      // When: Validating problematic schema
      const result = validator.validateSchema(schema);

      // Then: Should collect all validation issues
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, false);
      assertEquals(result.data.errors.length >= 2, true); // At least invalid path and wrong type
      assertEquals(result.data.warnings.length >= 1, true); // At least conflicting directives
    });
  });

  describe("Performance and Scale Testing", () => {
    it("should handle large schemas efficiently", () => {
      // Given: Large schema with many properties
      const properties: Record<string, any> = {};

      // Create 100 properties with directives for performance testing
      for (let i = 0; i < 100; i++) {
        properties[`field${i}`] = {
          type: "string",
          extensions: {
            "x-extract-from": `source.field${i}`,
          },
        };
      }

      const schema = {
        type: "object",
        properties,
      };

      const validator = createValidator();

      // When: Validating large schema with performance measurement
      const startTime = performance.now();
      const result = validator.validateSchema(schema);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Then: Should complete efficiently
      assertExists(result.ok);
      if (!result.ok) return;

      assertEquals(result.data.isValid, true);

      // Performance benchmark: Should complete within 100ms for 100 properties
      assertEquals(
        duration < 100,
        true,
        `DirectiveValidator took ${duration}ms for 100 properties, expected <100ms`,
      );
    });

    it("should handle deeply nested schemas efficiently", () => {
      // Given: Deeply nested schema (10 levels)
      let nestedSchema: any = {
        type: "string",
        extensions: {
          "x-extract-from": "deep.nested.value",
        },
      };

      // Build 10-level nesting
      for (let i = 0; i < 10; i++) {
        nestedSchema = {
          type: "object",
          properties: {
            [`level${i}`]: nestedSchema,
          },
          extensions: {
            "x-derived-from": `level${i}.source`,
          },
        };
      }

      const validator = createValidator();

      // When: Validating deeply nested schema
      const startTime = performance.now();
      const result = validator.validateSchema(nestedSchema);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Then: Should handle deep nesting efficiently
      assertExists(result.ok);
      if (!result.ok) return;

      // Performance benchmark: Should complete within 50ms for 10-level nesting
      assertEquals(
        duration < 50,
        true,
        `DirectiveValidator took ${duration}ms for 10-level nesting, expected <50ms`,
      );
    });
  });

  describe("Service Stateless Behavior", () => {
    it("should be stateless across multiple validation operations", () => {
      // Given: Same validator instance used for multiple operations
      const validator = createValidator();

      const property1 = createPropertyWithExtensions("string", {
        "x-extract-from": "source1.field",
      });

      const property2 = createPropertyWithExtensions("array", {
        "x-frontmatter-part": true,
        "x-extract-from": "source2.items[]",
      });

      // When: Using same validator for different operations
      const result1 = validator.validateProperty(property1, "target1");
      const result2 = validator.validateProperty(property2, "target2");

      // Then: Both operations should succeed independently
      assertExists(result1.ok);
      assertExists(result2.ok);
      if (!result1.ok || !result2.ok) return;

      assertEquals(result1.data.isValid, true);
      assertEquals(result2.data.isValid, true);
    });

    it("should handle validation errors without affecting subsequent operations", () => {
      // Given: Validator and properties with different validation outcomes
      const validator = createValidator();

      const invalidProperty = createPropertyWithExtensions("string", {
        "x-extract-from": "..invalid.path",
      });

      const validProperty = createPropertyWithExtensions("string", {
        "x-extract-from": "valid.path",
      });

      // When: Validating invalid property then valid property
      const invalidResult = validator.validateProperty(
        invalidProperty,
        "test1",
      );
      const validResult = validator.validateProperty(validProperty, "test2");

      // Then: Results should be independent
      assertExists(invalidResult.ok);
      assertExists(validResult.ok);
      if (!invalidResult.ok || !validResult.ok) return;

      assertEquals(invalidResult.data.isValid, false);
      assertEquals(validResult.data.isValid, true);
    });
  });
});
