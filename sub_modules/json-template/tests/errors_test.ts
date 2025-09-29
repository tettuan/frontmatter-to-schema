/**
 * Tests for custom error classes
 */

import { assertEquals, assertInstanceOf } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  JsonTemplateError,
  TemplateNotFoundError,
  VariableNotFoundError,
  InvalidJsonError,
  TemplateReadError
} from '../src/errors.ts';

Deno.test("JsonTemplateError - basic functionality", () => {
  const error = new JsonTemplateError("Test message", "TEST_CODE");

  assertEquals(error.message, "Test message");
  assertEquals(error.code, "TEST_CODE");
  assertEquals(error.name, "JsonTemplateError");
  assertEquals(error.templatePath, undefined);
  assertEquals(error.variablePath, undefined);
  assertEquals(error.originalError, undefined);
  assertInstanceOf(error, Error);
  assertInstanceOf(error, JsonTemplateError);
});

Deno.test("JsonTemplateError - with all parameters", () => {
  const originalError = new Error("Original error");
  const error = new JsonTemplateError(
    "Test message",
    "TEST_CODE",
    "/path/to/template.json",
    "variable.path",
    originalError
  );

  assertEquals(error.message, "Test message");
  assertEquals(error.code, "TEST_CODE");
  assertEquals(error.templatePath, "/path/to/template.json");
  assertEquals(error.variablePath, "variable.path");
  assertEquals(error.originalError, originalError);
});

Deno.test("TemplateNotFoundError", () => {
  const error = new TemplateNotFoundError("/path/to/template.json");

  assertEquals(error.message, "Template file not found: /path/to/template.json");
  assertEquals(error.code, "TEMPLATE_NOT_FOUND");
  assertEquals(error.name, "TemplateNotFoundError");
  assertEquals(error.templatePath, "/path/to/template.json");
  assertInstanceOf(error, JsonTemplateError);
  assertInstanceOf(error, TemplateNotFoundError);
});

Deno.test("VariableNotFoundError - without template path", () => {
  const error = new VariableNotFoundError("user.name");

  assertEquals(error.message, "Variable not found: user.name");
  assertEquals(error.code, "VARIABLE_NOT_FOUND");
  assertEquals(error.name, "VariableNotFoundError");
  assertEquals(error.variablePath, "user.name");
  assertEquals(error.templatePath, undefined);
  assertInstanceOf(error, JsonTemplateError);
  assertInstanceOf(error, VariableNotFoundError);
});

Deno.test("VariableNotFoundError - with template path", () => {
  const error = new VariableNotFoundError("user.name", "/path/to/template.json");

  assertEquals(error.message, "Variable not found: user.name");
  assertEquals(error.code, "VARIABLE_NOT_FOUND");
  assertEquals(error.name, "VariableNotFoundError");
  assertEquals(error.variablePath, "user.name");
  assertEquals(error.templatePath, "/path/to/template.json");
});

Deno.test("InvalidJsonError", () => {
  const originalError = new SyntaxError("Unexpected token");
  const error = new InvalidJsonError("/path/to/template.json", originalError);

  assertEquals(error.message, "Invalid JSON after template processing: Unexpected token");
  assertEquals(error.code, "INVALID_JSON");
  assertEquals(error.name, "InvalidJsonError");
  assertEquals(error.templatePath, "/path/to/template.json");
  assertEquals(error.originalError, originalError);
  assertInstanceOf(error, JsonTemplateError);
  assertInstanceOf(error, InvalidJsonError);
});

Deno.test("TemplateReadError", () => {
  const originalError = new Error("Permission denied");
  const error = new TemplateReadError("/path/to/template.json", originalError);

  assertEquals(error.message, "Failed to read template file: Permission denied");
  assertEquals(error.code, "TEMPLATE_READ_ERROR");
  assertEquals(error.name, "TemplateReadError");
  assertEquals(error.templatePath, "/path/to/template.json");
  assertEquals(error.originalError, originalError);
  assertInstanceOf(error, JsonTemplateError);
  assertInstanceOf(error, TemplateReadError);
});

Deno.test("Error inheritance chain", () => {
  const error = new VariableNotFoundError("test.path");

  assertInstanceOf(error, Error);
  assertInstanceOf(error, JsonTemplateError);
  assertInstanceOf(error, VariableNotFoundError);
});

Deno.test("Error codes are unique", () => {
  const errors = [
    new TemplateNotFoundError("path"),
    new VariableNotFoundError("path"),
    new InvalidJsonError("path", new Error()),
    new TemplateReadError("path", new Error())
  ];

  const codes = errors.map(e => e.code);
  const uniqueCodes = new Set(codes);

  assertEquals(codes.length, uniqueCodes.size, "All error codes should be unique");
});