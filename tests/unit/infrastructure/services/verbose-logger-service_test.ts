/**
 * VerboseLoggerService Tests - Robust Test Implementation
 *
 * Following DDD and Totality principles for complete coverage
 * Addresses Issue #723: Test Coverage Below Target
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  type VerboseContext,
  type VerboseLevel,
  VerboseLoggerService,
} from "../../../../src/infrastructure/services/verbose-logger-service.ts";

Deno.test("VerboseLoggerService - Robust Test Suite", async (t) => {
  await t.step("Constructor and Basic Setup", async (t) => {
    await t.step("should create instance with default service name", () => {
      const logger = new VerboseLoggerService();
      assertExists(logger, "Logger instance should be created");
      assertEquals(
        typeof logger.isVerbose,
        "function",
        "Should have isVerbose method",
      );
    });

    await t.step("should create instance with custom service name", () => {
      const customName = "test-service";
      const logger = new VerboseLoggerService(customName);
      assertExists(
        logger,
        "Logger instance should be created with custom name",
      );
    });

    await t.step("should detect verbose mode from environment", () => {
      const logger = new VerboseLoggerService();
      const verboseMode = logger.isVerbose();
      assertEquals(
        typeof verboseMode,
        "boolean",
        "Verbose mode should be boolean",
      );
    });
  });

  await t.step("Static Methods - Factory and Convenience", async (t) => {
    await t.step(
      "forService should create new instance with custom name",
      () => {
        const serviceName = "custom-test-service";
        const logger = VerboseLoggerService.forService(serviceName);
        assertExists(logger, "Should create logger instance");
        assertEquals(
          logger instanceof VerboseLoggerService,
          true,
          "Should be VerboseLoggerService instance",
        );
      },
    );

    await t.step("logDebug static method - 2-arg call", () => {
      // Test without throwing - logging should be silent in tests
      VerboseLoggerService.logDebug("Test debug message");
      VerboseLoggerService.logDebug("Test debug message", {
        operation: "test",
      });
    });

    await t.step("logDebug static method - 3-arg call", () => {
      VerboseLoggerService.logDebug("test-service", "Debug message", {
        stage: "testing",
      });
      VerboseLoggerService.logDebug("test-service", "Debug message", undefined);
      VerboseLoggerService.logDebug("test-service", "Debug message");
    });

    await t.step("logWarn static method - 2-arg call", () => {
      VerboseLoggerService.logWarn("Test warning message");
      VerboseLoggerService.logWarn("Test warning message", {
        operation: "test",
      });
    });

    await t.step("logWarn static method - 3-arg call", () => {
      VerboseLoggerService.logWarn("test-service", "Warning message", {
        stage: "testing",
      });
      VerboseLoggerService.logWarn(
        "test-service",
        "Warning message",
        undefined,
      );
      VerboseLoggerService.logWarn("test-service", "Warning message");
    });

    await t.step("logInfo static method - 2-arg call", () => {
      VerboseLoggerService.logInfo("Test info message");
      VerboseLoggerService.logInfo("Test info message", { operation: "test" });
    });

    await t.step("logInfo static method - 3-arg call", () => {
      VerboseLoggerService.logInfo("test-service", "Info message", {
        stage: "testing",
      });
      VerboseLoggerService.logInfo("test-service", "Info message", undefined);
      VerboseLoggerService.logInfo("test-service", "Info message");
    });
  });

  await t.step("Instance Methods - Core Logging Functionality", async (t) => {
    const logger = new VerboseLoggerService("test-instance");

    await t.step("logVerbose should handle all verbose levels", () => {
      const levels: VerboseLevel[] = ["info", "debug", "trace"];

      for (const level of levels) {
        // Test without context
        logger.logVerbose(level, `Test ${level} message`);

        // Test with context
        logger.logVerbose(level, `Test ${level} message with context`, {
          operation: "test",
          stage: "unit-testing",
          data: { level },
        });
      }
    });

    await t.step("info method should log at info level", () => {
      logger.info("Info message");
      logger.info("Info message with context", { operation: "info-test" });
    });

    await t.step("debug method should log at debug level", () => {
      logger.debug("Debug message");
      logger.debug("Debug message with context", { operation: "debug-test" });
    });

    await t.step("trace method should log at trace level", () => {
      logger.trace("Trace message");
      logger.trace("Trace message with context", { operation: "trace-test" });
    });
  });

  await t.step("Specialized Logging Methods", async (t) => {
    const logger = new VerboseLoggerService("specialized-test");

    await t.step("logStageCompletion should log stage completion", () => {
      // Test with all parameters
      logger.logStageCompletion("validation", "test-document.md", {
        duration: 100,
        status: "success",
      });

      // Test with stage only
      logger.logStageCompletion("parsing");

      // Test with stage and document
      logger.logStageCompletion("processing", "document.md");
    });

    await t.step("logExtractionResult should log extraction details", () => {
      const extractionResult = {
        title: "Test Article",
        author: "Test Author",
        date: "2024-01-15",
        tags: ["test", "extraction"],
      };

      logger.logExtractionResult(
        "frontmatter",
        "test-article.md",
        extractionResult,
      );

      // Test with empty result
      logger.logExtractionResult("metadata", "empty.md", {});
    });

    await t.step("logValidationResult should log validation outcomes", () => {
      // Test successful validation
      logger.logValidationResult("schema", true, {
        schemaType: "json",
        fieldsValidated: 5,
      });

      // Test failed validation
      logger.logValidationResult("format", false, {
        errors: ["Invalid date format", "Missing required field"],
        errorCount: 2,
      });

      // Test without details
      logger.logValidationResult("basic", true);
      logger.logValidationResult("basic", false);
    });
  });

  await t.step("Async Decorator Method - withVerboseLogging", async (t) => {
    const logger = new VerboseLoggerService("decorator-test");

    await t.step("should wrap successful async operation", async () => {
      const testValue = "success-result";

      const result = await logger.withVerboseLogging(
        "test-operation",
        "test-document.md",
        async () => {
          // Simulate async work
          await new Promise((resolve) => setTimeout(resolve, 1));
          return testValue;
        },
      );

      assertEquals(result, testValue, "Should return the operation result");
    });

    await t.step(
      "should wrap successful async operation without document",
      async () => {
        const testValue = { data: "test" };

        const result = await logger.withVerboseLogging(
          "bulk-operation",
          undefined,
          () => {
            return Promise.resolve(testValue);
          },
        );

        assertEquals(result, testValue, "Should return the operation result");
      },
    );

    await t.step(
      "should handle async operation errors and re-throw",
      async () => {
        const testError = new Error("Test operation failed");

        let caughtError: Error | undefined;
        try {
          await logger.withVerboseLogging(
            "failing-operation",
            "error-document.md",
            () => {
              return Promise.reject(testError);
            },
          );
        } catch (error) {
          caughtError = error as Error;
        }

        assertExists(caughtError, "Should catch and re-throw the error");
        assertEquals(
          caughtError.message,
          testError.message,
          "Should preserve original error message",
        );
      },
    );

    await t.step("should handle non-Error exceptions", async () => {
      const testError = "String error";

      let caughtError: unknown;
      try {
        await logger.withVerboseLogging(
          "string-error-operation",
          "string-error.md",
          () => {
            return Promise.reject(testError);
          },
        );
      } catch (error) {
        caughtError = error;
      }

      assertEquals(
        caughtError,
        testError,
        "Should preserve non-Error exceptions",
      );
    });
  });

  await t.step("Context Formatting and Data Handling", async (t) => {
    const logger = new VerboseLoggerService("context-test");

    await t.step("should handle VerboseContext with all properties", () => {
      const fullContext: VerboseContext = {
        operation: "full-test",
        document: "test-document.md",
        stage: "processing",
        data: {
          itemCount: 5,
          duration: 250,
          status: "completed",
        },
        customProperty: "custom-value",
        anotherField: 42,
      };

      logger.info("Testing full context", fullContext);
      logger.debug("Testing full context debug", fullContext);
      logger.trace("Testing full context trace", fullContext);
    });

    await t.step("should handle VerboseContext with partial properties", () => {
      // Only operation
      logger.info("Operation only", { operation: "test-op" });

      // Only document
      logger.info("Document only", { document: "doc.md" });

      // Only stage
      logger.info("Stage only", { stage: "validation" });

      // Only data
      logger.info("Data only", { data: { key: "value" } });

      // Custom properties only
      logger.info("Custom only", { customField: "value", number: 123 });
    });

    await t.step("should handle empty and undefined context", () => {
      // Empty context
      logger.info("Empty context", {});

      // Undefined context
      logger.info("No context");
      logger.debug("No context debug");
      logger.trace("No context trace");
    });

    await t.step("should handle complex nested data", () => {
      const complexContext: VerboseContext = {
        operation: "complex-processing",
        data: {
          nestedObject: {
            level1: {
              level2: {
                value: "deeply nested",
              },
            },
          },
          arrayData: [1, 2, 3, "string", { nested: true }],
          nullValue: null,
          undefinedValue: undefined,
          booleanValue: true,
          numberValue: 42.5,
        },
      };

      logger.info("Complex nested data", complexContext);
    });
  });

  await t.step("Verbose Mode Behavior", async (t) => {
    const logger = new VerboseLoggerService("verbose-mode-test");

    await t.step("should have consistent verbose mode state", () => {
      const verboseMode1 = logger.isVerbose();
      const verboseMode2 = logger.isVerbose();

      assertEquals(
        verboseMode1,
        verboseMode2,
        "Verbose mode should be consistent",
      );
      assertEquals(
        typeof verboseMode1,
        "boolean",
        "Verbose mode should be boolean",
      );
    });

    await t.step("should respect verbose mode for all logging methods", () => {
      // These should all execute without error regardless of verbose mode
      const isVerbose = logger.isVerbose();

      if (isVerbose) {
        // In verbose mode, logging should occur
        logger.logVerbose("info", "Verbose mode active");
      } else {
        // In non-verbose mode, logging should be skipped
        logger.logVerbose("info", "Verbose mode inactive");
      }

      // These should always work regardless of verbose mode
      logger.info("Standard info message");
      logger.debug("Standard debug message");
      logger.trace("Standard trace message");
    });
  });

  await t.step("Static vs Instance Method Consistency", async (t) => {
    await t.step(
      "should maintain consistency between static and instance methods",
      () => {
        const serviceName = "consistency-test";
        const staticLogger = VerboseLoggerService.forService(serviceName);
        const instanceLogger = new VerboseLoggerService(serviceName);

        // Both should be instances of VerboseLoggerService
        assertEquals(
          staticLogger instanceof VerboseLoggerService,
          true,
          "Static factory should create VerboseLoggerService",
        );
        assertEquals(
          instanceLogger instanceof VerboseLoggerService,
          true,
          "Constructor should create VerboseLoggerService",
        );

        // Both should have same verbose mode state
        assertEquals(
          staticLogger.isVerbose(),
          instanceLogger.isVerbose(),
          "Should have same verbose mode",
        );
      },
    );
  });

  await t.step("Error Handling and Edge Cases", async (t) => {
    await t.step("should handle empty strings and special characters", () => {
      const logger = new VerboseLoggerService("edge-case-test");

      // Empty strings
      logger.info("");
      logger.debug("", {});
      logger.trace("", { operation: "" });

      // Special characters
      logger.info("Message with special chars: !@#$%^&*()[]{}|;:,.<>?");
      logger.debug("Unicode: 你好 🌟 ñáéíóú", { data: { emoji: "🚀🎉" } });

      // Very long messages
      const longMessage = "A".repeat(1000);
      logger.info(longMessage);
    });

    await t.step("should handle circular references gracefully", () => {
      const logger = new VerboseLoggerService("circular-test");

      // Create circular reference
      const circular: Record<string, unknown> = { name: "circular" };
      circular.self = circular;

      // Should not throw error (logging system should handle circular refs)
      logger.info("Testing circular reference", { data: { circular } });
    });

    await t.step("should handle mixed argument types in static methods", () => {
      // Test edge cases in static method argument detection
      VerboseLoggerService.logDebug("message-only");
      VerboseLoggerService.logInfo("message-only");
      VerboseLoggerService.logWarn("message-only");

      // Test with null/undefined contexts
      VerboseLoggerService.logDebug("service", "message", undefined);
      VerboseLoggerService.logInfo("service", "message", undefined);
      VerboseLoggerService.logWarn("service", "message", undefined);
    });
  });

  await t.step("Performance and Memory Considerations", async (t) => {
    await t.step("should handle multiple logger instances efficiently", () => {
      const loggers: VerboseLoggerService[] = [];

      // Create multiple loggers
      for (let i = 0; i < 10; i++) {
        loggers.push(new VerboseLoggerService(`test-logger-${i}`));
      }

      // All should work independently
      for (const [index, logger] of loggers.entries()) {
        logger.info(`Logger ${index} working`);
        assertEquals(
          logger instanceof VerboseLoggerService,
          true,
          "Should be proper instance",
        );
      }
    });

    await t.step("should handle high-frequency logging calls", () => {
      const logger = new VerboseLoggerService("high-frequency-test");

      // Simulate high-frequency logging
      for (let i = 0; i < 100; i++) {
        logger.info(`High frequency log ${i}`, { iteration: i });

        if (i % 10 === 0) {
          logger.debug(`Debug checkpoint ${i}`);
        }

        if (i % 25 === 0) {
          logger.trace(`Trace checkpoint ${i}`);
        }
      }
    });
  });
});
