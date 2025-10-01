import { assertEquals } from "@std/assert";
import {
  createFileError,
  type FileError,
} from "../../../../../src/domain/shared/types/file-errors.ts";

Deno.test("createFileError - FileNotFound with default message", () => {
  const error: FileError = {
    kind: "FileNotFound",
    path: "/path/to/missing.txt",
  };

  const result = createFileError(error);

  assertEquals(result.kind, "FileNotFound");
  assertEquals(result.path, "/path/to/missing.txt");
  assertEquals(result.message, "File not found: /path/to/missing.txt");
});

Deno.test("createFileError - FileNotFound with custom message", () => {
  const error: FileError = {
    kind: "FileNotFound",
    path: "/path/to/missing.txt",
  };

  const result = createFileError(error, "Custom file not found message");

  assertEquals(result.kind, "FileNotFound");
  assertEquals(result.path, "/path/to/missing.txt");
  assertEquals(result.message, "Custom file not found message");
});

Deno.test("createFileError - PermissionDenied read with default message", () => {
  const error: FileError = {
    kind: "PermissionDenied",
    path: "/protected/file.txt",
    operation: "read",
  };

  const result = createFileError(error);

  assertEquals(result.kind, "PermissionDenied");
  assertEquals(result.path, "/protected/file.txt");
  if (result.kind === "PermissionDenied") {
    assertEquals(result.operation, "read");
  }
  assertEquals(
    result.message,
    "Permission denied for read operation: /protected/file.txt",
  );
});

Deno.test("createFileError - PermissionDenied write with default message", () => {
  const error: FileError = {
    kind: "PermissionDenied",
    path: "/protected/file.txt",
    operation: "write",
  };

  const result = createFileError(error);

  assertEquals(result.kind, "PermissionDenied");
  assertEquals(result.path, "/protected/file.txt");
  if (result.kind === "PermissionDenied") {
    assertEquals(result.operation, "write");
  }
  assertEquals(
    result.message,
    "Permission denied for write operation: /protected/file.txt",
  );
});

Deno.test("createFileError - PermissionDenied with custom message", () => {
  const error: FileError = {
    kind: "PermissionDenied",
    path: "/protected/file.txt",
    operation: "read",
  };

  const result = createFileError(error, "Access denied by policy");

  assertEquals(result.message, "Access denied by policy");
});

Deno.test("createFileError - InvalidPath with default message", () => {
  const error: FileError = {
    kind: "InvalidPath",
    path: "invalid:path",
    reason: "contains invalid characters",
  };

  const result = createFileError(error);

  assertEquals(result.kind, "InvalidPath");
  assertEquals(result.path, "invalid:path");
  if (result.kind === "InvalidPath") {
    assertEquals(result.reason, "contains invalid characters");
  }
  assertEquals(
    result.message,
    'Invalid path "invalid:path": contains invalid characters',
  );
});

Deno.test("createFileError - InvalidPath with custom message", () => {
  const error: FileError = {
    kind: "InvalidPath",
    path: "invalid:path",
    reason: "contains invalid characters",
  };

  const result = createFileError(error, "Path validation failed");

  assertEquals(result.message, "Path validation failed");
});

Deno.test("createFileError - FileAlreadyExists with default message", () => {
  const error: FileError = {
    kind: "FileAlreadyExists",
    path: "/existing/file.txt",
  };

  const result = createFileError(error);

  assertEquals(result.kind, "FileAlreadyExists");
  assertEquals(result.path, "/existing/file.txt");
  assertEquals(result.message, "File already exists: /existing/file.txt");
});

Deno.test("createFileError - FileAlreadyExists with custom message", () => {
  const error: FileError = {
    kind: "FileAlreadyExists",
    path: "/existing/file.txt",
  };

  const result = createFileError(error, "Duplicate file detected");

  assertEquals(result.message, "Duplicate file detected");
});

Deno.test("createFileError - DirectoryNotFound with default message", () => {
  const error: FileError = {
    kind: "DirectoryNotFound",
    path: "/missing/directory",
  };

  const result = createFileError(error);

  assertEquals(result.kind, "DirectoryNotFound");
  assertEquals(result.path, "/missing/directory");
  assertEquals(result.message, "Directory not found: /missing/directory");
});

Deno.test("createFileError - DirectoryNotFound with custom message", () => {
  const error: FileError = {
    kind: "DirectoryNotFound",
    path: "/missing/directory",
  };

  const result = createFileError(error, "Target directory is missing");

  assertEquals(result.message, "Target directory is missing");
});

Deno.test("createFileError - IOError with default message", () => {
  const error: FileError = {
    kind: "IOError",
    path: "/corrupted/file.txt",
    message: "disk read error",
  };

  const result = createFileError(error);

  assertEquals(result.kind, "IOError");
  assertEquals(result.path, "/corrupted/file.txt");
  assertEquals(
    result.message,
    "I/O error for /corrupted/file.txt: disk read error",
  );
});

Deno.test("createFileError - IOError with custom message", () => {
  const error: FileError = {
    kind: "IOError",
    path: "/corrupted/file.txt",
    message: "disk read error",
  };

  const result = createFileError(error, "Hardware failure detected");

  assertEquals(result.message, "Hardware failure detected");
});

Deno.test("createFileError - preserves all original error properties", () => {
  const error: FileError = {
    kind: "PermissionDenied",
    path: "/test/file.txt",
    operation: "write",
  };

  const result = createFileError(error);

  // Check that all original properties are preserved
  assertEquals(result.kind, error.kind);
  assertEquals(result.path, error.path);
  if (result.kind === "PermissionDenied" && error.kind === "PermissionDenied") {
    assertEquals(result.operation, error.operation);
  }
  assertEquals(typeof result.message, "string");
});

Deno.test("createFileError - works with complex path names", () => {
  const error: FileError = {
    kind: "FileNotFound",
    path:
      "/very/deeply/nested/directory/with spaces/file-name_with.special-chars.txt",
  };

  const result = createFileError(error);

  assertEquals(
    result.path,
    "/very/deeply/nested/directory/with spaces/file-name_with.special-chars.txt",
  );
  assertEquals(
    result.message,
    "File not found: /very/deeply/nested/directory/with spaces/file-name_with.special-chars.txt",
  );
});

Deno.test("createFileError - handles relative paths", () => {
  const error: FileError = {
    kind: "DirectoryNotFound",
    path: "./relative/path",
  };

  const result = createFileError(error);

  assertEquals(result.path, "./relative/path");
  assertEquals(result.message, "Directory not found: ./relative/path");
});
