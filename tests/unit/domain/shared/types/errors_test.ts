import { assertEquals } from "jsr:@std/assert";
import {
  DomainError,
  FrontmatterError,
  SchemaError,
  TemplateError,
} from "../../../../../src/domain/shared/types/errors.ts";

Deno.test("DomainError - base error with message", () => {
  const error = new DomainError("Test error", "TEST_ERROR");

  assertEquals(error.message, "Test error");
  assertEquals(error.code, "TEST_ERROR");
  assertEquals(error.toString(), "DomainError [TEST_ERROR]: Test error");
});

Deno.test("SchemaError - schema-specific error", () => {
  const error = new SchemaError("Invalid schema format", "INVALID_SCHEMA");

  assertEquals(error.message, "Invalid schema format");
  assertEquals(error.code, "INVALID_SCHEMA");
  assertEquals(
    error.toString(),
    "SchemaError [INVALID_SCHEMA]: Invalid schema format",
  );
});

Deno.test("FrontmatterError - frontmatter-specific error", () => {
  const error = new FrontmatterError(
    "Failed to parse frontmatter",
    "PARSE_ERROR",
  );

  assertEquals(error.message, "Failed to parse frontmatter");
  assertEquals(error.code, "PARSE_ERROR");
  assertEquals(
    error.toString(),
    "FrontmatterError [PARSE_ERROR]: Failed to parse frontmatter",
  );
});

Deno.test("TemplateError - template-specific error", () => {
  const error = new TemplateError("Template not found", "TEMPLATE_NOT_FOUND");

  assertEquals(error.message, "Template not found");
  assertEquals(error.code, "TEMPLATE_NOT_FOUND");
  assertEquals(
    error.toString(),
    "TemplateError [TEMPLATE_NOT_FOUND]: Template not found",
  );
});

Deno.test("Error inheritance", () => {
  const schemaError = new SchemaError("test", "TEST");
  const frontmatterError = new FrontmatterError("test", "TEST");
  const templateError = new TemplateError("test", "TEST");

  assertEquals(schemaError instanceof DomainError, true);
  assertEquals(frontmatterError instanceof DomainError, true);
  assertEquals(templateError instanceof DomainError, true);
});
