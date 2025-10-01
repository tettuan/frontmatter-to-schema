import { assertEquals } from "@std/assert";
import { FrontmatterParsingService } from "../../../../../src/domain/frontmatter/services/frontmatter-parsing-service.ts";
import { DenoFileSystemAdapter } from "../../../../../src/infrastructure/adapters/deno-file-system-adapter.ts";

Deno.test("FrontmatterParsingService - YAML array preservation", async (t) => {
  const fileSystem = DenoFileSystemAdapter.create();
  const serviceResult = FrontmatterParsingService.create(fileSystem);
  const service = serviceResult.unwrap();

  await t.step("should preserve YAML arrays as arrays, not strings", () => {
    const markdown = `---
options:
  input: [file, stdin]
  adaptation: [default, detailed]
title: Test Command
---
Content`;

    const result = service.parseFrontmatter(markdown);
    assertEquals(result.isOk(), true);
    const { frontmatter } = result.unwrap();

    // Arrays should be preserved as actual arrays
    const options = frontmatter?.options as Record<string, unknown>;
    assertEquals(Array.isArray(options?.input), true);
    assertEquals(options?.input, ["file", "stdin"]);

    assertEquals(Array.isArray(options?.adaptation), true);
    assertEquals(options?.adaptation, ["default", "detailed"]);
  });

  await t.step("should preserve nested object with array values", () => {
    const markdown = `---
config:
  tags: [bug, feature]
  priorities: [high, medium, low]
---
Content`;

    const result = service.parseFrontmatter(markdown);
    assertEquals(result.isOk(), true);
    const { frontmatter } = result.unwrap();

    const config = frontmatter?.config as Record<string, unknown>;
    assertEquals(Array.isArray(config?.tags), true);
    assertEquals(config?.tags, ["bug", "feature"]);

    assertEquals(Array.isArray(config?.priorities), true);
    assertEquals(config?.priorities, ["high", "medium", "low"]);
  });

  await t.step("should preserve single-item arrays", () => {
    const markdown = `---
items: [single]
---
Content`;

    const result = service.parseFrontmatter(markdown);
    assertEquals(result.isOk(), true);
    const { frontmatter } = result.unwrap();

    assertEquals(Array.isArray(frontmatter?.items), true);
    assertEquals(frontmatter?.items, ["single"]);
  });

  await t.step("should preserve empty arrays", () => {
    const markdown = `---
empty: []
---
Content`;

    const result = service.parseFrontmatter(markdown);
    assertEquals(result.isOk(), true);
    const { frontmatter } = result.unwrap();

    assertEquals(Array.isArray(frontmatter?.empty), true);
    assertEquals(frontmatter?.empty, []);
  });
});
