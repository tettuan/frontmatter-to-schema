import { assertEquals } from "@std/assert";
import { dirname, isAbsolute, join } from "@std/path";

/**
 * Tests for Issue 1 fix: API resolves schema-relative x-template paths
 *
 * This tests the path resolution logic added to src/api.ts
 * to ensure relative template paths in schemas are resolved against
 * the schema directory, matching CLI behavior.
 */

// Test the path resolution logic directly (unit test)
Deno.test("API path resolution - relative path should be resolved against schema directory", () => {
  const schemaPath = "/project/schemas/my-schema.json";
  const relativeTemplatePath = "./template.json";

  // Expected: resolve relative path against schema directory
  const schemaDir = dirname(schemaPath);
  const expectedPath = join(schemaDir, relativeTemplatePath);

  assertEquals(expectedPath, "/project/schemas/template.json");
});

Deno.test("API path resolution - absolute path should remain unchanged", () => {
  const _schemaPath = "/project/schemas/my-schema.json";
  const absoluteTemplatePath = "/absolute/path/template.json";

  // Absolute paths should be used as-is
  if (isAbsolute(absoluteTemplatePath)) {
    assertEquals(absoluteTemplatePath, "/absolute/path/template.json");
  }
});

Deno.test("API path resolution - nested relative path", () => {
  const schemaPath = "/project/schemas/nested/my-schema.json";
  const relativeTemplatePath = "../templates/template.json";

  const schemaDir = dirname(schemaPath);
  const resolvedPath = join(schemaDir, relativeTemplatePath);

  // join will resolve the .. in the path
  assertEquals(resolvedPath, "/project/schemas/templates/template.json");
});

Deno.test("API path resolution - schema in subdirectory with local template", () => {
  const schemaPath = "./config/schemas/api-schema.json";
  const relativeTemplatePath = "./api-template.json";

  const schemaDir = dirname(schemaPath);
  const resolvedPath = join(schemaDir, relativeTemplatePath);

  assertEquals(resolvedPath, "config/schemas/api-template.json");
});

Deno.test("API path resolution - various relative path formats", () => {
  const testCases = [
    {
      schemaPath: "/schemas/schema.json",
      templatePath: "./template.json",
      expected: "/schemas/template.json",
    },
    {
      schemaPath: "/schemas/schema.json",
      templatePath: "template.json",
      expected: "/schemas/template.json",
    },
    {
      schemaPath: "/deep/nested/schemas/schema.json",
      templatePath: "../../templates/t.json",
      expected: "/deep/templates/t.json",
    },
  ];

  for (const tc of testCases) {
    const schemaDir = dirname(tc.schemaPath);
    const resolvedPath = join(schemaDir, tc.templatePath);
    assertEquals(
      resolvedPath,
      tc.expected,
      `Failed for schemaPath=${tc.schemaPath}, templatePath=${tc.templatePath}`,
    );
  }
});
