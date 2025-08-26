import { FrontMatterExtractor } from "../../src/domain/frontmatter/frontmatter-models.ts";
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.0/assert/mod.ts";

Deno.test("FrontMatterExtractor - should extract frontmatter", () => {
  const extractor = new FrontMatterExtractor();
  const content = `---
title: Git Refinement Issue Creator
domain: git
action: create
target: refinement-issue
description: Create a refinement issue from requirements documentation
tags:
  - git
  - issue
  - refinement
config:
  input_formats:
    - MD
    - TXT
  processing_modes:
    - default
    - detailed
  supports:
    file_input: true
    stdin_input: false
    output_destination: true
usage: |
  Create refinement issues from requirement documents.
  Example: climpt-git create refinement-issue -f requirements.md
---

# Git Refinement Issue Creator

This prompt helps create refinement issues from requirements documentation for
better project tracking and management.`;

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

Deno.test("FrontMatterExtractor - should detect frontmatter presence", () => {
  const extractor = new FrontMatterExtractor();
  const withFrontmatter = `---
title: Test Document
author: John Doe
---
# Content here`;
  const withoutFrontmatter = "# Regular markdown";

  assertEquals(extractor.hasFrontMatter(withFrontmatter), true);
  assertEquals(extractor.hasFrontMatter(withoutFrontmatter), false);
});
