import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  type ErrorCode,
  ErrorCodeMap,
  ErrorMessages,
  formatErrorMessage,
  getErrorCode,
} from "../../../../src/domain/shared/error-messages.ts";

describe("ErrorMessages", () => {
  describe("Basic Error Messages", () => {
    it("should have EMPTY_INPUT message", () => {
      assertEquals(ErrorMessages.EMPTY_INPUT, "Input cannot be empty");
    });

    it("should generate INVALID_FORMAT message", () => {
      const result = ErrorMessages.INVALID_FORMAT("json", "invalid data");
      assertEquals(result, "Invalid format, expected json, got: invalid data");
    });

    it("should generate PATTERN_MISMATCH message", () => {
      const result = ErrorMessages.PATTERN_MISMATCH("^[a-z]+$", "123");
      assertEquals(result, "Input does not match pattern ^[a-z]+$: 123");
    });
  });

  describe("OUT_OF_RANGE messages", () => {
    it("should handle range with both min and max", () => {
      const result = ErrorMessages.OUT_OF_RANGE(15, 10, 20);
      assertEquals(result, "Value 15 is out of range [10, 20]");
    });

    it("should handle range with only min", () => {
      const result = ErrorMessages.OUT_OF_RANGE(5, 10);
      assertEquals(result, "Value 5 is below minimum 10");
    });

    it("should handle range with only max", () => {
      const result = ErrorMessages.OUT_OF_RANGE(25, undefined, 20);
      assertEquals(result, "Value 25 exceeds maximum 20");
    });

    it("should handle range with no bounds", () => {
      const result = ErrorMessages.OUT_OF_RANGE(100);
      assertEquals(result, "Value 100 is out of range");
    });

    it("should handle complex values", () => {
      const result = ErrorMessages.OUT_OF_RANGE({ count: 100 }, 0, 50);
      assertEquals(result, "Value [object Object] is out of range [0, 50]");
    });

    it("should handle null values", () => {
      const result = ErrorMessages.OUT_OF_RANGE(null, 1, 10);
      assertEquals(result, "Value null is out of range [1, 10]");
    });
  });

  describe("Path and Validation Messages", () => {
    it("should generate INVALID_PATH message", () => {
      const result = ErrorMessages.INVALID_PATH(
        "/invalid/path",
        "file not found",
      );
      assertEquals(result, "Invalid path: /invalid/path - file not found");
    });

    it("should generate SCHEMA_VALIDATION message", () => {
      const errors = ["missing field", "invalid type", "constraint violation"];
      const result = ErrorMessages.SCHEMA_VALIDATION(errors);
      assertEquals(result, "Schema validation failed with 3 error(s)");
    });

    it("should generate TEMPLATE_VALIDATION message", () => {
      const errors = ["syntax error"];
      const result = ErrorMessages.TEMPLATE_VALIDATION(errors);
      assertEquals(result, "Template validation failed with 1 error(s)");
    });

    it("should handle empty error arrays", () => {
      const result = ErrorMessages.SCHEMA_VALIDATION([]);
      assertEquals(result, "Schema validation failed with 0 error(s)");
    });

    it("should handle complex error objects", () => {
      const errors = [{ field: "name", error: "required" }, {
        field: "age",
        error: "invalid type",
      }];
      const result = ErrorMessages.TEMPLATE_VALIDATION(errors);
      assertEquals(result, "Template validation failed with 2 error(s)");
    });
  });

  describe("Processing Error Messages", () => {
    it("should generate EXTRACTION_FAILED message", () => {
      const result = ErrorMessages.EXTRACTION_FAILED(
        "document.md",
        "invalid syntax",
      );
      assertEquals(
        result,
        "Failed to extract frontmatter from document.md: invalid syntax",
      );
    });

    it("should generate ANALYSIS_FAILED message", () => {
      const result = ErrorMessages.ANALYSIS_FAILED(
        "test.md",
        "AI service unavailable",
      );
      assertEquals(
        result,
        "Failed to analyze document test.md: AI service unavailable",
      );
    });

    it("should generate MAPPING_FAILED message", () => {
      const result = ErrorMessages.MAPPING_FAILED(
        "data.md",
        "template not found",
      );
      assertEquals(
        result,
        "Failed to map document data.md: template not found",
      );
    });

    it("should generate AGGREGATION_FAILED message", () => {
      const result = ErrorMessages.AGGREGATION_FAILED(
        "output format not supported",
      );
      assertEquals(
        result,
        "Failed to aggregate results: output format not supported",
      );
    });

    it("should generate CONFIGURATION_INVALID message", () => {
      const errors = ["missing api key", "invalid endpoint"];
      const result = ErrorMessages.CONFIGURATION_INVALID(errors);
      assertEquals(result, "Configuration is invalid with 2 error(s)");
    });
  });

  describe("IO Error Messages", () => {
    it("should generate FILE_NOT_FOUND message", () => {
      const result = ErrorMessages.FILE_NOT_FOUND("/path/to/file.txt");
      assertEquals(result, "File not found: /path/to/file.txt");
    });

    it("should generate PERMISSION_DENIED message", () => {
      const result = ErrorMessages.PERMISSION_DENIED("/restricted/file.txt");
      assertEquals(result, "Permission denied: /restricted/file.txt");
    });

    it("should generate READ_ERROR message", () => {
      const result = ErrorMessages.READ_ERROR(
        "/data/file.json",
        "corrupted data",
      );
      assertEquals(result, "Failed to read /data/file.json: corrupted data");
    });

    it("should generate WRITE_ERROR message", () => {
      const result = ErrorMessages.WRITE_ERROR(
        "/output/result.json",
        "disk full",
      );
      assertEquals(result, "Failed to write to /output/result.json: disk full");
    });
  });

  describe("AI Error Messages", () => {
    it("should generate PROMPT_TOO_LONG message", () => {
      const result = ErrorMessages.PROMPT_TOO_LONG(5000, 4000);
      assertEquals(result, "Prompt length 5000 exceeds maximum 4000");
    });

    it("should generate API_ERROR message with code", () => {
      const result = ErrorMessages.API_ERROR("Invalid request", "400");
      assertEquals(result, "API error (400): Invalid request");
    });

    it("should generate API_ERROR message without code", () => {
      const result = ErrorMessages.API_ERROR("Network timeout");
      assertEquals(result, "API error: Network timeout");
    });

    it("should generate RATE_LIMITED message with retry time", () => {
      const result = ErrorMessages.RATE_LIMITED(60);
      assertEquals(result, "Rate limited, retry after 60 seconds");
    });

    it("should generate RATE_LIMITED message without retry time", () => {
      const result = ErrorMessages.RATE_LIMITED();
      assertEquals(result, "Rate limited, please try again later");
    });

    it("should generate INVALID_RESPONSE message", () => {
      const longResponse = "x".repeat(200);
      const result = ErrorMessages.INVALID_RESPONSE(longResponse);
      assertStringIncludes(result, "Invalid AI response:");
      assertStringIncludes(result, "...");
      assertEquals(result.length < longResponse.length + 50, true);
    });

    it("should handle short invalid responses", () => {
      const result = ErrorMessages.INVALID_RESPONSE("error");
      assertEquals(result, "Invalid AI response: error");
    });
  });

  describe("Domain-specific Error Messages", () => {
    it("should generate SCHEMA_FILE_NOT_FOUND message", () => {
      const result = ErrorMessages.SCHEMA_FILE_NOT_FOUND(
        "/schemas/schema.json",
      );
      assertEquals(result, "Schema file not found: /schemas/schema.json");
    });

    it("should generate TEMPLATE_FILE_NOT_FOUND message", () => {
      const result = ErrorMessages.TEMPLATE_FILE_NOT_FOUND(
        "/templates/template.md",
      );
      assertEquals(result, "Template file not found: /templates/template.md");
    });

    it("should generate INVALID_JSON_IN_SCHEMA message", () => {
      const result = ErrorMessages.INVALID_JSON_IN_SCHEMA(
        "/schema.json",
        "unexpected token",
      );
      assertEquals(
        result,
        "Failed to parse schema JSON from /schema.json: unexpected token",
      );
    });

    it("should have constant domain error messages", () => {
      assertEquals(
        ErrorMessages.INVALID_SCHEMA_ID,
        "Schema contains invalid ID field",
      );
      assertEquals(
        ErrorMessages.INVALID_SCHEMA_DEFINITION,
        "Schema structure is invalid",
      );
      assertEquals(
        ErrorMessages.INVALID_SCHEMA_VERSION,
        "Schema version format is invalid",
      );
      assertEquals(
        ErrorMessages.INVALID_TEMPLATE_ID,
        "Template contains invalid ID field",
      );
      assertEquals(
        ErrorMessages.INVALID_TEMPLATE_FORMAT,
        "Template format is invalid",
      );
    });

    it("should generate NO_FRONTMATTER_FOUND message", () => {
      const result = ErrorMessages.NO_FRONTMATTER_FOUND("article.md");
      assertEquals(result, "No frontmatter found in article.md");
    });

    it("should generate DOCUMENTS_DIR_NOT_FOUND message", () => {
      const result = ErrorMessages.DOCUMENTS_DIR_NOT_FOUND("/docs");
      assertEquals(result, "Documents directory not found: /docs");
    });

    it("should generate FAILED_TO_FIND_DOCUMENTS message", () => {
      const result = ErrorMessages.FAILED_TO_FIND_DOCUMENTS(
        "/docs",
        "permission denied",
      );
      assertEquals(
        result,
        "Failed to find documents in /docs: permission denied",
      );
    });

    it("should generate FAILED_TO_LOAD_SCHEMA message", () => {
      const result = ErrorMessages.FAILED_TO_LOAD_SCHEMA(
        "/schema.json",
        "invalid JSON",
      );
      assertEquals(
        result,
        "Failed to load schema from /schema.json: invalid JSON",
      );
    });

    it("should generate FAILED_TO_LOAD_TEMPLATE message", () => {
      const result = ErrorMessages.FAILED_TO_LOAD_TEMPLATE(
        "/template.md",
        "file corrupted",
      );
      assertEquals(
        result,
        "Failed to load template from /template.md: file corrupted",
      );
    });

    it("should generate UNEXPECTED_ERROR message", () => {
      const result = ErrorMessages.UNEXPECTED_ERROR(
        "processing",
        "null pointer exception",
      );
      assertEquals(
        result,
        "Unexpected error in processing: null pointer exception",
      );
    });
  });
});

describe("ErrorCodeMap", () => {
  it("should map validation errors correctly", () => {
    assertEquals(ErrorCodeMap.ValidationError, "VAL001");
    assertEquals(ErrorCodeMap.EmptyInput, "VAL001");
    assertEquals(ErrorCodeMap.InvalidFormat, "VAL002");
    assertEquals(ErrorCodeMap.PatternMismatch, "VAL003");
    assertEquals(ErrorCodeMap.OutOfRange, "VAL004");
    assertEquals(ErrorCodeMap.InvalidPath, "VAL005");
    assertEquals(ErrorCodeMap.SchemaValidation, "VAL006");
    assertEquals(ErrorCodeMap.TemplateValidation, "VAL007");
  });

  it("should map processing errors correctly", () => {
    assertEquals(ErrorCodeMap.ExtractionFailed, "PRO001");
    assertEquals(ErrorCodeMap.AnalysisFailed, "PRO002");
    assertEquals(ErrorCodeMap.MappingFailed, "PRO003");
    assertEquals(ErrorCodeMap.AggregationFailed, "PRO004");
    assertEquals(ErrorCodeMap.ConfigurationInvalid, "PRO005");
  });

  it("should map IO errors correctly", () => {
    assertEquals(ErrorCodeMap.FileNotFound, "IO001");
    assertEquals(ErrorCodeMap.PermissionDenied, "IO002");
    assertEquals(ErrorCodeMap.ReadError, "IO003");
    assertEquals(ErrorCodeMap.WriteError, "IO004");
  });

  it("should map AI errors correctly", () => {
    assertEquals(ErrorCodeMap.PromptTooLong, "AI001");
    assertEquals(ErrorCodeMap.APIError, "AI002");
    assertEquals(ErrorCodeMap.RateLimited, "AI003");
    assertEquals(ErrorCodeMap.InvalidResponse, "AI004");
  });

  it("should have all required mappings", () => {
    const expectedMappings = [
      "ValidationError",
      "EmptyInput",
      "InvalidFormat",
      "PatternMismatch",
      "OutOfRange",
      "InvalidPath",
      "SchemaValidation",
      "TemplateValidation",
      "ExtractionFailed",
      "AnalysisFailed",
      "MappingFailed",
      "AggregationFailed",
      "ConfigurationInvalid",
      "FileNotFound",
      "PermissionDenied",
      "ReadError",
      "WriteError",
      "PromptTooLong",
      "APIError",
      "RateLimited",
      "InvalidResponse",
    ];

    expectedMappings.forEach((key) => {
      assertEquals(key in ErrorCodeMap, true, `Missing mapping for ${key}`);
    });
  });
});

describe("getErrorCode", () => {
  it("should return correct error codes for known errors", () => {
    assertEquals(getErrorCode("ValidationError"), "VAL001");
    assertEquals(getErrorCode("FileNotFound"), "IO001");
    assertEquals(getErrorCode("APIError"), "AI002");
  });

  it("should return default code for unknown errors", () => {
    assertEquals(getErrorCode("UnknownError"), "DOM999");
    assertEquals(getErrorCode(""), "DOM999");
    assertEquals(getErrorCode("NonExistentError"), "DOM999");
  });

  it("should handle special characters in error kinds", () => {
    assertEquals(getErrorCode("Error-With-Dashes"), "DOM999");
    assertEquals(getErrorCode("Error With Spaces"), "DOM999");
    assertEquals(getErrorCode("Error_With_Underscores"), "DOM999");
  });

  it("should be case-sensitive", () => {
    assertEquals(getErrorCode("validationerror"), "DOM999");
    assertEquals(getErrorCode("VALIDATIONERROR"), "DOM999");
    assertEquals(getErrorCode("ValidationError"), "VAL001");
  });
});

describe("formatErrorMessage", () => {
  it("should format validation errors correctly", () => {
    const result = formatErrorMessage("VAL001");
    assertEquals(result, "[VAL001] Input cannot be empty");
  });

  it("should format errors with parameters", () => {
    const result = formatErrorMessage("VAL002", "json", "invalid data");
    assertEquals(
      result,
      "[VAL002] Invalid format, expected json, got: invalid data",
    );
  });

  it("should format complex errors", () => {
    const result = formatErrorMessage("VAL004", 15, 10, 20);
    assertEquals(result, "[VAL004] Value 15 is out of range [10, 20]");
  });

  it("should handle errors with optional parameters", () => {
    const result1 = formatErrorMessage("AI002", "Network error", "500");
    assertEquals(result1, "[AI002] API error (500): Network error");

    const result2 = formatErrorMessage("AI002", "Network error");
    assertEquals(result2, "[AI002] API error: Network error");
  });

  it("should handle array parameters", () => {
    const errors = ["error1", "error2", "error3"];
    const result = formatErrorMessage("VAL006", errors);
    assertEquals(result, "[VAL006] Schema validation failed with 3 error(s)");
  });

  it("should handle IO errors", () => {
    const result = formatErrorMessage("IO001", "/path/to/file.txt");
    assertEquals(result, "[IO001] File not found: /path/to/file.txt");
  });

  it("should handle domain errors", () => {
    const result = formatErrorMessage("DOM004");
    assertEquals(result, "[DOM004] Schema contains invalid ID field");
  });

  it("should handle unexpected error", () => {
    const result = formatErrorMessage(
      "DOM999",
      "initialization",
      "config file corrupted",
    );
    assertEquals(
      result,
      "[DOM999] Unexpected error in initialization: config file corrupted",
    );
  });

  it("should handle unknown error codes", () => {
    const result = formatErrorMessage("UNKNOWN" as ErrorCode);
    assertEquals(result, "[UNKNOWN] Unknown error code: UNKNOWN");
  });

  it("should handle missing parameters gracefully", () => {
    const result = formatErrorMessage("VAL002"); // Missing required parameters
    assertEquals(
      result,
      "[VAL002] Invalid format, expected undefined, got: undefined",
    );
  });

  it("should handle extra parameters", () => {
    const result = formatErrorMessage(
      "VAL001",
      "extra",
      "parameters",
      "ignored",
    );
    assertEquals(result, "[VAL001] Input cannot be empty");
  });

  it("should convert non-string parameters to strings", () => {
    const result = formatErrorMessage("VAL005", 123, { error: "invalid" });
    assertEquals(result, "[VAL005] Invalid path: 123 - [object Object]");
  });

  it("should handle null and undefined parameters", () => {
    const result1 = formatErrorMessage("PRO001", null, undefined);
    assertEquals(
      result1,
      "[PRO001] Failed to extract frontmatter from null: undefined",
    );

    const result2 = formatErrorMessage("IO003", undefined, null);
    assertEquals(result2, "[IO003] Failed to read undefined: null");
  });
});

describe("Edge Cases and Integration", () => {
  it("should maintain consistency between ErrorMessages and formatErrorMessage", () => {
    // Test that formatErrorMessage produces the same result as direct ErrorMessages usage
    const directMessage = ErrorMessages.INVALID_FORMAT("json", "invalid");
    const formattedMessage = formatErrorMessage("VAL002", "json", "invalid");

    assertEquals(formattedMessage, `[VAL002] ${directMessage}`);
  });

  it("should handle very long error messages", () => {
    const longPath = "/very/long/path/to/file/" + "segment/".repeat(100) +
      "file.txt";
    const longReason = "reason ".repeat(100);

    const result = formatErrorMessage("IO003", longPath, longReason);
    assertStringIncludes(result, "[IO003]");
    assertStringIncludes(result, "Failed to read");
  });

  it("should handle unicode characters", () => {
    const unicodePath = "/path/with/émojis/🚀/file.txt";
    const unicodeReason = "原因不明";

    const result = formatErrorMessage("IO004", unicodePath, unicodeReason);
    assertEquals(result.includes(unicodePath), true);
    assertEquals(result.includes(unicodeReason), true);
  });

  it("should handle circular references gracefully", () => {
    const circular: { name: string; self?: unknown } = { name: "test" };
    circular.self = circular;

    // Should not throw, even with circular references
    const result = formatErrorMessage("DOM999", "test", circular);
    assertStringIncludes(result, "[DOM999]");
    assertStringIncludes(result, "Unexpected error");
  });

  it("should handle boolean and number parameters correctly", () => {
    const result1 = formatErrorMessage("VAL004", true, 0, 1);
    assertEquals(result1, "[VAL004] Value true is out of range [0, 1]");

    const result2 = formatErrorMessage("AI001", 1000, 500);
    assertEquals(result2, "[AI001] Prompt length 1000 exceeds maximum 500");
  });

  it("should preserve error message consistency", () => {
    // Verify that constant error messages remain consistent across calls
    const message1 = ErrorMessages.EMPTY_INPUT;
    const message2 = ErrorMessages.EMPTY_INPUT;

    assertEquals(message1, message2);
    assertEquals(message1, "Input cannot be empty");
  });
});
