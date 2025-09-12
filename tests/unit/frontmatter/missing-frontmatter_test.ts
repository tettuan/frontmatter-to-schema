/**
 * Tests for graceful handling of missing frontmatter (Issue #695)
 *
 * Validates that the system properly handles documents without frontmatter
 * when allowEmptyFrontmatter is enabled
 */

import { assertEquals } from "jsr:@std/assert@1.0.8";
import { FrontmatterContext } from "../../../src/domain/frontmatter/frontmatter-context.ts";
import { ProcessingOptionsBuilder } from "../../../src/application/services/processing-options-builder.ts";

Deno.test("FrontmatterContext - Missing Frontmatter Handling", async (t) => {
  const context = new FrontmatterContext();

  await t.step(
    "should return empty frontmatter when allowEmptyFrontmatter is true",
    () => {
      const contentWithoutFrontmatter = `# Just a heading

This is a markdown file without any frontmatter.
It should be handled gracefully.`;

      const result = context.extractFrontmatter(contentWithoutFrontmatter, {
        allowEmptyFrontmatter: true,
        strict: false,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        // Content should be the entire document since there's no frontmatter
        assertEquals(result.data.content, contentWithoutFrontmatter);
        // Frontmatter should exist but be empty
        assertEquals(result.data.frontmatter.getData(), {});
        assertEquals(result.data.extractionMethod, "yaml");
        assertEquals(result.data.lineNumbers.start, 0);
        assertEquals(result.data.lineNumbers.end, 0);
      }
    },
  );

  await t.step(
    "should return error when allowEmptyFrontmatter is false",
    () => {
      const contentWithoutFrontmatter = `# Just a heading

This is a markdown file without any frontmatter.`;

      const result = context.extractFrontmatter(contentWithoutFrontmatter, {
        allowEmptyFrontmatter: false,
        strict: true,
      });

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "NoFrontMatterPresent");
      }
    },
  );

  await t.step(
    "should handle empty content when allowEmptyFrontmatter is true",
    () => {
      const emptyContent = "";

      const result = context.extractFrontmatter(emptyContent, {
        allowEmptyFrontmatter: true,
        strict: false,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.content, "");
        assertEquals(result.data.frontmatter.getData()._empty, true);
      }
    },
  );

  await t.step(
    "should handle whitespace-only content when allowEmptyFrontmatter is true",
    () => {
      const whitespaceContent = "   \n  \n   ";

      const result = context.extractFrontmatter(whitespaceContent, {
        allowEmptyFrontmatter: true,
        strict: false,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.content, "");
        assertEquals(result.data.frontmatter.getData()._empty, true);
      }
    },
  );

  await t.step("should correctly extract frontmatter when present", () => {
    const contentWithFrontmatter = `---
title: Test Document
author: Test Author
---

# Document Content

This document has frontmatter.`;

    const result = context.extractFrontmatter(contentWithFrontmatter, {
      allowEmptyFrontmatter: true,
      strict: false,
    });

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.frontmatter.getData().title, "Test Document");
      assertEquals(result.data.frontmatter.getData().author, "Test Author");
      assertEquals(result.data.content.startsWith("# Document Content"), true);
      assertEquals(result.data.extractionMethod, "yaml");
    }
  });
});

Deno.test("ProcessingOptionsBuilder - Default Configuration", async (t) => {
  await t.step("should have allowEmptyFrontmatter enabled by default", () => {
    const defaults = ProcessingOptionsBuilder.getDefaults();

    assertEquals(defaults.allowEmptyFrontmatter, true);
    assertEquals(defaults.strict, true);
    assertEquals(defaults.validateSchema, true);
  });

  await t.step(
    "should create builder with allowEmptyFrontmatter enabled",
    () => {
      const builderResult = ProcessingOptionsBuilder.create();

      assertEquals(builderResult.ok, true);
      if (builderResult.ok) {
        const options = builderResult.data.getOptions();
        assertEquals(options.allowEmptyFrontmatter, true);
      }
    },
  );

  await t.step("should allow strict mode with allowEmptyFrontmatter", () => {
    const builderResult = ProcessingOptionsBuilder.create({
      strict: true,
      allowEmptyFrontmatter: true,
      validateSchema: true,
    });

    assertEquals(builderResult.ok, true);
    if (builderResult.ok) {
      const options = builderResult.data.getOptions();
      assertEquals(options.strict, true);
      assertEquals(options.allowEmptyFrontmatter, true);
      assertEquals(options.validateSchema, true);
    }
  });

  await t.step(
    "should create permissive builder with allowEmptyFrontmatter",
    () => {
      const builderResult = ProcessingOptionsBuilder.createPermissive();

      assertEquals(builderResult.ok, true);
      if (builderResult.ok) {
        const options = builderResult.data.getOptions();
        assertEquals(options.allowEmptyFrontmatter, true);
        assertEquals(options.strict, false);
      }
    },
  );
});
