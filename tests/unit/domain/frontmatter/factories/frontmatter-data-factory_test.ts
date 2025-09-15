import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { FrontmatterDataFactory } from "../../../../../src/domain/frontmatter/factories/frontmatter-data-factory.ts";

describe("FrontmatterDataFactory", () => {
  describe("fromParsedData", () => {
    it("should create FrontmatterData from valid object", () => {
      const data = { title: "Test", count: 42 };
      const result = FrontmatterDataFactory.fromParsedData(data);

      assertEquals(result.ok, true);
      if (result.ok) {
        const value = result.data.get("title");
        assertEquals(value.ok, true);
        if (value.ok) {
          assertEquals(value.data, "Test");
        }
      }
    });

    it("should handle null data", () => {
      const result = FrontmatterDataFactory.fromParsedData(null);
      assertEquals(result.ok, false);
    });

    it("should handle undefined data", () => {
      const result = FrontmatterDataFactory.fromParsedData(undefined);
      assertEquals(result.ok, false);
    });
  });

  describe("fromObject", () => {
    it("should create FrontmatterData from valid object", () => {
      const obj = { name: "Test", active: true };
      const result = FrontmatterDataFactory.fromObject(obj);

      assertEquals(result.ok, true);
      if (result.ok) {
        const name = result.data.get("name");
        assertEquals(name.ok, true);
        if (name.ok) {
          assertEquals(name.data, "Test");
        }
      }
    });

    it("should reject null", () => {
      const result = FrontmatterDataFactory.fromObject(null as any);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "MalformedFrontmatter");
      }
    });

    it("should reject array", () => {
      const result = FrontmatterDataFactory.fromObject([1, 2, 3] as any);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "MalformedFrontmatter");
      }
    });

    it("should handle empty object", () => {
      const result = FrontmatterDataFactory.fromObject({});
      assertEquals(result.ok, true);
    });

    it("should handle nested objects", () => {
      const obj = {
        meta: {
          author: "John",
          tags: ["test", "example"],
        },
      };
      const result = FrontmatterDataFactory.fromObject(obj);

      assertEquals(result.ok, true);
      if (result.ok) {
        const author = result.data.get("meta.author");
        assertEquals(author.ok, true);
        if (author.ok) {
          assertEquals(author.data, "John");
        }
      }
    });
  });

  describe("fromArray", () => {
    it("should create array of FrontmatterData from valid array", () => {
      const items = [
        { id: 1, name: "Item1" },
        { id: 2, name: "Item2" },
      ];
      const result = FrontmatterDataFactory.fromArray(items);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 2);
        const first = result.data[0].get("name");
        assertEquals(first.ok, true);
        if (first.ok) {
          assertEquals(first.data, "Item1");
        }
      }
    });

    it("should reject non-array", () => {
      const result = FrontmatterDataFactory.fromArray("not an array" as any);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "MalformedFrontmatter");
        assertExists(result.error.message.includes("Expected array"));
      }
    });

    it("should handle empty array", () => {
      const result = FrontmatterDataFactory.fromArray([]);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 0);
      }
    });

    it("should reject array with invalid items", () => {
      const items = [
        { valid: "object" },
        null,
        { another: "object" },
      ];
      const result = FrontmatterDataFactory.fromArray(items);
      assertEquals(result.ok, false);
    });

    it("should handle array of primitives", () => {
      const items = ["string", 123, true];
      const result = FrontmatterDataFactory.fromArray(items);
      assertEquals(result.ok, false);
    });
  });

  describe("merge", () => {
    it("should merge multiple FrontmatterData instances", () => {
      const data1Result = FrontmatterDataFactory.fromObject({ a: 1, b: 2 });
      const data2Result = FrontmatterDataFactory.fromObject({ b: 3, c: 4 });

      assertExists(data1Result.ok);
      assertExists(data2Result.ok);

      if (data1Result.ok && data2Result.ok) {
        const merged = FrontmatterDataFactory.merge([
          data1Result.data,
          data2Result.data,
        ]);
        assertEquals(merged.ok, true);

        if (merged.ok) {
          const a = merged.data.get("a");
          const b = merged.data.get("b");
          const c = merged.data.get("c");

          assertEquals(a.ok, true);
          assertEquals(b.ok, true);
          assertEquals(c.ok, true);

          if (a.ok) assertEquals(a.data, 1);
          if (b.ok) assertEquals(b.data, 3); // Second value overwrites
          if (c.ok) assertEquals(c.data, 4);
        }
      }
    });

    it("should handle empty array", () => {
      const result = FrontmatterDataFactory.merge([]);
      assertEquals(result.ok, true);
    });

    it("should handle single item", () => {
      const dataResult = FrontmatterDataFactory.fromObject({ test: "value" });
      assertExists(dataResult.ok);

      if (dataResult.ok) {
        const merged = FrontmatterDataFactory.merge([dataResult.data]);
        assertEquals(merged.ok, true);

        if (merged.ok) {
          const test = merged.data.get("test");
          assertEquals(test.ok, true);
          if (test.ok) {
            assertEquals(test.data, "value");
          }
        }
      }
    });
  });

  describe("withDefaults", () => {
    it("should apply defaults to empty data", () => {
      const emptyResult = FrontmatterDataFactory.fromObject({});
      const defaults = { version: "1.0.0", author: "System" };

      assertExists(emptyResult.ok);
      if (emptyResult.ok) {
        const withDef = FrontmatterDataFactory.withDefaults(
          emptyResult.data,
          defaults,
        );
        assertEquals(withDef.ok, true);

        if (withDef.ok) {
          const version = withDef.data.get("version");
          const author = withDef.data.get("author");

          assertEquals(version.ok, true);
          assertEquals(author.ok, true);

          if (version.ok) assertEquals(version.data, "1.0.0");
          if (author.ok) assertEquals(author.data, "System");
        }
      }
    });

    it("should not override existing values", () => {
      const dataResult = FrontmatterDataFactory.fromObject({
        version: "2.0.0",
      });
      const defaults = { version: "1.0.0", author: "System" };

      assertExists(dataResult.ok);
      if (dataResult.ok) {
        const withDef = FrontmatterDataFactory.withDefaults(
          dataResult.data,
          defaults,
        );
        assertEquals(withDef.ok, true);

        if (withDef.ok) {
          const version = withDef.data.get("version");
          const author = withDef.data.get("author");

          assertEquals(version.ok, true);
          assertEquals(author.ok, true);

          if (version.ok) assertEquals(version.data, "2.0.0"); // Original value preserved
          if (author.ok) assertEquals(author.data, "System"); // Default applied
        }
      }
    });
  });
});
