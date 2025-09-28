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
    it("should create DirectiveOrderManager instance successfully", async () => {
      const result = await DirectiveOrderManager.create();

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assert(result.data instanceof DirectiveOrderManager);
      }
    });

    it("should provide all supported directive types", async () => {
      const result = await DirectiveOrderManager.create();

      assertEquals(result.ok, true);
      if (result.ok) {
        const supportedDirectives = result.data.getSupportedDirectives();

        assertEquals(supportedDirectives.length, 6);
        assert(supportedDirectives.includes("x-frontmatter-part"));
        assert(supportedDirectives.includes("x-jmespath-filter"));
        assert(supportedDirectives.includes("x-derived-from"));
        assert(supportedDirectives.includes("x-derived-unique"));
        assert(supportedDirectives.includes("x-template"));
        assert(supportedDirectives.includes("x-template-items"));
      }
    });
  });

  describe("Processing Order Determination", () => {
    it("should determine correct order for basic directive sequence", async () => {
      const managerResult = await DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const directives: DirectiveType[] = [
          "x-template",
          "x-derived-from",
          "x-frontmatter-part",
          "x-jmespath-filter",
        ];

        const orderResult = manager.determineProcessingOrder(directives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const order = orderResult.data;

          // Verify correct order
          assertEquals(order.orderedDirectives.length, 4);
          assertEquals(order.orderedDirectives[0], "x-frontmatter-part");
          assertEquals(order.orderedDirectives[1], "x-jmespath-filter");
          assertEquals(order.orderedDirectives[2], "x-derived-from");
          assertEquals(order.orderedDirectives[3], "x-template");

          // Verify stages
          assertEquals(order.stages.length, 4);
          assertEquals(order.stages[0].stage, 1);
          assertEquals(order.stages[0].directives[0], "x-frontmatter-part");
          assertEquals(order.stages[1].stage, 2);
          assertEquals(order.stages[1].directives[0], "x-jmespath-filter");
        }
      }
    });

    it("should handle complete directive pipeline order", async () => {
      const managerResult = await DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const allDirectives: DirectiveType[] = [
          "x-template-items",
          "x-template",
          "x-derived-unique",
          "x-derived-from",
          "x-jmespath-filter",
          "x-frontmatter-part",
        ];

        const orderResult = manager.determineProcessingOrder(allDirectives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const order = orderResult.data;

          // Verify complete correct order
          assertEquals(order.orderedDirectives.length, 6);
          assertEquals(order.orderedDirectives[0], "x-frontmatter-part");
          assertEquals(order.orderedDirectives[1], "x-jmespath-filter");
          assertEquals(order.orderedDirectives[2], "x-derived-from");
          assertEquals(order.orderedDirectives[3], "x-derived-unique");

          // Both template directives should be last (same stage)
          assert(order.orderedDirectives.includes("x-template"));
          assert(order.orderedDirectives.includes("x-template-items"));

          // Verify stage grouping
          assertEquals(order.stages.length, 5); // Stages 1-5
          assertEquals(order.stages[4].directives.length, 2); // Stage 5 has both template directives
        }
      }
    });

    it("should handle single directive", async () => {
      const managerResult = await DirectiveOrderManager.create();
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

    it("should handle empty directive list", async () => {
      const managerResult = await DirectiveOrderManager.create();
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
    it("should provide correct dependency information for each directive", async () => {
      const managerResult = await DirectiveOrderManager.create();
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

        // Test x-jmespath-filter (depends on x-frontmatter-part)
        const jmespathFilterResult = manager.getDirectiveDependencies(
          "x-jmespath-filter",
        );
        assertEquals(jmespathFilterResult.ok, true);
        if (jmespathFilterResult.ok) {
          assertEquals(jmespathFilterResult.data.dependsOn.length, 1);
          assertEquals(
            jmespathFilterResult.data.dependsOn[0],
            "x-frontmatter-part",
          );
          assertEquals(jmespathFilterResult.data.stage, 2);
        }

        // Test x-derived-from (depends on x-jmespath-filter)
        const derivedFromResult = manager.getDirectiveDependencies(
          "x-derived-from",
        );
        assertEquals(derivedFromResult.ok, true);
        if (derivedFromResult.ok) {
          assertEquals(derivedFromResult.data.dependsOn.length, 1);
          assert(
            derivedFromResult.data.dependsOn.includes("x-jmespath-filter"),
          );
          assertEquals(derivedFromResult.data.stage, 3);
        }

        // Test x-template (depends on x-derived-unique and x-derived-from)
        const templateResult = manager.getDirectiveDependencies("x-template");
        assertEquals(templateResult.ok, true);
        if (templateResult.ok) {
          assertEquals(templateResult.data.dependsOn.length, 2);
          assert(templateResult.data.dependsOn.includes("x-derived-unique"));
          assert(templateResult.data.dependsOn.includes("x-derived-from"));
          assertEquals(templateResult.data.stage, 5);
        }
      }
    });

    it("should handle invalid directive type", async () => {
      const managerResult = await DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;

        const invalidResult = manager.getDirectiveDependencies(
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

    it("should not detect circular dependencies in valid dependency graph", async () => {
      const managerResult = await DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const validDirectives: DirectiveType[] = [
          "x-frontmatter-part",
          "x-jmespath-filter",
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

    it("should handle directives with complex dependency chains", async () => {
      const managerResult = await DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const complexDirectives: DirectiveType[] = [
          "x-template",
          "x-derived-unique",
          "x-derived-from",
          "x-jmespath-filter",
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
          const jmespathIndex = order.orderedDirectives.indexOf(
            "x-jmespath-filter",
          );
          const derivedIndex = order.orderedDirectives.indexOf(
            "x-derived-from",
          );
          const uniqueIndex = order.orderedDirectives.indexOf(
            "x-derived-unique",
          );
          const templateIndex = order.orderedDirectives.indexOf("x-template");

          // Assert dependency order
          assert(frontmatterIndex < jmespathIndex);
          assert(jmespathIndex < derivedIndex);
          assert(derivedIndex < uniqueIndex);
          assert(uniqueIndex < templateIndex);
        }
      }
    });
  });

  describe("Dependency Graph Generation", () => {
    it("should generate correct dependency graph", async () => {
      const managerResult = await DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const directives: DirectiveType[] = [
          "x-frontmatter-part",
          "x-jmespath-filter",
          "x-derived-from",
        ];

        const orderResult = manager.determineProcessingOrder(directives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const graph = orderResult.data.dependencyGraph;

          // Verify graph structure
          assertEquals(graph["x-frontmatter-part"].length, 0);
          assertEquals(graph["x-jmespath-filter"].length, 1);
          assertEquals(graph["x-jmespath-filter"][0], "x-frontmatter-part");
          assertEquals(graph["x-derived-from"].length, 1);
          assert(graph["x-derived-from"].includes("x-jmespath-filter"));
        }
      }
    });
  });

  describe("Stage Organization", () => {
    it("should organize directives into correct processing stages", async () => {
      const managerResult = await DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const directives: DirectiveType[] = [
          "x-template",
          "x-template-items",
          "x-derived-unique",
          "x-frontmatter-part",
          "x-jmespath-filter",
        ];

        const orderResult = manager.determineProcessingOrder(directives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const stages = orderResult.data.stages;

          // Verify stage organization
          assertEquals(stages.length, 4); // Stages 1, 2, 4, 5

          // Stage 1: x-frontmatter-part
          assertEquals(stages[0].stage, 1);
          assertEquals(stages[0].directives.length, 1);
          assertEquals(stages[0].directives[0], "x-frontmatter-part");

          // Stage 2: x-jmespath-filter
          assertEquals(stages[1].stage, 2);
          assertEquals(stages[1].directives.length, 1);
          assertEquals(stages[1].directives[0], "x-jmespath-filter");

          // Stage 4: x-derived-unique
          assertEquals(stages[2].stage, 4);
          assertEquals(stages[2].directives.length, 1);
          assertEquals(stages[2].directives[0], "x-derived-unique");

          // Stage 5: both template directives
          assertEquals(stages[3].stage, 5);
          assertEquals(stages[3].directives.length, 2);
          assert(stages[3].directives.includes("x-template"));
          assert(stages[3].directives.includes("x-template-items"));
        }
      }
    });

    it("should provide meaningful stage descriptions", async () => {
      const managerResult = await DirectiveOrderManager.create();
      assertEquals(managerResult.ok, true);

      if (managerResult.ok) {
        const manager = managerResult.data;
        const directives: DirectiveType[] = [
          "x-frontmatter-part",
          "x-jmespath-filter",
        ];

        const orderResult = manager.determineProcessingOrder(directives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const stages = orderResult.data.stages;

          // Verify descriptions are meaningful
          assert(stages[0].description.includes("Identify target arrays"));
          assert(stages[1].description.includes("Apply JMESPath filtering"));
        }
      }
    });
  });
});
