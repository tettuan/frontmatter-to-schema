/**
 * Specification Tests for FormatRegistry
 *
 * Tests business requirements and eliminates hardcoded extension arrays
 * Addresses Issue #663: File extension hardcoding across multiple files
 */

import { assertEquals } from "jsr:@std/assert";
import {
  type FileFormat,
  type FormatCategory,
  FormatRegistry,
} from "../../../../src/domain/shared/entities/format-registry.ts";

Deno.test("FormatRegistry Specification Tests", async (t) => {
  await t.step(
    "SPEC: Default registry must be created with all hardcoded extensions",
    () => {
      const result = FormatRegistry.createDefault();

      assertEquals(result.ok, true, "Default registry creation must succeed");
      if (result.ok) {
        const registry = result.data;

        // Test extensions from cli-arguments.ts hardcoding
        const cliExtensions = ["json", "yml", "yaml", "toml"];
        for (const ext of cliExtensions) {
          assertEquals(
            registry.isSupported(ext),
            true,
            `Must support CLI extension: ${ext}`,
          );
        }

        // Test extensions from schema-path.ts hardcoding
        const schemaExtensions = ["json", "yaml", "yml"];
        for (const ext of schemaExtensions) {
          assertEquals(
            registry.isSupported(ext, "schema"),
            true,
            `Must support schema extension: ${ext}`,
          );
        }

        // Test document extensions from architecture docs
        assertEquals(
          registry.isSupported("md", "document"),
          true,
          "Must support markdown documents",
        );
      }
    },
  );

  await t.step(
    "SPEC: Extension detection must replace hardcoded validExtensions arrays",
    () => {
      const result = FormatRegistry.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const registry = result.data;

        // Test cases that replace hardcoded checks
        const testCases = [
          {
            path: "schema.json",
            category: "schema" as FormatCategory,
            shouldDetect: true,
          },
          {
            path: "config.yaml",
            category: "schema" as FormatCategory,
            shouldDetect: true,
          },
          {
            path: "template.yml",
            category: "template" as FormatCategory,
            shouldDetect: true,
          },
          {
            path: "output.toml",
            category: "output" as FormatCategory,
            shouldDetect: true,
          },
          {
            path: "README.md",
            category: "document" as FormatCategory,
            shouldDetect: true,
          },
          {
            path: "unknown.xyz",
            category: "schema" as FormatCategory,
            shouldDetect: false,
          },
        ];

        for (const testCase of testCases) {
          const detection = registry.detectFormat(
            testCase.path,
            testCase.category,
          );
          assertEquals(
            detection.ok,
            testCase.shouldDetect,
            `${testCase.path} detection in ${testCase.category} should ${
              testCase.shouldDetect ? "succeed" : "fail"
            }`,
          );
        }
      }
    },
  );

  await t.step("SPEC: Category-based extension filtering must work", () => {
    const result = FormatRegistry.createDefault();
    assertEquals(result.ok, true);

    if (result.ok) {
      const registry = result.data;

      // Schema category should include json, yaml, yml
      const schemaExtensions = registry.getSupportedExtensions("schema");
      assertEquals(
        schemaExtensions.includes("json"),
        true,
        "Schema must support JSON",
      );
      assertEquals(
        schemaExtensions.includes("yaml"),
        true,
        "Schema must support YAML",
      );
      assertEquals(
        schemaExtensions.includes("yml"),
        true,
        "Schema must support YML",
      );

      // Output category should include toml
      const outputExtensions = registry.getSupportedExtensions("output");
      assertEquals(
        outputExtensions.includes("toml"),
        true,
        "Output must support TOML",
      );

      // Document category should include markdown
      const documentExtensions = registry.getSupportedExtensions("document");
      assertEquals(
        documentExtensions.includes("md"),
        true,
        "Document must support Markdown",
      );
    }
  });

  await t.step("SPEC: Extension aliases must work correctly", () => {
    const result = FormatRegistry.createDefault();
    assertEquals(result.ok, true);

    if (result.ok) {
      const registry = result.data;

      // YAML aliases should work
      const yamlResult = registry.detectFormat("config.yaml");
      const ymlResult = registry.detectFormat("config.yml");

      assertEquals(yamlResult.ok, true, "YAML extension should be detected");
      assertEquals(ymlResult.ok, true, "YML extension should be detected");

      if (yamlResult.ok && ymlResult.ok) {
        assertEquals(
          yamlResult.data.format.mediaType,
          ymlResult.data.format.mediaType,
          "YAML and YML should have same media type",
        );
      }

      // Markdown aliases should work
      const mdResult = registry.detectFormat("doc.md");
      const markdownResult = registry.detectFormat("doc.markdown");

      assertEquals(mdResult.ok, true, "MD extension should be detected");
      assertEquals(
        markdownResult.ok,
        true,
        "MARKDOWN extension should be detected",
      );
    }
  });

  await t.step("SPEC: Priority-based format selection must work", () => {
    const result = FormatRegistry.createDefault();
    assertEquals(result.ok, true);

    if (result.ok) {
      const registry = result.data;

      // JSON should have highest priority in schema category
      const jsonResult = registry.getFormat("json");
      assertEquals(jsonResult.ok, true);

      if (jsonResult.ok) {
        assertEquals(
          jsonResult.data.priority,
          100,
          "JSON should have highest priority",
        );
      }

      // Extensions should be ordered by priority
      const schemaFormats = registry.getAllFormats()
        .filter((f) => f.category === "schema")
        .sort((a, b) => b.priority - a.priority);

      assertEquals(
        schemaFormats[0].extension,
        "json",
        "JSON should be first priority",
      );
    }
  });

  await t.step("SPEC: Custom format registration must work", () => {
    const result = FormatRegistry.createDefault();
    assertEquals(result.ok, true);

    if (result.ok) {
      const registry = result.data;

      const customFormat: FileFormat = {
        extension: "custom",
        mediaType: "application/x-custom",
        category: "config",
        priority: 50,
      };

      const registerResult = registry.registerFormat(customFormat);
      assertEquals(
        registerResult.ok,
        true,
        "Custom format registration should succeed",
      );

      const detectionResult = registry.detectFormat("test.custom");
      assertEquals(
        detectionResult.ok,
        true,
        "Custom format should be detected",
      );

      if (detectionResult.ok) {
        assertEquals(
          detectionResult.data.format.mediaType,
          "application/x-custom",
          "Custom format should have correct media type",
        );
      }
    }
  });

  await t.step("SPEC: Error cases must be handled with Result type", () => {
    const result = FormatRegistry.createDefault();
    assertEquals(result.ok, true);

    if (result.ok) {
      const registry = result.data;

      // Empty path
      const emptyResult = registry.detectFormat("");
      assertEquals(emptyResult.ok, false);
      if (!emptyResult.ok) {
        assertEquals(emptyResult.error.kind, "InvalidExtension");
      }

      // Unsupported extension
      const unsupportedResult = registry.detectFormat("file.unknown");
      assertEquals(unsupportedResult.ok, false);
      if (!unsupportedResult.ok) {
        assertEquals(unsupportedResult.error.kind, "FormatNotFound");
      }

      // Wrong category
      const wrongCategoryResult = registry.detectFormat("file.md", "schema");
      assertEquals(wrongCategoryResult.ok, false);
      if (!wrongCategoryResult.ok) {
        assertEquals(wrongCategoryResult.error.kind, "FormatNotFound");
      }
    }
  });

  await t.step("SPEC: Extension normalization must work correctly", () => {
    const result = FormatRegistry.createDefault();
    assertEquals(result.ok, true);

    if (result.ok) {
      const registry = result.data;

      // Case insensitive
      const upperCaseResult = registry.detectFormat("file.JSON");
      const lowerCaseResult = registry.detectFormat("file.json");

      assertEquals(
        upperCaseResult.ok,
        true,
        "Upper case extension should work",
      );
      assertEquals(
        lowerCaseResult.ok,
        true,
        "Lower case extension should work",
      );

      // With and without leading dot
      assertEquals(
        registry.isSupported("json"),
        true,
        "Without dot should work",
      );
      assertEquals(registry.isSupported(".json"), true, "With dot should work");
    }
  });
});

Deno.test("FormatRegistry - Hardcoding Replacement Tests", async (t) => {
  await t.step("SPEC: Must replace cli-arguments.ts hardcoded array", () => {
    // Original hardcoded: ["json", "yml", "yaml", "toml"]
    const result = FormatRegistry.createDefault();
    assertEquals(result.ok, true);

    if (result.ok) {
      const registry = result.data;
      const originalHardcodedExtensions = ["json", "yml", "yaml", "toml"];

      for (const ext of originalHardcodedExtensions) {
        const supported = registry.isSupported(ext);
        assertEquals(
          supported,
          true,
          `Registry must replace hardcoded extension: ${ext}`,
        );
      }
    }
  });

  await t.step("SPEC: Must replace schema-path.ts hardcoded array", () => {
    // Original hardcoded: [".json", ".yaml", ".yml"]
    const result = FormatRegistry.createDefault();
    assertEquals(result.ok, true);

    if (result.ok) {
      const registry = result.data;
      const originalSchemaExtensions = [".json", ".yaml", ".yml"];

      for (const ext of originalSchemaExtensions) {
        const supported = registry.isSupported(ext, "schema");
        assertEquals(
          supported,
          true,
          `Registry must replace schema hardcoded extension: ${ext}`,
        );
      }
    }
  });

  await t.step(
    "SPEC: Must replace domain architecture hardcoded extensions",
    () => {
      // From domain-architecture docs: [".md", ".markdown", ".mdown", ".mkd"]
      const result = FormatRegistry.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const registry = result.data;
        const documentExtensions = [".md", ".markdown", ".mdown", ".mkd"];

        for (const ext of documentExtensions) {
          const supported = registry.isSupported(ext, "document");
          assertEquals(
            supported,
            true,
            `Registry must replace document hardcoded extension: ${ext}`,
          );
        }
      }
    },
  );

  await t.step("SPEC: Must provide plugin-style extensibility", () => {
    const result = FormatRegistry.createDefault();
    assertEquals(result.ok, true);

    if (result.ok) {
      const registry = result.data;

      const extensionsBefore = registry.getSupportedExtensions().length;

      // Add new format without code changes
      const newFormat: FileFormat = {
        extension: "hjson",
        mediaType: "application/hjson",
        category: "config",
        priority: 40,
      };

      const registerResult = registry.registerFormat(newFormat);
      assertEquals(
        registerResult.ok,
        true,
        "New format should register successfully",
      );

      // Should now support the new extension
      assertEquals(
        registry.isSupported("hjson"),
        true,
        "Registry should support dynamically added format",
      );

      const extensionsAfter = registry.getSupportedExtensions().length;
      assertEquals(
        extensionsAfter,
        extensionsBefore + 1,
        "Extension count should increase after registration",
      );
    }
  });
});
