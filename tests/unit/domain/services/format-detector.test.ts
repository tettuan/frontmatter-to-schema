/**
 * Unit Tests for FormatDetector
 * Tests Smart Constructor pattern and format detection logic
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { FormatDetector } from "../../../../src/domain/services/format-detector.ts";

describe("FormatDetector", () => {
  describe("create", () => {
    it("should create with valid format rules", () => {
      const rules = [
        { extension: ".json", format: "json" as const, priority: 10 },
        { extension: ".yaml", format: "yaml" as const, priority: 9 },
      ];

      const result = FormatDetector.create(rules);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.detect("test.json"), "json");
        assertEquals(result.data.detect("test.yaml"), "yaml");
        assertEquals(result.data.detect("test.txt"), "custom");
      }
    });

    it("should create with custom configuration", () => {
      const rules = [
        { extension: ".JSON", format: "json" as const },
      ];

      const result = FormatDetector.create(rules, {
        caseSensitive: false,
        strictMatching: false,
        defaultFormat: "xml",
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.detect("test.json"), "json");
        assertEquals(result.data.detect("test.JSON"), "json");
        assertEquals(result.data.getDefaultFormat(), "xml");
      }
    });

    it("should prioritize rules by priority value", () => {
      const rules = [
        { extension: ".yml", format: "yaml" as const, priority: 5 },
        { extension: ".yaml", format: "yaml" as const, priority: 10 },
      ];

      const result = FormatDetector.create(rules);

      assertEquals(result.ok, true);
      if (result.ok) {
        const info = result.data.getDetectionInfo();
        // Higher priority should come first in the map iteration
        const extensions = Array.from(info.rules.map((r) => r.extension));
        assertEquals(extensions[0], ".yaml"); // priority 10
        assertEquals(extensions[1], ".yml"); // priority 5
      }
    });

    it("should reject empty rules array", () => {
      const result = FormatDetector.create([]);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "EmptyInput");
      }
    });

    it("should reject rules with empty extension", () => {
      const rules = [
        { extension: "", format: "json" as const },
      ];

      const result = FormatDetector.create(rules);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "EmptyInput");
      }
    });

    it("should reject extensions not starting with dot", () => {
      const rules = [
        { extension: "json", format: "json" as const },
      ];

      const result = FormatDetector.create(rules);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
      }
    });

    it("should reject excessively long extensions", () => {
      const rules = [
        { extension: "." + "a".repeat(10), format: "custom" as const },
      ];

      const result = FormatDetector.create(rules);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "TooLong");
      }
    });

    it("should reject duplicate extensions", () => {
      const rules = [
        { extension: ".json", format: "json" as const },
        { extension: ".JSON", format: "xml" as const },
      ];

      const result = FormatDetector.create(rules);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidState");
      }
    });
  });

  describe("createDefault", () => {
    it("should create detector with default format rules", () => {
      const result = FormatDetector.createDefault();

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.detect("test.json"), "json");
        assertEquals(result.data.detect("test.yaml"), "yaml");
        assertEquals(result.data.detect("test.yml"), "yaml");
        assertEquals(result.data.detect("test.xml"), "xml");
        assertEquals(result.data.detect("test.txt"), "custom");
      }
    });

    it("should have case-insensitive matching by default", () => {
      const result = FormatDetector.createDefault();

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.detect("test.JSON"), "json");
        assertEquals(result.data.detect("test.YAML"), "yaml");
        assertEquals(result.data.detect("test.XML"), "xml");
      }
    });
  });

  describe("createWebFormats", () => {
    it("should create detector with web-focused format rules", () => {
      const result = FormatDetector.createWebFormats();

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.detect("test.json"), "json");
        assertEquals(result.data.detect("test.yaml"), "yaml");
        assertEquals(result.data.detect("test.xml"), "xml");
        assertEquals(result.data.detect("test.html"), "custom");
        assertEquals(result.data.detect("test.htm"), "custom");
      }
    });

    it("should have less strict matching for web formats", () => {
      const result = FormatDetector.createWebFormats();

      assertEquals(result.ok, true);
      if (result.ok) {
        const info = result.data.getDetectionInfo();
        assertEquals(info.config.strictMatching, false);
      }
    });
  });

  describe("detect", () => {
    it("should detect format from file extension", () => {
      const result = FormatDetector.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const detector = result.data;
        assertEquals(detector.detect("config.json"), "json");
        assertEquals(detector.detect("data.yaml"), "yaml");
        assertEquals(detector.detect("template.xml"), "xml");
        assertEquals(detector.detect("script.js"), "custom");
      }
    });

    it("should handle file paths with directories", () => {
      const result = FormatDetector.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const detector = result.data;
        assertEquals(detector.detect("src/config/app.json"), "json");
        assertEquals(detector.detect("templates/user.yaml"), "yaml");
        assertEquals(detector.detect("data\\file.xml"), "xml");
      }
    });

    it("should return default format for empty filepath", () => {
      const result = FormatDetector.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        assertEquals(result.data.detect(""), "custom");
      }
    });

    it("should return default format for files without extension", () => {
      const result = FormatDetector.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const detector = result.data;
        assertEquals(detector.detect("README"), "custom");
        assertEquals(detector.detect("Makefile"), "custom");
        assertEquals(detector.detect("src/components/Button"), "custom");
      }
    });

    it("should handle multiple dots in filename", () => {
      const result = FormatDetector.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const detector = result.data;
        assertEquals(detector.detect("config.prod.json"), "json");
        assertEquals(detector.detect("app.config.yaml"), "yaml");
        assertEquals(detector.detect("data.backup.xml"), "xml");
      }
    });
  });

  describe("isSupported", () => {
    it("should check if format is supported", () => {
      const result = FormatDetector.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const detector = result.data;
        assertEquals(detector.isSupported("json"), true);
        assertEquals(detector.isSupported("yaml"), true);
        assertEquals(detector.isSupported("xml"), true);
        assertEquals(detector.isSupported("custom"), false);
      }
    });
  });

  describe("getExtensionsForFormat", () => {
    it("should return extensions for a specific format", () => {
      const result = FormatDetector.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const detector = result.data;
        const yamlExtensions = detector.getExtensionsForFormat("yaml");
        assertEquals(yamlExtensions.length, 2);
        assertEquals(yamlExtensions.includes(".yaml"), true);
        assertEquals(yamlExtensions.includes(".yml"), true);
      }
    });

    it("should return empty array for unsupported format", () => {
      const result = FormatDetector.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const extensions = result.data.getExtensionsForFormat("custom");
        assertEquals(extensions, []);
      }
    });
  });

  describe("getSupportedFormats", () => {
    it("should return all supported formats", () => {
      const result = FormatDetector.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const formats = result.data.getSupportedFormats();
        assertEquals(formats.includes("json"), true);
        assertEquals(formats.includes("yaml"), true);
        assertEquals(formats.includes("xml"), true);
        assertEquals(formats.length, 3);
      }
    });
  });

  describe("getDetectionInfo", () => {
    it("should return detection information", () => {
      const rules = [
        { extension: ".json", format: "json" as const, priority: 10 },
      ];
      const config = {
        caseSensitive: true,
        strictMatching: false,
        defaultFormat: "xml" as const,
      };

      const result = FormatDetector.create(rules, config);
      assertEquals(result.ok, true);

      if (result.ok) {
        const info = result.data.getDetectionInfo();
        assertEquals(info.rules.length, 1);
        assertEquals(info.rules[0].extension, ".json");
        assertEquals(info.rules[0].format, "json");
        assertEquals(info.config.caseSensitive, true);
        assertEquals(info.config.strictMatching, false);
        assertEquals(info.config.defaultFormat, "xml");
      }
    });
  });

  describe("withAdditionalRules", () => {
    it("should create new detector with additional rules", () => {
      const originalResult = FormatDetector.createDefault();
      assertEquals(originalResult.ok, true);

      if (originalResult.ok) {
        const newRules = [
          { extension: ".toml", format: "custom" as const, priority: 8 },
        ];

        const updatedResult = originalResult.data.withAdditionalRules(newRules);
        assertEquals(updatedResult.ok, true);

        if (updatedResult.ok) {
          assertEquals(originalResult.data.detect("config.toml"), "custom");
          assertEquals(updatedResult.data.detect("config.toml"), "custom");
          assertEquals(updatedResult.data.detect("data.json"), "json");
        }
      }
    });

    it("should validate additional rules", () => {
      const originalResult = FormatDetector.createDefault();
      assertEquals(originalResult.ok, true);

      if (originalResult.ok) {
        const invalidRules = [
          { extension: "invalid", format: "custom" as const },
        ];

        const updatedResult = originalResult.data.withAdditionalRules(
          invalidRules,
        );
        assertEquals(updatedResult.ok, false);
      }
    });
  });

  describe("withConfig", () => {
    it("should create new detector with modified configuration", () => {
      const originalResult = FormatDetector.create([
        { extension: ".JSON", format: "json" as const },
      ], { caseSensitive: true });

      assertEquals(originalResult.ok, true);

      if (originalResult.ok) {
        const updatedResult = originalResult.data.withConfig({
          caseSensitive: false,
        });
        assertEquals(updatedResult.ok, true);

        if (updatedResult.ok) {
          assertEquals(originalResult.data.detect("test.json"), "custom");
          assertEquals(updatedResult.data.detect("test.json"), "json");
        }
      }
    });
  });

  describe("getDefaultFormat", () => {
    it("should return configured default format", () => {
      const result = FormatDetector.create([
        { extension: ".json", format: "json" as const },
      ], { defaultFormat: "yaml" });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getDefaultFormat(), "yaml");
      }
    });

    it("should return 'custom' when no default configured", () => {
      const result = FormatDetector.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        assertEquals(result.data.getDefaultFormat(), "custom");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle case sensitivity correctly", () => {
      const caseSensitiveResult = FormatDetector.create([
        { extension: ".JSON", format: "json" as const },
      ], { caseSensitive: true });

      const caseInsensitiveResult = FormatDetector.create([
        { extension: ".JSON", format: "json" as const },
      ], { caseSensitive: false });

      assertEquals(caseSensitiveResult.ok, true);
      assertEquals(caseInsensitiveResult.ok, true);

      if (caseSensitiveResult.ok && caseInsensitiveResult.ok) {
        assertEquals(caseSensitiveResult.data.detect("test.json"), "custom");
        assertEquals(caseSensitiveResult.data.detect("test.JSON"), "json");

        assertEquals(caseInsensitiveResult.data.detect("test.json"), "json");
        assertEquals(caseInsensitiveResult.data.detect("test.JSON"), "json");
      }
    });

    it("should handle files with no extension after directory separator", () => {
      const result = FormatDetector.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        assertEquals(result.data.detect("path/to/file."), "custom");
        assertEquals(result.data.detect("path/to/.hidden"), "custom");
      }
    });

    it("should extract extension after last directory separator", () => {
      const result = FormatDetector.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        // Extension should be after the last separator
        assertEquals(result.data.detect("config.json/data"), "custom");
        assertEquals(result.data.detect("config.json\\data.yaml"), "yaml");
      }
    });
  });
});
