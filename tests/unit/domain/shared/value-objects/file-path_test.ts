import { assertEquals } from "jsr:@std/assert";
import { FilePath } from "../../../../../src/domain/shared/value-objects/file-path.ts";

Deno.test("FilePath - create with valid path", () => {
  const result = FilePath.create("/valid/path/file.md");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().toString(), "/valid/path/file.md");
});

Deno.test("FilePath - create with relative path", () => {
  const result = FilePath.create("./relative/path/file.json");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().toString(), "./relative/path/file.json");
});

Deno.test("FilePath - reject empty path", () => {
  const result = FilePath.create("");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "EMPTY_PATH");
});

Deno.test("FilePath - reject whitespace-only path", () => {
  const result = FilePath.create("   ");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "EMPTY_PATH");
});

Deno.test("FilePath - getExtension returns file extension", () => {
  const filePath = FilePath.create("/path/to/file.json").unwrap();

  assertEquals(filePath.getExtension(), ".json");
});

Deno.test("FilePath - getExtension returns empty for no extension", () => {
  const filePath = FilePath.create("/path/to/file").unwrap();

  assertEquals(filePath.getExtension(), "");
});

Deno.test("FilePath - getBasename returns filename", () => {
  const filePath = FilePath.create("/path/to/file.json").unwrap();

  assertEquals(filePath.getBasename(), "file.json");
});

Deno.test("FilePath - getDirectory returns directory path", () => {
  const filePath = FilePath.create("/path/to/file.json").unwrap();

  assertEquals(filePath.getDirectory(), "/path/to");
});

Deno.test("FilePath - isAbsolute detects absolute paths", () => {
  const absolutePath = FilePath.create("/absolute/path/file.md").unwrap();
  const relativePath = FilePath.create("./relative/path/file.md").unwrap();

  assertEquals(absolutePath.isAbsolute(), true);
  assertEquals(relativePath.isAbsolute(), false);
});

Deno.test("FilePath - hasExtension checks for specific extension", () => {
  const jsonFile = FilePath.create("/path/file.json").unwrap();
  const mdFile = FilePath.create("/path/file.md").unwrap();

  assertEquals(jsonFile.hasExtension(".json"), true);
  assertEquals(jsonFile.hasExtension(".md"), false);
  assertEquals(mdFile.hasExtension(".md"), true);
});

Deno.test("FilePath - equals compares paths correctly", () => {
  const path1 = FilePath.create("/same/path.json").unwrap();
  const path2 = FilePath.create("/same/path.json").unwrap();
  const path3 = FilePath.create("/different/path.json").unwrap();

  assertEquals(path1.equals(path2), true);
  assertEquals(path1.equals(path3), false);
});
