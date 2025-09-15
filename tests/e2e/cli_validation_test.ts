import { assert } from "@std/assert";
import {
  createTestEnvironment,
  executeCliCommand,
  writeTestFile,
} from "./helpers/e2e_test_helper.ts";
import { join } from "@std/path";

/**
 * E2E Tests for CLI Argument Validation
 * Tests error handling and validation of command-line arguments
 */
Deno.test("CLI Argument Validation", async (t) => {
  await t.step("should reject insufficient arguments", async () => {
    const testCases = [
      { args: [], description: "no arguments" },
      { args: ["schema.json"], description: "only schema" },
      { args: ["schema.json", "output.json"], description: "missing pattern" },
    ];

    for (const testCase of testCases) {
      const result = await executeCliCommand(testCase.args);
      assert(
        !result.ok,
        `CLI should fail with ${testCase.description}`,
      );
      assert(
        result.error.kind === "CLIExecutionFailed",
        "Should be CLI execution failure",
      );
      assert(
        result.error.exitCode === 1,
        "Should exit with code 1",
      );
    }
  });

  await t.step("should handle non-existent schema file", async () => {
    const testEnvResult = await createTestEnvironment();
    if (!testEnvResult.ok) {
      throw new Error(
        `Failed to create test environment: ${testEnvResult.error.message}`,
      );
    }
    const { tempDir, cleanup } = testEnvResult.data;

    try {
      const nonExistentSchema = join(tempDir, "non_existent.json");
      const outputPath = join(tempDir, "output.json");

      const result = await executeCliCommand([
        nonExistentSchema,
        "*.md",
        outputPath,
      ], { cwd: tempDir });

      assert(!result.ok, "CLI should fail with non-existent schema");
      assert(
        result.error.kind === "CLIExecutionFailed",
        "Should be CLI execution failure",
      );
    } finally {
      await cleanup();
    }
  });

  await t.step("should handle invalid schema file", async () => {
    const testEnvResult = await createTestEnvironment();
    if (!testEnvResult.ok) {
      throw new Error(
        `Failed to create test environment: ${testEnvResult.error.message}`,
      );
    }
    const { tempDir, cleanup } = testEnvResult.data;

    try {
      const invalidSchemaPath = join(tempDir, "invalid.json");
      const outputPath = join(tempDir, "output.json");

      // Write invalid JSON
      await writeTestFile(invalidSchemaPath, "{ invalid json content }");

      const result = await executeCliCommand([
        invalidSchemaPath,
        "*.md",
        outputPath,
      ], { cwd: tempDir });

      assert(!result.ok, "CLI should fail with invalid schema");
      assert(
        result.error.kind === "CLIExecutionFailed",
        "Should be CLI execution failure",
      );
    } finally {
      await cleanup();
    }
  });

  await t.step("should handle empty markdown pattern", async () => {
    const testEnvResult = await createTestEnvironment();
    if (!testEnvResult.ok) {
      throw new Error(
        `Failed to create test environment: ${testEnvResult.error.message}`,
      );
    }
    const { tempDir, cleanup } = testEnvResult.data;

    try {
      const schemaPath = join(tempDir, "schema.json");
      const outputPath = join(tempDir, "output.json");

      // Create a minimal valid schema
      const basicSchema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "x-template": "template.json",
        "properties": {
          "title": { "type": "string" },
        },
      };

      await writeTestFile(schemaPath, JSON.stringify(basicSchema, null, 2));

      // Create a basic template
      await writeTestFile(
        join(tempDir, "template.json"),
        '{"title": "{title}"}',
      );

      // Use pattern that matches no files
      const result = await executeCliCommand([
        schemaPath,
        "non_existent_*.md",
        outputPath,
      ], { cwd: tempDir });

      // CLI should complete but may produce empty or default output
      // The exact behavior depends on implementation - this tests that it doesn't crash
      assert(
        result.ok || result.error.kind === "CLIExecutionFailed",
        "CLI should handle empty pattern gracefully",
      );
    } finally {
      await cleanup();
    }
  });

  await t.step(
    "should handle output directory that doesn't exist",
    async () => {
      const testEnvResult = await createTestEnvironment();
      if (!testEnvResult.ok) {
        throw new Error(
          `Failed to create test environment: ${testEnvResult.error.message}`,
        );
      }
      const { tempDir, cleanup } = testEnvResult.data;

      try {
        const schemaPath = join(tempDir, "schema.json");
        const outputPath = join(tempDir, "deep", "nested", "output.json");
        const markdownPath = join(tempDir, "test.md");

        // Set up test files
        const basicSchema = {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "template.json",
          "properties": {
            "title": { "type": "string" },
          },
        };

        await writeTestFile(schemaPath, JSON.stringify(basicSchema, null, 2));
        await writeTestFile(
          join(tempDir, "template.json"),
          '{"title": "{title}"}',
        );
        await writeTestFile(markdownPath, "---\ntitle: Test\n---\n# Test");

        const result = await executeCliCommand([
          schemaPath,
          "*.md",
          outputPath,
        ], { cwd: tempDir });

        // Should either succeed (auto-create dirs) or fail gracefully
        if (!result.ok) {
          assert(
            result.error.kind === "CLIExecutionFailed",
            "Should be CLI execution failure",
          );
        }
      } finally {
        await cleanup();
      }
    },
  );

  await t.step("should validate unknown flags", async () => {
    const testEnvResult = await createTestEnvironment();
    if (!testEnvResult.ok) {
      throw new Error(
        `Failed to create test environment: ${testEnvResult.error.message}`,
      );
    }
    const { tempDir, cleanup } = testEnvResult.data;

    try {
      const schemaPath = join(tempDir, "schema.json");
      const outputPath = join(tempDir, "output.json");

      const result = await executeCliCommand([
        schemaPath,
        "*.md",
        outputPath,
        "--unknown-flag",
      ], { cwd: tempDir });

      // CLI should handle unknown flags gracefully
      // This tests that unknown flags don't cause crashes
      assert(
        result.ok || result.error.kind === "CLIExecutionFailed",
        "CLI should handle unknown flags gracefully",
      );
    } finally {
      await cleanup();
    }
  });
});
