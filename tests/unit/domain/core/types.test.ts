import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { DocumentPath } from "../../../../src/domain/models/value-objects.ts";
// Note: DocumentPath and DocumentPath don't exist anymore - using DocumentPath instead
import { ResultUtils } from "../../../../src/domain/core/result.ts";

Deno.test("DocumentPath", async (t) => {
  await t.step("should identify markdown files", () => {
    const mdPath = ResultUtils.unwrap(DocumentPath.create("/test/file.md"));
    assertEquals(mdPath.isMarkdown(), true);

    const txtPath = ResultUtils.unwrap(DocumentPath.create("/test/file.txt"));
    assertEquals(txtPath.isMarkdown(), false);
  });

  await t.step("should extract filename", () => {
    const path = ResultUtils.unwrap(DocumentPath.create("/test/dir/file.md"));
    assertEquals(path.getFilename(), "file.md");
  });

  await t.step("should extract directory", () => {
    const path = ResultUtils.unwrap(DocumentPath.create("/test/dir/file.md"));
    assertEquals(path.getDirectory(), "/test/dir");
  });
});

// TODO: Fix these tests - API has changed significantly after refactoring
// The types have been moved and their interfaces have changed
// These tests need to be rewritten to match the new API
