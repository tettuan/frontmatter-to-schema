import { assertEquals } from "@std/assert";
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
