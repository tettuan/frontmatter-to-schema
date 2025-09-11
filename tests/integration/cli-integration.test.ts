import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { join } from "jsr:@std/path";
import { exists } from "jsr:@std/fs";

// Helper to run CLI commands
async function runCLI(args: string[]): Promise<{ success: boolean; output: string; error: string }> {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-all", "cli.ts", ...args],
    stdout: "piped",
    stderr: "piped",
  });

  const process = await cmd.output();
  const output = new TextDecoder().decode(process.stdout);
  const error = new TextDecoder().decode(process.stderr);

  return {
    success: process.success,
    output,
    error,
  };
}

// Create test fixtures
const setupTestFixtures = async (baseDir: string) => {
  await Deno.mkdir(join(baseDir, "markdown"), { recursive: true });
  await Deno.mkdir(join(baseDir, "output"), { recursive: true });
  
  // Create test markdown files
  await Deno.writeTextFile(
    join(baseDir, "markdown", "test1.md"),
    `---
title: "CLI Test 1"
author: "Test Author"
tags: ["cli", "test"]
date: "2024-01-01"
---

# CLI Test Document 1

This is for CLI integration testing.
`
  );
  
  await Deno.writeTextFile(
    join(baseDir, "markdown", "test2.md"),
    `---
title: "CLI Test 2"
author: "Another Author"
tags: ["integration", "e2e"]
date: "2024-01-02"
---

# CLI Test Document 2

Another document for testing.
`
  );

  // Create schema file
  await Deno.writeTextFile(
    join(baseDir, "schema.json"),
    JSON.stringify({
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "author": { "type": "string" },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        },
        "date": { "type": "string" }
      },
      "required": ["title", "author"]
    }, null, 2)
  );

  // Create template file
  await Deno.writeTextFile(
    join(baseDir, "template.json"),
    JSON.stringify({
      "documents": "{{documents}}",
      "count": "{{count}}",
      "timestamp": "{{timestamp}}"
    }, null, 2)
  );
};

Deno.test("CLI Integration: Basic Command Execution", async (t) => {
  const TEST_DIR = await Deno.makeTempDir({ prefix: "cli-test-" });
  
  try {
    await setupTestFixtures(TEST_DIR);

    await t.step("should show help with --help flag", async () => {
      const result = await runCLI(["--help"]);
      assertEquals(result.success, true);
      assertStringIncludes(result.output, "frontmatter-to-schema");
      assertStringIncludes(result.output, "Usage:");
      assertStringIncludes(result.output, "Options:");
    });

    await t.step("should show help with -h flag", async () => {
      const result = await runCLI(["-h"]);
      assertEquals(result.success, true);
      assertStringIncludes(result.output, "frontmatter-to-schema");
    });

    await t.step("should process files with command line arguments", async () => {
      const result = await runCLI([
        "-i", join(TEST_DIR, "markdown"),
        "-s", join(TEST_DIR, "schema.json"),
        "-t", join(TEST_DIR, "template.json"),
        "-o", join(TEST_DIR, "output", "cli-output.json")
      ]);
      
      assertEquals(result.success, true);
      assertStringIncludes(result.output, "Processing completed successfully");
      
      // Verify output file was created
      const outputExists = await exists(join(TEST_DIR, "output", "cli-output.json"));
      assertEquals(outputExists, true);
    });

    await t.step("should support verbose mode", async () => {
      const result = await runCLI([
        "-i", join(TEST_DIR, "markdown", "test1.md"),
        "-s", join(TEST_DIR, "schema.json"),
        "-t", join(TEST_DIR, "template.json"),
        "-o", join(TEST_DIR, "output", "verbose-output.json"),
        "--verbose"
      ]);
      
      assertEquals(result.success, true);
      assertStringIncludes(result.output, "Verbose mode enabled");
    });

    await t.step("should support -v flag for verbose", async () => {
      const result = await runCLI([
        "-i", join(TEST_DIR, "markdown", "test1.md"),
        "-s", join(TEST_DIR, "schema.json"),
        "-t", join(TEST_DIR, "template.json"),
        "-o", join(TEST_DIR, "output", "verbose-v-output.json"),
        "-v"
      ]);
      
      assertEquals(result.success, true);
      assertStringIncludes(result.output, "Verbose mode enabled");
    });

  } finally {
    await Deno.remove(TEST_DIR, { recursive: true }).catch(() => {});
  }
});

Deno.test("CLI Integration: Configuration File Support", async (t) => {
  const TEST_DIR = await Deno.makeTempDir({ prefix: "cli-config-" });
  
  try {
    await setupTestFixtures(TEST_DIR);

    await t.step("should process with configuration file", async () => {
      // Create config file
      const config = {
        input: {
          path: join(TEST_DIR, "markdown"),
          pattern: "\\.md$"
        },
        schema: {
          definition: JSON.parse(await Deno.readTextFile(join(TEST_DIR, "schema.json"))),
          format: "json"
        },
        template: {
          definition: await Deno.readTextFile(join(TEST_DIR, "template.json")),
          format: "json"
        },
        output: {
          path: join(TEST_DIR, "output", "config-output.json"),
          format: "json"
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      await Deno.writeTextFile(
        join(TEST_DIR, "config.json"),
        JSON.stringify(config, null, 2)
      );

      const result = await runCLI([
        "-c", join(TEST_DIR, "config.json")
      ]);
      
      assertEquals(result.success, true);
      assertStringIncludes(result.output, "Processing completed successfully");
      
      // Verify output file was created
      const outputExists = await exists(join(TEST_DIR, "output", "config-output.json"));
      assertEquals(outputExists, true);
    });

    await t.step("should override config file with command line args", async () => {
      const result = await runCLI([
        "-c", join(TEST_DIR, "config.json"),
        "-o", join(TEST_DIR, "output", "override-output.json")
      ]);
      
      assertEquals(result.success, true);
      
      // Verify override output file was created
      const outputExists = await exists(join(TEST_DIR, "output", "override-output.json"));
      assertEquals(outputExists, true);
    });

  } finally {
    await Deno.remove(TEST_DIR, { recursive: true }).catch(() => {});
  }
});

Deno.test("CLI Integration: Error Handling", async (t) => {
  const TEST_DIR = await Deno.makeTempDir({ prefix: "cli-error-" });
  
  try {
    await setupTestFixtures(TEST_DIR);

    await t.step("should handle missing required arguments", async () => {
      const result = await runCLI([]);
      assertEquals(result.success, false);
      assertStringIncludes(result.output, "Processing failed");
    });

    await t.step("should handle non-existent input file", async () => {
      const result = await runCLI([
        "-i", join(TEST_DIR, "nonexistent.md"),
        "-s", join(TEST_DIR, "schema.json"),
        "-t", join(TEST_DIR, "template.json"),
        "-o", join(TEST_DIR, "output", "error.json")
      ]);
      
      assertEquals(result.success, false);
      assertStringIncludes(result.output, "Processing failed");
    });

    await t.step("should handle non-existent schema file", async () => {
      const result = await runCLI([
        "-i", join(TEST_DIR, "markdown"),
        "-s", join(TEST_DIR, "nonexistent-schema.json"),
        "-t", join(TEST_DIR, "template.json"),
        "-o", join(TEST_DIR, "output", "error.json")
      ]);
      
      assertEquals(result.success, false);
      assertStringIncludes(result.output, "Processing failed");
    });

    await t.step("should handle invalid schema JSON", async () => {
      await Deno.writeTextFile(
        join(TEST_DIR, "invalid-schema.json"),
        "{ invalid json content"
      );

      const result = await runCLI([
        "-i", join(TEST_DIR, "markdown"),
        "-s", join(TEST_DIR, "invalid-schema.json"),
        "-t", join(TEST_DIR, "template.json"),
        "-o", join(TEST_DIR, "output", "error.json")
      ]);
      
      assertEquals(result.success, false);
      assertStringIncludes(result.output, "Processing failed");
    });

    await t.step("should handle markdown without frontmatter", async () => {
      await Deno.writeTextFile(
        join(TEST_DIR, "markdown", "no-frontmatter.md"),
        `# Document without frontmatter

Just content here.`
      );

      const result = await runCLI([
        "-i", join(TEST_DIR, "markdown", "no-frontmatter.md"),
        "-s", join(TEST_DIR, "schema.json"),
        "-t", join(TEST_DIR, "template.json"),
        "-o", join(TEST_DIR, "output", "no-fm-output.json")
      ]);
      
      // Should process but may have validation warnings
      assertEquals(result.success, true);
    });

  } finally {
    await Deno.remove(TEST_DIR, { recursive: true }).catch(() => {});
  }
});

Deno.test("CLI Integration: Output Format Support", async (t) => {
  const TEST_DIR = await Deno.makeTempDir({ prefix: "cli-format-" });
  
  try {
    await setupTestFixtures(TEST_DIR);

    await t.step("should generate JSON output", async () => {
      const result = await runCLI([
        "-i", join(TEST_DIR, "markdown", "test1.md"),
        "-s", join(TEST_DIR, "schema.json"),
        "-t", join(TEST_DIR, "template.json"),
        "-o", join(TEST_DIR, "output", "test.json")
      ]);
      
      assertEquals(result.success, true);
      
      const outputContent = await Deno.readTextFile(join(TEST_DIR, "output", "test.json"));
      // Verify it's valid JSON
      JSON.parse(outputContent);
    });

    await t.step("should generate YAML output", async () => {
      const result = await runCLI([
        "-i", join(TEST_DIR, "markdown", "test1.md"),
        "-s", join(TEST_DIR, "schema.json"),
        "-t", join(TEST_DIR, "template.json"),
        "-o", join(TEST_DIR, "output", "test.yaml")
      ]);
      
      assertEquals(result.success, true);
      
      const outputExists = await exists(join(TEST_DIR, "output", "test.yaml"));
      assertEquals(outputExists, true);
    });

    await t.step("should generate YML output", async () => {
      const result = await runCLI([
        "-i", join(TEST_DIR, "markdown", "test1.md"),
        "-s", join(TEST_DIR, "schema.json"),
        "-t", join(TEST_DIR, "template.json"),
        "-o", join(TEST_DIR, "output", "test.yml")
      ]);
      
      assertEquals(result.success, true);
      
      const outputExists = await exists(join(TEST_DIR, "output", "test.yml"));
      assertEquals(outputExists, true);
    });

  } finally {
    await Deno.remove(TEST_DIR, { recursive: true }).catch(() => {});
  }
});

Deno.test("CLI Integration: Directory Processing", async (t) => {
  const TEST_DIR = await Deno.makeTempDir({ prefix: "cli-dir-" });
  
  try {
    await setupTestFixtures(TEST_DIR);

    await t.step("should process entire directory", async () => {
      const result = await runCLI([
        "-i", join(TEST_DIR, "markdown"),
        "-s", join(TEST_DIR, "schema.json"),
        "-t", join(TEST_DIR, "template.json"),
        "-o", join(TEST_DIR, "output", "directory-output.json")
      ]);
      
      assertEquals(result.success, true);
      assertStringIncludes(result.output, "Processing completed successfully");
      
      const outputContent = await Deno.readTextFile(join(TEST_DIR, "output", "directory-output.json"));
      const parsed = JSON.parse(outputContent);
      // Should have processed multiple files
      assertExists(parsed);
    });

    await t.step("should handle empty directory", async () => {
      await Deno.mkdir(join(TEST_DIR, "empty"), { recursive: true });

      const result = await runCLI([
        "-i", join(TEST_DIR, "empty"),
        "-s", join(TEST_DIR, "schema.json"),
        "-t", join(TEST_DIR, "template.json"),
        "-o", join(TEST_DIR, "output", "empty-output.json")
      ]);
      
      // Should succeed but with no documents processed
      assertEquals(result.success, true);
    });

  } finally {
    await Deno.remove(TEST_DIR, { recursive: true }).catch(() => {});
  }
});

// Helper function to check if output exists
function assertExists(value: unknown): asserts value {
  if (value === null || value === undefined) {
    throw new Error("Value does not exist");
  }
}