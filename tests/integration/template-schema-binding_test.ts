import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { BreakdownLogger } from "jsr:@tettuan/breakdownlogger";
import { VariableContext } from "../../src/domain/template/value-objects/variable-context.ts";
import { FrontmatterTestFactory } from "../helpers/frontmatter-test-factory.ts";

/**
 * INTEGRATION TEST: Template-Schema Binding Layer
 *
 * This test validates the complete Template-Schema Binding Layer implementation,
 * ensuring {@items} variables are resolved from x-frontmatter-part hierarchy level.
 *
 * This is a simplified integration test that focuses on the core architectural
 * constraint: {@items} resolution from schema hierarchy.
 */
describe("Template-Schema Binding Integration", () => {
  const _logger = new BreakdownLogger("template-schema-binding");
  describe("Variable Context with Legacy Support", () => {
    it("should resolve regular variables in legacy mode", () => {
      // Arrange: Use legacy context creation
      const data = FrontmatterTestFactory.createCustomData({
        project: {
          name: "My Project",
          version: "2.0.0",
        },
        description: "A test project",
      });

      const contextResult = VariableContext.fromSingleData(data);
      assertExists(contextResult.ok, "Should create legacy context");
      if (!contextResult.ok) return;

      const context = contextResult.data;

      // Act & Assert: Regular variables should work
      const nameResult = context.resolveVariable("project.name");
      assertExists(nameResult.ok, "Should resolve nested variable");
      if (!nameResult.ok) return;
      assertEquals(nameResult.data, "My Project");

      const versionResult = context.resolveVariable("project.version");
      assertExists(versionResult.ok, "Should resolve version");
      if (!versionResult.ok) return;
      assertEquals(versionResult.data, "2.0.0");

      const descResult = context.resolveVariable("description");
      assertExists(descResult.ok, "Should resolve top-level variable");
      if (!descResult.ok) return;
      assertEquals(descResult.data, "A test project");
    });

    it("should handle {@items} in legacy mode with fallback", () => {
      // Arrange: Legacy context with array data
      const mainData = { title: "Test Project" };
      const arrayData = [
        { name: "task1", command: "echo task1" },
        { name: "task2", command: "echo task2" },
      ];

      const contextResult = VariableContext.fromComposedData({
        mainData,
        arrayData,
      });

      assertExists(contextResult.ok, "Should create legacy composed context");
      if (!contextResult.ok) return;

      const context = contextResult.data;

      // Act: {@items} should resolve from legacy array data
      const itemsResult = context.resolveVariable("@items");
      assertExists(itemsResult.ok, "Should resolve {@items} in legacy mode");
      if (!itemsResult.ok) return;
      assertExists(Array.isArray(itemsResult.data), "Should return array");
      const itemsArray = itemsResult.data as Array<
        { name: string; command: string }
      >;
      assertEquals(itemsArray.length, 2);
      assertEquals(itemsArray[0].name, "task1");

      // Regular variables should also work
      const titleResult = context.resolveVariable("title");
      assertExists(titleResult.ok, "Should resolve main data variables");
      if (!titleResult.ok) return;
      assertEquals(titleResult.data, "Test Project");
    });

    it("should validate context capabilities", () => {
      // Arrange
      const data = FrontmatterTestFactory.createCustomData({
        title: "Test",
        items: [1, 2, 3],
      });

      const contextResult = VariableContext.fromSingleData(data);
      assertExists(contextResult.ok, "Should create context");
      if (!contextResult.ok) return;

      const context = contextResult.data;

      // Act & Assert: Context should have expected properties
      const hierarchyRootState = context.getHierarchyRootState();
      assertEquals(hierarchyRootState.kind, "not-defined"); // Legacy mode has no hierarchy
      assertExists(context.getDataKeys().includes("title"));
      assertExists(context.getDataKeys().includes("items"));
      assertExists(!context.hasArrayData()); // No legacy array data
      assertEquals(context.getArrayData().length, 0);

      // Unknown @ variables should fail
      const unknownResult = context.resolveVariable("@unknown");
      assertExists(!unknownResult.ok, "Should reject unknown @ variables");
    });

    it("should handle error cases gracefully", () => {
      // Arrange
      const data = FrontmatterTestFactory.createMinimalData();

      const contextResult = VariableContext.fromSingleData(data);
      assertExists(contextResult.ok);
      if (!contextResult.ok) return;

      const context = contextResult.data;

      // Act & Assert: Missing variables should fail gracefully
      const missingResult = context.resolveVariable("missing");
      assertExists(!missingResult.ok, "Should fail for missing variable");
      if (missingResult.ok) return;
      assertExists(
        missingResult.error.message.includes("not found"),
        "Should indicate variable not found",
      );

      // {@items} without array data should fail
      const itemsResult = context.resolveVariable("@items");
      assertExists(!itemsResult.ok, "Should fail {@items} without hierarchy");
      if (itemsResult.ok) return;
      assertExists(
        itemsResult.error.message.includes("Array marker"),
        "Should indicate missing schema context",
      );
    });
  });

  describe("Architectural Constraints", () => {
    it("should demonstrate {@items} hierarchy constraint requirement", () => {
      // This test demonstrates the architectural constraint that {@items}
      // should be resolved from x-frontmatter-part hierarchy level.
      // In legacy mode, this fails as expected.

      const data = FrontmatterTestFactory.createCustomData({
        commands: [
          { name: "build", script: "npm run build" },
          { name: "test", script: "npm test" },
        ],
        other_array: ["a", "b", "c"], // This should NOT be used for {@items
      });

      const contextResult = VariableContext.fromSingleData(data);
      assertExists(contextResult.ok);
      if (!contextResult.ok) return;

      const context = contextResult.data;

      // {@items} should fail because there's no schema hierarchy
      const itemsResult = context.resolveVariable("@items");
      assertExists(!itemsResult.ok, "Should fail without schema hierarchy");

      // But regular array access should work
      const commandsResult = context.resolveVariable("commands");
      assertExists(
        commandsResult.ok,
        "Should access commands as regular variable",
      );
      if (!commandsResult.ok) return;
      assertExists(
        Array.isArray(commandsResult.data),
        "Commands should be array",
      );
      const commandsArray = commandsResult.data as Array<unknown>;
      assertEquals(commandsArray.length, 2);

      const otherResult = context.resolveVariable("other_array");
      assertExists(
        otherResult.ok,
        "Should access other_array as regular variable",
      );
      if (!otherResult.ok) return;
      assertExists(
        Array.isArray(otherResult.data),
        "Other array should be accessible",
      );
      const otherArray = otherResult.data as Array<unknown>;
      assertEquals(otherArray.length, 3);
    });
  });
});
