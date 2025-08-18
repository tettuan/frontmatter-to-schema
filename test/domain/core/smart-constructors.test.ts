import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  ValidFilePath,
  FrontMatterContent,
  SchemaDefinition,
  SourceFile,
  AnalysisResult,
} from "../../../src/domain/core/types.ts";

Deno.test("ValidFilePath Smart Constructor", async (t) => {
  await t.step("should create valid file path successfully", () => {
    const result = ValidFilePath.create("/path/to/file.md");
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.value, "/path/to/file.md");
    }
  });

  await t.step("should reject empty input", () => {
    const result = ValidFilePath.create("");
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
      assertEquals(result.error.message, "Input cannot be empty");
    }
  });

  await t.step("should reject whitespace-only input", () => {
    const result = ValidFilePath.create("   ");
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should reject paths that are too long", () => {
    const longPath = "/".repeat(600);
    const result = ValidFilePath.create(longPath);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "TooLong");
      assertEquals((result.error as any).maxLength, 512);
    }
  });

  await t.step("should reject paths with null bytes", () => {
    const result = ValidFilePath.create("/path/with\0null");
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("should reject paths with carriage return", () => {
    const result = ValidFilePath.create("/path/with\rcarriage");
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("should reject paths with newline", () => {
    const result = ValidFilePath.create("/path/with\nnewline");
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("should trim whitespace from valid paths", () => {
    const result = ValidFilePath.create("  /path/to/file.md  ");
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.value, "/path/to/file.md");
    }
  });

  await t.step("createMarkdown should accept .md files", () => {
    const result = ValidFilePath.createMarkdown("/path/to/file.md");
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.value, "/path/to/file.md");
    }
  });

  await t.step("createMarkdown should reject non-.md files", () => {
    const result = ValidFilePath.createMarkdown("/path/to/file.txt");
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "FileExtensionMismatch");
      assertEquals((result.error as any).path, "/path/to/file.txt");
      assertEquals((result.error as any).expected, [".md"]);
    }
  });

  await t.step("isMarkdown should correctly identify .md files", () => {
    const mdResult = ValidFilePath.create("/path/to/file.md");
    const txtResult = ValidFilePath.create("/path/to/file.txt");
    
    if (mdResult.ok) {
      assertEquals(mdResult.data.isMarkdown(), true);
    }
    if (txtResult.ok) {
      assertEquals(txtResult.data.isMarkdown(), false);
    }
  });

  await t.step("filename property should return correct filename", () => {
    const result = ValidFilePath.create("/path/to/file.md");
    
    if (result.ok) {
      assertEquals(result.data.filename, "file.md");
    }
  });

  await t.step("filename property should handle root file", () => {
    const result = ValidFilePath.create("file.md");
    
    if (result.ok) {
      assertEquals(result.data.filename, "file.md");
    }
  });

  await t.step("directory property should return correct directory", () => {
    const result = ValidFilePath.create("/path/to/file.md");
    
    if (result.ok) {
      assertEquals(result.data.directory, "/path/to");
    }
  });

  await t.step("directory property should handle root directory", () => {
    const result = ValidFilePath.create("file.md");
    
    if (result.ok) {
      assertEquals(result.data.directory, "");
    }
  });
});

Deno.test("FrontMatterContent Smart Constructor", async (t) => {
  await t.step("should parse simple YAML frontmatter", () => {
    const yamlContent = `title: Test Document
author: John Doe
published: true
count: 42`;
    
    const result = FrontMatterContent.fromYaml(yamlContent);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.get("title"), "Test Document");
      assertEquals(result.data.get("author"), "John Doe");
      assertEquals(result.data.get("published"), true);
      assertEquals(result.data.get("count"), 42);
    }
  });

  await t.step("should reject empty YAML content", () => {
    const result = FrontMatterContent.fromYaml("");
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should reject whitespace-only YAML content", () => {
    const result = FrontMatterContent.fromYaml("   ");
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should ignore comments in YAML", () => {
    const yamlContent = `title: Test Document
# This is a comment
author: John Doe`;
    
    const result = FrontMatterContent.fromYaml(yamlContent);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.get("title"), "Test Document");
      assertEquals(result.data.get("author"), "John Doe");
      assertEquals(result.data.has("# This is a comment"), false);
    }
  });

  await t.step("should ignore lines without colons", () => {
    const yamlContent = `title: Test Document
invalid line without colon
author: John Doe`;
    
    const result = FrontMatterContent.fromYaml(yamlContent);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.get("title"), "Test Document");
      assertEquals(result.data.get("author"), "John Doe");
      assertEquals(result.data.size(), 2);
    }
  });

  await t.step("should parse quoted strings", () => {
    const yamlContent = `title: "Quoted Title"
description: "Multi word description"`;
    
    const result = FrontMatterContent.fromYaml(yamlContent);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.get("title"), "Quoted Title");
      assertEquals(result.data.get("description"), "Multi word description");
    }
  });

  await t.step("should parse boolean values", () => {
    const yamlContent = `published: true
draft: false
enabled: TRUE
disabled: FALSE`;
    
    const result = FrontMatterContent.fromYaml(yamlContent);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.get("published"), true);
      assertEquals(result.data.get("draft"), false);
      assertEquals(result.data.get("enabled"), true);
      assertEquals(result.data.get("disabled"), false);
    }
  });

  await t.step("should parse integer values", () => {
    const yamlContent = `count: 42
negative: -10
zero: 0`;
    
    const result = FrontMatterContent.fromYaml(yamlContent);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.get("count"), 42);
      assertEquals(result.data.get("negative"), -10);
      assertEquals(result.data.get("zero"), 0);
    }
  });

  await t.step("should create from object successfully", () => {
    const obj = {
      title: "Test",
      count: 42,
      published: true,
    };
    
    const result = FrontMatterContent.fromObject(obj);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.get("title"), "Test");
      assertEquals(result.data.get("count"), 42);
      assertEquals(result.data.get("published"), true);
    }
  });

  await t.step("should reject non-object input for fromObject", () => {
    const result = FrontMatterContent.fromObject("not an object" as any);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("should reject array input for fromObject", () => {
    const result = FrontMatterContent.fromObject([1, 2, 3] as any);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("should reject null input for fromObject", () => {
    const result = FrontMatterContent.fromObject(null as any);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("getTyped should return typed value when validator passes", () => {
    const obj = { count: 42 };
    const result = FrontMatterContent.fromObject(obj);
    
    if (result.ok) {
      const count = result.data.getTyped("count", (v): v is number => typeof v === "number");
      assertEquals(count, 42);
    }
  });

  await t.step("getTyped should return undefined when validator fails", () => {
    const obj = { count: "not a number" };
    const result = FrontMatterContent.fromObject(obj);
    
    if (result.ok) {
      const count = result.data.getTyped("count", (v): v is number => typeof v === "number");
      assertEquals(count, undefined);
    }
  });

  await t.step("has method should correctly detect key presence", () => {
    const obj = { title: "Test", count: 0 };
    const result = FrontMatterContent.fromObject(obj);
    
    if (result.ok) {
      assertEquals(result.data.has("title"), true);
      assertEquals(result.data.has("count"), true);
      assertEquals(result.data.has("nonexistent"), false);
    }
  });

  await t.step("keys method should return all keys", () => {
    const obj = { title: "Test", count: 42, published: true };
    const result = FrontMatterContent.fromObject(obj);
    
    if (result.ok) {
      const keys = result.data.keys();
      assertEquals(keys.sort(), ["count", "published", "title"]);
    }
  });

  await t.step("size method should return correct count", () => {
    const obj = { title: "Test", count: 42, published: true };
    const result = FrontMatterContent.fromObject(obj);
    
    if (result.ok) {
      assertEquals(result.data.size(), 3);
    }
  });
});

Deno.test("SchemaDefinition Smart Constructor", async (t) => {
  await t.step("should create schema from valid object", () => {
    const schema = { type: "object", properties: { title: { type: "string" } } };
    const result = SchemaDefinition.create(schema);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.schema, schema);
    }
  });

  await t.step("should reject null schema", () => {
    const result = SchemaDefinition.create(null as any);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should reject undefined schema", () => {
    const result = SchemaDefinition.create(undefined as any);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should reject non-object schema", () => {
    const result = SchemaDefinition.create("not an object" as any);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("should reject array schema", () => {
    const result = SchemaDefinition.create([1, 2, 3] as any);
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("should create schema from JSON string", () => {
    const jsonString = '{"type": "object", "properties": {"title": {"type": "string"}}}';
    const result = SchemaDefinition.fromJsonString(jsonString);
    
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals((result.data.schema as any).type, "object");
    }
  });

  await t.step("should reject empty JSON string", () => {
    const result = SchemaDefinition.fromJsonString("");
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should reject invalid JSON string", () => {
    const result = SchemaDefinition.fromJsonString("{ invalid json }");
    
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ParseError");
    }
  });

  await t.step("should validate data successfully for valid schema", () => {
    const schema = { type: "object" };
    const schemaResult = SchemaDefinition.create(schema);
    
    if (schemaResult.ok) {
      const validationResult = schemaResult.data.validate({ title: "Test" });
      assertEquals(validationResult.ok, true);
      if (validationResult.ok) {
        assertEquals(validationResult.data, true);
      }
    }
  });

  await t.step("should reject null data for validation", () => {
    const schema = { type: "object" };
    const schemaResult = SchemaDefinition.create(schema);
    
    if (schemaResult.ok) {
      const validationResult = schemaResult.data.validate(null);
      assertEquals(validationResult.ok, false);
      if (!validationResult.ok) {
        assertEquals(validationResult.error.kind, "EmptyInput");
      }
    }
  });

  await t.step("should reject undefined data for validation", () => {
    const schema = { type: "object" };
    const schemaResult = SchemaDefinition.create(schema);
    
    if (schemaResult.ok) {
      const validationResult = schemaResult.data.validate(undefined);
      assertEquals(validationResult.ok, false);
      if (!validationResult.ok) {
        assertEquals(validationResult.error.kind, "EmptyInput");
      }
    }
  });
});

Deno.test("SourceFile Smart Constructor", async (t) => {
  await t.step("should create SourceFile successfully", () => {
    const pathResult = ValidFilePath.create("/test.md");
    const frontMatterResult = FrontMatterContent.fromObject({ title: "Test" });
    
    if (pathResult.ok && frontMatterResult.ok) {
      const sourceFileResult = SourceFile.create(pathResult.data, "# Test Content", frontMatterResult.data);
      
      assertEquals(sourceFileResult.ok, true);
      if (sourceFileResult.ok) {
        assertEquals(sourceFileResult.data.path.value, "/test.md");
        assertEquals(sourceFileResult.data.content, "# Test Content");
        assertEquals(sourceFileResult.data.hasFrontMatter(), true);
      }
    }
  });

  await t.step("should create SourceFile without frontmatter", () => {
    const pathResult = ValidFilePath.create("/test.md");
    
    if (pathResult.ok) {
      const sourceFileResult = SourceFile.create(pathResult.data, "# Test Content");
      
      assertEquals(sourceFileResult.ok, true);
      if (sourceFileResult.ok) {
        assertEquals(sourceFileResult.data.path.value, "/test.md");
        assertEquals(sourceFileResult.data.content, "# Test Content");
        assertEquals(sourceFileResult.data.hasFrontMatter(), false);
      }
    }
  });

  await t.step("should reject null content", () => {
    const pathResult = ValidFilePath.create("/test.md");
    
    if (pathResult.ok) {
      const sourceFileResult = SourceFile.create(pathResult.data, null as any);
      
      assertEquals(sourceFileResult.ok, false);
      if (!sourceFileResult.ok) {
        assertEquals(sourceFileResult.error.kind, "InvalidFormat");
      }
    }
  });

  await t.step("should accept empty string content", () => {
    const pathResult = ValidFilePath.create("/test.md");
    
    if (pathResult.ok) {
      const sourceFileResult = SourceFile.create(pathResult.data, "");
      
      assertEquals(sourceFileResult.ok, true);
      if (sourceFileResult.ok) {
        assertEquals(sourceFileResult.data.content, "");
      }
    }
  });

  await t.step("extractFrontMatter should return frontmatter when present", () => {
    const pathResult = ValidFilePath.create("/test.md");
    const frontMatterResult = FrontMatterContent.fromObject({ title: "Test" });
    
    if (pathResult.ok && frontMatterResult.ok) {
      const sourceFileResult = SourceFile.create(pathResult.data, "# Content", frontMatterResult.data);
      
      if (sourceFileResult.ok) {
        const extracted = sourceFileResult.data.extractFrontMatter();
        assertEquals(extracted.ok, true);
        if (extracted.ok) {
          assertEquals(extracted.data.get("title"), "Test");
        }
      }
    }
  });

  await t.step("extractFrontMatter should fail when no frontmatter present", () => {
    const pathResult = ValidFilePath.create("/test.md");
    
    if (pathResult.ok) {
      const sourceFileResult = SourceFile.create(pathResult.data, "# Content");
      
      if (sourceFileResult.ok) {
        const extracted = sourceFileResult.data.extractFrontMatter();
        assertEquals(extracted.ok, false);
        if (!extracted.ok) {
          assertEquals(extracted.error.kind, "InvalidFormat");
        }
      }
    }
  });
});

Deno.test("AnalysisResult", async (t) => {
  await t.step("should create AnalysisResult with metadata", () => {
    const pathResult = ValidFilePath.create("/test.md");
    
    if (pathResult.ok) {
      const metadata = new Map([["timestamp", "2023-01-01"], ["version", "1.0"]]);
      const result = new AnalysisResult(pathResult.data, { title: "Test" }, metadata);
      
      assertEquals(result.sourceFile.value, "/test.md");
      assertEquals(result.extractedData.title, "Test");
      assertEquals(result.getMetadata("timestamp"), "2023-01-01");
      assertEquals(result.getMetadata("version"), "1.0");
    }
  });

  await t.step("should handle metadata operations", () => {
    const pathResult = ValidFilePath.create("/test.md");
    
    if (pathResult.ok) {
      const result = new AnalysisResult(pathResult.data, { title: "Test" });
      
      result.addMetadata("author", "John Doe");
      result.addMetadata("created", new Date("2023-01-01"));
      
      assertEquals(result.hasMetadata("author"), true);
      assertEquals(result.hasMetadata("nonexistent"), false);
      assertEquals(result.getMetadata("author"), "John Doe");
    }
  });

  await t.step("should support typed metadata retrieval", () => {
    const pathResult = ValidFilePath.create("/test.md");
    
    if (pathResult.ok) {
      const result = new AnalysisResult(pathResult.data, { title: "Test" });
      
      result.addMetadata("count", 42);
      result.addMetadata("name", "test");
      
      const count = result.getTypedMetadata("count", (v): v is number => typeof v === "number");
      const name = result.getTypedMetadata("name", (v): v is string => typeof v === "string");
      const invalid = result.getTypedMetadata("count", (v): v is string => typeof v === "string");
      
      assertEquals(count, 42);
      assertEquals(name, "test");
      assertEquals(invalid, undefined);
    }
  });
});