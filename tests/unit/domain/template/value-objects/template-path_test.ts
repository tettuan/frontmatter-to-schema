import { assertEquals } from "jsr:@std/assert";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";

Deno.test("TemplatePath - create with valid JSON template path", () => {
  const result = TemplatePath.create("registry_template.json");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().toString(), "registry_template.json");
});

Deno.test("TemplatePath - create with absolute path", () => {
  const result = TemplatePath.create("/absolute/path/template.json");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().toString(), "/absolute/path/template.json");
});

Deno.test("TemplatePath - reject non-JSON extension", () => {
  const result = TemplatePath.create("template.yaml");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_EXTENSION");
});

Deno.test("TemplatePath - reject empty path", () => {
  const result = TemplatePath.create("");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "EMPTY_PATH");
});

Deno.test("TemplatePath - reject path without extension", () => {
  const result = TemplatePath.create("template");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_EXTENSION");
});

Deno.test("TemplatePath - getBasename returns filename", () => {
  const templatePath = TemplatePath.create("path/to/registry_template.json")
    .unwrap();

  assertEquals(templatePath.getBasename(), "registry_template.json");
});

Deno.test("TemplatePath - getTemplateName returns name without extension", () => {
  const templatePath = TemplatePath.create("registry_template.json").unwrap();

  assertEquals(templatePath.getTemplateName(), "registry_template");
});

Deno.test("TemplatePath - equals compares paths correctly", () => {
  const path1 = TemplatePath.create("same_template.json").unwrap();
  const path2 = TemplatePath.create("same_template.json").unwrap();
  const path3 = TemplatePath.create("different_template.json").unwrap();

  assertEquals(path1.equals(path2), true);
  assertEquals(path1.equals(path3), false);
});

Deno.test("TemplatePath - isItemsTemplate detects items template patterns", () => {
  const itemsTemplate = TemplatePath.create("registry_command_template.json")
    .unwrap();
  const itemsTemplate2 = TemplatePath.create("item_template.json").unwrap();
  const containerTemplate = TemplatePath.create("registry_template.json")
    .unwrap();

  assertEquals(itemsTemplate.isItemsTemplate(), true);
  assertEquals(itemsTemplate2.isItemsTemplate(), true);
  assertEquals(containerTemplate.isItemsTemplate(), false);
});

Deno.test("TemplatePath - getDirectory returns directory path", () => {
  const absolutePath = TemplatePath.create("/path/to/template.json").unwrap();
  const relativePath = TemplatePath.create("./templates/template.json")
    .unwrap();
  const localPath = TemplatePath.create("template.json").unwrap();

  assertEquals(absolutePath.getDirectory(), "/path/to");
  assertEquals(relativePath.getDirectory(), "./templates");
  assertEquals(localPath.getDirectory(), ".");
});
