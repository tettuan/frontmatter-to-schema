import { assertEquals } from "@std/assert";
import {
  DocumentId,
  MarkdownDocument,
} from "../../../../../src/domain/frontmatter/entities/markdown-document.ts";
import { FilePath } from "../../../../../src/domain/shared/value-objects/file-path.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

Deno.test("MarkdownDocument - create with all components", () => {
  const id = DocumentId.create("test-doc-1");
  const path = FilePath.create("/path/to/document.md").unwrap();
  const content = "# Test Document\n\nThis is a test.";
  const frontmatterData = FrontmatterData.create({ title: "Test" }).unwrap();

  const document = MarkdownDocument.create(id, path, content, frontmatterData);

  assertEquals(document.getId(), id);
  assertEquals(document.getPath(), path);
  assertEquals(document.getContent(), content);
  assertEquals(document.getFrontmatter(), frontmatterData);
  assertEquals(document.hasFrontmatter(), true);
});

Deno.test("MarkdownDocument - create without frontmatter", () => {
  const id = DocumentId.create("test-doc-2");
  const path = FilePath.create("/path/to/simple.md").unwrap();
  const content = "# Simple Document\n\nNo frontmatter here.";

  const document = MarkdownDocument.create(id, path, content);

  assertEquals(document.getId(), id);
  assertEquals(document.getPath(), path);
  assertEquals(document.getContent(), content);
  assertEquals(document.getFrontmatter(), undefined);
  assertEquals(document.hasFrontmatter(), false);
});

Deno.test("MarkdownDocument - withFrontmatter adds frontmatter to document", () => {
  const id = DocumentId.create("test-doc-3");
  const path = FilePath.create("/path/to/document.md").unwrap();
  const content = "# Document";
  const frontmatterData = FrontmatterData.create({ title: "Updated" }).unwrap();

  const document = MarkdownDocument.create(id, path, content);
  const updatedDocument = document.withFrontmatter(frontmatterData);

  assertEquals(document.hasFrontmatter(), false);
  assertEquals(updatedDocument.hasFrontmatter(), true);
  assertEquals(updatedDocument.getFrontmatter(), frontmatterData);
});

Deno.test("MarkdownDocument - withContent updates document content", () => {
  const id = DocumentId.create("test-doc-4");
  const path = FilePath.create("/path/to/document.md").unwrap();
  const originalContent = "# Original";
  const newContent = "# Updated Content";

  const document = MarkdownDocument.create(id, path, originalContent);
  const updatedDocument = document.withContent(newContent);

  assertEquals(document.getContent(), originalContent);
  assertEquals(updatedDocument.getContent(), newContent);
  assertEquals(updatedDocument.getId(), id); // ID remains same
  assertEquals(updatedDocument.getPath(), path); // Path remains same
});

Deno.test("MarkdownDocument - getMarkdownContent returns content without frontmatter", () => {
  const id = DocumentId.create("test-doc-5");
  const path = FilePath.create("/path/to/document.md").unwrap();
  const content = "---\ntitle: Test\n---\n# Document\n\nContent here.";

  const document = MarkdownDocument.create(id, path, content);
  const markdownOnly = document.getMarkdownContent();

  assertEquals(markdownOnly, "# Document\n\nContent here.");
});

Deno.test("MarkdownDocument - getMarkdownContent returns full content when no frontmatter", () => {
  const id = DocumentId.create("test-doc-6");
  const path = FilePath.create("/path/to/simple.md").unwrap();
  const content = "# Simple Document\n\nNo frontmatter.";

  const document = MarkdownDocument.create(id, path, content);
  const markdownOnly = document.getMarkdownContent();

  assertEquals(markdownOnly, content);
});

Deno.test("MarkdownDocument - isMarkdownFile checks file extension", () => {
  const mdPath = FilePath.create("/path/to/document.md").unwrap();
  const mdxPath = FilePath.create("/path/to/document.mdx").unwrap();
  const txtPath = FilePath.create("/path/to/document.txt").unwrap();

  const mdDoc = MarkdownDocument.create(
    DocumentId.create("md"),
    mdPath,
    "content",
  );
  const mdxDoc = MarkdownDocument.create(
    DocumentId.create("mdx"),
    mdxPath,
    "content",
  );
  const txtDoc = MarkdownDocument.create(
    DocumentId.create("txt"),
    txtPath,
    "content",
  );

  assertEquals(mdDoc.isMarkdownFile(), true);
  assertEquals(mdxDoc.isMarkdownFile(), true);
  assertEquals(txtDoc.isMarkdownFile(), false);
});

Deno.test("DocumentId - create generates unique identifier", () => {
  const id1 = DocumentId.create("doc-1");
  const id2 = DocumentId.create("doc-1");
  const id3 = DocumentId.create("doc-2");

  assertEquals(id1.getValue(), "doc-1");
  assertEquals(id1.equals(id2), true);
  assertEquals(id1.equals(id3), false);
});

Deno.test("DocumentId - fromPath creates ID from file path", () => {
  const path = FilePath.create("/path/to/my-document.md").unwrap();
  const id = DocumentId.fromPath(path);

  assertEquals(id.getValue(), "my-document");
});
