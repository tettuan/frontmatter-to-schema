/**
 * @fileoverview Unit tests for DirectiveType value object
 * @description Tests for Issue #900: directive processing order control
 *
 * Following TDD and Totality principles:
 * - Comprehensive test coverage for all scenarios
 * - Result<T,E> pattern testing
 * - Edge case validation
 */

import { assert, assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  DirectiveType,
  DirectiveTypeKind,
} from "../../../../../src/domain/schema/value-objects/directive-type.ts";

describe("DirectiveType", () => {
  describe("Smart Constructor patterns", () => {
    it("should create valid directive types", () => {
      const validTypes: DirectiveTypeKind[] = [
        "frontmatter-part",
        "extract-from",
        "flatten-arrays",
        "jmespath-filter",
        "merge-arrays",
        "derived-from",
        "derived-unique",
        "template",
        "template-items",
        "template-format",
      ];

      for (const kind of validTypes) {
        const result = DirectiveType.create(kind);
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.getKind(), kind);
        }
      }
    });

    it("should reject invalid directive types", () => {
      const invalidType = "invalid-directive" as DirectiveTypeKind;
      const result = DirectiveType.create(invalidType);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assert(result.error.message.includes("Unknown directive type"));
      }
    });

    it("should create all directive types successfully", () => {
      const result = DirectiveType.createAll();

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 10);

        // Verify all expected types are present
        const kinds = result.data.map((d) => d.getKind());
        const expectedKinds = [
          "frontmatter-part",
          "extract-from",
          "flatten-arrays",
          "jmespath-filter",
          "merge-arrays",
          "derived-from",
          "derived-unique",
          "template",
          "template-items",
          "template-format",
        ];

        for (const expected of expectedKinds) {
          assert(
            kinds.includes(expected as DirectiveTypeKind),
            `Missing directive type: ${expected}`,
          );
        }
      }
    });
  });

  describe("Dependency relationships", () => {
    it("should define correct dependency relationships", () => {
      const frontmatterPartResult = DirectiveType.create("frontmatter-part");
      const extractFromResult = DirectiveType.create("extract-from");
      const flattenArraysResult = DirectiveType.create("flatten-arrays");
      const jmespathFilterResult = DirectiveType.create("jmespath-filter");
      const mergeArraysResult = DirectiveType.create("merge-arrays");
      const derivedFromResult = DirectiveType.create("derived-from");

      assert(frontmatterPartResult.ok);
      assert(extractFromResult.ok);
      assert(flattenArraysResult.ok);
      assert(jmespathFilterResult.ok);
      assert(mergeArraysResult.ok);
      assert(derivedFromResult.ok);

      const frontmatterPart = frontmatterPartResult.data;
      const extractFrom = extractFromResult.data;
      const flattenArrays = flattenArraysResult.data;
      const jmespathFilter = jmespathFilterResult.data;
      const mergeArrays = mergeArraysResult.data;
      const derivedFrom = derivedFromResult.data;

      // Test dependency relationships
      assertEquals(frontmatterPart.getDependencies().length, 0); // No dependencies
      assertEquals(extractFrom.getDependencies(), ["frontmatter-part"]);
      assertEquals(flattenArrays.getDependencies(), ["extract-from"]);
      assertEquals(jmespathFilter.getDependencies(), ["flatten-arrays"]);
      assertEquals(mergeArrays.getDependencies(), ["jmespath-filter"]);
      assertEquals(derivedFrom.getDependencies(), ["merge-arrays"]);
    });

    it("should correctly identify dependencies", () => {
      const frontmatterPartResult = DirectiveType.create("frontmatter-part");
      const extractFromResult = DirectiveType.create("extract-from");

      assert(frontmatterPartResult.ok);
      assert(extractFromResult.ok);

      const frontmatterPart = frontmatterPartResult.data;
      const extractFrom = extractFromResult.data;

      // extract-from depends on frontmatter-part
      assertEquals(extractFrom.dependsOn(frontmatterPart), true);

      // frontmatter-part doesn't depend on extract-from
      assertEquals(frontmatterPart.dependsOn(extractFrom), false);
    });
  });

  describe("Processing priority", () => {
    it("should assign correct processing priorities", () => {
      const priorities = new Map<DirectiveTypeKind, number>([
        ["frontmatter-part", 1],
        ["extract-from", 2],
        ["flatten-arrays", 3],
        ["jmespath-filter", 4],
        ["merge-arrays", 5],
        ["derived-from", 6],
        ["derived-unique", 7],
        ["template", 8],
        ["template-items", 9],
        ["template-format", 10],
      ]);

      for (const [kind, expectedPriority] of priorities) {
        const result = DirectiveType.create(kind);
        assert(result.ok);
        if (result.ok) {
          assertEquals(result.data.getProcessingPriority(), expectedPriority);
        }
      }
    });

    it("should order directives by priority correctly", () => {
      const allResult = DirectiveType.createAll();
      assert(allResult.ok);

      if (allResult.ok) {
        const sorted = [...allResult.data].sort((a, b) =>
          a.getProcessingPriority() - b.getProcessingPriority()
        );

        const expectedOrder: DirectiveTypeKind[] = [
          "frontmatter-part",
          "extract-from",
          "flatten-arrays",
          "jmespath-filter",
          "merge-arrays",
          "derived-from",
          "derived-unique",
          "template",
          "template-items",
          "template-format",
        ];

        for (let i = 0; i < sorted.length; i++) {
          assertEquals(sorted[i].getKind(), expectedOrder[i]);
        }
      }
    });
  });

  describe("Value object behavior", () => {
    it("should provide value equality", () => {
      const directive1Result = DirectiveType.create("extract-from");
      const directive2Result = DirectiveType.create("extract-from");
      const directive3Result = DirectiveType.create("derived-from");

      assert(directive1Result.ok);
      assert(directive2Result.ok);
      assert(directive3Result.ok);

      const directive1 = directive1Result.data;
      const directive2 = directive2Result.data;
      const directive3 = directive3Result.data;

      // Same type should be equal
      assertEquals(directive1.equals(directive2), true);

      // Different types should not be equal
      assertEquals(directive1.equals(directive3), false);
    });

    it("should provide meaningful string representation", () => {
      const result = DirectiveType.create("extract-from");
      assert(result.ok);

      if (result.ok) {
        const str = result.data.toString();
        assert(str.includes("extract-from"));
        assert(str.includes("priority=2"));
        assert(str.includes("frontmatter-part"));
      }
    });

    it("should return immutable dependency arrays", () => {
      const result = DirectiveType.create("derived-from");
      assert(result.ok);

      if (result.ok) {
        const deps1 = result.data.getDependencies();
        const deps2 = result.data.getDependencies();

        // Should be different array instances
        assert(deps1 !== deps2);

        // Should have same content
        assertEquals(deps1, deps2);
      }
    });
  });

  describe("Logical dependency validation", () => {
    it("should ensure frontmatter-part has no dependencies", () => {
      const result = DirectiveType.create("frontmatter-part");
      assert(result.ok);

      if (result.ok) {
        assertEquals(result.data.getDependencies().length, 0);
        assertEquals(result.data.getProcessingPriority(), 1); // Highest priority
      }
    });

    it("should ensure template directives come last", () => {
      const templateResult = DirectiveType.create("template");
      const itemsResult = DirectiveType.create("template-items");
      const formatResult = DirectiveType.create("template-format");

      assert(templateResult.ok);
      assert(itemsResult.ok);
      assert(formatResult.ok);

      const template = templateResult.data;
      const items = itemsResult.data;
      const format = formatResult.data;

      // Template processing should come after data processing
      assert(template.getProcessingPriority() >= 6);
      assert(items.getProcessingPriority() > template.getProcessingPriority());
      assert(format.getProcessingPriority() > items.getProcessingPriority());
    });

    it("should maintain dependency chain integrity", () => {
      const allResult = DirectiveType.createAll();
      assert(allResult.ok);

      if (allResult.ok) {
        // For each directive, verify its dependencies have lower priorities
        for (const directive of allResult.data) {
          for (const depKind of directive.getDependencies()) {
            const depResult = DirectiveType.create(depKind);
            assert(depResult.ok);

            if (depResult.ok) {
              const dependency = depResult.data;
              assert(
                dependency.getProcessingPriority() <
                  directive.getProcessingPriority(),
                `Dependency ${depKind} should have lower priority than ${directive.getKind()}`,
              );
            }
          }
        }
      }
    });
  });
});
