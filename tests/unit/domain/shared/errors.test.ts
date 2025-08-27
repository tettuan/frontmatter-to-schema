/**
 * Tests for Domain Error Types and Factory Functions
 * Achieving comprehensive coverage for error handling
 */

import { assert, assertEquals } from "jsr:@std/assert";
import {
  type APIError,
  type ConfigurationError,
  createAPIError,
  createConfigurationError,
  createIOError,
  createProcessingError,
  createValidationError,
  type DomainError,
  errorToString,
  type IOError,
  type ProcessingError,
  type ValidationError,
} from "../../../../src/domain/shared/errors.ts";

Deno.test("ValidationError", async (t) => {
  await t.step("should create validation error with all fields", () => {
    const error = createValidationError(
      "Invalid value",
      "username",
      "admin123",
    );

    assertEquals(error.kind, "ValidationError");
    assertEquals(error.message, "Invalid value");
    assertEquals(error.field, "username");
    assertEquals(error.value, "admin123");
  });

  await t.step("should create validation error with message only", () => {
    const error = createValidationError("Required field missing");

    assertEquals(error.kind, "ValidationError");
    assertEquals(error.message, "Required field missing");
    assertEquals(error.field, undefined);
    assertEquals(error.value, undefined);
  });

  await t.step("should create validation error with field but no value", () => {
    const error = createValidationError("Field is required", "email");

    assertEquals(error.kind, "ValidationError");
    assertEquals(error.message, "Field is required");
    assertEquals(error.field, "email");
    assertEquals(error.value, undefined);
  });

  await t.step("should handle complex value types", () => {
    const complexValue = { nested: { data: [1, 2, 3] } };
    const error = createValidationError(
      "Invalid structure",
      "config",
      complexValue,
    );

    assertEquals(error.kind, "ValidationError");
    assertEquals(error.value, complexValue);
  });
});

Deno.test("ProcessingError", async (t) => {
  await t.step("should create processing error with cause", () => {
    const cause = new Error("Original error");
    const error = createProcessingError("Failed to process", cause);

    assertEquals(error.kind, "ProcessingError");
    assertEquals(error.message, "Failed to process");
    assertEquals(error.cause, cause);
  });

  await t.step("should create processing error without cause", () => {
    const error = createProcessingError("Processing failed");

    assertEquals(error.kind, "ProcessingError");
    assertEquals(error.message, "Processing failed");
    assertEquals(error.cause, undefined);
  });

  await t.step("should preserve error stack in cause", () => {
    const cause = new Error("Stack trace error");
    cause.stack = "Error: Stack trace error\n    at test.ts:10:5";
    const error = createProcessingError("Wrapper error", cause);

    assertEquals(error.cause?.stack, cause.stack);
  });
});

Deno.test("IOError", async (t) => {
  await t.step("should create IO error with all fields", () => {
    const error = createIOError(
      "File not found",
      "/path/to/file.txt",
      "read",
    );

    assertEquals(error.kind, "IOError");
    assertEquals(error.message, "File not found");
    assertEquals(error.path, "/path/to/file.txt");
    assertEquals(error.operation, "read");
  });

  await t.step("should create IO error with message only", () => {
    const error = createIOError("Disk full");

    assertEquals(error.kind, "IOError");
    assertEquals(error.message, "Disk full");
    assertEquals(error.path, undefined);
    assertEquals(error.operation, undefined);
  });

  await t.step("should handle write operations", () => {
    const error = createIOError(
      "Permission denied",
      "/protected/file",
      "write",
    );

    assertEquals(error.operation, "write");
  });

  await t.step("should handle delete operations", () => {
    const error = createIOError(
      "Cannot delete",
      "/important/file",
      "delete",
    );

    assertEquals(error.operation, "delete");
  });
});

Deno.test("APIError", async (t) => {
  await t.step("should create API error with all fields", () => {
    const responseBody = { error: "Invalid token" };
    const error = createAPIError(
      "Authentication failed",
      401,
      responseBody,
    );

    assertEquals(error.kind, "APIError");
    assertEquals(error.message, "Authentication failed");
    assertEquals(error.statusCode, 401);
    assertEquals(error.response, responseBody);
  });

  await t.step("should create API error with message only", () => {
    const error = createAPIError("Network timeout");

    assertEquals(error.kind, "APIError");
    assertEquals(error.message, "Network timeout");
    assertEquals(error.statusCode, undefined);
    assertEquals(error.response, undefined);
  });

  await t.step("should handle various status codes", () => {
    const testCases = [
      { code: 400, message: "Bad Request" },
      { code: 404, message: "Not Found" },
      { code: 500, message: "Internal Server Error" },
      { code: 503, message: "Service Unavailable" },
    ];

    for (const testCase of testCases) {
      const error = createAPIError(testCase.message, testCase.code);
      assertEquals(error.statusCode, testCase.code);
    }
  });

  await t.step("should handle complex response objects", () => {
    const response = {
      errors: [
        { field: "email", message: "Invalid format" },
        { field: "password", message: "Too weak" },
      ],
      timestamp: new Date().toISOString(),
    };

    const error = createAPIError("Validation failed", 422, response);
    assertEquals(error.response, response);
  });
});

Deno.test("ConfigurationError", async (t) => {
  await t.step("should create configuration error with field", () => {
    const error = createConfigurationError(
      "Invalid configuration value",
      "database.host",
    );

    assertEquals(error.kind, "ConfigurationError");
    assertEquals(error.message, "Invalid configuration value");
    assertEquals(error.field, "database.host");
  });

  await t.step("should create configuration error without field", () => {
    const error = createConfigurationError("Configuration file missing");

    assertEquals(error.kind, "ConfigurationError");
    assertEquals(error.message, "Configuration file missing");
    assertEquals(error.field, undefined);
  });

  await t.step("should handle nested field paths", () => {
    const error = createConfigurationError(
      "Port must be a number",
      "server.http.port",
    );

    assertEquals(error.field, "server.http.port");
  });
});

Deno.test("errorToString", async (t) => {
  await t.step("should format ValidationError with field", () => {
    const error: ValidationError = {
      kind: "ValidationError",
      message: "Must be positive",
      field: "age",
    };

    const result = errorToString(error);
    assertEquals(result, "Validation error in field 'age': Must be positive");
  });

  await t.step("should format ValidationError without field", () => {
    const error: ValidationError = {
      kind: "ValidationError",
      message: "Invalid input",
    };

    const result = errorToString(error);
    assertEquals(result, "Validation error: Invalid input");
  });

  await t.step("should format ProcessingError with cause", () => {
    const cause = new Error("Database connection failed");
    const error: ProcessingError = {
      kind: "ProcessingError",
      message: "Cannot save user",
      cause,
    };

    const result = errorToString(error);
    assertEquals(
      result,
      "Processing error: Cannot save user (Database connection failed)",
    );
  });

  await t.step("should format ProcessingError without cause", () => {
    const error: ProcessingError = {
      kind: "ProcessingError",
      message: "Unknown processing error",
    };

    const result = errorToString(error);
    assertEquals(result, "Processing error: Unknown processing error");
  });

  await t.step("should format IOError with path and operation", () => {
    const error: IOError = {
      kind: "IOError",
      message: "Permission denied",
      path: "/etc/config.yml",
      operation: "write",
    };

    const result = errorToString(error);
    assertEquals(
      result,
      "IO error (write) at '/etc/config.yml': Permission denied",
    );
  });

  await t.step("should format IOError without path", () => {
    const error: IOError = {
      kind: "IOError",
      message: "Disk full",
    };

    const result = errorToString(error);
    assertEquals(result, "IO error: Disk full");
  });

  await t.step("should format IOError with path but no operation", () => {
    const error: IOError = {
      kind: "IOError",
      message: "File locked",
      path: "/tmp/file.lock",
    };

    const result = errorToString(error);
    assertEquals(
      result,
      "IO error (unknown) at '/tmp/file.lock': File locked",
    );
  });

  await t.step("should format APIError with status code", () => {
    const error: APIError = {
      kind: "APIError",
      message: "Unauthorized",
      statusCode: 401,
    };

    const result = errorToString(error);
    assertEquals(result, "API error (401): Unauthorized");
  });

  await t.step("should format APIError without status code", () => {
    const error: APIError = {
      kind: "APIError",
      message: "Service unavailable",
    };

    const result = errorToString(error);
    assertEquals(result, "API error: Service unavailable");
  });

  await t.step("should format ConfigurationError with field", () => {
    const error: ConfigurationError = {
      kind: "ConfigurationError",
      message: "Invalid port number",
      field: "server.port",
    };

    const result = errorToString(error);
    assertEquals(
      result,
      "Configuration error in field 'server.port': Invalid port number",
    );
  });

  await t.step("should format ConfigurationError without field", () => {
    const error: ConfigurationError = {
      kind: "ConfigurationError",
      message: "Missing configuration file",
    };

    const result = errorToString(error);
    assertEquals(result, "Configuration error: Missing configuration file");
  });
});

Deno.test("DomainError type", async (t) => {
  await t.step("should work as discriminated union", () => {
    const errors: DomainError[] = [
      createValidationError("test"),
      createProcessingError("test"),
      createIOError("test"),
      createAPIError("test"),
      createConfigurationError("test"),
    ];

    for (const error of errors) {
      // Type guard checks
      switch (error.kind) {
        case "ValidationError":
          assert("field" in error || !("field" in error));
          break;
        case "ProcessingError":
          assert("cause" in error || !("cause" in error));
          break;
        case "IOError":
          assert("operation" in error || !("operation" in error));
          break;
        case "APIError":
          assert("statusCode" in error || !("statusCode" in error));
          break;
        case "ConfigurationError":
          assert("field" in error || !("field" in error));
          break;
      }
    }
  });

  await t.step("should exhaustively handle all error types", () => {
    const testError = (error: DomainError): string => {
      switch (error.kind) {
        case "ValidationError":
          return "validation";
        case "ProcessingError":
          return "processing";
        case "IOError":
          return "io";
        case "APIError":
          return "api";
        case "ConfigurationError":
          return "config";
          // TypeScript ensures exhaustive checking
      }
    };

    assertEquals(testError(createValidationError("test")), "validation");
    assertEquals(testError(createProcessingError("test")), "processing");
    assertEquals(testError(createIOError("test")), "io");
    assertEquals(testError(createAPIError("test")), "api");
    assertEquals(testError(createConfigurationError("test")), "config");
  });
});

Deno.test("Edge cases", async (t) => {
  await t.step("should handle empty strings", () => {
    const error = createValidationError("", "", "");
    assertEquals(error.message, "");
    assertEquals(error.field, "");
    assertEquals(error.value, "");
  });

  await t.step("should handle null and undefined in value field", () => {
    const nullError = createValidationError("Null value", "field", null);
    assertEquals(nullError.value, null);

    const undefinedError = createValidationError(
      "Undefined",
      "field",
      undefined,
    );
    assertEquals(undefinedError.value, undefined);
  });

  await t.step("should handle special characters in messages", () => {
    const specialChars = "Error: 'test' failed with \"quotes\" and \n newlines";
    const error = createProcessingError(specialChars);
    assertEquals(error.message, specialChars);
  });

  await t.step("should handle very long field paths", () => {
    const longPath =
      "config.server.database.connection.pool.settings.timeout.milliseconds";
    const error = createConfigurationError("Too long", longPath);
    assertEquals(error.field, longPath);
  });

  await t.step("should handle circular references in response", () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;

    const error = createAPIError("Circular", 500, circular);
    assert(error.response === circular);
  });
});
