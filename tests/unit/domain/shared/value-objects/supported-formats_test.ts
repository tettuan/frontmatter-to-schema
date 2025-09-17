/**
 * Tests for SupportedFormats registry
 * Following robust testing principles with totality
 */

import { assertEquals, assertExists } from "@std/assert";
import { SupportedFormats } from "../../../../../src/domain/shared/value-objects/supported-formats.ts";
import { FileExtension } from "../../../../../src/domain/shared/value-objects/file-extension.ts";

Deno.test("SupportedFormats", async (t) => {
  await t.step("isSupported() - validates extensions for categories", () => {
    // Schema category
    const jsonExt = FileExtension.create(".json");
    assertEquals(jsonExt.ok, true);
    if (jsonExt.ok) {
      assertEquals(SupportedFormats.isSupported(jsonExt.data, "schema"), true);
      assertEquals(
        SupportedFormats.isSupported(jsonExt.data, "template"),
        true,
      );
      assertEquals(
        SupportedFormats.isSupported(jsonExt.data, "output"),
        true,
      );
      assertEquals(
        SupportedFormats.isSupported(jsonExt.data, "markdown"),
        false,
      );
    }

    // Markdown category
    const mdExt = FileExtension.create(".md");
    assertEquals(mdExt.ok, true);
    if (mdExt.ok) {
      assertEquals(
        SupportedFormats.isSupported(mdExt.data, "markdown"),
        true,
      );
      assertEquals(SupportedFormats.isSupported(mdExt.data, "schema"), false);
      assertEquals(
        SupportedFormats.isSupported(mdExt.data, "template"),
        false,
      );
    }

    // Unknown extension
    const unknownExt = FileExtension.create(".xyz");
    assertEquals(unknownExt.ok, true);
    if (unknownExt.ok) {
      assertEquals(
        SupportedFormats.isSupported(unknownExt.data, "schema"),
        false,
      );
      assertEquals(
        SupportedFormats.isSupported(unknownExt.data, "markdown"),
        false,
      );
    }
  });

  await t.step("getExtensions() - returns extensions for category", () => {
    // Valid categories
    const schemaExtensions = SupportedFormats.getExtensions("schema");
    assertEquals(schemaExtensions.ok, true);
    if (schemaExtensions.ok) {
      assertEquals(schemaExtensions.data.length >= 1, true);
      const jsonFound = schemaExtensions.data.some((e) =>
        e.getValue() === ".json"
      );
      assertEquals(jsonFound, true);
    }

    const markdownExtensions = SupportedFormats.getExtensions("markdown");
    assertEquals(markdownExtensions.ok, true);
    if (markdownExtensions.ok) {
      assertEquals(markdownExtensions.data.length >= 1, true);
      const mdFound = markdownExtensions.data.some((e) =>
        e.getValue() === ".md"
      );
      assertEquals(mdFound, true);
    }

    // Invalid category
    const invalidCategory = SupportedFormats.getExtensions(
      "invalid" as any,
    );
    assertEquals(invalidCategory.ok, false);
    if (!invalidCategory.ok) {
      assertEquals(invalidCategory.error.kind, "InvalidFormat");
      assertExists(invalidCategory.error.message);
    }
  });

  await t.step("validatePath() - validates file paths for categories", () => {
    // Valid schema file
    const schemaValidation = SupportedFormats.validatePath(
      "schema.json",
      "schema",
    );
    assertEquals(schemaValidation.ok, true);
    if (schemaValidation.ok) {
      assertEquals(schemaValidation.data.getValue(), ".json");
    }

    // Invalid schema file (markdown extension)
    const invalidSchema = SupportedFormats.validatePath(
      "schema.md",
      "schema",
    );
    assertEquals(invalidSchema.ok, false);
    if (!invalidSchema.ok) {
      assertEquals(invalidSchema.error.kind, "InvalidFormat");
      assertExists(invalidSchema.error.message);
      assertEquals(
        invalidSchema.error.message.includes("Unsupported schema format"),
        true,
      );
    }

    // Valid markdown file
    const markdownValidation = SupportedFormats.validatePath(
      "README.md",
      "markdown",
    );
    assertEquals(markdownValidation.ok, true);
    if (markdownValidation.ok) {
      assertEquals(markdownValidation.data.getValue(), ".md");
    }

    // File without extension
    const noExtension = SupportedFormats.validatePath(
      "README",
      "markdown",
    );
    assertEquals(noExtension.ok, false);
    if (!noExtension.ok) {
      assertEquals(noExtension.error.kind, "InvalidFormat");
    }
  });

  await t.step(
    "getSuggestedExamples() - provides example file names",
    () => {
      // Schema examples
      const schemaExamples = SupportedFormats.getSuggestedExamples("schema");
      assertEquals(schemaExamples.length > 0, true);
      assertEquals(schemaExamples.some((e) => e.includes(".json")), true);
      assertEquals(schemaExamples.some((e) => e.includes("schema")), true);

      // Template examples
      const templateExamples = SupportedFormats.getSuggestedExamples(
        "template",
      );
      assertEquals(templateExamples.length > 0, true);
      assertEquals(
        templateExamples.some((e) => e.includes("template")),
        true,
      );

      // Markdown examples
      const markdownExamples = SupportedFormats.getSuggestedExamples(
        "markdown",
      );
      assertEquals(markdownExamples.length > 0, true);
      assertEquals(markdownExamples.some((e) => e.includes(".md")), true);

      // Invalid category
      const invalidExamples = SupportedFormats.getSuggestedExamples(
        "invalid" as any,
      );
      assertEquals(invalidExamples.length, 0);
    },
  );

  await t.step("detectCategory() - detects category from file path", () => {
    // Schema files (by name pattern)
    const schemaFile = SupportedFormats.detectCategory(
      "command_schema.json",
    );
    assertEquals(schemaFile.ok, true);
    if (schemaFile.ok) {
      assertEquals(schemaFile.data, "schema");
    }

    // Template files (by name pattern)
    const templateFile = SupportedFormats.detectCategory(
      "output_template.yaml",
    );
    assertEquals(templateFile.ok, true);
    if (templateFile.ok) {
      assertEquals(templateFile.data, "template");
    }

    // Markdown files (by extension)
    const markdownFile = SupportedFormats.detectCategory("README.md");
    assertEquals(markdownFile.ok, true);
    if (markdownFile.ok) {
      assertEquals(markdownFile.data, "markdown");
    }

    // JSON file without specific pattern
    const jsonFile = SupportedFormats.detectCategory("data.json");
    assertEquals(jsonFile.ok, true);
    if (jsonFile.ok) {
      // Should detect as one of the categories that support JSON
      const validCategories = ["schema", "template", "output", "configuration"];
      assertEquals(validCategories.includes(jsonFile.data), true);
    }

    // Unknown file type
    const unknownFile = SupportedFormats.detectCategory("file.xyz");
    assertEquals(unknownFile.ok, false);
    if (!unknownFile.ok) {
      assertEquals(unknownFile.error.kind, "InvalidFormat");
      assertExists(unknownFile.error.message);
    }

    // File without extension
    const noExtFile = SupportedFormats.detectCategory("Makefile");
    assertEquals(noExtFile.ok, false);
    if (!noExtFile.ok) {
      assertEquals(noExtFile.error.kind, "InvalidFormat");
    }
  });

  await t.step("category coverage - all categories have extensions", () => {
    const categories = [
      "schema",
      "template",
      "markdown",
      "output",
      "configuration",
    ] as const;

    for (const category of categories) {
      const extensions = SupportedFormats.getExtensions(category);
      assertEquals(extensions.ok, true);
      if (extensions.ok) {
        assertEquals(
          extensions.data.length > 0,
          true,
          `Category ${category} should have extensions`,
        );
      }
    }
  });

  await t.step(
    "extension uniqueness - extensions map to correct categories",
    () => {
      // Test that markdown extensions only work for markdown category
      const mdExt = FileExtension.create(".md");
      assertEquals(mdExt.ok, true);
      if (mdExt.ok) {
        assertEquals(
          SupportedFormats.isSupported(mdExt.data, "markdown"),
          true,
        );
        assertEquals(
          SupportedFormats.isSupported(mdExt.data, "schema"),
          false,
        );
      }

      // Test that JSON works for multiple categories
      const jsonExt = FileExtension.create(".json");
      assertEquals(jsonExt.ok, true);
      if (jsonExt.ok) {
        assertEquals(
          SupportedFormats.isSupported(jsonExt.data, "schema"),
          true,
        );
        assertEquals(
          SupportedFormats.isSupported(jsonExt.data, "template"),
          true,
        );
        assertEquals(
          SupportedFormats.isSupported(jsonExt.data, "output"),
          true,
        );
        assertEquals(
          SupportedFormats.isSupported(jsonExt.data, "configuration"),
          true,
        );
      }
    },
  );
});
