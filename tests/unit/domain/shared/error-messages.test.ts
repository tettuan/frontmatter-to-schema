// Tests for centralized error messages

import { assertEquals, assertExists } from "jsr:@std/assert@1.0.5";
import { createError } from "../../../../src/domain/shared/types.ts";
import {
  ErrorMessages,
  formatErrorMessage,
  getErrorCode,
} from "../../../../src/domain/shared/error-messages.ts";

Deno.test("Error Messages - Error codes are assigned correctly", () => {
  const emptyError = createError({
    kind: "ValidationError",
    message: "Input cannot be empty",
  });
  assertEquals(emptyError.code, "VAL001");
  assertExists(emptyError.message);
  assertEquals(emptyError.message, "[VAL001] Input cannot be empty");

  const fileNotFoundError = createError({
    kind: "FileNotFound",
    path: "/test/file.txt",
  });
  assertEquals(fileNotFoundError.code, "IO001");
  assertEquals(
    fileNotFoundError.message,
    "[IO001] File not found: /test/file.txt",
  );

  // PatternMismatch is no longer available, now using ValidationError
  const patternError = createError({
    kind: "ValidationError",
    message: "Input does not match pattern X.Y.Z: 1.0",
  });
  assertEquals(patternError.code, "VAL001");
  assertEquals(
    patternError.message,
    "[VAL001] Input does not match pattern X.Y.Z: 1.0",
  );
});

Deno.test("Error Messages - Custom messages override defaults", () => {
  const error = createError(
    { kind: "ValidationError", message: "Default message" },
    "Custom empty input message",
  );
  assertEquals(error.code, "VAL001");
  assertEquals(error.message, "Custom empty input message");
});

Deno.test("Error Messages - Error code mapping", () => {
  assertEquals(getErrorCode("ValidationError"), "VAL001");
  assertEquals(getErrorCode("FileNotFound"), "IO001");
  assertEquals(getErrorCode("ExtractionFailed"), "PRO001");
  assertEquals(getErrorCode("PromptTooLong"), "AI001");
  assertEquals(getErrorCode("UnknownError"), "DOM999");
});

Deno.test("Error Messages - Format error message", () => {
  const msg1 = formatErrorMessage("VAL001");
  assertEquals(msg1, "[VAL001] Input cannot be empty");

  const msg2 = formatErrorMessage("IO001", "/path/to/file");
  assertEquals(msg2, "[IO001] File not found: /path/to/file");

  const msg3 = formatErrorMessage("VAL003", "X.Y.Z", "invalid");
  assertEquals(msg3, "[VAL003] Input does not match pattern X.Y.Z: invalid");
});

Deno.test("Error Messages - All error types have messages", () => {
  // Validation errors
  assertExists(ErrorMessages.EMPTY_INPUT);
  assertExists(ErrorMessages.INVALID_FORMAT);
  assertExists(ErrorMessages.PATTERN_MISMATCH);
  assertExists(ErrorMessages.OUT_OF_RANGE);
  assertExists(ErrorMessages.INVALID_PATH);
  assertExists(ErrorMessages.SCHEMA_VALIDATION);
  assertExists(ErrorMessages.TEMPLATE_VALIDATION);

  // Processing errors
  assertExists(ErrorMessages.EXTRACTION_FAILED);
  assertExists(ErrorMessages.ANALYSIS_FAILED);
  assertExists(ErrorMessages.MAPPING_FAILED);
  assertExists(ErrorMessages.AGGREGATION_FAILED);
  assertExists(ErrorMessages.CONFIGURATION_INVALID);

  // IO errors
  assertExists(ErrorMessages.FILE_NOT_FOUND);
  assertExists(ErrorMessages.PERMISSION_DENIED);
  assertExists(ErrorMessages.READ_ERROR);
  assertExists(ErrorMessages.WRITE_ERROR);

  // AI errors
  assertExists(ErrorMessages.PROMPT_TOO_LONG);
  assertExists(ErrorMessages.API_ERROR);
  assertExists(ErrorMessages.RATE_LIMITED);
  assertExists(ErrorMessages.INVALID_RESPONSE);

  // Domain-specific errors
  assertExists(ErrorMessages.SCHEMA_FILE_NOT_FOUND);
  assertExists(ErrorMessages.TEMPLATE_FILE_NOT_FOUND);
  assertExists(ErrorMessages.INVALID_JSON_IN_SCHEMA);
  assertExists(ErrorMessages.INVALID_SCHEMA_ID);
  assertExists(ErrorMessages.INVALID_SCHEMA_DEFINITION);
  assertExists(ErrorMessages.INVALID_SCHEMA_VERSION);
  assertExists(ErrorMessages.INVALID_TEMPLATE_ID);
  assertExists(ErrorMessages.INVALID_TEMPLATE_FORMAT);
  assertExists(ErrorMessages.NO_FRONTMATTER_FOUND);
  assertExists(ErrorMessages.DOCUMENTS_DIR_NOT_FOUND);
  assertExists(ErrorMessages.FAILED_TO_FIND_DOCUMENTS);
  assertExists(ErrorMessages.FAILED_TO_LOAD_SCHEMA);
  assertExists(ErrorMessages.FAILED_TO_LOAD_TEMPLATE);
  assertExists(ErrorMessages.UNEXPECTED_ERROR);
});

Deno.test("Error Messages - Range errors with different parameters", () => {
  const msg1 = ErrorMessages.OUT_OF_RANGE(5, 1, 10);
  assertEquals(msg1, "Value 5 is out of range [1, 10]");

  const msg2 = ErrorMessages.OUT_OF_RANGE(5, 10, undefined);
  assertEquals(msg2, "Value 5 is below minimum 10");

  const msg3 = ErrorMessages.OUT_OF_RANGE(15, undefined, 10);
  assertEquals(msg3, "Value 15 exceeds maximum 10");

  const msg4 = ErrorMessages.OUT_OF_RANGE(5);
  assertEquals(msg4, "Value 5 is out of range");
});

Deno.test("Error Messages - Complex error types", () => {
  const configError = createError({
    kind: "ConfigurationInvalid",
    errors: [
      { kind: "ValidationError", message: "Input cannot be empty" },
      { kind: "ValidationError", message: "Invalid path: /test - not found" },
    ],
  });
  assertEquals(configError.code, "PRO005");
  assertEquals(
    configError.message,
    "[PRO005] Configuration is invalid with 2 error(s)",
  );

  const aiError = createError({
    kind: "APIError",
    message: "Service unavailable",
    code: "503",
  });
  assertEquals(aiError.code, "AI002");
  assertEquals(aiError.message, "[AI002] API error (503): Service unavailable");
});
