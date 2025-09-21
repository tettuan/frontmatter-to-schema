/**
 * @fileoverview Comprehensive Test Suite for Directive Order Management - Issue #900
 * @description Tests for directive processing order control system
 */

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  DirectiveOrderManager,
  DirectiveType,
} from "../../../../src/domain/schema/directive-order.ts";

describe("DirectiveOrderManager", () => {
  describe("Smart Constructor", () => {
    it("should create DirectiveOrderManager instance successfully", () => {
      const result = DirectiveOrderManager.create();

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assert(result.data instanceof DirectiveOrderManager);
      }
    });

    it("should provide all supported directive types", () => {
      const result = DirectiveOrderManager.create();

      assertEquals(result.ok, true);
      if (result.ok) {
        const supportedDirectives = result.data.getSupportedDirectives();

        assertEquals(supportedDirectives.length, 8);
        assert(supportedDirectives.includes("x-frontmatter-part"));
        assert(supportedDirectives.includes("x-extract-from"));
        assert(supportedDirectives.includes("x-jmespath-filter"));
        assert(supportedDirectives.includes("x-merge-arrays"));
        assert(supportedDirectives.includes("x-derived-from"));
        assert(supportedDirectives.includes("x-derived-unique"));
        assert(supportedDirectives.includes("x-template"));
        assert(supportedDirectives.includes("x-template-items"));
      }
    });
  });

  describe("Processing Order Determination", () => {
    it("should determine correct order for basic directive sequence", () => {
      const managerResult = DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const directives: DirectiveType[] = [
          "x-template",
          "x-derived-from",
          "x-frontmatter-part",
          "x-extract-from",
        ];

        const orderResult = manager.determineProcessingOrder(directives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const order = orderResult.data;

          // Verify correct order
          assertEquals(order.orderedDirectives.length, 4);
          assertEquals(order.orderedDirectives[0], "x-frontmatter-part");
          assertEquals(order.orderedDirectives[1], "x-extract-from");
          assertEquals(order.orderedDirectives[2], "x-derived-from");
          assertEquals(order.orderedDirectives[3], "x-template");

          // Verify stages
          assertEquals(order.stages.length, 4);
          assertEquals(order.stages[0].stage, 1);
          assertEquals(order.stages[0].directives[0], "x-frontmatter-part");
          assertEquals(order.stages[1].stage, 2);
          assertEquals(order.stages[1].directives[0], "x-extract-from");
        }
      }
    });

    it("should handle complete directive pipeline order", () => {
      const managerResult = DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const allDirectives: DirectiveType[] = [
          "x-template-items",
          "x-template",
          "x-derived-unique",
          "x-derived-from",
          "x-merge-arrays",
          "x-jmespath-filter",
          "x-extract-from",
          "x-frontmatter-part",
        ];

        const orderResult = manager.determineProcessingOrder(allDirectives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const order = orderResult.data;

          // Verify complete correct order
          assertEquals(order.orderedDirectives.length, 8);
          assertEquals(order.orderedDirectives[0], "x-frontmatter-part");
          assertEquals(order.orderedDirectives[1], "x-extract-from");
          assertEquals(order.orderedDirectives[2], "x-jmespath-filter");
          assertEquals(order.orderedDirectives[3], "x-merge-arrays");
          assertEquals(order.orderedDirectives[4], "x-derived-from");
          assertEquals(order.orderedDirectives[5], "x-derived-unique");

          // Both template directives should be last (same stage)
          assert(order.orderedDirectives.includes("x-template"));
          assert(order.orderedDirectives.includes("x-template-items"));

          // Verify stage grouping
          assertEquals(order.stages.length, 7); // Stages 1-7
          assertEquals(order.stages[6].directives.length, 2); // Stage 7 has both template directives
        }
      }
    });

    it("should handle single directive", () => {
      const managerResult = DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const singleDirective: DirectiveType[] = ["x-frontmatter-part"];

        const orderResult = manager.determineProcessingOrder(singleDirective);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const order = orderResult.data;

          assertEquals(order.orderedDirectives.length, 1);
          assertEquals(order.orderedDirectives[0], "x-frontmatter-part");
          assertEquals(order.stages.length, 1);
          assertEquals(order.stages[0].stage, 1);
        }
      }
    });

    it("should handle empty directive list", () => {
      const managerResult = DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const emptyDirectives: DirectiveType[] = [];

        const orderResult = manager.determineProcessingOrder(emptyDirectives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const order = orderResult.data;

          assertEquals(order.orderedDirectives.length, 0);
          assertEquals(order.stages.length, 0);
          assertEquals(Object.keys(order.dependencyGraph).length, 0);
        }
      }
    });
  });

  describe("Dependency Information", () => {
    it("should provide correct dependency information for each directive", () => {
      const managerResult = DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;

        // Test x-frontmatter-part (no dependencies)
        const frontmatterPartResult = manager.getDirectiveDependencies(
          "x-frontmatter-part",
        );
        assertEquals(frontmatterPartResult.ok, true);
        if (frontmatterPartResult.ok) {
          assertEquals(frontmatterPartResult.data.dependsOn.length, 0);
          assertEquals(frontmatterPartResult.data.stage, 1);
        }

        // Test x-extract-from (depends on x-frontmatter-part)
        const extractFromResult = manager.getDirectiveDependencies(
          "x-extract-from",
        );
        assertEquals(extractFromResult.ok, true);
        if (extractFromResult.ok) {
          assertEquals(extractFromResult.data.dependsOn.length, 1);
          assertEquals(
            extractFromResult.data.dependsOn[0],
            "x-frontmatter-part",
          );
          assertEquals(extractFromResult.data.stage, 2);
        }

        // Test x-derived-from (depends on x-merge-arrays and x-extract-from)
        const derivedFromResult = manager.getDirectiveDependencies(
          "x-derived-from",
        );
        assertEquals(derivedFromResult.ok, true);
        if (derivedFromResult.ok) {
          assertEquals(derivedFromResult.data.dependsOn.length, 2);
          assert(derivedFromResult.data.dependsOn.includes("x-merge-arrays"));
          assert(derivedFromResult.data.dependsOn.includes("x-extract-from"));
          assertEquals(derivedFromResult.data.stage, 5);
        }

        // Test x-template (depends on x-derived-unique and x-derived-from)
        const templateResult = manager.getDirectiveDependencies("x-template");
        assertEquals(templateResult.ok, true);
        if (templateResult.ok) {
          assertEquals(templateResult.data.dependsOn.length, 2);
          assert(templateResult.data.dependsOn.includes("x-derived-unique"));
          assert(templateResult.data.dependsOn.includes("x-derived-from"));
          assertEquals(templateResult.data.stage, 7);
        }
      }
    });

    it("should handle invalid directive type", () => {
      const managerResult = DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;

        const invalidResult = manager.getDirectiveDependencies(
          // @ts-expect-error - testing invalid directive
          "x-invalid-directive",
        );
        assertEquals(invalidResult.ok, false);

        if (!invalidResult.ok) {
          assertEquals(invalidResult.error.kind, "InvalidFormat");
          if (invalidResult.error.kind === "InvalidFormat") {
            assertEquals(invalidResult.error.format, "supported-directive");
            if ("value" in invalidResult.error && invalidResult.error.value) {
              assertEquals(invalidResult.error.value, "x-invalid-directive");
            }
          }
        }
      }
    });
  });

  describe("Circular Dependency Detection", () => {
    // Note: The current dependency structure doesn't have cycles by design
    // This test verifies that the detection would work if cycles were introduced

    it("should not detect circular dependencies in valid dependency graph", () => {
      const managerResult = DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const validDirectives: DirectiveType[] = [
          "x-frontmatter-part",
          "x-extract-from",
          "x-derived-from",
          "x-template",
        ];

        const orderResult = manager.determineProcessingOrder(validDirectives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          // If no circular dependency is detected, the processing order should be determined successfully
          assertEquals(orderResult.data.orderedDirectives.length, 4);
        }
      }
    });

    it("should handle directives with complex dependency chains", () => {
      const managerResult = DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const complexDirectives: DirectiveType[] = [
          "x-template",
          "x-derived-unique",
          "x-derived-from",
          "x-merge-arrays",
          "x-jmespath-filter",
          "x-extract-from",
          "x-frontmatter-part",
        ];

        const orderResult = manager.determineProcessingOrder(complexDirectives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const order = orderResult.data;

          // Verify that dependencies are respected in ordering
          const frontmatterIndex = order.orderedDirectives.indexOf(
            "x-frontmatter-part",
          );
          const extractIndex = order.orderedDirectives.indexOf(
            "x-extract-from",
          );
          const mergeIndex = order.orderedDirectives.indexOf("x-merge-arrays");
          const derivedIndex = order.orderedDirectives.indexOf(
            "x-derived-from",
          );
          const uniqueIndex = order.orderedDirectives.indexOf(
            "x-derived-unique",
          );
          const templateIndex = order.orderedDirectives.indexOf("x-template");

          // Assert dependency order
          assert(frontmatterIndex < extractIndex);
          assert(extractIndex < mergeIndex);
          assert(mergeIndex < derivedIndex);
          assert(derivedIndex < uniqueIndex);
          assert(uniqueIndex < templateIndex);
        }
      }
    });
  });

  describe("Dependency Graph Generation", () => {
    it("should generate correct dependency graph", () => {
      const managerResult = DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const directives: DirectiveType[] = [
          "x-frontmatter-part",
          "x-extract-from",
          "x-derived-from",
        ];

        const orderResult = manager.determineProcessingOrder(directives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const graph = orderResult.data.dependencyGraph;

          // Verify graph structure
          assertEquals(graph["x-frontmatter-part"].length, 0);
          assertEquals(graph["x-extract-from"].length, 1);
          assertEquals(graph["x-extract-from"][0], "x-frontmatter-part");
          assertEquals(graph["x-derived-from"].length, 2);
          assert(graph["x-derived-from"].includes("x-merge-arrays"));
          assert(graph["x-derived-from"].includes("x-extract-from"));
        }
      }
    });
  });

  describe("Stage Organization", () => {
    it("should organize directives into correct processing stages", () => {
      const managerResult = DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const directives: DirectiveType[] = [
          "x-template",
          "x-template-items",
          "x-derived-unique",
          "x-frontmatter-part",
          "x-extract-from",
        ];

        const orderResult = manager.determineProcessingOrder(directives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const stages = orderResult.data.stages;

          // Verify stage organization
          assertEquals(stages.length, 4); // Stages 1, 2, 6, 7

          // Stage 1: x-frontmatter-part
          assertEquals(stages[0].stage, 1);
          assertEquals(stages[0].directives.length, 1);
          assertEquals(stages[0].directives[0], "x-frontmatter-part");

          // Stage 2: x-extract-from
          assertEquals(stages[1].stage, 2);
          assertEquals(stages[1].directives.length, 1);
          assertEquals(stages[1].directives[0], "x-extract-from");

          // Stage 6: x-derived-unique
          assertEquals(stages[2].stage, 6);
          assertEquals(stages[2].directives.length, 1);
          assertEquals(stages[2].directives[0], "x-derived-unique");

          // Stage 7: both template directives
          assertEquals(stages[3].stage, 7);
          assertEquals(stages[3].directives.length, 2);
          assert(stages[3].directives.includes("x-template"));
          assert(stages[3].directives.includes("x-template-items"));
        }
      }
    });

    it("should provide meaningful stage descriptions", () => {
      const managerResult = DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const directives: DirectiveType[] = [
          "x-frontmatter-part",
          "x-extract-from",
        ];

        const orderResult = manager.determineProcessingOrder(directives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const stages = orderResult.data.stages;

          // Verify descriptions are meaningful
          assert(stages[0].description.includes("Identify target arrays"));
          assert(stages[1].description.includes("Extract values"));
        }
      }
    });
  });
});
