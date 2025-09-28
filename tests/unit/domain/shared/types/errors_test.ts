import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { createError } from "../../../../../src/domain/shared/types/errors.ts";

describe("Error Types", () => {
  describe("createError function", () => {
    describe("ValidationError types", () => {
      it("should create OutOfRange error", () => {
        const error = createError({
          kind: "OutOfRange",
          value: 101,
          min: 0,
          max: 100,
        });
        assertEquals(error.kind, "OutOfRange");
        assertEquals(error.value, 101);
        assertEquals(error.min, 0);
        assertEquals(error.max, 100);
      });

      it("should create InvalidRegex error", () => {
        const error = createError({
          kind: "InvalidRegex",
          pattern: "[invalid",
        });
        assertEquals(error.kind, "InvalidRegex");
        assertEquals(error.pattern, "[invalid");
      });

      it("should create PatternMismatch error", () => {
        const error = createError({
          kind: "PatternMismatch",
          value: "test123",
          pattern: "^[a-z]+$",
        });
        assertEquals(error.kind, "PatternMismatch");
        assertEquals(error.value, "test123");
        assertEquals(error.pattern, "^[a-z]+$");
      });

      it("should create ParseError with optional field", () => {
        const error1 = createError({
          kind: "ParseError",
          input: "invalid json",
        });
        assertEquals(error1.kind, "ParseError");
        assertEquals(error1.input, "invalid json");
        assertEquals(error1.field, undefined);

        const error2 = createError({
          kind: "ParseError",
          input: "invalid json",
          field: "config",
        });
        assertEquals(error2.field, "config");
      });

      it("should create EmptyInput error", () => {
        const error = createError({ kind: "EmptyInput" });
        assertEquals(error.kind, "EmptyInput");
      });

      it("should create TooLong error", () => {
        const error = createError({
          kind: "TooLong",
          value: "a".repeat(300),
          maxLength: 255,
        });
        assertEquals(error.kind, "TooLong");
        assertEquals(error.value.length, 300);
        assertEquals(error.maxLength, 255);
      });

      it("should create InvalidType error", () => {
        const error = createError({
          kind: "InvalidType",
          expected: "string",
          actual: "number",
        });
        assertEquals(error.kind, "InvalidType");
        assertEquals(error.expected, "string");
        assertEquals(error.actual, "number");
      });

      it("should create MissingRequired error", () => {
        const error = createError({
          kind: "MissingRequired",
          field: "username",
        });
        assertEquals(error.kind, "MissingRequired");
        assertEquals(error.field, "username");
      });

      it("should create TooManyArguments error", () => {
        const error = createError({
          kind: "TooManyArguments",
          field: "parameters",
        });
        assertEquals(error.kind, "TooManyArguments");
        assertEquals(error.field, "parameters");
      });

      it("should create InvalidFormat error with optional fields", () => {
        const error = createError({
          kind: "InvalidFormat",
          format: "email",
          value: "notanemail",
          field: "userEmail",
        });
        assertEquals(error.kind, "InvalidFormat");
        assertEquals(error.format, "email");
        assertEquals(error.value, "notanemail");
        assertEquals(error.field, "userEmail");
      });
    });

    describe("SchemaError types", () => {
      it("should create SchemaNotFound error", () => {
        const error = createError({
          kind: "SchemaNotFound",
          path: "/schemas/user.json",
        });
        assertEquals(error.kind, "SchemaNotFound");
        assertEquals((error as any).path, "/schemas/user.json");
      });

      it("should create InvalidSchema error", () => {
        const error = createError({
          kind: "InvalidSchema",
          message: "Schema must have a type property",
        });
        assertEquals(error.kind, "InvalidSchema");
        assertEquals((error as any).message, "Schema must have a type property");
      });

      it("should create RefResolutionFailed error", () => {
        const error = createError({
          kind: "RefResolutionFailed",
          ref: "#/definitions/User",
          message: "Definition not found",
        });
        assertEquals(error.kind, "RefResolutionFailed");
        assertEquals((error as any).ref, "#/definitions/User");
        assertEquals((error as any).message, "Definition not found");
      });

      it("should create CircularReference error", () => {
        const error = createError({
          kind: "CircularReference",
          refs: ["#/a", "#/b", "#/a"],
        });
        assertEquals(error.kind, "CircularReference");
        assertEquals(error.refs, ["#/a", "#/b", "#/a"]);
      });

      it("should create template-related errors", () => {
        const errors = [
          createError({ kind: "TemplateNotDefined" }),
          createError({ kind: "TemplateItemsNotDefined" }),
          createError({ kind: "TemplateFormatNotDefined" }),
          createError({ kind: "InvalidTemplateFormat" }),
          createError({ kind: "JMESPathFilterNotDefined" }),
        ];

        assertEquals(errors[0].kind, "TemplateNotDefined");
        assertEquals(errors[1].kind, "TemplateItemsNotDefined");
        assertEquals(errors[2].kind, "TemplateFormatNotDefined");
        assertEquals(errors[3].kind, "InvalidTemplateFormat");
        assertEquals(errors[4].kind, "JMESPathFilterNotDefined");
      });

      it("should create JMESPath errors", () => {
        const compilationError = createError({
          kind: "JMESPathCompilationFailed",
          expression: "[?invalid",
          message: "Unexpected token",
        });
        assertEquals(compilationError.kind, "JMESPathCompilationFailed");
        assertEquals((compilationError as any).expression, "[?invalid");
        assertEquals((compilationError as any).message, "Unexpected token");

        const executionError = createError({
          kind: "JMESPathExecutionFailed",
          expression: "foo.bar",
          message: "Cannot read property of null",
        });
        assertEquals(executionError.kind, "JMESPathExecutionFailed");

        const resultError = createError({
          kind: "InvalidJMESPathResult",
          expression: "length(@)",
          result: "not an array",
        });
        assertEquals(resultError.kind, "InvalidJMESPathResult");
        assertEquals((resultError as any).result, "not an array");
      });
    });

    describe("FrontmatterError types", () => {
      it("should create ExtractionFailed error", () => {
        const error = createError({
          kind: "ExtractionFailed",
          message: "Could not parse frontmatter",
        });
        assertEquals(error.kind, "ExtractionFailed");
        assertEquals((error as any).message, "Could not parse frontmatter");
      });

      it("should create InvalidYaml error", () => {
        const error = createError({
          kind: "InvalidYaml",
          message: "Unexpected indentation",
        });
        assertEquals(error.kind, "InvalidYaml");
        assertEquals((error as any).message, "Unexpected indentation");
      });

      it("should create NoFrontmatter error", () => {
        const error = createError({ kind: "NoFrontmatter" });
        assertEquals(error.kind, "NoFrontmatter");
      });

      it("should create MalformedFrontmatter error", () => {
        const error = createError({
          kind: "MalformedFrontmatter",
          content: "---\nincomplete",
        });
        assertEquals(error.kind, "MalformedFrontmatter");
        assertEquals((error as any).content, "---\nincomplete");
      });
    });

    describe("TemplateError types", () => {
      it("should create TemplateNotFound error", () => {
        const error = createError({
          kind: "TemplateNotFound",
          path: "/templates/main.njk",
        });
        assertEquals(error.kind, "TemplateNotFound");
        assertEquals(error.path, "/templates/main.njk");
      });

      it("should create InvalidTemplate error", () => {
        const error = createError({
          kind: "InvalidTemplate",
          message: "Unclosed tag",
        });
        assertEquals(error.kind, "InvalidTemplate");
        assertEquals((error as any).message, "Unclosed tag");
      });

      it("should create VariableNotFound error", () => {
        const error = createError({
          kind: "VariableNotFound",
          variable: "user.name",
        });
        assertEquals(error.kind, "VariableNotFound");
        assertEquals(error.variable, "user.name");
      });

      it("should create RenderFailed error", () => {
        const error = createError({
          kind: "RenderFailed",
          message: "Template rendering failed",
        });
        assertEquals(error.kind, "RenderFailed");
        assertEquals((error as any).message, "Template rendering failed");
      });

      it("should create template structure errors", () => {
        const structureError = createError({
          kind: "TemplateStructureInvalid",
          template: "{{unclosed",
          issue: "Unclosed variable tag",
        });
        assertEquals(structureError.kind, "TemplateStructureInvalid");
        assertEquals(structureError.template, "{{unclosed");
        assertEquals(structureError.issue, "Unclosed variable tag");

        const resolutionError = createError({
          kind: "VariableResolutionFailed",
          variable: "items[0].id",
          reason: "Array is empty",
        });
        assertEquals(resolutionError.kind, "VariableResolutionFailed");
        assertEquals(resolutionError.variable, "items[0].id");
        assertEquals(resolutionError.reason, "Array is empty");

        const compositionError = createError({
          kind: "DataCompositionFailed",
          reason: "Incompatible data types",
        });
        assertEquals(compositionError.kind, "DataCompositionFailed");
        assertEquals(compositionError.reason, "Incompatible data types");
      });
    });

    describe("FileSystemError types", () => {
      it("should create FileNotFound error", () => {
        const error = createError({
          kind: "FileNotFound",
          path: "/missing/file.txt",
        });
        assertEquals(error.kind, "FileNotFound");
        assertEquals(error.path, "/missing/file.txt");
      });

      it("should create ReadFailed error", () => {
        const error = createError({
          kind: "ReadFailed",
          path: "/corrupted/file.dat",
          message: "Unexpected end of file",
        });
        assertEquals(error.kind, "ReadFailed");
        assertEquals((error as any).path, "/corrupted/file.dat");
        assertEquals((error as any).message, "Unexpected end of file");
      });

      it("should create WriteFailed error", () => {
        const error = createError({
          kind: "WriteFailed",
          path: "/readonly/file.txt",
          message: "Permission denied",
        });
        assertEquals(error.kind, "WriteFailed");
        assertEquals((error as any).path, "/readonly/file.txt");
        assertEquals((error as any).message, "Permission denied");
      });

      it("should create InvalidPath error", () => {
        const error = createError({
          kind: "InvalidPath",
          path: "../../etc/passwd",
        });
        assertEquals(error.kind, "InvalidPath");
        assertEquals(error.path, "../../etc/passwd");
      });

      it("should create PermissionDenied error", () => {
        const error = createError({
          kind: "PermissionDenied",
          path: "/system/protected.cfg",
        });
        assertEquals(error.kind, "PermissionDenied");
        assertEquals(error.path, "/system/protected.cfg");
      });
    });

    describe("SystemError types", () => {
      it("should create InitializationError", () => {
        const error = createError({
          kind: "InitializationError",
          message: "Failed to initialize database connection",
        });
        assertEquals(error.kind, "InitializationError");
        assertEquals((error as any).message, "Failed to initialize database connection");
      });

      it("should create ConfigurationError", () => {
        const error = createError({
          kind: "ConfigurationError",
          message: "Invalid configuration: missing API key",
        });
        assertEquals(error.kind, "ConfigurationError");
        assertEquals((error as any).message, "Invalid configuration: missing API key");
      });

      it("should create MemoryBoundsViolation", () => {
        const error = createError({
          kind: "MemoryBoundsViolation",
          content: "Memory limit exceeded",
        });
        assertEquals(error.kind, "MemoryBoundsViolation");
        assertEquals((error as any).content, "Memory limit exceeded");
      });
    });

    describe("ProcessingError types", () => {
      it("should create EXCEPTION_CAUGHT error", () => {
        const error = createError({
          kind: "EXCEPTION_CAUGHT",
          code: "ERR_001",
        });
        assertEquals(error.kind, "EXCEPTION_CAUGHT");
        assertEquals((error as any).code, "ERR_001");
      });

      it("should create UNKNOWN_ERROR", () => {
        const error = createError({
          kind: "UNKNOWN_ERROR",
          code: "ERR_002",
        });
        assertEquals(error.kind, "UNKNOWN_ERROR");
        assertEquals((error as any).code, "ERR_002");
      });
    });

    describe("Error type discrimination", () => {
      it("should properly discriminate between error types", () => {
        const validationError = createError({ kind: "EmptyInput" });
        const schemaError = createError({ kind: "SchemaNotFound", path: "/test" });
        const frontmatterError = createError({ kind: "NoFrontmatter" });

        // Type guards would work in TypeScript
        assertEquals(validationError.kind === "EmptyInput", true);
        assertEquals(schemaError.kind === "SchemaNotFound", true);
        assertEquals(frontmatterError.kind === "NoFrontmatter", true);

        // Different error types - check they exist and are different
        assertEquals("kind" in validationError, true);
        assertEquals("kind" in schemaError, true);
        assertEquals("kind" in frontmatterError, true);
      });

      it("should handle all error message properties", () => {
        const errorWithMessage = createError({
          kind: "ExtractionFailed",
          message: "Test message",
        });
        assertEquals("message" in errorWithMessage, true);
        assertEquals((errorWithMessage as any).message, "Test message");

        const errorWithoutMessage = createError({ kind: "EmptyInput" });
        assertEquals("message" in errorWithoutMessage, false);
      });
    });
  });
});