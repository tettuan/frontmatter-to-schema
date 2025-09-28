/**
 * @fileoverview Tests for ErrorHandlingService following Totality principles
 * @description Comprehensive test coverage for all error handling patterns
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  CommonErrorFactories,
  ErrorHandling,
  ErrorHandlingService,
  type OperationContext,
} from "./error-handling-service.ts";
import { err, ok } from "../types/result.ts";
import { type SystemError } from "../types/errors.ts";

// Test error factories using existing domain error types
const testErrorFactory = (
  message: string,
  context?: OperationContext,
): SystemError & { message: string } => ({
  kind: "InitializationError",
  message: context ? `${context.operation}: ${message}` : message,
});

// Removed unused testValidationErrorFactory to fix lint warnings

describe("ErrorHandlingService", () => {
  describe("Smart Constructor", () => {
    it("should create service instance successfully", () => {
      const result = ErrorHandlingService.create();
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should return same instance type as singleton", () => {
      const result = ErrorHandlingService.create();
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(typeof result.data, typeof ErrorHandling);
      }
    });
  });

  describe("Synchronous Operation Wrapping", () => {
    it("should wrap successful operation", () => {
      const operation = () => "test result";
      const result = ErrorHandling.wrapOperation(operation, testErrorFactory);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "test result");
      }
    });

    it("should wrap failing operation with Error instance", () => {
      const operation = () => {
        throw new Error("Test error message");
      };
      const result = ErrorHandling.wrapOperation(operation, testErrorFactory);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
        assertEquals(result.error.message, "Test error message");
      }
    });

    it("should wrap failing operation with string error", () => {
      const operation = () => {
        throw "String error";
      };
      const result = ErrorHandling.wrapOperation(operation, testErrorFactory);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
        assertEquals(result.error.message, "String error");
      }
    });

    it("should wrap failing operation with object error", () => {
      const operation = () => {
        throw { message: "Object error" };
      };
      const result = ErrorHandling.wrapOperation(operation, testErrorFactory);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
        assertEquals(result.error.message, "Object error");
      }
    });

    it("should include operation context in error", () => {
      const operation = () => {
        throw new Error("Context test");
      };
      const context: OperationContext = {
        operation: "testOperation",
        method: "testMethod",
        metadata: { key: "value" },
      };
      const result = ErrorHandling.wrapOperation(
        operation,
        testErrorFactory,
        context,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.message, "testOperation: Context test");
      }
    });
  });

  describe("Asynchronous Operation Wrapping", () => {
    it("should wrap successful async operation", async () => {
      const operation = () => Promise.resolve("async result");
      const result = await ErrorHandling.wrapAsyncOperation(
        operation,
        testErrorFactory,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "async result");
      }
    });

    it("should wrap failing async operation", async () => {
      const operation = () => Promise.reject(new Error("Async error"));
      const result = await ErrorHandling.wrapAsyncOperation(
        operation,
        testErrorFactory,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
        assertEquals(result.error.message, "Async error");
      }
    });

    it("should wrap async operation with Promise.reject", async () => {
      const operation = () => Promise.reject(new Error("Rejection error"));
      const result = await ErrorHandling.wrapAsyncOperation(
        operation,
        testErrorFactory,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
        assertEquals(result.error.message, "Rejection error");
      }
    });
  });

  describe("Result Operation Wrapping", () => {
    it("should wrap successful Result operation", () => {
      const operation = () => ok("result operation");
      const result = ErrorHandling.wrapResultOperation(
        operation,
        testErrorFactory,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "result operation");
      }
    });

    it("should pass through Result operation error", () => {
      const operation = () =>
        err({
          kind: "InvalidFormat" as const,
          format: "test",
          message: "test error",
        });
      const result = ErrorHandling.wrapResultOperation(
        operation,
        testErrorFactory,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
      }
    });

    it("should wrap unexpected exception in Result operation", () => {
      const operation = () => {
        throw new Error("Unexpected error");
      };
      const result = ErrorHandling.wrapResultOperation(
        operation,
        testErrorFactory,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
        assertEquals((result.error as any).message, "Unexpected error");
      }
    });
  });

  describe("Operation Chaining", () => {
    it("should chain successful operations", () => {
      const operations = [
        (input: string) => ok(input + "1"),
        (input: string) => ok(input + "2"),
        (input: string) => ok(input + "3"),
      ];
      const result = ErrorHandling.chainOperations(
        operations,
        "start",
        testErrorFactory,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "start123");
      }
    });

    it("should stop chaining on first error", () => {
      const operations = [
        (input: string) => ok(input + "1"),
        (_input: string) =>
          err({
            kind: "InitializationError" as const,
            message: "chain error",
          }),
        (input: string) => ok(input + "3"), // Should not execute
      ];
      const result = ErrorHandling.chainOperations(
        operations,
        "start",
        testErrorFactory,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
      }
    });

    it("should handle exception during chaining", () => {
      const operations = [
        (input: string) => ok(input + "1"),
        (_input: string) => {
          throw new Error("Chain exception");
        },
      ];
      const result = ErrorHandling.chainOperations(
        operations,
        "start",
        testErrorFactory,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
        assertEquals(result.error.message, "Chain exception");
      }
    });
  });

  describe("Parallel Operations", () => {
    it("should execute parallel operations successfully", async () => {
      const operations = [
        () => Promise.resolve("result1"),
        () => Promise.resolve("result2"),
        () => Promise.resolve("result3"),
      ];
      const result = await ErrorHandling.wrapParallelOperations(
        operations,
        testErrorFactory,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["result1", "result2", "result3"]);
      }
    });

    it("should handle parallel operation failure", async () => {
      const operations = [
        () => Promise.resolve("result1"),
        () => Promise.reject(new Error("Parallel failure")),
        () => Promise.resolve("result3"),
      ];
      const result = await ErrorHandling.wrapParallelOperations(
        operations,
        testErrorFactory,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
        assertEquals(result.error.message, "Parallel failure");
      }
    });
  });

  describe("Context Creation Helper", () => {
    it("should create operation context with all fields", () => {
      const context = ErrorHandlingService.createContext(
        "testOperation",
        "testMethod",
        { key: "value", number: 42 },
      );

      assertEquals(context.operation, "testOperation");
      assertEquals(context.method, "testMethod");
      assertEquals(context.metadata?.key, "value");
      assertEquals(context.metadata?.number, 42);
    });

    it("should create operation context with minimal fields", () => {
      const context = ErrorHandlingService.createContext("minimalOperation");

      assertEquals(context.operation, "minimalOperation");
      assertEquals(context.method, undefined);
      assertEquals(context.metadata, undefined);
    });
  });

  describe("Common Error Factories", () => {
    it("should create configuration error", () => {
      const error = CommonErrorFactories.configurationError("Config not found");

      assertEquals(error.kind, "ConfigurationError");
      assertEquals(error.message, "Config not found");
    });

    it("should create configuration error with context", () => {
      const context: OperationContext = {
        operation: "loadConfig",
        method: "validate",
      };
      const error = CommonErrorFactories.configurationError(
        "Invalid config",
        context,
      );

      assertEquals(error.kind, "ConfigurationError");
      assertEquals(error.message, "loadConfig.validate: Invalid config");
    });

    it("should create initialization error", () => {
      const error = CommonErrorFactories.initializationError(
        "Service failed to start",
      );

      assertEquals(error.kind, "InitializationError");
      assertEquals(error.message, "Service failed to start");
    });

    it("should create validation error", () => {
      const error = CommonErrorFactories.validationError(
        "Field validation failed",
      );

      assertEquals(error.kind, "InvalidFormat");
      assertEquals(error.format, "operation");
      assertEquals(error.message, "Field validation failed");
    });
  });

  describe("Totality Compliance", () => {
    it("should never throw exceptions from public methods", () => {
      // Test with various edge cases that should not throw
      const service = ErrorHandling;

      // Test with operation that returns undefined
      const result1 = service.wrapOperation(() => undefined, testErrorFactory);
      assertEquals(result1.ok, true);

      // Test with operation that throws null
      const result2 = service.wrapOperation(() => {
        throw null;
      }, testErrorFactory);
      assertEquals(result2.ok, false);
    });

    it("should handle all error types consistently", () => {
      const errorTypes = [
        new Error("Error instance"),
        "String error",
        { message: "Object with message" },
        42,
        null,
        undefined,
      ];

      errorTypes.forEach((errorType) => {
        const operation = () => {
          throw errorType;
        };
        const result = ErrorHandling.wrapOperation(operation, testErrorFactory);

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InitializationError");
          assertExists(result.error.message);
          assertEquals(typeof result.error.message, "string");
        }
      });
    });

    it("should maintain Result type consistency", () => {
      // Success case
      const successResult = ErrorHandling.wrapOperation(
        () => "success",
        testErrorFactory,
      );
      assertEquals(successResult.ok, true);
      assertEquals("data" in successResult, true);
      assertEquals("error" in successResult, false);

      // Error case
      const errorResult = ErrorHandling.wrapOperation(() => {
        throw new Error("test");
      }, testErrorFactory);
      assertEquals(errorResult.ok, false);
      assertEquals("data" in errorResult, false);
      assertEquals("error" in errorResult, true);
    });
  });
});
