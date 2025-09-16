/**
 * Unit tests for TemplateStructure value objects
 * Following DDD, TDD, and Totality testing principles
 *
 * Test coverage for:
 * - TemplateStructure
 * - ArrayExpansionKey
 * - VariableReference
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  ArrayExpansionKey,
  TemplateStructure,
  VariableReference,
} from "../../../../../src/domain/template/value-objects/template-structure.ts";

describe("TemplateStructure", () => {
  describe("create", () => {
    it("should create valid template structure with all components", () => {
      // Arrange
      const arrayKeyResult = ArrayExpansionKey.create(
        "@items",
        "{@items}",
        "commands[]",
      );
      const variableResult = VariableReference.create(
        "{{title}}",
        "title",
        0,
      );

      assertEquals(arrayKeyResult.ok, true);
      assertEquals(variableResult.ok, true);

      if (!arrayKeyResult.ok || !variableResult.ok) return;

      const arrayKeys = [arrayKeyResult.data];
      const variables = [variableResult.data];
      const staticContent = ["header", "footer"];

      // Act
      const result = TemplateStructure.create(
        arrayKeys,
        variables,
        staticContent,
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const structure = result.data;
      assertEquals(structure.hasArrayExpansions(), true);
      assertEquals(structure.hasVariableReferences(), true);
      assertEquals(structure.getArrayExpansionKeys().length, 1);
      assertEquals(structure.getVariableReferences().length, 1);
      assertEquals(structure.getStaticContent().length, 2);
    });

    it("should create template structure with no array expansions", () => {
      // Arrange
      const variableResult = VariableReference.create(
        "{{version}}",
        "version",
        0,
      );

      assertEquals(variableResult.ok, true);
      if (!variableResult.ok) return;

      const variables = [variableResult.data];
      const staticContent = ["static text"];

      // Act
      const result = TemplateStructure.create(
        [],
        variables,
        staticContent,
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const structure = result.data;
      assertEquals(structure.hasArrayExpansions(), false);
      assertEquals(structure.hasVariableReferences(), true);
      assertEquals(structure.getArrayExpansionKeys().length, 0);
    });

    it("should create template structure with no variable references", () => {
      // Arrange
      const arrayKeyResult = ArrayExpansionKey.create(
        "@commands",
        "{@commands}",
        "commands",
      );

      assertEquals(arrayKeyResult.ok, true);
      if (!arrayKeyResult.ok) return;

      const arrayKeys = [arrayKeyResult.data];
      const staticContent = ["template content"];

      // Act
      const result = TemplateStructure.create(
        arrayKeys,
        [],
        staticContent,
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const structure = result.data;
      assertEquals(structure.hasArrayExpansions(), true);
      assertEquals(structure.hasVariableReferences(), false);
      assertEquals(structure.getVariableReferences().length, 0);
    });

    it("should create empty template structure", () => {
      // Act
      const result = TemplateStructure.create([], [], []);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const structure = result.data;
      assertEquals(structure.hasArrayExpansions(), false);
      assertEquals(structure.hasVariableReferences(), false);
      assertEquals(structure.getArrayExpansionKeys().length, 0);
      assertEquals(structure.getVariableReferences().length, 0);
      assertEquals(structure.getStaticContent().length, 0);
    });

    it("should reject template with duplicate array expansion keys", () => {
      // Arrange
      const arrayKey1Result = ArrayExpansionKey.create(
        "@items",
        "{@items}",
        "commands",
      );
      const arrayKey2Result = ArrayExpansionKey.create(
        "@items", // Duplicate key
        "{@items}",
        "other_path",
      );

      assertEquals(arrayKey1Result.ok, true);
      assertEquals(arrayKey2Result.ok, true);

      if (!arrayKey1Result.ok || !arrayKey2Result.ok) return;

      const arrayKeys = [arrayKey1Result.data, arrayKey2Result.data];

      // Act
      const result = TemplateStructure.create(arrayKeys, [], []);

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "TemplateStructureInvalid");
      if (result.error.kind === "TemplateStructureInvalid") {
        assertEquals(
          result.error.issue,
          "Duplicate array expansion keys detected",
        );
      }
    });
  });

  describe("immutability", () => {
    it("should return defensive copies of internal arrays", () => {
      // Arrange
      const arrayKeyResult = ArrayExpansionKey.create(
        "@items",
        "{@items}",
        "commands",
      );
      const variableResult = VariableReference.create(
        "{{title}}",
        "title",
        0,
      );

      assertEquals(arrayKeyResult.ok, true);
      assertEquals(variableResult.ok, true);

      if (!arrayKeyResult.ok || !variableResult.ok) return;

      const result = TemplateStructure.create(
        [arrayKeyResult.data],
        [variableResult.data],
        ["static"],
      );

      assertEquals(result.ok, true);
      if (!result.ok) return;

      const structure = result.data;

      // Act - Modify returned arrays
      const arrayKeys = structure.getArrayExpansionKeys();
      const variables = structure.getVariableReferences();
      const staticContent = structure.getStaticContent();

      arrayKeys.push(arrayKeyResult.data);
      variables.push(variableResult.data);
      staticContent.push("modified");

      // Assert - Original structure should be unchanged
      assertEquals(structure.getArrayExpansionKeys().length, 1);
      assertEquals(structure.getVariableReferences().length, 1);
      assertEquals(structure.getStaticContent().length, 1);
    });
  });
});

describe("ArrayExpansionKey", () => {
  describe("create", () => {
    it("should create valid array expansion key", () => {
      // Act
      const result = ArrayExpansionKey.create(
        "@items",
        "{@items}",
        "commands[]",
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const key = result.data;
      assertEquals(key.templateKey, "@items");
      assertEquals(key.expansionMarker, "{@items}");
      assertEquals(key.targetPath, "commands[]");
    });

    it("should create key with empty target path", () => {
      // Act
      const result = ArrayExpansionKey.create(
        "@root",
        "{@root}",
        "",
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.targetPath, "");
    });

    it("should reject empty template key", () => {
      // Act
      const result = ArrayExpansionKey.create(
        "",
        "{@items}",
        "commands",
      );

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "TemplateStructureInvalid");
      if (result.error.kind === "TemplateStructureInvalid") {
        assertEquals(result.error.issue, "Template key cannot be empty");
      }
    });

    it("should reject whitespace-only template key", () => {
      // Act
      const result = ArrayExpansionKey.create(
        "   ",
        "{@items}",
        "commands",
      );

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "TemplateStructureInvalid");
      if (result.error.kind === "TemplateStructureInvalid") {
        assertEquals(result.error.issue, "Template key cannot be empty");
      }
    });

    it("should reject empty expansion marker", () => {
      // Act
      const result = ArrayExpansionKey.create(
        "@items",
        "",
        "commands",
      );

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "TemplateStructureInvalid");
      if (result.error.kind === "TemplateStructureInvalid") {
        assertEquals(result.error.issue, "Expansion marker cannot be empty");
      }
    });

    it("should reject whitespace-only expansion marker", () => {
      // Act
      const result = ArrayExpansionKey.create(
        "@items",
        "   ",
        "commands",
      );

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "TemplateStructureInvalid");
      if (result.error.kind === "TemplateStructureInvalid") {
        assertEquals(result.error.issue, "Expansion marker cannot be empty");
      }
    });
  });
});

describe("VariableReference", () => {
  describe("create", () => {
    it("should create valid variable reference", () => {
      // Act
      const result = VariableReference.create(
        "{{title}}",
        "title",
        42,
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const variable = result.data;
      assertEquals(variable.placeholder, "{{title}}");
      assertEquals(variable.variablePath, "title");
      assertEquals(variable.position, 42);
    });

    it("should create variable reference at position 0", () => {
      // Act
      const result = VariableReference.create(
        "{{version}}",
        "version",
        0,
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.position, 0);
    });

    it("should reject empty placeholder", () => {
      // Act
      const result = VariableReference.create(
        "",
        "title",
        0,
      );

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "TemplateStructureInvalid");
      if (result.error.kind === "TemplateStructureInvalid") {
        assertEquals(result.error.issue, "Placeholder cannot be empty");
      }
    });

    it("should reject whitespace-only placeholder", () => {
      // Act
      const result = VariableReference.create(
        "   ",
        "title",
        0,
      );

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "TemplateStructureInvalid");
      if (result.error.kind === "TemplateStructureInvalid") {
        assertEquals(result.error.issue, "Placeholder cannot be empty");
      }
    });

    it("should reject empty variable path", () => {
      // Act
      const result = VariableReference.create(
        "{{title}}",
        "",
        0,
      );

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "TemplateStructureInvalid");
      if (result.error.kind === "TemplateStructureInvalid") {
        assertEquals(result.error.issue, "Variable path cannot be empty");
      }
    });

    it("should reject whitespace-only variable path", () => {
      // Act
      const result = VariableReference.create(
        "{{title}}",
        "   ",
        0,
      );

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "TemplateStructureInvalid");
      if (result.error.kind === "TemplateStructureInvalid") {
        assertEquals(result.error.issue, "Variable path cannot be empty");
      }
    });

    it("should reject negative position", () => {
      // Act
      const result = VariableReference.create(
        "{{title}}",
        "title",
        -1,
      );

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "TemplateStructureInvalid");
      if (result.error.kind === "TemplateStructureInvalid") {
        assertEquals(result.error.issue, "Position cannot be negative");
      }
    });
  });
});
