/**
 * @fileoverview Tests for PropertyPath Value Object following Totality principles
 * @description Comprehensive test coverage for path validation and manipulation
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { CommonPaths, PropertyPath } from "./property-path.ts";

describe("PropertyPath", () => {
  describe("Smart Constructor", () => {
    describe("Valid Paths", () => {
      it("should create simple property path", () => {
        const result = PropertyPath.create("name");
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.toString(), "name");
          assertEquals(result.data.getSegments(), ["name"]);
          assertEquals(result.data.hasArrayAccess(), false);
        }
      });

      it("should create nested property path", () => {
        const result = PropertyPath.create("user.profile.name");
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.toString(), "user.profile.name");
          assertEquals(result.data.getSegments(), ["user", "profile", "name"]);
          assertEquals(result.data.getDepth(), 3);
        }
      });

      it("should create array access path", () => {
        const result = PropertyPath.create("items[]");
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.toString(), "items[]");
          assertEquals(result.data.hasArrayAccess(), true);
          assertEquals(result.data.getSegments(), ["items"]);
        }
      });

      it("should create indexed array access path", () => {
        const result = PropertyPath.create("items[0]");
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.toString(), "items[0]");
          assertEquals(result.data.hasArrayAccess(), true);
          assertEquals(result.data.getArrayIndices(), [0]);
          assertEquals(result.data.getSegments(), ["items"]);
        }
      });

      it("should create complex nested array path", () => {
        const result = PropertyPath.create("data.items[0].properties[1].value");
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(
            result.data.toString(),
            "data.items[0].properties[1].value",
          );
          assertEquals(result.data.hasArrayAccess(), true);
          assertEquals(result.data.getArrayIndices(), [0, 1]);
          assertEquals(result.data.getSegments(), [
            "data",
            "items",
            "properties",
            "value",
          ]);
        }
      });

      it("should handle underscores and dollar signs", () => {
        const result = PropertyPath.create("_private.$special");
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.getSegments(), ["_private", "$special"]);
        }
      });
    });

    describe("Invalid Paths - Totality Error Handling", () => {
      it("should reject empty path", () => {
        const result = PropertyPath.create("");
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "EmptyInput");
          assertExists(result.error.message);
        }
      });

      it("should reject whitespace-only path", () => {
        const result = PropertyPath.create("   ");
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "EmptyInput");
        }
      });

      it("should reject leading dot", () => {
        const result = PropertyPath.create(".property");
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "PatternMismatch");
          assertEquals((result.error as any).pattern, "valid-property-path");
          assertExists(result.error.message);
        }
      });

      it("should reject trailing dot", () => {
        const result = PropertyPath.create("property.");
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "PatternMismatch");
          assertEquals((result.error as any).pattern, "valid-property-path");
        }
      });

      it("should reject consecutive dots", () => {
        const result = PropertyPath.create("user..name");
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "PatternMismatch");
          assertEquals((result.error as any).pattern, "valid-property-path");
        }
      });

      it("should reject invalid array notation", () => {
        const invalidArrayPaths = [
          "items[",
          "items]",
          "items[abc]",
          "items[-1]",
          "items[0.5]",
          "items[]extra",
        ];

        invalidArrayPaths.forEach((path) => {
          const result = PropertyPath.create(path);
          assertEquals(result.ok, false, `Expected ${path} to be invalid`);
          if (!result.ok) {
            assertEquals(result.error.kind, "PatternMismatch");
          }
        });
      });

      it("should reject circular references", () => {
        const result = PropertyPath.create("user.profile.user");
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "PatternMismatch");
          assertEquals((result.error as any).pattern, "non-circular-path");
        }
      });
    });
  });

  describe("Path Manipulation", () => {
    it("should get parent path", () => {
      const pathResult = PropertyPath.create("user.profile.name");
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        const parentResult = pathResult.data.getParent();
        assertEquals(parentResult.ok, true);
        if (parentResult.ok) {
          assertEquals(parentResult.data.toString(), "user.profile");
        }
      }
    });

    it("should reject parent of root path", () => {
      const pathResult = PropertyPath.create("root");
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        const parentResult = pathResult.data.getParent();
        assertEquals(parentResult.ok, false);
        if (!parentResult.ok) {
          assertEquals(parentResult.error.kind, "OutOfRange");
        }
      }
    });

    it("should append segment", () => {
      const pathResult = PropertyPath.create("user");
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        const appendResult = pathResult.data.append("name");
        assertEquals(appendResult.ok, true);
        if (appendResult.ok) {
          assertEquals(appendResult.data.toString(), "user.name");
        }
      }
    });

    it("should reject empty segment append", () => {
      const pathResult = PropertyPath.create("user");
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        const appendResult = pathResult.data.append("");
        assertEquals(appendResult.ok, false);
        if (!appendResult.ok) {
          assertEquals(appendResult.error.kind, "EmptyInput");
        }
      }
    });

    it("should reject segment with dots", () => {
      const pathResult = PropertyPath.create("user");
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        const appendResult = pathResult.data.append("profile.name");
        assertEquals(appendResult.ok, false);
        if (!appendResult.ok) {
          assertEquals(appendResult.error.kind, "PatternMismatch");
        }
      }
    });

    it("should append array access", () => {
      const pathResult = PropertyPath.create("data");
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        const appendResult = pathResult.data.appendArray("items");
        assertEquals(appendResult.ok, true);
        if (appendResult.ok) {
          assertEquals(appendResult.data.toString(), "data.items[]");
          assertEquals(appendResult.data.hasArrayAccess(), true);
        }
      }
    });

    it("should append indexed array access", () => {
      const pathResult = PropertyPath.create("data");
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        const appendResult = pathResult.data.appendArray("items", 5);
        assertEquals(appendResult.ok, true);
        if (appendResult.ok) {
          assertEquals(appendResult.data.toString(), "data.items[5]");
          assertEquals(appendResult.data.getArrayIndices(), [5]);
        }
      }
    });
  });

  describe("Path Relationships", () => {
    it("should detect parent-child relationships", () => {
      const parentResult = PropertyPath.create("user");
      const childResult = PropertyPath.create("user.profile");

      assertEquals(parentResult.ok, true);
      assertEquals(childResult.ok, true);

      if (parentResult.ok && childResult.ok) {
        assertEquals(parentResult.data.isParentOf(childResult.data), true);
        assertEquals(childResult.data.isChildOf(parentResult.data), true);
        assertEquals(childResult.data.isParentOf(parentResult.data), false);
      }
    });

    it("should detect non-relationships", () => {
      const path1Result = PropertyPath.create("user.name");
      const path2Result = PropertyPath.create("user.email");

      assertEquals(path1Result.ok, true);
      assertEquals(path2Result.ok, true);

      if (path1Result.ok && path2Result.ok) {
        assertEquals(path1Result.data.isParentOf(path2Result.data), false);
        assertEquals(path1Result.data.isChildOf(path2Result.data), false);
      }
    });

    it("should handle same path relationships", () => {
      const path1Result = PropertyPath.create("user.name");
      const path2Result = PropertyPath.create("user.name");

      assertEquals(path1Result.ok, true);
      assertEquals(path2Result.ok, true);

      if (path1Result.ok && path2Result.ok) {
        assertEquals(path1Result.data.isParentOf(path2Result.data), false);
        assertEquals(path1Result.data.isChildOf(path2Result.data), false);
        assertEquals(path1Result.data.equals(path2Result.data), true);
      }
    });
  });

  describe("Typed Segments", () => {
    it("should provide typed segments for simple path", () => {
      const result = PropertyPath.create("user.name");
      assertEquals(result.ok, true);
      if (result.ok) {
        const typedSegments = result.data.getTypedSegments();
        assertEquals(typedSegments.length, 2);
        assertEquals(typedSegments[0].value, "user");
        assertEquals(typedSegments[0].isArrayAccess, false);
        assertEquals(typedSegments[1].value, "name");
        assertEquals(typedSegments[1].isArrayAccess, false);
      }
    });

    it("should provide typed segments for array path", () => {
      const result = PropertyPath.create("items[0].name");
      assertEquals(result.ok, true);
      if (result.ok) {
        const typedSegments = result.data.getTypedSegments();
        assertEquals(typedSegments.length, 2);
        assertEquals(typedSegments[0].value, "items");
        assertEquals(typedSegments[0].isArrayAccess, true);
        assertEquals(typedSegments[0].arrayIndex, 0);
        assertEquals(typedSegments[1].value, "name");
        assertEquals(typedSegments[1].isArrayAccess, false);
      }
    });

    it("should handle multiple array accesses", () => {
      const result = PropertyPath.create("data[1].items[2].value");
      assertEquals(result.ok, true);
      if (result.ok) {
        const typedSegments = result.data.getTypedSegments();
        assertEquals(typedSegments.length, 3);
        assertEquals(typedSegments[0].arrayIndex, 1);
        assertEquals(typedSegments[1].arrayIndex, 2);
        assertEquals(typedSegments[2].isArrayAccess, false);
      }
    });
  });

  describe("Value Object Behavior", () => {
    it("should implement equality based on value", () => {
      const path1Result = PropertyPath.create("user.name");
      const path2Result = PropertyPath.create("user.name");
      const path3Result = PropertyPath.create("user.email");

      assertEquals(path1Result.ok, true);
      assertEquals(path2Result.ok, true);
      assertEquals(path3Result.ok, true);

      if (path1Result.ok && path2Result.ok && path3Result.ok) {
        assertEquals(path1Result.data.equals(path2Result.data), true);
        assertEquals(path1Result.data.equals(path3Result.data), false);
      }
    });

    it("should provide hash code based on value", () => {
      const path1Result = PropertyPath.create("user.name");
      const path2Result = PropertyPath.create("user.name");

      assertEquals(path1Result.ok, true);
      assertEquals(path2Result.ok, true);

      if (path1Result.ok && path2Result.ok) {
        assertEquals(
          path1Result.data.hashCode(),
          path2Result.data.hashCode(),
        );
      }
    });

    it("should support JSON serialization", () => {
      const result = PropertyPath.create("user.profile.name");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.toJSON(), "user.profile.name");
        assertEquals(JSON.stringify(result.data), '"user.profile.name"');
      }
    });
  });

  describe("Common Patterns", () => {
    it("should detect simple property pattern", () => {
      assertEquals(PropertyPath.COMMON_PATTERNS.isSimpleProperty("name"), true);
      assertEquals(
        PropertyPath.COMMON_PATTERNS.isSimpleProperty("user.name"),
        false,
      );
      assertEquals(
        PropertyPath.COMMON_PATTERNS.isSimpleProperty("items[]"),
        false,
      );
    });

    it("should detect nested property pattern", () => {
      assertEquals(
        PropertyPath.COMMON_PATTERNS.isNestedProperty("user.name"),
        true,
      );
      assertEquals(
        PropertyPath.COMMON_PATTERNS.isNestedProperty("user.profile.name"),
        true,
      );
      assertEquals(
        PropertyPath.COMMON_PATTERNS.isNestedProperty("name"),
        false,
      );
      assertEquals(
        PropertyPath.COMMON_PATTERNS.isNestedProperty("items[]"),
        false,
      );
    });

    it("should detect array access pattern", () => {
      assertEquals(
        PropertyPath.COMMON_PATTERNS.hasArrayAccess("items[]"),
        true,
      );
      assertEquals(
        PropertyPath.COMMON_PATTERNS.hasArrayAccess("items[0]"),
        true,
      );
      assertEquals(
        PropertyPath.COMMON_PATTERNS.hasArrayAccess("user.items[1].name"),
        true,
      );
      assertEquals(
        PropertyPath.COMMON_PATTERNS.hasArrayAccess("user.name"),
        false,
      );
    });

    it("should extract array indices", () => {
      const indices1 = PropertyPath.COMMON_PATTERNS.extractArrayIndices(
        "items[0]",
      );
      assertEquals(indices1, [0]);

      const indices2 = PropertyPath.COMMON_PATTERNS.extractArrayIndices(
        "data[1].items[2]",
      );
      assertEquals(indices2, [1, 2]);

      const indices3 = PropertyPath.COMMON_PATTERNS.extractArrayIndices(
        "user.name",
      );
      assertEquals(indices3, []);
    });
  });

  describe("Common Paths Factory", () => {
    it("should create root path", () => {
      const result = CommonPaths.root();
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.toString(), "root");
      }
    });

    it("should create data path", () => {
      const result = CommonPaths.data();
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.toString(), "data");
      }
    });

    it("should create items array path", () => {
      const result = CommonPaths.items();
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.toString(), "items[]");
        assertEquals(result.data.hasArrayAccess(), true);
      }
    });

    it("should create properties path", () => {
      const result = CommonPaths.properties();
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.toString(), "properties");
      }
    });
  });

  describe("Totality Compliance", () => {
    it("should never return null or undefined", () => {
      const path = PropertyPath.create("test.path");
      assertEquals(path.ok, true);
      if (path.ok) {
        // All methods should return defined values
        assertExists(path.data.getSegments());
        assertExists(path.data.toString());
        assertExists(path.data.hasArrayAccess());
        assertExists(path.data.getArrayIndices());
        assertExists(path.data.getDepth());
        assertExists(path.data.hashCode());
        assertExists(path.data.toJSON());
      }
    });

    it("should handle edge cases gracefully", () => {
      // Test with various edge cases
      const edgeCases = [
        "a", // Single character
        "a1", // Alphanumeric
        "_underscore", // Leading underscore
        "$dollar", // Dollar sign
        "very_long_property_name_with_underscores_and_numbers123",
      ];

      edgeCases.forEach((testCase) => {
        const result = PropertyPath.create(testCase);
        assertEquals(
          result.ok,
          true,
          `Edge case "${testCase}" should be valid`,
        );
      });
    });

    it("should maintain immutability", () => {
      const result = PropertyPath.create("user.name");
      assertEquals(result.ok, true);
      if (result.ok) {
        const segments1 = result.data.getSegments();
        const segments2 = result.data.getSegments();

        // Should return the same array reference (readonly)
        assertEquals(segments1, segments2);

        // Original path should remain unchanged after operations
        const appendResult = result.data.append("extra");
        assertEquals(result.data.toString(), "user.name"); // Unchanged
        if (appendResult.ok) {
          assertEquals(appendResult.data.toString(), "user.name.extra");
        }
      }
    });

    it("should provide exhaustive error information", () => {
      const invalidPath = PropertyPath.create("..invalid");
      assertEquals(invalidPath.ok, false);
      if (!invalidPath.ok) {
        // Error should have all required fields
        assertExists(invalidPath.error.kind);
        assertExists(invalidPath.error.message);
        assertEquals(typeof invalidPath.error.message, "string");
        assertEquals(invalidPath.error.message.length > 0, true);
      }
    });
  });
});
