import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  Document,
  DocumentBody,
  DocumentPath,
  FrontMatter,
} from "../../../../src/domain/models/document.ts";
import { isError, isOk } from "../../../../src/domain/shared/result.ts";

Deno.test("DocumentPath", async (t) => {
  await t.step("should create valid document path", () => {
    const result = DocumentPath.create("/path/to/file.md");
    assertExists(result);
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getValue(), "/path/to/file.md");
      assertEquals(result.data.getFileName(), "file.md");
      assertEquals(result.data.getDirectory(), "/path/to");
    }
  });

  await t.step("should reject empty path", () => {
    const result = DocumentPath.create("");
    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should trim whitespace", () => {
    const result = DocumentPath.create("  /path/to/file.md  ");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getValue(), "/path/to/file.md");
    }
  });
});

Deno.test("FrontMatter", async (t) => {
  await t.step("should create valid frontmatter", () => {
    const raw = "title: Test\nauthor: John";
    const parsed = { title: "Test", author: "John" };
    const result = FrontMatter.create(raw, parsed);

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getRaw(), raw);
      assertEquals(result.data.getParsed(), parsed);
      assertEquals(result.data.getField("title"), "Test");
    }
  });

  await t.step("should allow empty raw content", () => {
    const result = FrontMatter.create("", { title: "Test" });
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getRaw(), "");
      assertEquals(result.data.getParsed().title, "Test");
    }
  });
});

Deno.test("DocumentBody", async (t) => {
  await t.step("should create document body", () => {
    const content = "# Hello World\n\nThis is content.";
    const body = DocumentBody.create(content);

    assertEquals(body.getContent(), content);
    assertEquals(body.getLength(), content.length);
  });

  await t.step("should handle empty content", () => {
    const body = DocumentBody.create("");
    assertEquals(body.getContent(), "");
    assertEquals(body.getLength(), 0);
  });
});

Deno.test("Document", async (t) => {
  await t.step("should create document with frontmatter", () => {
    const pathResult = DocumentPath.create("/test.md");
    const fmResult = FrontMatter.create("title: Test", { title: "Test" });
    const body = DocumentBody.create("Content");

    if (isOk(pathResult) && isOk(fmResult)) {
      const doc = Document.create(pathResult.data, fmResult.data, body);

      assertEquals(doc.hasFrontMatter(), true);
      assertEquals(doc.getPath().getValue(), "/test.md");
      assertEquals(doc.getBody().getContent(), "Content");
      assertExists(doc.getFrontMatter());
    }
  });

  await t.step("should create document without frontmatter", () => {
    const pathResult = DocumentPath.create("/test.md");
    const body = DocumentBody.create("Content");

    if (isOk(pathResult)) {
      const doc = Document.create(pathResult.data, null, body);

      assertEquals(doc.hasFrontMatter(), false);
      assertEquals(doc.getFrontMatter(), null);
    }
  });
});
