import { assert, assertEquals } from "@std/assert";
import { TemplatePath } from "../../../../../src/domain/shared/value-objects/template-path.ts";
import { DIRECTIVE_NAMES } from "../../../../../src/domain/schema/constants/directive-names.ts";

Deno.test("TemplatePath - creates container template path", () => {
  const result = TemplatePath.create(
    "templates/container.json",
    "container",
    DIRECTIVE_NAMES.TEMPLATE
  );

  assert(result.isOk());
  const templatePath = result.unwrap();
  assertEquals(templatePath.path, "templates/container.json");
  assertEquals(templatePath.type, "container");
  assertEquals(templatePath.source, DIRECTIVE_NAMES.TEMPLATE);
  assert(templatePath.isContainer());
  assert(!templatePath.isItems());
});

Deno.test("TemplatePath - creates items template path", () => {
  const result = TemplatePath.create(
    "templates/items.json",
    "items",
    DIRECTIVE_NAMES.TEMPLATE_ITEMS
  );

  assert(result.isOk());
  const templatePath = result.unwrap();
  assertEquals(templatePath.path, "templates/items.json");
  assertEquals(templatePath.type, "items");
  assertEquals(templatePath.source, DIRECTIVE_NAMES.TEMPLATE_ITEMS);
  assert(!templatePath.isContainer());
  assert(templatePath.isItems());
});

Deno.test("TemplatePath - rejects empty path", () => {
  const result = TemplatePath.create(
    "",
    "container",
    DIRECTIVE_NAMES.TEMPLATE
  );

  assert(result.isError());
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_TEMPLATE_PATH");
  assert(error.message.includes("cannot be empty"));
});

Deno.test("TemplatePath - rejects whitespace-only path", () => {
  const result = TemplatePath.create(
    "   ",
    "container",
    DIRECTIVE_NAMES.TEMPLATE
  );

  assert(result.isError());
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_TEMPLATE_PATH");
});

Deno.test("TemplatePath - rejects path without .json extension", () => {
  const result = TemplatePath.create(
    "template.txt",
    "container",
    DIRECTIVE_NAMES.TEMPLATE
  );

  assert(result.isError());
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_TEMPLATE_PATH");
  assert(error.message.includes(".json extension"));
});

Deno.test("TemplatePath - rejects container type with wrong source", () => {
  const result = TemplatePath.create(
    "template.json",
    "container",
    DIRECTIVE_NAMES.TEMPLATE_ITEMS
  );

  assert(result.isError());
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_TEMPLATE_PATH");
  assert(error.message.includes("Container template must use x-template"));
});

Deno.test("TemplatePath - rejects items type with wrong source", () => {
  const result = TemplatePath.create(
    "template.json",
    "items",
    DIRECTIVE_NAMES.TEMPLATE
  );

  assert(result.isError());
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_TEMPLATE_PATH");
  assert(error.message.includes("Items template must use x-template-items"));
});

Deno.test("TemplatePath - equals returns true for same paths", () => {
  const path1 = TemplatePath.create(
    "template.json",
    "container",
    DIRECTIVE_NAMES.TEMPLATE
  ).unwrap();

  const path2 = TemplatePath.create(
    "template.json",
    "container",
    DIRECTIVE_NAMES.TEMPLATE
  ).unwrap();

  assert(path1.equals(path2));
});

Deno.test("TemplatePath - equals returns false for different paths", () => {
  const path1 = TemplatePath.create(
    "template1.json",
    "container",
    DIRECTIVE_NAMES.TEMPLATE
  ).unwrap();

  const path2 = TemplatePath.create(
    "template2.json",
    "container",
    DIRECTIVE_NAMES.TEMPLATE
  ).unwrap();

  assert(!path1.equals(path2));
});

Deno.test("TemplatePath - equals returns false for different types", () => {
  const path1 = TemplatePath.create(
    "template.json",
    "container",
    DIRECTIVE_NAMES.TEMPLATE
  ).unwrap();

  const path2 = TemplatePath.create(
    "template.json",
    "items",
    DIRECTIVE_NAMES.TEMPLATE_ITEMS
  ).unwrap();

  assert(!path1.equals(path2));
});

Deno.test("TemplatePath - toString returns formatted string", () => {
  const templatePath = TemplatePath.create(
    "template.json",
    "container",
    DIRECTIVE_NAMES.TEMPLATE
  ).unwrap();

  const str = templatePath.toString();
  assert(str.includes("template.json"));
  assert(str.includes("container"));
  assert(str.includes(DIRECTIVE_NAMES.TEMPLATE));
});
