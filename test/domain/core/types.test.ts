import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  AnalysisResult,
  ValidFilePath,
  FrontMatterContent,
  SchemaDefinition,
  SourceFile,
} from "../../../src/domain/core/types.ts";
import { ResultUtils } from "../../../src/domain/core/result.ts";

Deno.test("ValidFilePath", async (t) => {
  await t.step("should identify markdown files", () => {
    const mdPath = ResultUtils.unwrap(ValidFilePath.create("/test/file.md"));
    assertEquals(mdPath.isMarkdown(), true);

    const txtPath = ResultUtils.unwrap(ValidFilePath.create("/test/file.txt"));
    assertEquals(txtPath.isMarkdown(), false);
  });

  await t.step("should extract filename", () => {
    const path = ResultUtils.unwrap(ValidFilePath.create("/test/dir/file.md"));
    assertEquals(path.filename, "file.md");
  });

  await t.step("should extract directory", () => {
    const path = ResultUtils.unwrap(ValidFilePath.create("/test/dir/file.md"));
    assertEquals(path.directory, "/test/dir");
  });
});

Deno.test("FrontMatterContent", async (t) => {
  await t.step("should get values by key", () => {
    const content = ResultUtils.unwrap(FrontMatterContent.fromObject({
      title: "Test",
      count: 42,
      tags: ["tag1", "tag2"],
    }));

    assertEquals(content.get("title"), "Test");
    assertEquals(content.get("count"), 42);
    assertEquals(content.get("tags"), ["tag1", "tag2"]);
  });

  await t.step("should check if key exists", () => {
    const content = ResultUtils.unwrap(FrontMatterContent.fromObject({
      title: "Test",
    }));

    assertEquals(content.has("title"), true);
    assertEquals(content.has("missing"), false);
  });

  await t.step("should return all keys", () => {
    const content = ResultUtils.unwrap(FrontMatterContent.fromObject({
      a: 1,
      b: 2,
      c: 3,
    }));

    const keys = content.keys();
    assertEquals(keys.length, 3);
    assertEquals(keys.includes("a"), true);
    assertEquals(keys.includes("b"), true);
    assertEquals(keys.includes("c"), true);
  });
});

Deno.test("SchemaDefinition", async (t) => {
  await t.step("should validate schema exists", () => {
    const schema = ResultUtils.unwrap(SchemaDefinition.create({ type: "object" }));
    const validationResult = schema.validate({});
    assertEquals(validationResult.ok, true);

    const invalidSchemaResult = SchemaDefinition.create(null);
    assertEquals(invalidSchemaResult.ok, false);
    if (!invalidSchemaResult.ok) {
      assertEquals(invalidSchemaResult.error.kind, "EmptyInput");
    }
  });
});

Deno.test("SourceFile", async (t) => {
  await t.step("should detect frontmatter presence", () => {
    const withFrontMatter = ResultUtils.unwrap(SourceFile.create(
      ResultUtils.unwrap(ValidFilePath.create("/test.md")),
      "# Content",
      ResultUtils.unwrap(FrontMatterContent.fromObject({ title: "Test" }))
    ));
    assertEquals(withFrontMatter.hasFrontMatter(), true);

    const withoutFrontMatter = ResultUtils.unwrap(SourceFile.create(
      ResultUtils.unwrap(ValidFilePath.create("/test.md")),
      "# Content"
    ));
    assertEquals(withoutFrontMatter.hasFrontMatter(), false);
  });
});

Deno.test("AnalysisResult", async (t) => {
  await t.step("should store and retrieve metadata", () => {
    const result = new AnalysisResult(
      ResultUtils.unwrap(ValidFilePath.create("/test.md")),
      { processed: true },
    );

    result.addMetadata("timestamp", "2024-01-01");
    result.addMetadata("version", "1.0.0");

    assertEquals(result.getMetadata("timestamp"), "2024-01-01");
    assertEquals(result.getMetadata("version"), "1.0.0");
    assertEquals(result.getMetadata("missing"), undefined);
  });

  await t.step("should initialize with metadata", () => {
    const metadata = new Map<string, unknown>([
      ["key1", "value1"],
      ["key2", 42],
    ]);

    const result = new AnalysisResult(
      ResultUtils.unwrap(ValidFilePath.create("/test.md")),
      { data: "test" },
      metadata,
    );

    assertEquals(result.getMetadata("key1"), "value1");
    assertEquals(result.getMetadata("key2"), 42);
  });
});
