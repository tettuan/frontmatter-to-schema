/**
 * Unit Tests for ProcessingOptionsBuilder
 * Tests Smart Constructor pattern and validation logic
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { ProcessingOptionsBuilder } from "../../../../src/application/services/processing-options-builder.ts";

describe("ProcessingOptionsBuilder", () => {
  describe("create", () => {
    it("should create with default options when no config provided", () => {
      const result = ProcessingOptionsBuilder.create();

      assertEquals(result.ok, true);
      if (result.ok) {
        const options = result.data.getOptions();
        assertEquals(options.strict, true);
        assertEquals(options.allowEmptyFrontmatter, false);
        assertEquals(options.allowMissingVariables, false);
        assertEquals(options.validateSchema, true);
        assertEquals(options.parallelProcessing, false);
        assertEquals(options.maxFiles, 1000);
      }
    });

    it("should create with custom options", () => {
      const config = {
        strict: false,
        maxFiles: 500,
      };

      const result = ProcessingOptionsBuilder.create(config);

      assertEquals(result.ok, true);
      if (result.ok) {
        const options = result.data.getOptions();
        assertEquals(options.strict, false);
        assertEquals(options.maxFiles, 500);
        // Other options should use defaults
        assertEquals(options.validateSchema, true);
      }
    });

    it("should reject invalid maxFiles values", () => {
      const result = ProcessingOptionsBuilder.create({ maxFiles: 0 });

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "OutOfRange");
      }
    });

    it("should reject maxFiles over limit", () => {
      const result = ProcessingOptionsBuilder.create({ maxFiles: 60000 });

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "OutOfRange");
      }
    });

    it("should reject invalid strict mode combinations", () => {
      const result = ProcessingOptionsBuilder.create({
        strict: true,
        allowEmptyFrontmatter: true,
        validateSchema: true,
      });

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidState");
      }
    });
  });

  describe("createStrict", () => {
    it("should create strict processing options", () => {
      const result = ProcessingOptionsBuilder.createStrict();

      assertEquals(result.ok, true);
      if (result.ok) {
        const options = result.data.getOptions();
        assertEquals(options.strict, true);
        assertEquals(options.allowEmptyFrontmatter, false);
        assertEquals(options.allowMissingVariables, false);
        assertEquals(options.validateSchema, true);
        assertEquals(options.parallelProcessing, false);
        assertEquals(options.maxFiles, 100);
      }
    });
  });

  describe("createPermissive", () => {
    it("should create permissive processing options", () => {
      const result = ProcessingOptionsBuilder.createPermissive();

      assertEquals(result.ok, true);
      if (result.ok) {
        const options = result.data.getOptions();
        assertEquals(options.strict, false);
        assertEquals(options.allowEmptyFrontmatter, true);
        assertEquals(options.allowMissingVariables, true);
        assertEquals(options.validateSchema, false);
        assertEquals(options.parallelProcessing, true);
        assertEquals(options.maxFiles, 10000);
      }
    });
  });

  describe("immutable updates", () => {
    it("should create new builder with withStrict", () => {
      const originalResult = ProcessingOptionsBuilder.create({ strict: false });
      assertEquals(originalResult.ok, true);

      if (originalResult.ok) {
        const updatedResult = originalResult.data.withStrict(true);
        assertEquals(updatedResult.ok, true);

        if (updatedResult.ok) {
          assertEquals(originalResult.data.getOptions().strict, false);
          assertEquals(updatedResult.data.getOptions().strict, true);
        }
      }
    });

    it("should create new builder with withMaxFiles", () => {
      const originalResult = ProcessingOptionsBuilder.create({
        maxFiles: 1000,
      });
      assertEquals(originalResult.ok, true);

      if (originalResult.ok) {
        const updatedResult = originalResult.data.withMaxFiles(2000);
        assertEquals(updatedResult.ok, true);

        if (updatedResult.ok) {
          assertEquals(originalResult.data.getOptions().maxFiles, 1000);
          assertEquals(updatedResult.data.getOptions().maxFiles, 2000);
        }
      }
    });

    it("should validate when creating new builder with invalid maxFiles", () => {
      const originalResult = ProcessingOptionsBuilder.create();
      assertEquals(originalResult.ok, true);

      if (originalResult.ok) {
        const updatedResult = originalResult.data.withMaxFiles(-5);
        assertEquals(updatedResult.ok, false);

        if (!updatedResult.ok) {
          assertEquals(updatedResult.error.kind, "OutOfRange");
        }
      }
    });

    it("should create new builder with withValidation", () => {
      const originalResult = ProcessingOptionsBuilder.create({
        validateSchema: true,
      });
      assertEquals(originalResult.ok, true);

      if (originalResult.ok) {
        const updatedResult = originalResult.data.withValidation(false, true);
        assertEquals(updatedResult.ok, true);

        if (updatedResult.ok) {
          assertEquals(originalResult.data.getOptions().validateSchema, true);
          assertEquals(updatedResult.data.getOptions().validateSchema, false);
          assertEquals(
            updatedResult.data.getOptions().allowEmptyFrontmatter,
            true,
          );
        }
      }
    });
  });

  describe("configuration analysis", () => {
    it("should identify high performance configuration", () => {
      const result = ProcessingOptionsBuilder.create({
        parallelProcessing: true,
        strict: false,
        maxFiles: 2000,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isHighPerformance(), true);
      }
    });

    it("should identify non-high performance configuration", () => {
      const result = ProcessingOptionsBuilder.create({
        parallelProcessing: false,
        strict: true,
        maxFiles: 100,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isHighPerformance(), false);
      }
    });

    it("should identify strict validation configuration", () => {
      const result = ProcessingOptionsBuilder.create({
        strict: true,
        validateSchema: true,
        allowEmptyFrontmatter: false,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isStrictValidation(), true);
      }
    });

    it("should identify non-strict validation configuration", () => {
      const result = ProcessingOptionsBuilder.create({
        strict: false,
        validateSchema: false,
        allowEmptyFrontmatter: true,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isStrictValidation(), false);
      }
    });
  });

  describe("getDefaults", () => {
    it("should return consistent default values", () => {
      const defaults = ProcessingOptionsBuilder.getDefaults();

      assertExists(defaults);
      assertEquals(defaults.strict, true);
      assertEquals(defaults.allowEmptyFrontmatter, false);
      assertEquals(defaults.allowMissingVariables, false);
      assertEquals(defaults.validateSchema, true);
      assertEquals(defaults.parallelProcessing, false);
      assertEquals(defaults.maxFiles, 1000);
    });
  });
});
