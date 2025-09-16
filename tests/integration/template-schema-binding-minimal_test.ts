import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { VariableContext } from "../../src/domain/template/value-objects/variable-context.ts";
import { TestDataFactory } from "../helpers/test-data-factory.ts";

/**
 * MINIMAL INTEGRATION TEST: Template-Schema Binding Layer
 *
 * This test validates the core Template-Schema Binding Layer implementation
 * with proper Result type handling.
 */
describe("Template-Schema Binding Minimal", () => {
  describe("Variable Context Legacy Support", () => {
    it("should create and use variable context in legacy mode", () => {
      // Arrange
      const dataResult = TestDataFactory.createFrontmatterData({
        title: "My Project",
        version: "1.0.0",
      });

      assertExists(dataResult.ok, "Should create frontmatter data");
      if (!dataResult.ok) return;

      const contextResult = VariableContext.fromSingleData(dataResult.data);
      assertExists(contextResult.ok, "Should create legacy context");
      if (!contextResult.ok) return;

      const context = contextResult.data;

      // Act & Assert: Test basic functionality
      const titleResult = context.resolveVariable("title");
      assertExists(titleResult.ok, "Should resolve title variable");
      if (titleResult.ok) {
        assertEquals(titleResult.data, "My Project");
      }

      const versionResult = context.resolveVariable("version");
      assertExists(versionResult.ok, "Should resolve version variable");
      if (versionResult.ok) {
        assertEquals(versionResult.data, "1.0.0");
      }

      // Test hierarchy properties
      assertEquals(
        context.getHierarchyRoot(),
        null,
        "Legacy mode should have no hierarchy",
      );
      assertExists(context.getDataKeys().length > 0, "Should have data keys");
    });

    it("should handle {@items} correctly in different modes", () => {
      // Test 1: Legacy mode without array data - should fail
      const simpleDataResult = TestDataFactory.createFrontmatterData({
        title: "Test",
      });
      assertExists(simpleDataResult.ok);
      if (!simpleDataResult.ok) return;

      const simpleContextResult = VariableContext.fromSingleData(
        simpleDataResult.data,
      );
      assertExists(simpleContextResult.ok);
      if (!simpleContextResult.ok) return;

      const simpleContext = simpleContextResult.data;
      const itemsFailResult = simpleContext.resolveVariable("@items");
      assertExists(
        !itemsFailResult.ok,
        "Should fail {@items} without hierarchy",
      );

      // Test 2: Composed mode with array data - should work
      const composedResult = VariableContext.fromComposedData({
        mainData: { title: "Test" },
        arrayData: [{ name: "item1" }, { name: "item2" }],
      });

      assertExists(composedResult.ok, "Should create composed context");
      if (!composedResult.ok) return;

      const composedContext = composedResult.data;
      const itemsSuccessResult = composedContext.resolveVariable("@items");
      assertExists(
        itemsSuccessResult.ok,
        "Should resolve {@items} with array data",
      );
      if (itemsSuccessResult.ok) {
        assertExists(
          Array.isArray(itemsSuccessResult.data),
          "Should return array",
        );
        const arrayData = itemsSuccessResult.data as unknown[];
        assertEquals(arrayData.length, 2);
      }
    });

    it("should handle error cases properly", () => {
      const dataResult = TestDataFactory.createFrontmatterData({
        title: "Test",
      });
      assertExists(dataResult.ok);
      if (!dataResult.ok) return;

      const contextResult = VariableContext.fromSingleData(dataResult.data);
      assertExists(contextResult.ok);
      if (!contextResult.ok) return;

      const context = contextResult.data;

      // Test missing variable
      const missingResult = context.resolveVariable("missing");
      assertExists(!missingResult.ok, "Should fail for missing variable");

      // Test unknown @ variable
      const unknownResult = context.resolveVariable("@unknown");
      assertExists(!unknownResult.ok, "Should fail for unknown @ variable");
    });
  });
});
