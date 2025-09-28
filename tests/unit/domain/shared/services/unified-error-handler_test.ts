/**
 * @fileoverview Tests for Unified Error Handler
 * @description Validates DDD & Totality-based error management system
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  ErrorHandler,
  UnifiedErrorHandler,
} from "../../../../../src/domain/shared/services/unified-error-handler.ts";

describe("UnifiedErrorHandler", () => {
  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = UnifiedErrorHandler.getInstance();
      const instance2 = UnifiedErrorHandler.getInstance();
      assertEquals(instance1, instance2);
    });

    it("should provide the same instance through ErrorHandler export", () => {
      const instance = UnifiedErrorHandler.getInstance();
      assertEquals(ErrorHandler, instance);
    });
  });

  describe("Domain-Specific Error Builders", () => {
    describe("Schema Errors", () => {
      it("should create schema not found error with correct kind", () => {
        const result = ErrorHandler.schema().notFound("/path/to/schema.json");

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "SchemaNotFound");
          assertExists(result.error.message);
        }
      });

      it("should create invalid schema error with custom message", () => {
        const result = ErrorHandler.schema().invalid(
          "Schema validation failed",
        );

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidSchema");
          assertExists(result.error.message);
        }
      });

      it("should create template not defined error", () => {
        const result = ErrorHandler.schema().templateNotDefined();

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "TemplateNotDefined");
          assertExists(result.error.message);
        }
      });
    });

    describe("Validation Errors", () => {
      it("should create empty input error", () => {
        const result = ErrorHandler.validation().emptyInput();

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "EmptyInput");
          assertExists(result.error.message);
        }
      });

      it("should create out of range error", () => {
        const result = ErrorHandler.validation().outOfRange(150, 0, 100);

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "OutOfRange");
          assertExists(result.error.message);
        }
      });

      it("should create invalid regex error", () => {
        const result = ErrorHandler.validation().invalidRegex("[invalid");

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidRegex");
          assertExists(result.error.message);
        }
      });
    });

    describe("Frontmatter Errors", () => {
      it("should create no frontmatter error", () => {
        const result = ErrorHandler.frontmatter().noFrontmatter();

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "NoFrontmatter");
          assertExists(result.error.message);
        }
      });

      it("should create extraction failed error", () => {
        const result = ErrorHandler.frontmatter().extractionFailed(
          "YAML parsing failed",
        );

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "ExtractionFailed");
          assertExists(result.error.message);
        }
      });
    });

    describe("Template Errors", () => {
      it("should create template not found error", () => {
        const result = ErrorHandler.template().notFound(
          "/templates/output.json",
        );

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "TemplateNotFound");
          assertExists(result.error.message);
        }
      });

      it("should create variable not found error", () => {
        const result = ErrorHandler.template().variableNotFound("userName");

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "VariableNotFound");
          assertExists(result.error.message);
        }
      });
    });

    describe("FileSystem Errors", () => {
      it("should create file not found error", () => {
        const result = ErrorHandler.filesystem().fileNotFound(
          "/missing/file.txt",
        );

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "FileNotFound");
          assertExists(result.error.message);
        }
      });

      it("should create permission denied error", () => {
        const result = ErrorHandler.filesystem().permissionDenied(
          "/protected/file.txt",
        );

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "PermissionDenied");
          assertExists(result.error.message);
        }
      });
    });

    describe("System Errors", () => {
      it("should create configuration error", () => {
        const result = ErrorHandler.system().configurationError(
          "Invalid config format",
        );

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "ConfigurationError");
          assertExists(result.error.message);
        }
      });

      it("should create initialization error", () => {
        const result = ErrorHandler.system().initializationError(
          "Service failed to start",
        );

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InitializationError");
          assertExists(result.error.message);
        }
      });
    });
  });

  describe("Result Type Integration", () => {
    it("should follow Totality principles with Result types", () => {
      const schemaResult = ErrorHandler.schema().notFound("/test.json");
      const validationResult = ErrorHandler.validation().emptyInput();
      const templateResult = ErrorHandler.template().notFound("/template.json");

      // All results should be errors (Result<never, Error>)
      assertEquals(schemaResult.ok, false);
      assertEquals(validationResult.ok, false);
      assertEquals(templateResult.ok, false);

      // Verify discriminated union types work correctly
      if (!schemaResult.ok) {
        assertEquals(schemaResult.error.kind, "SchemaNotFound");
      }
      if (!validationResult.ok) {
        assertEquals(validationResult.error.kind, "EmptyInput");
      }
      if (!templateResult.ok) {
        assertEquals(templateResult.error.kind, "TemplateNotFound");
      }
    });
  });

  describe("Domain Boundary Compliance", () => {
    it("should provide builders for all domain contexts", () => {
      // Verify all domain builders are available
      assertExists(ErrorHandler.schema);
      assertExists(ErrorHandler.validation);
      assertExists(ErrorHandler.frontmatter);
      assertExists(ErrorHandler.template);
      assertExists(ErrorHandler.aggregation);
      assertExists(ErrorHandler.filesystem);
      assertExists(ErrorHandler.system);
      assertExists(ErrorHandler.performance);
    });

    it("should create domain-specific error types", () => {
      const schemaError = ErrorHandler.schema().notFound("/test");
      const validationError = ErrorHandler.validation().emptyInput();
      const frontmatterError = ErrorHandler.frontmatter().noFrontmatter();

      assertEquals(schemaError.ok, false);
      assertEquals(validationError.ok, false);
      assertEquals(frontmatterError.ok, false);

      // Each should have the correct domain-specific kind
      if (!schemaError.ok) {
        assertEquals(schemaError.error.kind, "SchemaNotFound");
      }
      if (!validationError.ok) {
        assertEquals(validationError.error.kind, "EmptyInput");
      }
      if (!frontmatterError.ok) {
        assertEquals(frontmatterError.error.kind, "NoFrontmatter");
      }
    });
  });

  describe("Context Integration", () => {
    it("should work with custom context", () => {
      const result = ErrorHandler.schema({
        operation: "schema validation",
        method: "validateSchema",
      }).notFound("/path/to/schema.json");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "SchemaNotFound");
        assertExists(result.error.message);
      }
    });

    it("should work without context", () => {
      const result = ErrorHandler.schema().invalid("Schema is malformed");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertExists(result.error.message);
      }
    });
  });
});
