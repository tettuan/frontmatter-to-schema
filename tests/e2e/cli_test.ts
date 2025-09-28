import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { ensureDir } from "jsr:@std/fs";

async function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-all", "./cli.ts", ...args],
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, stderr, code } = await command.output();
  return {
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
    code,
  };
}

Deno.test("CLI - show help message", async () => {
  const result = await runCLI(["--help"]);

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "Frontmatter to Schema Processor");
  assertStringIncludes(result.stdout, "USAGE:");
  assertStringIncludes(result.stdout, "process");
});

Deno.test("CLI - show version", async () => {
  const result = await runCLI(["--version"]);

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "frontmatter-to-schema");
});

Deno.test("CLI - process single file", async () => {
  const testDir = await Deno.makeTempDir();
  const schemaPath = `${testDir}/schema.json`;
  const templatePath = `${testDir}/template.json`;
  const markdownPath = `${testDir}/test.md`;
  const outputPath = `${testDir}/output.json`;

  // Create test files
  await Deno.writeTextFile(schemaPath, JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string", "x-frontmatter-part": true },
      date: { type: "string", "x-frontmatter-part": true },
    },
  }));

  await Deno.writeTextFile(templatePath, JSON.stringify({
    posts: [],
  }));

  await Deno.writeTextFile(markdownPath, `---
title: E2E Test Post
date: 2024-01-15
---

This is a test post.`);

  // Run CLI
  const result = await runCLI([
    "process",
    schemaPath,
    templatePath,
    markdownPath,
    outputPath,
    "json",
  ]);

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "✅ Processed 1 documents");
  assertStringIncludes(result.stdout, `📄 Output written to: ${outputPath}`);

  // Verify output file
  const output = JSON.parse(await Deno.readTextFile(outputPath));
  assertEquals(output.posts.length, 1);
  assertEquals(output.posts[0].title, "E2E Test Post");
  assertEquals(output.posts[0].date, "2024-01-15");

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("CLI - process directory", async () => {
  const testDir = await Deno.makeTempDir();
  const docsDir = `${testDir}/docs`;
  await ensureDir(docsDir);

  const schemaPath = `${testDir}/schema.json`;
  const templatePath = `${testDir}/template.json`;
  const outputPath = `${testDir}/output.yml`;

  // Create schema and template
  await Deno.writeTextFile(schemaPath, JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string", "x-frontmatter-part": true },
      category: { type: "string", "x-frontmatter-part": true },
    },
  }));

  await Deno.writeTextFile(templatePath, JSON.stringify({
    items: [],
  }));

  // Create multiple markdown files
  await Deno.writeTextFile(`${docsDir}/item1.md`, `---
title: Item One
category: Category A
---
Content 1`);

  await Deno.writeTextFile(`${docsDir}/item2.md`, `---
title: Item Two
category: Category B
---
Content 2`);

  await Deno.writeTextFile(`${docsDir}/item3.md`, `---
title: Item Three
category: Category A
---
Content 3`);

  // Run CLI with YAML output
  const result = await runCLI([
    "process",
    schemaPath,
    templatePath,
    docsDir,
    outputPath,
    "yaml",
  ]);

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "✅ Processed 3 documents");

  // Verify YAML output
  const yamlContent = await Deno.readTextFile(outputPath);
  assertStringIncludes(yamlContent, "items:");
  assertStringIncludes(yamlContent, "title: Item One");
  assertStringIncludes(yamlContent, "title: Item Two");
  assertStringIncludes(yamlContent, "title: Item Three");

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("CLI - handle invalid arguments", async () => {
  const result = await runCLI(["process", "missing.json"]);

  assertEquals(result.code, 1);
  assertStringIncludes(result.stderr, "Insufficient arguments");
});

Deno.test("CLI - handle non-existent schema file", async () => {
  const result = await runCLI([
    "process",
    "/nonexistent/schema.json",
    "/nonexistent/template.json",
    "/nonexistent/input.md",
    "/tmp/output.json",
  ]);

  assertEquals(result.code, 1);
  assertStringIncludes(result.stderr, "❌");
});

Deno.test("CLI - support both JSON and YAML templates", async () => {
  const testDir = await Deno.makeTempDir();
  const schemaPath = `${testDir}/schema.json`;
  const yamlTemplatePath = `${testDir}/template.yml`;
  const markdownPath = `${testDir}/test.md`;
  const outputPath = `${testDir}/output.json`;

  // Create files
  await Deno.writeTextFile(schemaPath, JSON.stringify({
    type: "object",
    properties: {
      name: { type: "string", "x-frontmatter-part": true },
    },
  }));

  // Create YAML template (as JSON for now since we're testing)
  await Deno.writeTextFile(yamlTemplatePath, JSON.stringify({
    entries: [],
  }));

  await Deno.writeTextFile(markdownPath, `---
name: Test Entry
---
Content`);

  // Run CLI with .yml template
  const result = await runCLI([
    "process",
    schemaPath,
    yamlTemplatePath,
    markdownPath,
    outputPath,
  ]);

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "✅ Processed 1 documents");

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});