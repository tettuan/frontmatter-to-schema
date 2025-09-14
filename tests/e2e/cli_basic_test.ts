import { assert } from "@std/assert";
import {
  assertFileExists,
  assertValidJson,
  createTestEnvironment,
  executeCliCommand,
  fileExists,
  parseJsonFile,
  readTestFile,
  writeTestFile,
} from "./helpers/e2e_test_helper.ts";
import { join } from "@std/path";

/**
 * E2E Tests for Basic CLI Functionality
 * Tests the core workflow: schema + markdown -> JSON output
 */
Deno.test("CLI Basic Functionality", async (t) => {
  await t.step("should show help when --help flag provided", async () => {
    const result = await executeCliCommand(["--help"]);

    if (!result.ok) {
      throw new Error(`CLI execution failed: ${result.error.message}`);
    }
    assert(
      result.data.stdout.includes("frontmatter-to-schema"),
      "Help output should contain tool name",
    );
    assert(
      result.data.stdout.includes("USAGE:"),
      "Help output should contain usage information",
    );
  });

  await t.step("should show version when --version flag provided", async () => {
    const result = await executeCliCommand(["--version"]);

    if (!result.ok) {
      throw new Error(`CLI execution failed: ${result.error.message}`);
    }
    assert(
      result.data.stdout.trim().length > 0,
      "Version output should not be empty",
    );
  });

  await t.step(
    "should exit with error when insufficient arguments provided",
    async () => {
      const result = await executeCliCommand([]);

      assert(!result.ok, "CLI should fail with no arguments");
      assert(
        result.error.kind === "CLIExecutionFailed",
        "Should be CLI execution failure",
      );
      assert(result.error.exitCode === 1, "Should exit with code 1");
    },
  );

  await t.step("should process valid schema and markdown files", async () => {
    // Arrange: Set up test environment
    const testEnvResult = await createTestEnvironment();
    if (!testEnvResult.ok) {
      throw new Error(
        `Failed to create test environment: ${testEnvResult.error.message}`,
      );
    }
    const { tempDir, cleanup } = testEnvResult.data;

    try {
      // Copy test fixtures to temp directory
      const schemaPath = join(tempDir, "schema.json");
      const templatePath = join(tempDir, "basic_template.json");
      const markdownPath = join(tempDir, "test.md");
      const outputPath = join(tempDir, "output.json");

      // Read fixtures from the fixtures directory
      const schemaContent = await Deno.readTextFile(
        "tests/e2e/fixtures/basic_schema.json",
      );
      const templateContent = await Deno.readTextFile(
        "tests/e2e/fixtures/basic_template.json",
      );
      const markdownContent = await Deno.readTextFile(
        "tests/e2e/fixtures/test_article.md",
      );

      // Write files to temp directory
      await writeTestFile(schemaPath, schemaContent);
      await writeTestFile(templatePath, templateContent);
      await writeTestFile(markdownPath, markdownContent);

      // Act: Execute CLI command
      const result = await executeCliCommand([
        schemaPath,
        outputPath,
        "*.md",
      ], { cwd: tempDir });

      // Assert: Validate results
      if (!result.ok) {
        throw new Error(`CLI execution failed: ${result.error.message}`);
      }

      const outputExists = await fileExists(outputPath);
      assertFileExists(outputPath, outputExists);

      // Validate output content
      const outputContentResult = await readTestFile(outputPath);
      if (!outputContentResult.ok) {
        throw new Error(
          `Failed to read output: ${outputContentResult.error.message}`,
        );
      }

      assertValidJson(outputContentResult.data);

      const outputJsonResult = await parseJsonFile<Record<string, unknown>>(
        outputPath,
      );
      if (!outputJsonResult.ok) {
        throw new Error(
          `Failed to parse output JSON: ${outputJsonResult.error.message}`,
        );
      }

      const outputJson = outputJsonResult.data;

      // Verify core fields exist and have expected content
      assert(outputJson.title === "E2E Test Article", "Title should match");
      assert(outputJson.author === "Test Author", "Author should match");

      // The template processing converts values to strings, so we need to check for that
      assert(
        outputJson.published === "true",
        `Published should be string "true". Got: ${outputJson.published}`,
      );

      // Tags are also converted to string representation
      assert(
        typeof outputJson.tags === "string",
        "Tags should be a string representation",
      );
      assert(
        outputJson.tags.includes("test") && outputJson.tags.includes("e2e"),
        "Tags should contain expected values",
      );

      // Verify template metadata was added
      assert(
        typeof outputJson.metadata === "object",
        "Metadata should be an object",
      );
      const metadata = outputJson.metadata as Record<string, unknown>;
      assert(metadata.processed === true, "Metadata processed should be true");
      assert(
        metadata.schema_version === "1.0.0",
        "Metadata version should be correct",
      );
    } finally {
      await cleanup();
    }
  });

  await t.step("should handle verbose flag correctly", async () => {
    // Arrange: Set up test environment
    const testEnvResult = await createTestEnvironment();
    if (!testEnvResult.ok) {
      throw new Error(
        `Failed to create test environment: ${testEnvResult.error.message}`,
      );
    }
    const { tempDir, cleanup } = testEnvResult.data;

    try {
      // Set up basic test files
      const schemaPath = join(tempDir, "schema.json");
      const templatePath = join(tempDir, "basic_template.json");
      const markdownPath = join(tempDir, "test.md");
      const outputPath = join(tempDir, "output.json");

      const schemaContent = await Deno.readTextFile(
        "tests/e2e/fixtures/basic_schema.json",
      );
      const templateContent = await Deno.readTextFile(
        "tests/e2e/fixtures/basic_template.json",
      );
      const markdownContent = await Deno.readTextFile(
        "tests/e2e/fixtures/test_article.md",
      );

      await writeTestFile(schemaPath, schemaContent);
      await writeTestFile(templatePath, templateContent);
      await writeTestFile(markdownPath, markdownContent);

      // Act: Execute CLI command with verbose flag
      const result = await executeCliCommand([
        schemaPath,
        outputPath,
        "*.md",
        "--verbose",
      ], { cwd: tempDir });

      // Assert: Should still succeed
      if (!result.ok) {
        throw new Error(
          `CLI execution with verbose flag failed: ${result.error.message}`,
        );
      }

      const outputExists = await fileExists(outputPath);
      assertFileExists(outputPath, outputExists);
    } finally {
      await cleanup();
    }
  });
});
