import { assertEquals } from "@std/assert";
import { FrontmatterParsingService } from "../../../../../src/domain/frontmatter/services/frontmatter-parsing-service.ts";
import { DenoFileSystemAdapter } from "../../../../../src/infrastructure/adapters/deno-file-system-adapter.ts";

Deno.test("FrontmatterParsingService - comment handling", async (t) => {
  const fileSystem = DenoFileSystemAdapter.create();
  const serviceResult = FrontmatterParsingService.create(fileSystem);
  const service = serviceResult.unwrap();

  await t.step("should strip comments from unquoted values", () => {
    const markdown = `---
title: Test
status: active # this is a comment
---
Content`;
    
    const result = service.parseFrontmatter(markdown);
    assertEquals(result.isOk(), true);
    const { frontmatter } = result.unwrap();
    assertEquals(frontmatter?.status, "active");
  });

  await t.step("should preserve quoted values with comments after", () => {
    const markdown = `---
title: "Test Title"
type: "tech" # comment after quote
---
Content`;
    
    const result = service.parseFrontmatter(markdown);
    assertEquals(result.isOk(), true);
    const { frontmatter } = result.unwrap();
    assertEquals(frontmatter?.type, "tech");
  });

  await t.step("should handle single quotes with comments", () => {
    const markdown = `---
name: 'value' # comment
---
Content`;

    const result = service.parseFrontmatter(markdown);
    assertEquals(result.isOk(), true);
    const { frontmatter } = result.unwrap();
    assertEquals(frontmatter?.name, "value");
  });

  await t.step("should handle values without comments", () => {
    const markdown = `---
plain: value
---
Content`;

    const result = service.parseFrontmatter(markdown);
    assertEquals(result.isOk(), true);
    const { frontmatter } = result.unwrap();
    assertEquals(frontmatter?.plain, "value");
  });

  await t.step("should handle minimal frontmatter", () => {
    const markdown = `---
key: val
---
Content`;

    const result = service.parseFrontmatter(markdown);
    assertEquals(result.isOk(), true);
    const { frontmatter } = result.unwrap();
    assertEquals(frontmatter?.key, "val");
  });

  await t.step("should handle markdown without frontmatter", () => {
    const markdown = `# Just Content
No frontmatter here`;

    const result = service.parseFrontmatter(markdown);
    assertEquals(result.isOk(), true);
    const data = result.unwrap();
    assertEquals(data.frontmatter, undefined);
    assertEquals(data.content, markdown);
  });
});
