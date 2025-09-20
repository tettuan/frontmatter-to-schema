/**
 * @fileoverview Error Handler Test Suite
 * @description Comprehensive tests for error handling and recovery functionality
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ErrorHandler } from "../../../../src/application/services/error-handler.ts";
import {
  ExtractionErrorContextFactory,
  ExtractionErrorFactory,
} from "../../../../src/domain/errors/extraction-errors.ts";

describe("ErrorHandler", () => {
  describe("Smart Constructor", () => {
    it("should create with default configuration", () => {
      const errorHandler = ErrorHandler.create();
      assertExists(errorHandler);
    });

    it("should create with custom configuration", () => {
      const config = {
        enableRecovery: false,
        debugMode: true,
        verboseLogging: true,
        maxRecoveryAttempts: 5,
        continueOnError: false,
      };
      const errorHandler = ErrorHandler.create(config);
      assertExists(errorHandler);
    });
  });

  describe("Property Extraction Error Handling", () => {
    it("should handle invalid property paths with suggestions", () => {
      const errorHandler = ErrorHandler.create();
      const result = errorHandler.handlePropertyExtraction("id..full", {
        id: { full: "test" },
      });

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "PropertyPathInvalid");
        assertExists(result.error.message);
      }
    });

    it("should handle property not found with available alternatives", () => {
      const errorHandler = ErrorHandler.create();
      const sourceData = {
        id: { full: "123" },
        name: "test",
        tags: ["a", "b"],
      };

      const result = errorHandler.handlePropertyExtraction(
        "missing.property",
        sourceData,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "PropertyNotFound");
        assertExists(result.error.message);
        if (result.error.kind === "PropertyNotFound") {
          assertEquals(result.error.availablePaths.length > 0, true);
        }
      }
    });

    it("should handle type mismatch with conversion attempts", () => {
      const errorHandler = ErrorHandler.create({ enableRecovery: true });
      const sourceData = { count: "123" }; // string instead of number

      const result = errorHandler.handlePropertyExtraction(
        "count",
        sourceData,
        "number",
      );

      // Should succeed with type conversion
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 123);
      }
    });

    it("should extract valid properties successfully", () => {
      const errorHandler = ErrorHandler.create();
      const sourceData = {
        user: {
          profile: {
            name: "John Doe",
            age: 30,
          },
        },
      };

      const result = errorHandler.handlePropertyExtraction(
        "user.profile.name",
        sourceData,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "John Doe");
      }
    });

    it("should handle nested object extraction", () => {
      const errorHandler = ErrorHandler.create();
      const sourceData = {
        metadata: {
          tags: ["tag1", "tag2"],
          created: "2024-01-01",
        },
      };

      const result = errorHandler.handlePropertyExtraction(
        "metadata.tags",
        sourceData,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(Array.isArray(result.data), true);
        assertEquals((result.data as string[]).length, 2);
      }
    });
  });

  describe("Extraction Operation Error Handling", () => {
    it("should handle successful extraction operations", async () => {
      const errorHandler = ErrorHandler.create();

      const operation = async () => {
        await Promise.resolve();
        return ExtractionErrorContextFactory.createSuccessResult("test data");
      };

      const result = await errorHandler.handleExtractionOperation(
        operation,
        "test-operation",
      );

      assertEquals(result.success, true);
      assertEquals(result.data, "test data");
      assertEquals(result.errors.length, 0);
    });

    it("should handle failed extraction with recovery", async () => {
      const errorHandler = ErrorHandler.create({
        enableRecovery: true,
        maxRecoveryAttempts: 2,
      });

      let attemptCount = 0;
      const operation = async () => {
        await Promise.resolve();
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails
          const error = ExtractionErrorFactory.createPropertyNotFound(
            "missing.prop",
            ["available.prop"],
            "test data",
          );
          return ExtractionErrorContextFactory.createErrorResult(
            error,
            ExtractionErrorContextFactory.create("test", "extraction"),
          );
        } else {
          // Second attempt succeeds (simulating recovery)
          return ExtractionErrorContextFactory.createSuccessResult(
            "recovered data",
          );
        }
      };

      const result = await errorHandler.handleExtractionOperation(
        operation,
        "test-operation-with-recovery",
      );

      assertEquals(result.success, true);
      assertEquals(result.data, "recovered data");
      assertEquals(result.recoveryActions.length > 0, true);
    });

    it("should collect errors and warnings from failed operations", async () => {
      const errorHandler = ErrorHandler.create({
        enableRecovery: false,
      });

      const operation = async () => {
        await Promise.resolve();
        const error = ExtractionErrorFactory.createTypeMismatchInExtraction(
          "string",
          "number",
          "test.path",
          123,
        );
        return ExtractionErrorContextFactory.createErrorResult(
          error,
          ExtractionErrorContextFactory.create("test", "extraction"),
        );
      };

      const result = await errorHandler.handleExtractionOperation(
        operation,
        "failing-operation",
      );

      assertEquals(result.success, false);
      assertEquals(result.errors.length, 1);
      assertEquals(result.errors[0].kind, "TypeMismatchInExtraction");
    });

    it("should handle operations with warnings", async () => {
      const errorHandler = ErrorHandler.create();

      const operation = async () => {
        await Promise.resolve();
        const warning = ExtractionErrorFactory.createExtractionRecoverable(
          "test.path",
          "partial data",
          "minor issue",
        );
        return ExtractionErrorContextFactory.createSuccessResult(
          "success data",
          [warning],
        );
      };

      const result = await errorHandler.handleExtractionOperation(
        operation,
        "operation-with-warnings",
      );

      assertEquals(result.success, true);
      assertEquals(result.data, "success data");
      assertEquals(result.warnings.length, 1);
      assertEquals(result.warnings[0].kind, "ExtractionRecoverable");
    });

    it("should handle unexpected exceptions during operation", async () => {
      const errorHandler = ErrorHandler.create();

      const operation = async () => {
        await Promise.resolve();
        throw new Error("Unexpected error during processing");
      };

      const result = await errorHandler.handleExtractionOperation(
        operation,
        "exception-operation",
      );

      assertEquals(result.success, false);
      assertEquals(result.errors.length, 1);
      assertEquals(result.errors[0].kind, "ExtractionRecoverable");
    });
  });

  describe("Recovery Strategies", () => {
    it("should apply default value recovery for missing properties", async () => {
      const errorHandler = ErrorHandler.create({
        enableRecovery: true,
      });

      const operation = async () => {
        await Promise.resolve();
        const error = ExtractionErrorFactory.createPropertyNotFound(
          "missing.prop",
          ["available.prop"],
          "test data",
        );
        return ExtractionErrorContextFactory.createErrorResult(
          error,
          ExtractionErrorContextFactory.create("test", "extraction"),
        );
      };

      const result = await errorHandler.handleExtractionOperation(
        operation,
        "missing-property-operation",
      );

      assertEquals(result.success, true);
      assertEquals(result.data, null); // Default value for missing property
      assertEquals(result.recoveryActions.length, 2); // Retry first, then default value
      assertEquals(result.recoveryActions[0].action.kind, "retry");
      assertEquals(result.recoveryActions[1].action.kind, "defaultValue");
    });

    it("should apply partial result recovery for recoverable errors", async () => {
      const errorHandler = ErrorHandler.create({
        enableRecovery: true,
      });

      const partialData = { partial: "result" };
      const operation = async () => {
        await Promise.resolve();
        const error = ExtractionErrorFactory.createExtractionRecoverable(
          "test.path",
          partialData,
          "processing issue",
        );
        return ExtractionErrorContextFactory.createErrorResult(
          error,
          ExtractionErrorContextFactory.create("test", "extraction"),
          partialData,
        );
      };

      const result = await errorHandler.handleExtractionOperation(
        operation,
        "partial-result-operation",
      );

      assertEquals(result.success, true);
      assertEquals(result.data, partialData);
      assertEquals(result.recoveryActions.length, 1);
      assertEquals(result.recoveryActions[0].action.kind, "partialResult");
    });

    it("should abort on circular dependency errors", async () => {
      const errorHandler = ErrorHandler.create({
        enableRecovery: true,
      });

      const operation = async () => {
        await Promise.resolve();
        const error = ExtractionErrorFactory.createCircularDependency(
          ["path1", "path2", "path3"],
          "path1",
        );
        return ExtractionErrorContextFactory.createErrorResult(
          error,
          ExtractionErrorContextFactory.create("test", "extraction"),
        );
      };

      const result = await errorHandler.handleExtractionOperation(
        operation,
        "circular-dependency-operation",
      );

      assertEquals(result.success, false);
      assertEquals(result.recoveryActions.length, 1);
      assertEquals(result.recoveryActions[0].action.kind, "abort");
    });
  });

  describe("Debug Mode", () => {
    it("should include debug information when debug mode is enabled", async () => {
      const errorHandler = ErrorHandler.create({
        debugMode: true,
      });

      const operation = async () => {
        await Promise.resolve();
        return ExtractionErrorContextFactory.createSuccessResult(
          "debug test data",
        );
      };

      const result = await errorHandler.handleExtractionOperation(
        operation,
        "debug-operation",
      );

      assertEquals(result.success, true);
      assertExists(result.debugInfo);
      assertExists(result.debugInfo?.attemptCount);
      assertExists(result.debugInfo?.context);
    });

    it("should not include debug information when debug mode is disabled", async () => {
      const errorHandler = ErrorHandler.create({
        debugMode: false,
      });

      const operation = async () => {
        await Promise.resolve();
        return ExtractionErrorContextFactory.createSuccessResult(
          "normal test data",
        );
      };

      const result = await errorHandler.handleExtractionOperation(
        operation,
        "normal-operation",
      );

      assertEquals(result.success, true);
      assertEquals(result.debugInfo, undefined);
    });
  });

  describe("Error Message Formatting", () => {
    it("should format property path errors with suggestions", () => {
      const errorHandler = ErrorHandler.create();
      const result = errorHandler.handlePropertyExtraction("id..full", {});

      assertEquals(result.ok, false);
      if (!result.ok) {
        const message = result.error.message;
        assertEquals(message.includes("❌"), true);
        assertEquals(message.includes("Invalid property path"), true);
        assertEquals(message.includes("💡"), true);
      }
    });

    it("should format property not found errors with alternatives", () => {
      const errorHandler = ErrorHandler.create();
      const sourceData = {
        user: { name: "John" },
        posts: ["post1", "post2"],
      };

      const result = errorHandler.handlePropertyExtraction(
        "profile.bio",
        sourceData,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        const message = result.error.message;
        assertEquals(message.includes("❌"), true);
        assertEquals(message.includes("not found"), true);
        assertEquals(message.includes("📋"), true);
        assertEquals(message.includes("Available"), true);
      }
    });

    it("should format type mismatch errors with value information", () => {
      const errorHandler = ErrorHandler.create({ enableRecovery: false });
      const sourceData = { count: "not-a-number" };

      const result = errorHandler.handlePropertyExtraction(
        "count",
        sourceData,
        "number",
      );

      assertEquals(result.ok, false);
      if (!result.ok && result.error.kind === "TypeMismatchInExtraction") {
        const message = result.error.message;
        assertEquals(message.includes("❌"), true);
        assertEquals(message.includes("Type mismatch"), true);
        assertEquals(message.includes("Expected: number"), true);
        assertEquals(message.includes("Got: string"), true);
      }
    });
  });

  describe("Performance and Limits", () => {
    it("should respect maximum recovery attempts", async () => {
      const errorHandler = ErrorHandler.create({
        enableRecovery: true,
        maxRecoveryAttempts: 2,
      });

      let attemptCount = 0;
      const operation = async () => {
        await Promise.resolve();
        attemptCount++;
        const error = ExtractionErrorFactory.createPropertyNotFound(
          "always.missing",
          [],
          "test data",
        );
        return ExtractionErrorContextFactory.createErrorResult(
          error,
          ExtractionErrorContextFactory.create("test", "extraction"),
        );
      };

      const result = await errorHandler.handleExtractionOperation(
        operation,
        "max-attempts-operation",
      );

      assertEquals(result.success, true); // Should succeed with default value recovery
      assertEquals(attemptCount, 2); // Should attempt twice (original + retry), then apply recovery
      assertEquals(result.recoveryActions.length, 2); // Retry first, then default value
    });
  });
});
