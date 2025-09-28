import { assertEquals } from "jsr:@std/assert";
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
        assertEquals((error as any).value, 101);
        assertEquals((error as any).min, 0);
        assertEquals((error as any).max, 100);
      });

      it("should create EmptyInput error", () => {
        const error = createError({ kind: "EmptyInput" });
        assertEquals(error.kind, "EmptyInput");
      });

      it("should create InvalidType error", () => {
        const error = createError({
          kind: "InvalidType",
          expected: "string",
          actual: "number",
        });
        assertEquals(error.kind, "InvalidType");
        assertEquals((error as any).expected, "string");
        assertEquals((error as any).actual, "number");
      });

      it("should create MissingRequired error", () => {
        const error = createError({
          kind: "MissingRequired",
          field: "username",
        });
        assertEquals(error.kind, "MissingRequired");
        assertEquals((error as any).field, "username");
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

      it("should create CircularReference error", () => {
        const error = createError({
          kind: "CircularReference",
          refs: ["#/a", "#/b", "#/a"],
        });
        assertEquals(error.kind, "CircularReference");
        assertEquals((error as any).refs, ["#/a", "#/b", "#/a"]);
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
    });

    describe("FrontmatterError types", () => {
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
        assertEquals((error as any).path, "/templates/main.njk");
      });

      it("should create VariableNotFound error", () => {
        const error = createError({
          kind: "VariableNotFound",
          variable: "user.name",
        });
        assertEquals(error.kind, "VariableNotFound");
        assertEquals((error as any).variable, "user.name");
      });

      it("should create template structure errors", () => {
        const structureError = createError({
          kind: "TemplateStructureInvalid",
          template: "{{unclosed",
          issue: "Unclosed variable tag",
        });
        assertEquals(structureError.kind, "TemplateStructureInvalid");
        assertEquals((structureError as any).template, "{{unclosed");
        assertEquals((structureError as any).issue, "Unclosed variable tag");

        const resolutionError = createError({
          kind: "VariableResolutionFailed",
          variable: "items[0].id",
          reason: "Array is empty",
        });
        assertEquals(resolutionError.kind, "VariableResolutionFailed");
        assertEquals((resolutionError as any).variable, "items[0].id");
        assertEquals((resolutionError as any).reason, "Array is empty");

        const compositionError = createError({
          kind: "DataCompositionFailed",
          reason: "Incompatible data types",
        });
        assertEquals(compositionError.kind, "DataCompositionFailed");
        assertEquals((compositionError as any).reason, "Incompatible data types");
      });
    });

    describe("FileSystemError types", () => {
      it("should create FileNotFound error", () => {
        const error = createError({
          kind: "FileNotFound",
          path: "/missing/file.txt",
        });
        assertEquals(error.kind, "FileNotFound");
        assertEquals((error as any).path, "/missing/file.txt");
      });

      it("should create InvalidPath error", () => {
        const error = createError({
          kind: "InvalidPath",
          path: "../../etc/passwd",
        });
        assertEquals(error.kind, "InvalidPath");
        assertEquals((error as any).path, "../../etc/passwd");
      });

      it("should create PermissionDenied error", () => {
        const error = createError({
          kind: "PermissionDenied",
          path: "/system/protected.cfg",
        });
        assertEquals(error.kind, "PermissionDenied");
        assertEquals((error as any).path, "/system/protected.cfg");
      });
    });

    describe("SystemError types", () => {
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

      it("should have message property on all errors", () => {
        const error = createError({ kind: "EmptyInput" });
        assertEquals("message" in error, true);
        assertEquals(typeof (error as any).message, "string");
      });
    });
  });
});