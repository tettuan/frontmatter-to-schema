/**
 * @fileoverview Tests for PropertyExtractor
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  PropertyExtractor,
  PropertyPath,
} from "../../../../../src/domain/schema/extractors/property-extractor.ts";

describe("PropertyPath", () => {
  describe("create", () => {
    it("should parse simple property path", () => {
      const result = PropertyPath.create("id.full");
      assertExists(result.ok);
      if (result.ok) {
        assertEquals(result.data.getSegments(), ["id", "full"]);
        assertEquals(result.data.hasArrayExpansion(), false);
      }
    });

    it("should parse path with array notation", () => {
      const result = PropertyPath.create("traceability[].id.full");
      assertExists(result.ok);
      if (result.ok) {
        assertEquals(result.data.getSegments(), [
          "traceability[]",
          "id",
          "full",
        ]);
        assertEquals(result.data.hasArrayExpansion(), true);
        assertEquals(result.data.getPreArraySegments(), ["traceability"]);
        assertEquals(result.data.getPostArraySegments(), ["id", "full"]);
      }
    });

    it("should handle single segment path", () => {
      const result = PropertyPath.create("title");
      assertExists(result.ok);
      if (result.ok) {
        assertEquals(result.data.getSegments(), ["title"]);
        assertEquals(result.data.hasArrayExpansion(), false);
      }
    });

    it("should handle array notation at the end", () => {
      const result = PropertyPath.create("items[]");
      assertExists(result.ok);
      if (result.ok) {
        assertEquals(result.data.getSegments(), ["items[]"]);
        assertEquals(result.data.hasArrayExpansion(), true);
        assertEquals(result.data.getPreArraySegments(), ["items"]);
        assertEquals(result.data.getPostArraySegments(), []);
      }
    });

    it("should reject empty path", () => {
      const result = PropertyPath.create("");
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "PropertyNotFound");
        if (result.error.kind === "PropertyNotFound") {
          assertEquals(result.error.path, "Property path cannot be empty");
        }
      }
    });

    it("should reject path with consecutive dots", () => {
      const result = PropertyPath.create("id..full");
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "PropertyNotFound");
        if (result.error.kind === "PropertyNotFound") {
          assertEquals(
            result.error.path,
            "Invalid path: 'id..full' - consecutive dots are not allowed",
          );
        }
      }
    });
  });
});

describe("PropertyExtractor", () => {
  const extractor = PropertyExtractor.create();

  describe("extract simple paths", () => {
    it("should extract nested property value", () => {
      const data = {
        id: {
          full: "req:api:test-123",
          hash: "test123",
        },
      };
      const path = PropertyPath.create("id.full");
      assertExists(path.ok);
      if (path.ok) {
        const result = extractor.extract(data, path.data);
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, "req:api:test-123");
        }
      }
    });

    it("should extract top-level property", () => {
      const data = {
        title: "Test Title",
        description: "Test Description",
      };
      const path = PropertyPath.create("title");
      assertExists(path.ok);
      if (path.ok) {
        const result = extractor.extract(data, path.data);
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, "Test Title");
        }
      }
    });

    it("should return undefined for non-existent path", () => {
      const data = {
        id: {
          full: "test",
        },
      };
      const path = PropertyPath.create("id.missing");
      assertExists(path.ok);
      if (path.ok) {
        const result = extractor.extract(data, path.data);
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, undefined);
        }
      }
    });

    it("should return undefined for null intermediate value", () => {
      const data = {
        id: null,
      };
      const path = PropertyPath.create("id.full");
      assertExists(path.ok);
      if (path.ok) {
        const result = extractor.extract(data, path.data);
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, undefined);
        }
      }
    });
  });

  describe("extract with array notation", () => {
    it("should extract from array elements", () => {
      const data = {
        traceability: [
          { id: { full: "req:001" }, summary: "First" },
          { id: { full: "req:002" }, summary: "Second" },
        ],
      };
      const path = PropertyPath.create("traceability[].id.full");
      assertExists(path.ok);
      if (path.ok) {
        const result = extractor.extract(data, path.data);
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, ["req:001", "req:002"]);
        }
      }
    });

    it("should normalize single element to array", () => {
      const data = {
        traceability: {
          id: { full: "req:single-001" },
          summary: "Single requirement",
        },
      };
      const path = PropertyPath.create("traceability[].id.full");
      assertExists(path.ok);
      if (path.ok) {
        const result = extractor.extract(data, path.data);
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, ["req:single-001"]);
        }
      }
    });

    it("should handle empty array", () => {
      const data = {
        traceability: [],
      };
      const path = PropertyPath.create("traceability[].id.full");
      assertExists(path.ok);
      if (path.ok) {
        const result = extractor.extract(data, path.data);
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, []);
        }
      }
    });

    it("should handle null value with array notation", () => {
      const data = {
        traceability: null,
      };
      const path = PropertyPath.create("traceability[].id.full");
      assertExists(path.ok);
      if (path.ok) {
        const result = extractor.extract(data, path.data);
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, []);
        }
      }
    });

    it("should extract array itself with [] at the end", () => {
      const data = {
        items: ["a", "b", "c"],
      };
      const path = PropertyPath.create("items[]");
      assertExists(path.ok);
      if (path.ok) {
        const result = extractor.extract(data, path.data);
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, ["a", "b", "c"]);
        }
      }
    });

    it("should filter undefined values from array extraction", () => {
      const data = {
        traceability: [
          { id: { full: "req:001" } },
          { summary: "No id here" },
          { id: { full: "req:003" } },
        ],
      };
      const path = PropertyPath.create("traceability[].id.full");
      assertExists(path.ok);
      if (path.ok) {
        const result = extractor.extract(data, path.data);
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, ["req:001", "req:003"]);
        }
      }
    });
  });

  describe("error handling", () => {
    it("should error when accessing property on primitive", () => {
      const data = {
        value: "string",
      };
      const path = PropertyPath.create("value.property");
      assertExists(path.ok);
      if (path.ok) {
        const result = extractor.extract(data, path.data);
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "PropertyNotFound");
        }
      }
    });
  });
});
