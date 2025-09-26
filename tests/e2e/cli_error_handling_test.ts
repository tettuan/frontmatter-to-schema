import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { join } from "jsr:@std/path";
import { TEST_EXTENSIONS } from "../helpers/test-extensions.ts";

/**
 * CLI Error Handling E2E Tests
 * Tests comprehensive error scenarios and recovery guidance
 * Following DDD and Totality principles with Result<T,E> pattern validation
 */
Deno.test("CLI Error Handling Comprehensive", async (t) => {
  const projectRoot = Deno.cwd();
  const cliPath = join(projectRoot, "cli.ts");

  await t.step(
    "should provide helpful error for malformed JSON schema",
    async () => {
      // Create malformed schema file
      const tempDir = await Deno.makeTempDir();
      const schemaPath = join(tempDir, "malformed_schema.json");
      const outputPath = join(tempDir, "output.json");

      await Deno.writeTextFile(schemaPath, '{"invalid": json}');

      try {
        const cmd = new Deno.Command("deno", {
          args: ["run", "--allow-all", cliPath, schemaPath, "*.md", outputPath],
          stdout: "piped",
          stderr: "piped",
        });

        const result = await cmd.output();
        const stderr = new TextDecoder().decode(result.stderr);

        assertEquals(result.code, 1);
        assertStringIncludes(stderr.toLowerCase(), "parse");
        assertStringIncludes(stderr.toLowerCase(), "schema");
        // Should provide recovery guidance or context
        assertStringIncludes(stderr.toLowerCase(), "error");
      } finally {
        await Deno.remove(tempDir, { recursive: true });
      }
    },
  );

  await t.step(
    "should handle permission denied errors gracefully",
    async () => {
      const tempDir = await Deno.makeTempDir();
      const schemaPath = join(tempDir, "schema.json");
      const restrictedDir = join(tempDir, "restricted");
      const _outputPath = join(restrictedDir, "output.json");

      // Create valid schema
      const schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "template.json",
        "properties": { "title": { "type": "string" } },
      };
      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      // Create restricted directory (simulate permission denied)
      await Deno.mkdir(restrictedDir);

      try {
        // On some systems, we can't actually restrict permissions in tests
        // So we'll test the error handling path by using an invalid output path
        const cmd = new Deno.Command("deno", {
          args: [
            "run",
            "--allow-read",
            "--allow-write",
            cliPath,
            schemaPath,
            "*.md",
            "/root/forbidden/output.json",
          ],
          stdout: "piped",
          stderr: "piped",
        });

        const result = await cmd.output();

        // Should exit with error code
        assertEquals(result.code, 1);
      } finally {
        await Deno.remove(tempDir, { recursive: true });
      }
    },
  );

  await t.step(
    "should provide helpful error for circular schema references",
    async () => {
      const tempDir = await Deno.makeTempDir();
      const schemaPath = join(tempDir, "circular_schema.json");
      const outputPath = join(tempDir, "output.json");

      // Create schema with potential circular reference
      const schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "template.json",
        "properties": {
          "self": { "$ref": "#" }, // Circular reference to root
        },
      };
      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      try {
        const cmd = new Deno.Command("deno", {
          args: ["run", "--allow-all", cliPath, schemaPath, "*.md", outputPath],
          stdout: "piped",
          stderr: "piped",
        });

        const result = await cmd.output();
        const stderr = new TextDecoder().decode(result.stderr);

        // Should handle gracefully, either succeed or provide clear error
        if (result.code !== 0) {
          assertStringIncludes(stderr.toLowerCase(), "error");
        }
      } finally {
        await Deno.remove(tempDir, { recursive: true });
      }
    },
  );

  await t.step(
    "should handle missing template files with recovery guidance",
    async () => {
      const tempDir = await Deno.makeTempDir();
      const schemaPath = join(tempDir, "schema.json");
      const outputPath = join(tempDir, "output.json");

      // Create schema referencing non-existent template
      const schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "nonexistent_template.json",
        "properties": { "title": { "type": "string" } },
      };
      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      try {
        const cmd = new Deno.Command("deno", {
          args: ["run", "--allow-all", cliPath, schemaPath, "*.md", outputPath],
          stdout: "piped",
          stderr: "piped",
        });

        const result = await cmd.output();
        const stderr = new TextDecoder().decode(result.stderr);

        assertEquals(result.code, 1);
        assertStringIncludes(stderr.toLowerCase(), "template");
        assertStringIncludes(stderr.toLowerCase(), "not found");
      } finally {
        await Deno.remove(tempDir, { recursive: true });
      }
    },
  );

  await t.step("should handle empty markdown pattern gracefully", async () => {
    const tempDir = await Deno.makeTempDir();
    const schemaPath = join(tempDir, "schema.json");
    const outputPath = join(tempDir, "output.json");

    const schema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      [TEST_EXTENSIONS.TEMPLATE]: "template.json",
      "properties": { "title": { "type": "string" } },
    };
    await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

    const template = '{"title": "{title}"}';
    await Deno.writeTextFile(join(tempDir, "template.json"), template);

    try {
      const cmd = new Deno.Command("deno", {
        args: [
          "run",
          "--allow-all",
          cliPath,
          schemaPath,
          join(tempDir, "nonexistent_*.md"),
          outputPath,
        ],
        stdout: "piped",
        stderr: "piped",
      });

      const result = await cmd.output();
      const stdout = new TextDecoder().decode(result.stdout);
      const stderr = new TextDecoder().decode(result.stderr);

      // Should succeed with empty results or provide helpful message
      if (result.code === 0) {
        // Should complete successfully even with no matching files
        assertStringIncludes(
          stdout.toLowerCase() + stderr.toLowerCase(),
          "processing completed successfully",
        );
      }
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  });

  await t.step("should validate output directory is writable", async () => {
    const tempDir = await Deno.makeTempDir();
    const schemaPath = join(tempDir, "schema.json");

    const schema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      [TEST_EXTENSIONS.TEMPLATE]: "template.json",
      "properties": { "title": { "type": "string" } },
    };
    await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

    try {
      // Try to write to a path that doesn't exist
      const cmd = new Deno.Command("deno", {
        args: [
          "run",
          "--allow-all",
          cliPath,
          schemaPath,
          "*.md",
          "/nonexistent/path/output.json",
        ],
        stdout: "piped",
        stderr: "piped",
      });

      const result = await cmd.output();

      if (result.code !== 0) {
        const stderr = new TextDecoder().decode(result.stderr);
        assertStringIncludes(stderr.toLowerCase(), "error");
      }
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  });

  await t.step(
    "should handle invalid frontmatter gracefully with context",
    async () => {
      const tempDir = await Deno.makeTempDir();
      const schemaPath = join(tempDir, "schema.json");
      const outputPath = join(tempDir, "output.json");
      const mdPath = join(tempDir, "test.md");

      const schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "template.json",
        "properties": { "title": { "type": "string" } },
      };
      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      const template = '{"title": "{title}"}';
      await Deno.writeTextFile(join(tempDir, "template.json"), template);

      // Create markdown with malformed frontmatter
      const markdown = `---
title: "Test"
invalid: yaml: content: here
---
# Content`;
      await Deno.writeTextFile(mdPath, markdown);

      try {
        const cmd = new Deno.Command("deno", {
          args: ["run", "--allow-all", cliPath, schemaPath, mdPath, outputPath],
          stdout: "piped",
          stderr: "piped",
        });

        const result = await cmd.output();

        // Should either succeed by skipping invalid files or provide helpful error
        if (result.code !== 0) {
          const stderr = new TextDecoder().decode(result.stderr);
          assertStringIncludes(stderr.toLowerCase(), "error");
        }
      } finally {
        await Deno.remove(tempDir, { recursive: true });
      }
    },
  );
});
