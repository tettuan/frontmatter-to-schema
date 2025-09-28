import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { isErr, isOk } from "../../../../../src/domain/shared/types/result.ts";

describe("SchemaPath", () => {
  describe("create method", () => {
    it("should create a valid SchemaPath with valid string", () => {
      const result = SchemaPath.create("schemas/user.json");
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(result.data.toString(), "schemas/user.json");
      }
    });

    it("should accept simple filename", () => {
      const result = SchemaPath.create("schema.json");
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(result.data.toString(), "schema.json");
      }
    });

    it("should accept path with multiple directories", () => {
      const result = SchemaPath.create("/path/to/deep/nested/schema.yaml");
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(
          result.data.toString(),
          "/path/to/deep/nested/schema.yaml",
        );
      }
    });

    it("should accept path without extension", () => {
      const result = SchemaPath.create("schemas/config");
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(result.data.toString(), "schemas/config");
      }
    });

    it("should reject empty string", () => {
      const result = SchemaPath.create("");
      assertEquals(isErr(result), true);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertEquals(
          result.error.message,
          "Schema path must be a non-empty string",
        );
      }
    });

    it("should reject null", () => {
      const result = SchemaPath.create(null as any);
      assertEquals(isErr(result), true);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertEquals(
          result.error.message,
          "Schema path must be a non-empty string",
        );
      }
    });

    it("should reject undefined", () => {
      const result = SchemaPath.create(undefined as any);
      assertEquals(isErr(result), true);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertEquals(
          result.error.message,
          "Schema path must be a non-empty string",
        );
      }
    });

    it("should reject non-string types", () => {
      const result = SchemaPath.create(123 as any);
      assertEquals(isErr(result), true);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertEquals(
          result.error.message,
          "Schema path must be a non-empty string",
        );
      }
    });

    it("should accept paths with special characters", () => {
      const result = SchemaPath.create("schemas/@org/package-schema.json");
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(
          result.data.toString(),
          "schemas/@org/package-schema.json",
        );
      }
    });

    it("should accept relative paths with dots", () => {
      const result = SchemaPath.create("../schemas/schema.json");
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(result.data.toString(), "../schemas/schema.json");
      }
    });
  });

  describe("toString method", () => {
    it("should return the original path string", () => {
      const path = "test/schema.json";
      const result = SchemaPath.create(path);
      if (result.ok) {
        assertEquals(result.data.toString(), path);
      }
    });

    it("should preserve absolute paths", () => {
      const path = "/absolute/path/to/schema.yaml";
      const result = SchemaPath.create(path);
      if (result.ok) {
        assertEquals(result.data.toString(), path);
      }
    });
  });

  describe("equals method", () => {
    it("should return true for identical paths", () => {
      const result1 = SchemaPath.create("schemas/test.json");
      const result2 = SchemaPath.create("schemas/test.json");
      if (result1.ok && result2.ok) {
        assertEquals(result1.data.getValue(), result2.data.getValue());
      }
    });

    it("should return false for different paths", () => {
      const result1 = SchemaPath.create("schemas/test1.json");
      const result2 = SchemaPath.create("schemas/test2.json");
      if (result1.ok && result2.ok) {
        assertNotEquals(result1.data.getValue(), result2.data.getValue());
      }
    });

    it("should be case-sensitive", () => {
      const result1 = SchemaPath.create("schemas/Test.json");
      const result2 = SchemaPath.create("schemas/test.json");
      if (result1.ok && result2.ok) {
        assertNotEquals(result1.data.getValue(), result2.data.getValue());
      }
    });

    it("should handle paths with different separators as different", () => {
      const result1 = SchemaPath.create("schemas/test.json");
      const result2 = SchemaPath.create("schemas\\test.json");
      if (result1.ok && result2.ok) {
        assertNotEquals(result1.data.getValue(), result2.data.getValue());
      }
    });
  });

  describe("getFormat method", () => {
    it("should return json for .json files", () => {
      const result = SchemaPath.create("schemas/config.json");
      if (result.ok) {
        assertEquals(result.data.getFormat(), "json");
      }
    });

    it("should return yaml for .yaml files", () => {
      const result = SchemaPath.create("configs/settings.yaml");
      if (result.ok) {
        assertEquals(result.data.getFormat(), "yaml");
      }
    });

    it("should return yaml for .yml files", () => {
      const result = SchemaPath.create("settings.yml");
      if (result.ok) {
        assertEquals(result.data.getFormat(), "yaml");
      }
    });

    it("should handle multiple dots correctly", () => {
      const result = SchemaPath.create("schemas/config.test.json");
      if (result.ok) {
        assertEquals(result.data.getFormat(), "json");
      }
    });

    it("should handle hidden files with extension", () => {
      const result = SchemaPath.create(".config.json");
      if (result.ok) {
        assertEquals(result.data.getFormat(), "json");
      }
    });

    it("should handle complex paths with extension", () => {
      const result = SchemaPath.create(
        "/very/long/path/to/nested/schema.config.json",
      );
      if (result.ok) {
        assertEquals(result.data.getFormat(), "json");
      }
    });

    it("should handle paths with dots in directory names", () => {
      const result = SchemaPath.create("v1.2.3/schemas/config.yaml");
      if (result.ok) {
        assertEquals(result.data.getFormat(), "yaml");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle single character paths", () => {
      const result = SchemaPath.create("a");
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(result.data.toString(), "a");
        assertEquals(result.data.getFileName(), "a");
      }
    });

    it("should handle paths with only dots", () => {
      const result = SchemaPath.create("...");
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(result.data.toString(), "...");
        assertEquals(result.data.getFileName(), "...");
      }
    });

    it("should handle paths with spaces", () => {
      const result = SchemaPath.create("path with spaces/schema.json");
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(result.data.toString(), "path with spaces/schema.json");
        assertEquals(result.data.getFormat(), "json");
      }
    });

    it("should handle Windows-style paths", () => {
      const result = SchemaPath.create("C:\\Users\\Documents\\schema.json");
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(
          result.data.toString(),
          "C:\\Users\\Documents\\schema.json",
        );
        assertEquals(result.data.getFormat(), "json");
      }
    });

    it("should handle URL-style paths", () => {
      const result = SchemaPath.create("file:///home/user/schema.json");
      assertEquals(isOk(result), true);
      if (result.ok) {
        assertEquals(result.data.toString(), "file:///home/user/schema.json");
        assertEquals(result.data.getFormat(), "json");
      }
    });
  });
});
