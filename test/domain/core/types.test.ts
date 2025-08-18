import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  FilePath,
  FrontMatterContent,
  SchemaDefinition,
  SourceFile,
  AnalysisResult
} from "../../../src/domain/core/types.ts";

Deno.test("FilePath", async (t) => {
  await t.step("should identify markdown files", () => {
    const mdPath = new FilePath("/test/file.md");
    assertEquals(mdPath.isMarkdown(), true);
    
    const txtPath = new FilePath("/test/file.txt");
    assertEquals(txtPath.isMarkdown(), false);
  });
  
  await t.step("should extract filename", () => {
    const path = new FilePath("/test/dir/file.md");
    assertEquals(path.filename, "file.md");
  });
  
  await t.step("should extract directory", () => {
    const path = new FilePath("/test/dir/file.md");
    assertEquals(path.directory, "/test/dir");
  });
});

Deno.test("FrontMatterContent", async (t) => {
  await t.step("should get values by key", () => {
    const content = new FrontMatterContent({
      title: "Test",
      count: 42,
      tags: ["tag1", "tag2"]
    });
    
    assertEquals(content.get("title"), "Test");
    assertEquals(content.get("count"), 42);
    assertEquals(content.get("tags"), ["tag1", "tag2"]);
  });
  
  await t.step("should check if key exists", () => {
    const content = new FrontMatterContent({
      title: "Test"
    });
    
    assertEquals(content.has("title"), true);
    assertEquals(content.has("missing"), false);
  });
  
  await t.step("should return all keys", () => {
    const content = new FrontMatterContent({
      a: 1,
      b: 2,
      c: 3
    });
    
    const keys = content.keys();
    assertEquals(keys.length, 3);
    assertEquals(keys.includes("a"), true);
    assertEquals(keys.includes("b"), true);
    assertEquals(keys.includes("c"), true);
  });
});

Deno.test("SchemaDefinition", async (t) => {
  await t.step("should validate schema exists", () => {
    const schema = new SchemaDefinition({ type: "object" });
    assertEquals(schema.validate({}), true);
    
    const invalidSchema = new SchemaDefinition(null);
    assertEquals(invalidSchema.validate({}), false);
  });
});

Deno.test("SourceFile", async (t) => {
  await t.step("should detect frontmatter presence", () => {
    const withFrontMatter = new SourceFile(
      new FilePath("/test.md"),
      new FrontMatterContent({ title: "Test" }),
      "# Content"
    );
    assertEquals(withFrontMatter.hasFrontMatter(), true);
    
    const withoutFrontMatter = new SourceFile(
      new FilePath("/test.md"),
      null,
      "# Content"
    );
    assertEquals(withoutFrontMatter.hasFrontMatter(), false);
  });
});

Deno.test("AnalysisResult", async (t) => {
  await t.step("should store and retrieve metadata", () => {
    const result = new AnalysisResult(
      new FilePath("/test.md"),
      { processed: true }
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
      ["key2", 42]
    ]);
    
    const result = new AnalysisResult(
      new FilePath("/test.md"),
      { data: "test" },
      metadata
    );
    
    assertEquals(result.getMetadata("key1"), "value1");
    assertEquals(result.getMetadata("key2"), 42);
  });
});