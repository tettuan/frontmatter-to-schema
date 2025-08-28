/**
 * Tests for Domain Error Types and Factory Functions
 * Achieving comprehensive coverage for error handling with new result system
 */

import { assert, assertEquals } from "jsr:@std/assert";
import {
  createDomainError,
  type DomainError as _DomainError,
  type FileSystemError as _FileSystemError,
} from "../../../../src/domain/core/result.ts";

Deno.test("DomainError", async (t) => {
  await t.step("should create domain error with validation kind", () => {
    const error = createDomainError(
      {
        kind: "EmptyInput",
        field: "username",
      },
      "Invalid value",
    );

    assertEquals(error.kind, "EmptyInput");
    assertEquals(error.message, "Invalid value");
    assertEquals(error.field, "username");
  });

  await t.step("should create domain error with message only", () => {
    const error = createDomainError(
      { kind: "EmptyInput" },
      "Required field missing",
    );

    assertEquals(error.kind, "EmptyInput");
    assertEquals(error.message, "Required field missing");
  });

  await t.step("should create format error with input details", () => {
    const error = createDomainError(
      {
        kind: "InvalidFormat",
        input: "invalid-value",
        expectedFormat: "email",
      },
      "Invalid email format",
    );

    assertEquals(error.kind, "InvalidFormat");
    assertEquals(error.message, "Invalid email format");
    assertEquals(error.input, "invalid-value");
    assertEquals(error.expectedFormat, "email");
  });
});

Deno.test("FileSystemError", async (t) => {
  await t.step("should create file system error", () => {
    const error = createDomainError(
      {
        kind: "FileNotFound",
        path: "/path/to/file.txt",
      },
      "File not found",
    );

    assertEquals(error.kind, "FileNotFound");
    assertEquals(error.message, "File not found");
    assertEquals(error.path, "/path/to/file.txt");
  });

  await t.step("should create read error with details", () => {
    const error = createDomainError(
      {
        kind: "ReadError",
        path: "/path/to/file.txt",
        details: "Permission denied",
      },
      "Cannot read file",
    );

    assertEquals(error.kind, "ReadError");
    assertEquals(error.message, "Cannot read file");
    assertEquals(error.path, "/path/to/file.txt");
    assertEquals(error.details, "Permission denied");
  });
});

Deno.test("Error Message Handling", async (t) => {
  await t.step("should have meaningful error message", () => {
    const error = createDomainError(
      {
        kind: "InvalidFormat",
        input: "test-value",
        expectedFormat: "email",
      },
    );

    const result = error.message;
    assert(result.includes("test-value"));
    assert(result.includes("email"));
  });

  await t.step("should have meaningful file system error message", () => {
    const error = createDomainError(
      {
        kind: "FileNotFound",
        path: "/missing/file.txt",
      },
    );

    const result = error.message;
    assert(result.includes("/missing/file.txt"));
  });
});
