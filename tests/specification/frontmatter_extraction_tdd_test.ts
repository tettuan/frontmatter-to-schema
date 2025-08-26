/**
 * TDD Test Suite for FrontMatter Extraction Pipeline
 * Following TDD principles: Red-Green-Refactor cycle
 * Issue #388: Comprehensive test coverage using test-climpt principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1.0.9";
import { FrontMatterExtractorImpl } from "../../src/infrastructure/adapters/frontmatter-extractor-impl.ts";
import { Document, FrontMatter } from "../../src/domain/models/entities.ts";
import { DocumentPath, DocumentContent } from "../../src/domain/models/value-objects.ts";

Deno.test("TDD: FrontMatter Extraction Pipeline", async (t) => {
  const extractor = new FrontMatterExtractorImpl();

  await t.step("GIVEN valid markdown with YAML frontmatter WHEN extracted THEN returns parsed object", () => {
    // Arrange
    const markdown = `---
title: Test Document
description: A test document for TDD
tags:
  - test
  - tdd
  - frontmatter
metadata:
  author: TDD Bot
  version: 1.0.0
---

# Test Content

This is the body content.`;

    const pathResult = DocumentPath.create("test.md");
    const contentResult = DocumentContent.create(markdown);
    
    assertEquals(pathResult.ok, true);
    assertEquals(contentResult.ok, true);
    
    if (!pathResult.ok || !contentResult.ok) {
      throw new Error("Failed to create test data");
    }

    const doc = Document.create(pathResult.data, null, contentResult.data);

    // Act
    const result = extractor.extract(doc);

    // Assert
    assertEquals(result.ok, true);
    if (!result.ok) {
      throw new Error("Extraction failed");
    }
    assertExists(result.data);
    
    const frontMatterData = result.data!.getContent().toJSON() as Record<string, unknown>;
    assertEquals(frontMatterData.title, "Test Document");
    assertEquals(frontMatterData.description, "A test document for TDD");
    assertEquals(Array.isArray(frontMatterData.tags), true);
    assertEquals((frontMatterData.tags as string[]).length, 3);
    assertExists(frontMatterData._documentPath); // Path propagation check
  });

  await t.step("GIVEN markdown without frontmatter WHEN extracted THEN returns null", () => {
    // Arrange
    const markdown = `# Just Content

No frontmatter here, just regular markdown content.`;

    const pathResult = DocumentPath.create("no-frontmatter.md");
    const contentResult = DocumentContent.create(markdown);
    
    assertEquals(pathResult.ok, true);
    assertEquals(contentResult.ok, true);
    
    if (!pathResult.ok || !contentResult.ok) {
      throw new Error("Failed to create test data");
    }

    const doc = Document.create(pathResult.data, null, contentResult.data);

    // Act
    const result = extractor.extract(doc);

    // Assert
    assertEquals(result.ok, true);
    assertEquals(result.data, null);
  });

  await t.step("GIVEN empty frontmatter section WHEN extracted THEN returns null", () => {
    // Arrange
    const markdown = `---
---

# Content with empty frontmatter`;

    const pathResult = DocumentPath.create("empty-frontmatter.md");
    const contentResult = DocumentContent.create(markdown);
    
    assertEquals(pathResult.ok, true);
    assertEquals(contentResult.ok, true);
    
    if (!pathResult.ok || !contentResult.ok) {
      throw new Error("Failed to create test data");
    }

    const doc = Document.create(pathResult.data, null, contentResult.data);

    // Act
    const result = extractor.extract(doc);

    // Assert
    assertEquals(result.ok, true);
    assertEquals(result.data, null);
  });

  await t.step("GIVEN malformed YAML in frontmatter WHEN extracted THEN handles gracefully", () => {
    // Arrange
    const markdown = `---
title: Broken YAML
invalid: : : multiple colons
  bad indentation here
---

# Content`;

    const pathResult = DocumentPath.create("malformed.md");
    const contentResult = DocumentContent.create(markdown);
    
    assertEquals(pathResult.ok, true);
    assertEquals(contentResult.ok, true);
    
    if (!pathResult.ok || !contentResult.ok) {
      throw new Error("Failed to create test data");
    }

    const doc = Document.create(pathResult.data, null, contentResult.data);

    // Act
    const result = extractor.extract(doc);

    // Assert - Should either parse what it can or return null/error
    assertExists(result); // Should not throw
  });

  await t.step("GIVEN complex nested structures WHEN extracted THEN preserves hierarchy", () => {
    // Arrange
    const markdown = `---
project:
  name: FrontMatter Schema
  version: 2.0.0
  dependencies:
    - name: deno
      version: 1.46.0
    - name: typescript
      version: 5.5.0
  config:
    deep:
      nested:
        value: 42
        enabled: true
---

# Complex Structure Test`;

    const pathResult = DocumentPath.create("complex.md");
    const contentResult = DocumentContent.create(markdown);
    
    assertEquals(pathResult.ok, true);
    assertEquals(contentResult.ok, true);
    
    if (!pathResult.ok || !contentResult.ok) {
      throw new Error("Failed to create test data");
    }

    const doc = Document.create(pathResult.data, null, contentResult.data);

    // Act
    const result = extractor.extract(doc);

    // Assert
    assertEquals(result.ok, true);
    if (!result.ok) {
      throw new Error("Extraction failed");
    }
    assertExists(result.data);
    
    const frontMatterData = result.data!.getContent().toJSON() as any;
    assertExists(frontMatterData.project);
    assertEquals(frontMatterData.project.name, "FrontMatter Schema");
    assertEquals(frontMatterData.project.version, "2.0.0");
    assertEquals(Array.isArray(frontMatterData.project.dependencies), true);
    assertEquals(frontMatterData.project.config.deep.nested.value, 42);
  });

  await t.step("GIVEN unicode and special characters WHEN extracted THEN handles correctly", () => {
    // Arrange
    const markdown = `---
title: "日本語タイトル"
emoji: "🚀 🎯 ✅"
special: "Line with 'quotes' and \"double quotes\""
multiline: |
  This is a multiline
  string value that should
  preserve formatting
---

# Unicode Content Test`;

    const pathResult = DocumentPath.create("unicode.md");
    const contentResult = DocumentContent.create(markdown);
    
    assertEquals(pathResult.ok, true);
    assertEquals(contentResult.ok, true);
    
    if (!pathResult.ok || !contentResult.ok) {
      throw new Error("Failed to create test data");
    }

    const doc = Document.create(pathResult.data, null, contentResult.data);

    // Act
    const result = extractor.extract(doc);

    // Assert
    assertEquals(result.ok, true);
    if (!result.ok) {
      throw new Error("Extraction failed");
    }
    assertExists(result.data);
    
    const frontMatterData = result.data!.getContent().toJSON() as any;
    assertEquals(frontMatterData.title, "日本語タイトル");
    assertEquals(frontMatterData.emoji, "🚀 🎯 ✅");
    assertExists(frontMatterData.special);
    assertExists(frontMatterData.multiline);
  });

  await t.step("GIVEN document path WHEN extracted THEN includes _documentPath field", () => {
    // Arrange
    const markdown = `---
title: Path Test
---

Content`;
    
    const testPath = "tests/fixtures/test-doc.md";
    const pathResult = DocumentPath.create(testPath);
    const contentResult = DocumentContent.create(markdown);
    
    assertEquals(pathResult.ok, true);
    assertEquals(contentResult.ok, true);
    
    if (!pathResult.ok || !contentResult.ok) {
      throw new Error("Failed to create test data");
    }

    const doc = Document.create(pathResult.data, null, contentResult.data);

    // Act
    const result = extractor.extract(doc);

    // Assert
    assertEquals(result.ok, true);
    if (!result.ok) {
      throw new Error("Extraction failed");
    }
    assertExists(result.data);
    
    const frontMatterData = result.data!.getContent().toJSON() as any;
    assertEquals(frontMatterData._documentPath, testPath);
  });

  await t.step("GIVEN arrays and lists WHEN extracted THEN preserves structure", () => {
    // Arrange
    const markdown = `---
tags: [javascript, typescript, deno]
authors:
  - name: Alice
    role: Developer
  - name: Bob
    role: Tester
numbers: [1, 2, 3, 4, 5]
mixed: [true, 42, "string", null]
---

Content`;

    const pathResult = DocumentPath.create("arrays.md");
    const contentResult = DocumentContent.create(markdown);
    
    assertEquals(pathResult.ok, true);
    assertEquals(contentResult.ok, true);
    
    if (!pathResult.ok || !contentResult.ok) {
      throw new Error("Failed to create test data");
    }

    const doc = Document.create(pathResult.data, null, contentResult.data);

    // Act
    const result = extractor.extract(doc);

    // Assert
    assertEquals(result.ok, true);
    if (!result.ok) {
      throw new Error("Extraction failed");
    }
    assertExists(result.data);
    
    const frontMatterData = result.data!.getContent().toJSON() as any;
    assertEquals(Array.isArray(frontMatterData.tags), true);
    assertEquals(frontMatterData.tags.length, 3);
    assertEquals(Array.isArray(frontMatterData.authors), true);
    assertEquals(frontMatterData.authors[0].name, "Alice");
    assertEquals(Array.isArray(frontMatterData.numbers), true);
    assertEquals(frontMatterData.numbers[2], 3);
  });

  await t.step("GIVEN boolean and null values WHEN extracted THEN preserves types", () => {
    // Arrange
    const markdown = `---
enabled: true
disabled: false
optional: null
defaulted: ~
---

Content`;

    const pathResult = DocumentPath.create("types.md");
    const contentResult = DocumentContent.create(markdown);
    
    assertEquals(pathResult.ok, true);
    assertEquals(contentResult.ok, true);
    
    if (!pathResult.ok || !contentResult.ok) {
      throw new Error("Failed to create test data");
    }

    const doc = Document.create(pathResult.data, null, contentResult.data);

    // Act
    const result = extractor.extract(doc);

    // Assert
    assertEquals(result.ok, true);
    if (!result.ok) {
      throw new Error("Extraction failed");
    }
    assertExists(result.data);
    
    const frontMatterData = result.data!.getContent().toJSON() as any;
    assertEquals(frontMatterData.enabled, true);
    assertEquals(frontMatterData.disabled, false);
    assertEquals(frontMatterData.optional, null);
    assertEquals(frontMatterData.defaulted, null);
  });

  await t.step("GIVEN climpt command metadata WHEN extracted THEN parses correctly", () => {
    // Arrange
    const markdown = `---
directive: merge-cleanup
layer: develop-branches
adaptation: default
description: Merge develop branches and cleanup
input_text: true
output_path: /tmp/output
---

# Climpt Command Documentation`;

    const pathResult = DocumentPath.create(".agent/climpt/prompts/git/merge-cleanup/develop-branches/f_default.md");
    const contentResult = DocumentContent.create(markdown);
    
    assertEquals(pathResult.ok, true);
    assertEquals(contentResult.ok, true);
    
    if (!pathResult.ok || !contentResult.ok) {
      throw new Error("Failed to create test data");
    }

    const doc = Document.create(pathResult.data, null, contentResult.data);

    // Act
    const result = extractor.extract(doc);

    // Assert
    assertEquals(result.ok, true);
    if (!result.ok) {
      throw new Error("Extraction failed");
    }
    assertExists(result.data);
    
    const frontMatterData = result.data!.getContent().toJSON() as any;
    assertEquals(frontMatterData.directive, "merge-cleanup");
    assertEquals(frontMatterData.layer, "develop-branches");
    assertEquals(frontMatterData.adaptation, "default");
    assertEquals(frontMatterData.description, "Merge develop branches and cleanup");
    assertEquals(frontMatterData._documentPath, ".agent/climpt/prompts/git/merge-cleanup/develop-branches/f_default.md");
  });
});