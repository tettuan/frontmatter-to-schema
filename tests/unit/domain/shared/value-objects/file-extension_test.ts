/**
 * Tests for FileExtension value object
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { FileExtension } from "../../../../../src/domain/shared/value-objects/file-extension.ts";

Deno.test("FileExtension", async (t) => {
  await t.step("create() - valid extensions", () => {
    const cases = [
      { input: ".json", expected: ".json" },
      { input: "json", expected: ".json" },
      { input: ".MD", expected: ".md" },
      { input: "YAML", expected: ".yaml" },
      { input: ".ts", expected: ".ts" },
    ];

    for (const { input, expected } of cases) {
      const result = FileExtension.create(input);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getValue(), expected);
      }
    }
  });

  await t.step("create() - invalid extensions", () => {
    const cases = [
      { input: ".json.bak", reason: "multiple dots" },
      { input: ".json#", reason: "special characters" },
      { input: "..json", reason: "double dots" },
      { input: ".json ", reason: "trailing space" },
      {
        input: ".verylongextensionnamethatshouldnotbeallowed",
        reason: "too long",
      },
      { input: "", reason: "empty string" },
      { input: ".", reason: "just a dot" },
    ];

    for (const { input, reason } of cases) {
      const result = FileExtension.create(input);
      assertEquals(result.ok, false, `Should reject: ${reason}`);
      if (!result.ok) {
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    }
  });

  await t.step("fromPath() - extract extension from file path", () => {
    const cases = [
      { input: "schema.json", expected: ".json" },
      { input: "/path/to/file.md", expected: ".md" },
      { input: "document.test.yaml", expected: ".yaml" },
      { input: "../config/settings.yml", expected: ".yml" },
      { input: "FILE.JSON", expected: ".json" },
    ];

    for (const { input, expected } of cases) {
      const result = FileExtension.fromPath(input);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getValue(), expected);
      }
    }
  });

  await t.step("fromPath() - handle files without extensions", () => {
    const cases = [
      "README",
      "Dockerfile",
      "/path/to/file",
      "file.",
      "",
    ];

    for (const input of cases) {
      const result = FileExtension.fromPath(input);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
      }
    }
  });

  await t.step("getWithoutDot() - returns extension without dot", () => {
    const result = FileExtension.create(".json");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getWithoutDot(), "json");
    }
  });

  await t.step("equals() - compares extensions", () => {
    const ext1Result = FileExtension.create(".json");
    const ext2Result = FileExtension.create("JSON");
    const ext3Result = FileExtension.create(".yaml");

    assertEquals(ext1Result.ok, true);
    assertEquals(ext2Result.ok, true);
    assertEquals(ext3Result.ok, true);

    if (ext1Result.ok && ext2Result.ok && ext3Result.ok) {
      assertEquals(ext1Result.data.equals(ext2Result.data), true);
      assertEquals(ext1Result.data.equals(ext3Result.data), false);
    }
  });

  await t.step("matches() - checks string match", () => {
    const result = FileExtension.create(".json");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.matches(".json"), true);
      assertEquals(result.data.matches("json"), true);
      assertEquals(result.data.matches(".JSON"), true);
      assertEquals(result.data.matches(".yaml"), false);
    }
  });

  await t.step("toString() - returns string representation", () => {
    const result = FileExtension.create("json");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.toString(), ".json");
    }
  });
});
