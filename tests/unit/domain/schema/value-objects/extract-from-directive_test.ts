import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertExists } from "@std/assert";
import { ExtractFromDirective } from "../../../../../src/domain/schema/value-objects/extract-from-directive.ts";

describe("ExtractFromDirective", () => {
  describe("Smart Constructor", () => {
    describe("Valid creation", () => {
      it("should create directive with simple path and target", () => {
        const result = ExtractFromDirective.create("user.name", "userName");

        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.getSourcePathString(), "user.name");
          assertEquals(result.data.getTargetProperty(), "userName");
          assertEquals(result.data.hasArrayNotation(), false);
        }
      });

      it("should create directive with array notation", () => {
        const result = ExtractFromDirective.create("items[].id", "itemIds");

        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.getSourcePathString(), "items[].id");
          assertEquals(result.data.getTargetProperty(), "itemIds");
          assertEquals(result.data.hasArrayNotation(), true);
        }
      });

      it("should create directive with nested target property", () => {
        const result = ExtractFromDirective.create(
          "source.value",
          "target.nested.property",
        );

        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(
            result.data.getTargetProperty(),
            "target.nested.property",
          );
          assertEquals(result.data.hasNestedTarget(), true);
          assertEquals(result.data.getTargetSegments(), [
            "target",
            "nested",
            "property",
          ]);
        }
      });
    });

    describe("Invalid input rejection", () => {
      it("should reject empty source path", () => {
        const result = ExtractFromDirective.create("", "target");

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidSchema");
          if (result.error.kind === "InvalidSchema") {
            assertEquals(
              result.error.message,
              "Source path for x-extract-from cannot be empty",
            );
          }
        }
      });

      it("should reject empty target property", () => {
        const result = ExtractFromDirective.create("source.path", "");

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidSchema");
          if (result.error.kind === "InvalidSchema") {
            assertEquals(
              result.error.message,
              "Target property for x-extract-from cannot be empty",
            );
          }
        }
      });

      it("should reject invalid target property format - starts with number", () => {
        const result = ExtractFromDirective.create("source", "123target");

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidSchema");
          if (result.error.kind === "InvalidSchema") {
            assertExists(
              result.error.message.includes("Invalid target property format"),
            );
          }
        }
      });

      it("should reject invalid source path with consecutive dots", () => {
        const result = ExtractFromDirective.create("source..path", "target");

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidSchema");
          if (result.error.kind === "InvalidSchema") {
            assertExists(
              result.error.message.includes("Invalid x-extract-from path"),
            );
          }
        }
      });
    });
  });

  describe("Getters", () => {
    const createValidDirective = (source: string, target: string) => {
      const result = ExtractFromDirective.create(source, target);
      if (!result.ok) throw new Error("Failed to create directive");
      return result.data;
    };

    it("should return source path", () => {
      const directive = createValidDirective(
        "user.profile.name",
        "profileName",
      );

      assertEquals(directive.getSourcePathString(), "user.profile.name");
      assertExists(directive.getSourcePath());
    });

    it("should return target property", () => {
      const directive = createValidDirective("source", "targetProperty");

      assertEquals(directive.getTargetProperty(), "targetProperty");
    });
  });

  describe("Array Notation Detection", () => {
    const createValidDirective = (source: string, target: string) => {
      const result = ExtractFromDirective.create(source, target);
      if (!result.ok) throw new Error("Failed to create directive");
      return result.data;
    };

    it("should detect array notation in path", () => {
      const directive = createValidDirective("items[].value", "values");
      assertEquals(directive.hasArrayNotation(), true);
    });

    it("should not detect array notation when absent", () => {
      const directive = createValidDirective("item.value", "value");
      assertEquals(directive.hasArrayNotation(), false);
    });
  });

  describe("Equality", () => {
    const createValidDirective = (source: string, target: string) => {
      const result = ExtractFromDirective.create(source, target);
      if (!result.ok) throw new Error("Failed to create directive");
      return result.data;
    };

    it("should consider directives with same path and target as equal", () => {
      const directive1 = createValidDirective("user.name", "userName");
      const directive2 = createValidDirective("user.name", "userName");
      assertEquals(directive1.equals(directive2), true);
    });

    it("should consider directives with different paths as not equal", () => {
      const directive1 = createValidDirective("user.name", "userName");
      const directive2 = createValidDirective("user.email", "userName");
      assertEquals(directive1.equals(directive2), false);
    });

    it("should consider directives with different targets as not equal", () => {
      const directive1 = createValidDirective("user.name", "userName");
      const directive2 = createValidDirective("user.name", "userEmail");
      assertEquals(directive1.equals(directive2), false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle deeply nested paths", () => {
      const result = ExtractFromDirective.create(
        "a.b.c.d.e.f.g.h.i.j",
        "target",
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getSourcePathString(), "a.b.c.d.e.f.g.h.i.j");
      }
    });

    it("should handle single segment paths", () => {
      const result = ExtractFromDirective.create("single", "target");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.hasNestedTarget(), false);
        assertEquals(result.data.hasArrayNotation(), false);
      }
    });
  });
});
