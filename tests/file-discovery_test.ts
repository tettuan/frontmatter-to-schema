import { assertEquals } from "jsr:@std/assert@1";
import {
  discoverPromptFiles,
  extractFrontmatter,
  findTemplateVariables,
  parseCommandStructure,
} from "../src/file-discovery.ts";
import { join } from "jsr:@std/path@1";

Deno.test("parseCommandStructure should parse valid command structure", () => {
  const filePath = "/prompts/domain/action/layer/f_input_adaptation.md";
  const promptsDir = "/prompts";

  const result = parseCommandStructure(filePath, promptsDir);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.c1, "domain");
    assertEquals(result.data.c2, "action");
    assertEquals(result.data.c3, "layer");
    assertEquals(result.data.input, "input");
    assertEquals(result.data.adaptation, "adaptation");
  }
});

Deno.test("parseCommandStructure should handle paths without adaptation", () => {
  const filePath = "/prompts/domain/action/layer/f_input.md";
  const promptsDir = "/prompts";

  const result = parseCommandStructure(filePath, promptsDir);

  assertEquals(result.ok, true);
  if (!result.ok) return;
  const data = result.data;

  assertEquals(data.c1, "domain");
  assertEquals(data.c2, "action");
  assertEquals(data.c3, "layer");
  assertEquals(data.input, "input");
  assertEquals(data.adaptation, undefined);
});

Deno.test("parseCommandStructure should handle multi-part adaptation", () => {
  const filePath = "/prompts/domain/action/layer/f_input_part1_part2.md";
  const promptsDir = "/prompts";

  const result = parseCommandStructure(filePath, promptsDir);

  assertEquals(result.ok, true);
  if (!result.ok) return;
  const data = result.data;

  assertEquals(data.c1, "domain");
  assertEquals(data.c2, "action");
  assertEquals(data.c3, "layer");
  assertEquals(data.input, "input");
  assertEquals(data.adaptation, "part1_part2");
});

Deno.test("parseCommandStructure should throw for invalid path structure", () => {
  const filePath = "/prompts/invalid/f_input.md";
  const promptsDir = "/prompts";

  const result = parseCommandStructure(filePath, promptsDir);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("parseCommandStructure should return error for invalid filename format", () => {
  const filePath = "/prompts/domain/action/layer/invalid_file.md";
  const promptsDir = "/prompts";

  const result = parseCommandStructure(filePath, promptsDir);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("parseCommandStructure should return error for filename without f_ prefix", () => {
  const filePath = "/prompts/domain/action/layer/g_input.md";
  const promptsDir = "/prompts";

  const result = parseCommandStructure(filePath, promptsDir);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("extractFrontmatter should extract valid frontmatter", () => {
  const content = `---
title: Test
description: A test file
---
# Content

This is the body content.`;

  const result = extractFrontmatter(content);

  assertEquals(result.frontmatter, "title: Test\ndescription: A test file");
  assertEquals(result.body, "# Content\n\nThis is the body content.");
});

Deno.test("extractFrontmatter should handle content without frontmatter", () => {
  const content = "# Content\n\nThis is the body content.";

  const result = extractFrontmatter(content);

  assertEquals(result.frontmatter, "");
  assertEquals(result.body, content);
});

Deno.test("extractFrontmatter should handle empty content", () => {
  const content = "";

  const result = extractFrontmatter(content);

  assertEquals(result.frontmatter, "");
  assertEquals(result.body, "");
});

Deno.test("extractFrontmatter should handle frontmatter with no body", () => {
  const content = `---
title: Test
---
`;

  const result = extractFrontmatter(content);

  assertEquals(result.frontmatter, "title: Test");
  assertEquals(result.body, "");
});

Deno.test("extractFrontmatter should handle malformed frontmatter", () => {
  const content = `---
title: Test
# Missing closing delimiter
# Content`;

  const result = extractFrontmatter(content);

  assertEquals(result.frontmatter, "");
  assertEquals(result.body, content);
});

Deno.test("extractFrontmatter should handle frontmatter with nested dashes", () => {
  const content = `---
title: Test
items:
  - item1
  - item2
---
# Content`;

  const result = extractFrontmatter(content);

  assertEquals(result.frontmatter, "title: Test\nitems:\n  - item1\n  - item2");
  assertEquals(result.body, "# Content");
});

Deno.test("findTemplateVariables should find single variable", () => {
  const content = "Hello {name}!";

  const result = findTemplateVariables(content);

  assertEquals(result, ["name"]);
});

Deno.test("findTemplateVariables should find multiple variables", () => {
  const content = "Hello {firstName} {lastName}! Your age is {age}.";

  const result = findTemplateVariables(content);

  assertEquals(result, ["firstName", "lastName", "age"]);
});

Deno.test("findTemplateVariables should handle duplicate variables", () => {
  const content = "Hello {name}! Nice to meet you, {name}.";

  const result = findTemplateVariables(content);

  assertEquals(result, ["name"]);
});

Deno.test("findTemplateVariables should handle no variables", () => {
  const content = "Hello world!";

  const result = findTemplateVariables(content);

  assertEquals(result, []);
});

Deno.test("findTemplateVariables should handle empty content", () => {
  const content = "";

  const result = findTemplateVariables(content);

  assertEquals(result, []);
});

Deno.test("findTemplateVariables should handle nested braces", () => {
  const content = "Value: {{nested}}";

  const result = findTemplateVariables(content);

  assertEquals(result, ["{nested"]);
});

Deno.test("findTemplateVariables should handle variables with spaces", () => {
  const content = "Hello {first name} and {last name}!";

  const result = findTemplateVariables(content);

  assertEquals(result, ["first name", "last name"]);
});

Deno.test("findTemplateVariables should handle variables with special characters", () => {
  const content = "Values: {user-id}, {email@address}, {item_1}";

  const result = findTemplateVariables(content);

  assertEquals(result, ["user-id", "email@address", "item_1"]);
});

Deno.test("discoverPromptFiles should discover valid prompt files", async () => {
  const tempDir = await Deno.makeTempDir();
  const promptsDir = join(tempDir, "prompts");

  try {
    // Create test structure
    await Deno.mkdir(join(promptsDir, "domain", "action", "layer"), {
      recursive: true,
    });

    // Create valid prompt file
    const filePath = join(promptsDir, "domain", "action", "layer", "f_test.md");
    const content = `---
title: Test
---
# Test Content`;
    await Deno.writeTextFile(filePath, content);

    // Create invalid file (should be ignored)
    const invalidPath = join(
      promptsDir,
      "domain",
      "action",
      "layer",
      "invalid.md",
    );
    await Deno.writeTextFile(invalidPath, "Invalid content");

    const result = await discoverPromptFiles(promptsDir);

    assertEquals(result.ok, true);
    if (!result.ok) return;
    const files = result.data;

    assertEquals(files.length, 1);
    assertEquals(files[0].content, content);
    assertEquals(files[0].commandStructure.c1, "domain");
    assertEquals(files[0].commandStructure.c2, "action");
    assertEquals(files[0].commandStructure.c3, "layer");
    assertEquals(files[0].commandStructure.input, "test");
    assertEquals(files[0].commandStructure.adaptation, undefined);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("discoverPromptFiles should handle empty directory", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const result = await discoverPromptFiles(tempDir);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, []);
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("discoverPromptFiles should discover files with adaptation", async () => {
  const tempDir = await Deno.makeTempDir();
  const promptsDir = join(tempDir, "prompts");

  try {
    // Create test structure
    await Deno.mkdir(join(promptsDir, "domain", "action", "layer"), {
      recursive: true,
    });

    // Create prompt file with adaptation
    const filePath = join(
      promptsDir,
      "domain",
      "action",
      "layer",
      "f_test_adapted.md",
    );
    const content = "# Test with adaptation";
    await Deno.writeTextFile(filePath, content);

    const result = await discoverPromptFiles(promptsDir);

    assertEquals(result.ok, true);
    if (!result.ok) return;
    const files = result.data;

    assertEquals(files.length, 1);
    assertEquals(files[0].commandStructure.input, "test");
    assertEquals(files[0].commandStructure.adaptation, "adapted");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("discoverPromptFiles should handle nested directories", async () => {
  const tempDir = await Deno.makeTempDir();
  const promptsDir = join(tempDir, "prompts");

  try {
    // Create multiple nested structures
    await Deno.mkdir(join(promptsDir, "domain1", "action1", "layer1"), {
      recursive: true,
    });
    await Deno.mkdir(join(promptsDir, "domain2", "action2", "layer2"), {
      recursive: true,
    });

    // Create files in different locations
    const file1 = join(
      promptsDir,
      "domain1",
      "action1",
      "layer1",
      "f_test1.md",
    );
    await Deno.writeTextFile(file1, "Content 1");

    const file2 = join(
      promptsDir,
      "domain2",
      "action2",
      "layer2",
      "f_test2.md",
    );
    await Deno.writeTextFile(file2, "Content 2");

    const result = await discoverPromptFiles(promptsDir);

    assertEquals(result.ok, true);
    if (!result.ok) return;
    const files = result.data;

    assertEquals(files.length, 2);

    const test1 = files.find((f) => f.commandStructure.input === "test1");
    const test2 = files.find((f) => f.commandStructure.input === "test2");

    assertEquals(test1?.commandStructure.c1, "domain1");
    assertEquals(test2?.commandStructure.c1, "domain2");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
