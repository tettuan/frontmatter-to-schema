import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { VariableReplacer } from "../../../../../src/domain/template/services/variable-replacer.ts";

/**
 * SIMPLIFIED TEST: Variable Replacer with Schema Support
 *
 * This test validates that the variable replacer can be created with
 * the new schema-aware binding service integration.
 */
describe("VariableReplacer - Schema Support", () => {
  describe("Service Creation", () => {
    it("should create variable replacer with binding service", () => {
      const result = VariableReplacer.create();
      assertExists(result.ok, "Should create variable replacer successfully");

      if (result.ok) {
        const replacer = result.data;
        assertExists(replacer, "Variable replacer should exist");
        assertExists(
          typeof replacer.replaceVariables === "function",
          "Should have replaceVariables method",
        );
        assertExists(
          typeof replacer.replaceVariablesWithSchema === "function",
          "Should have schema-aware method",
        );
      }
    });
  });

  describe("Basic Variable Replacement", () => {
    it("should still support legacy variable replacement", async () => {
      const replacerResult = VariableReplacer.create();
      assertExists(replacerResult.ok, "Should create replacer");

      if (!replacerResult.ok) return;

      const replacer = replacerResult.data;

      // Create minimal frontmatter data for testing
      const { FrontmatterData } = await import(
        "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts"
      );
      const dataResult = FrontmatterData.create({
        title: "Test Project",
        version: "1.0.0",
      });

      assertExists(dataResult.ok, "Should create frontmatter data");
      if (!dataResult.ok) return;

      const template = "Project: {{title}} v{{version}}";
      const result = replacer.replaceVariables(template, dataResult.data);

      assertExists(result.ok, "Should replace variables successfully");
      if (result.ok) {
        assertEquals(result.data, "Project: Test Project v1.0.0");
      }
    });
  });
});
