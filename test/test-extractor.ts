import { FrontMatterExtractor } from "../src/domain/frontmatter/Extractor.ts";
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.0/assert/mod.ts";

Deno.test("FrontMatterExtractor - should extract frontmatter", async () => {
  const extractor = new FrontMatterExtractor();
  const content = await Deno.readTextFile("./test/sample-prompt.md");

  const frontMatter = extractor.extract(content);

  assertExists(frontMatter);
  assertEquals(frontMatter?.get("domain"), "git");
  assertEquals(frontMatter?.get("action"), "create");
  assertEquals(frontMatter?.get("target"), "refinement-issue");
});

Deno.test("FrontMatterExtractor - should return null for no frontmatter", () => {
  const extractor = new FrontMatterExtractor();
  const content = "# Just a regular markdown file\n\nNo frontmatter here.";

  const frontMatter = extractor.extract(content);

  assertEquals(frontMatter, null);
});

Deno.test("FrontMatterExtractor - should detect frontmatter presence", async () => {
  const extractor = new FrontMatterExtractor();
  const withFrontmatter = await Deno.readTextFile("./test/sample-prompt.md");
  const withoutFrontmatter = "# Regular markdown";

  assertEquals(extractor.hasFrontMatter(withFrontmatter), true);
  assertEquals(extractor.hasFrontMatter(withoutFrontmatter), false);
});
