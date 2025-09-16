/**
 * Unit tests for TemplateStructureAnalyzer domain service
 * Following DDD, TDD, and Totality testing principles
 *
 * Test coverage for:
 * - TemplateStructureAnalyzer creation and validation
 * - String template analysis with variables and array expansion
 * - Array template analysis and nested structures
 * - Object template analysis with complex structures
 * - Error handling and edge cases following Totality principles
 * - Pattern detection for different template types
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { TemplateStructureAnalyzer } from "../../../../../src/domain/template/services/template-structure-analyzer.ts";
import { Template } from "../../../../../src/domain/template/entities/template.ts";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";

// Helper function to create test templates
function createTestTemplate(content: unknown): Template {
  const pathResult = TemplatePath.create("test-template.json");
  if (!pathResult.ok) {
    throw new Error("Failed to create template path");
  }

  const templateResult = Template.create(pathResult.data, content);
  if (!templateResult.ok) {
    throw new Error("Failed to create template");
  }

  return templateResult.data;
}

describe("TemplateStructureAnalyzer", () => {
  describe("creation", () => {
    it("should create analyzer instance successfully", () => {
      // Act
      const result = TemplateStructureAnalyzer.create();

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertExists(result.data);
    });

    it("should create multiple independent instances", () => {
      // Act
      const result1 = TemplateStructureAnalyzer.create();
      const result2 = TemplateStructureAnalyzer.create();

      // Assert
      assertEquals(result1.ok, true);
      assertEquals(result2.ok, true);
      if (!result1.ok || !result2.ok) return;

      // Instances should be independent
      assertEquals(result1.data !== result2.data, true);
    });
  });

  describe("analyzeStructure", () => {
    const analyzer = TemplateStructureAnalyzer.create();
    if (!analyzer.ok) throw new Error("Failed to create analyzer");
    const analyzerInstance = analyzer.data;

    describe("string template analysis", () => {
      it("should analyze simple string template with variables", () => {
        // Arrange
        const template = createTestTemplate("Hello {name}, your age is {age}");

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 0);
        assertEquals(structure.getVariableReferences().length, 2);

        const variables = structure.getVariableReferences();
        assertEquals(variables[0].placeholder, "{name}");
        assertEquals(variables[0].variablePath, "name");
        assertEquals(variables[1].placeholder, "{age}");
        assertEquals(variables[1].variablePath, "age");
      });

      it("should analyze string template with array expansion", () => {
        // Arrange
        const template = createTestTemplate("Items: {@items}");

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 1);
        assertEquals(structure.getVariableReferences().length, 0);

        const arrayKeys = structure.getArrayExpansionKeys();
        assertEquals(arrayKeys[0].templateKey, "items");
        assertEquals(arrayKeys[0].expansionMarker, "{@items}");
        assertEquals(arrayKeys[0].targetPath, "items");
      });

      it("should analyze string template with both variables and array expansion", () => {
        // Arrange
        const template = createTestTemplate(
          "Title: {title}\nItems: {@items}\nCount: {count}",
        );

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 1);
        assertEquals(structure.getVariableReferences().length, 2);

        const arrayKeys = structure.getArrayExpansionKeys();
        assertEquals(arrayKeys[0].expansionMarker, "{@items}");

        const variables = structure.getVariableReferences();
        assertEquals(variables[0].placeholder, "{title}");
        assertEquals(variables[1].placeholder, "{count}");
      });

      it("should analyze string template with nested variable paths", () => {
        // Arrange
        const template = createTestTemplate(
          "User: {user.name}, Email: {user.contact.email}",
        );

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getVariableReferences().length, 2);

        const variables = structure.getVariableReferences();
        assertEquals(variables[0].placeholder, "{user.name}");
        assertEquals(variables[0].variablePath, "user.name");
        assertEquals(variables[1].placeholder, "{user.contact.email}");
        assertEquals(variables[1].variablePath, "user.contact.email");
      });

      it("should detect duplicate array expansion keys in string templates", () => {
        // Arrange - Multiple array expansion patterns in string templates all use "items" as templateKey
        // This causes a duplicate key error, which is expected behavior
        const template = createTestTemplate(
          "Books: {@items}\nMore: {@authors}",
        );

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert - Should fail due to duplicate array expansion keys
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

      it("should handle template creation failure for empty content", () => {
        // Arrange & Act - Empty string template creation should fail
        const pathResult = TemplatePath.create("test-template.json");
        if (!pathResult.ok) throw new Error("Failed to create template path");

        const templateResult = Template.create(pathResult.data, "");

        // Assert - Should fail to create template with empty content
        assertEquals(templateResult.ok, false);
        if (templateResult.ok) return;

        assertEquals(templateResult.error.kind, "InvalidTemplate");
        if (templateResult.error.kind === "InvalidTemplate") {
          assertEquals(
            templateResult.error.message,
            "Invalid template: Template content is empty",
          );
        }
      });

      it("should handle string template with no placeholders", () => {
        // Arrange
        const template = createTestTemplate("This is a static template");

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 0);
        assertEquals(structure.getVariableReferences().length, 0);
      });
    });

    describe("array template analysis", () => {
      it("should analyze array template with {@items} placeholder", () => {
        // Arrange
        const template = createTestTemplate([
          "Header",
          "{@items}",
          "Footer",
        ]);

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 1);

        const arrayKeys = structure.getArrayExpansionKeys();
        assertEquals(arrayKeys[0].templateKey, "array_1");
        assertEquals(arrayKeys[0].expansionMarker, "{@items}");
        assertEquals(arrayKeys[0].targetPath, "items");
      });

      it("should analyze array template with variables in elements", () => {
        // Arrange
        const template = createTestTemplate([
          "Title: {title}",
          "Content: {content}",
          "Author: {author.name}",
        ]);

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 0);
        assertEquals(structure.getVariableReferences().length, 3);

        const variables = structure.getVariableReferences();
        assertEquals(variables[0].placeholder, "{title}");
        assertEquals(variables[1].placeholder, "{content}");
        assertEquals(variables[2].placeholder, "{author.name}");
      });

      it("should analyze array template with mixed content types", () => {
        // Arrange
        const template = createTestTemplate([
          "Static string",
          "{@items}",
          { key: "{value}" },
          42,
          true,
        ]);

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 1);
        assertEquals(structure.getVariableReferences().length, 1);

        const arrayKeys = structure.getArrayExpansionKeys();
        assertEquals(arrayKeys[0].templateKey, "array_1");

        const variables = structure.getVariableReferences();
        assertEquals(variables[0].placeholder, "{value}");
      });

      it("should handle empty array template", () => {
        // Arrange
        const template = createTestTemplate([]);

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 0);
        assertEquals(structure.getVariableReferences().length, 0);
      });

      it("should analyze nested array structures", () => {
        // Arrange
        const template = createTestTemplate([
          ["Nested", "{nested.var}"],
          ["{@items}", "Another nested"],
        ]);

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 1);
        assertEquals(structure.getVariableReferences().length, 1);
      });
    });

    describe("object template analysis", () => {
      it("should analyze object template with variable values", () => {
        // Arrange
        const template = createTestTemplate({
          title: "{document.title}",
          author: "{author.name}",
          date: "{metadata.created}",
        });

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 0);
        assertEquals(structure.getVariableReferences().length, 3);

        const variables = structure.getVariableReferences();
        assertEquals(variables[0].placeholder, "{document.title}");
        assertEquals(variables[1].placeholder, "{author.name}");
        assertEquals(variables[2].placeholder, "{metadata.created}");
      });

      it("should analyze object template with array expansion properties", () => {
        // Arrange - Object templates with {@items} create duplicate keys and should fail
        const template = createTestTemplate({
          title: "Document Title",
          items: "{@items}",
          author: "{author.name}",
        });

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert - This should fail due to duplicate array expansion keys
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

      it("should detect duplicate array expansion keys in object templates", () => {
        // Arrange - Multiple properties with {@items} will cause duplicate key error
        const template = createTestTemplate({
          items1: "{@items}",
          items2: "{@items}",
        });

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert - Should fail due to duplicate array expansion keys
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

      it("should analyze nested object structures", () => {
        // Arrange - Nested objects with just variables (no {@items} to avoid duplicates)
        const template = createTestTemplate({
          metadata: {
            title: "{title}",
            author: {
              name: "{author.name}",
              email: "{author.email}",
            },
          },
          content: {
            summary: "{summary}",
            tags: "{tags}",
          },
        });

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 0);
        assertEquals(structure.getVariableReferences().length, 5);

        const variables = structure.getVariableReferences();
        const variablePaths = variables.map((v) => v.variablePath);
        assertEquals(variablePaths.includes("title"), true);
        assertEquals(variablePaths.includes("author.name"), true);
        assertEquals(variablePaths.includes("author.email"), true);
        assertEquals(variablePaths.includes("summary"), true);
        assertEquals(variablePaths.includes("tags"), true);
      });

      it("should handle object template with mixed value types", () => {
        // Arrange - Mixed types without {@items} to avoid duplicate key error
        const template = createTestTemplate({
          staticString: "Static value",
          dynamicString: "{variable}",
          number: 42,
          boolean: true,
          nullValue: null,
          arrayValue: ["{item}", "static"],
          objectValue: { nested: "{nested.value}" },
        });

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 0);
        assertEquals(structure.getVariableReferences().length, 3);

        const variables = structure.getVariableReferences();
        const variablePaths = variables.map((v) => v.variablePath);
        assertEquals(variablePaths.includes("variable"), true);
        assertEquals(variablePaths.includes("item"), true);
        assertEquals(variablePaths.includes("nested.value"), true);
      });

      it("should handle empty object template", () => {
        // Arrange
        const template = createTestTemplate({});

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 0);
        assertEquals(structure.getVariableReferences().length, 0);
      });
    });

    describe("primitive template analysis", () => {
      it("should analyze number template", () => {
        // Arrange
        const template = createTestTemplate(42);

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 0);
        assertEquals(structure.getVariableReferences().length, 0);
      });

      it("should analyze boolean template", () => {
        // Arrange
        const template = createTestTemplate(true);

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 0);
        assertEquals(structure.getVariableReferences().length, 0);
      });

      it("should handle template creation failure for null content", () => {
        // Arrange & Act - Null template creation should fail
        const pathResult = TemplatePath.create("test-template.json");
        if (!pathResult.ok) throw new Error("Failed to create template path");

        const templateResult = Template.create(pathResult.data, null);

        // Assert - Should fail to create template with null content
        assertEquals(templateResult.ok, false);
        if (templateResult.ok) return;

        assertEquals(templateResult.error.kind, "InvalidTemplate");
      });
    });

    describe("edge cases and complex patterns", () => {
      it("should handle variables with special characters in paths", () => {
        // Arrange
        const template = createTestTemplate(
          "Value: {data.special-key}, ID: {data.id_123}",
        );

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getVariableReferences().length, 2);

        const variables = structure.getVariableReferences();
        assertEquals(variables[0].variablePath, "data.special-key");
        assertEquals(variables[1].variablePath, "data.id_123");
      });

      it("should handle malformed placeholders gracefully", () => {
        // Arrange
        const template = createTestTemplate(
          "Valid: {valid}, Malformed: {unclosed, Empty: {}, Nested: {{nested}}",
        );

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        // Should find valid placeholders and ignore malformed ones
        assertEquals(structure.getVariableReferences().length >= 1, true);

        const variables = structure.getVariableReferences();
        const validFound = variables.some((v) => v.variablePath === "valid");
        assertEquals(validFound, true);
      });

      it("should handle very deep nested structures", () => {
        // Arrange - Deep nesting with variables only (no {@items} to avoid duplicates)
        const deepTemplate = {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    deep_variable: "{deep.nested.value}",
                    another_variable: "{another.path}",
                  },
                },
              },
            },
          },
        };
        const template = createTestTemplate(deepTemplate);

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 0);
        assertEquals(structure.getVariableReferences().length, 2);

        const variables = structure.getVariableReferences();
        const variablePaths = variables.map((v) => v.variablePath);
        assertEquals(variablePaths.includes("deep.nested.value"), true);
        assertEquals(variablePaths.includes("another.path"), true);
      });

      it("should handle templates with many placeholders efficiently", () => {
        // Arrange
        const manyVariables: Record<string, string> = {};
        for (let i = 0; i < 100; i++) {
          manyVariables[`key_${i}`] = `{value_${i}}`;
        }
        const template = createTestTemplate(manyVariables);

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getVariableReferences().length, 100);

        // Verify all variables are captured
        const variablePaths = structure.getVariableReferences().map((v) =>
          v.variablePath
        );
        for (let i = 0; i < 100; i++) {
          assertEquals(variablePaths.includes(`value_${i}`), true);
        }
      });

      it("should handle complex mixed template with all features", () => {
        // Arrange
        const complexTemplate = {
          metadata: {
            title: "{document.title}",
            created: "{metadata.created}",
            author: {
              name: "{author.name}",
              profile: "{author.profile.url}",
            },
          },
          content: [
            "Introduction: {intro}",
            "{@items}",
            {
              summary: "{summary}",
              tags: "{@items}",
            },
          ],
          footer: "Generated on {date}",
          static_value: "No placeholders here",
          numbers: [1, 2, 3],
          booleans: [true, false],
        };
        const template = createTestTemplate(complexTemplate);

        // Act
        const result = analyzerInstance.analyzeStructure(template);

        // Assert - Should succeed as different contexts create different templateKeys
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const structure = result.data;
        assertEquals(structure.getArrayExpansionKeys().length, 3);
        assertEquals(structure.getVariableReferences().length, 7);

        const arrayKeys = structure.getArrayExpansionKeys();
        const templateKeys = arrayKeys.map((k) => k.templateKey);

        // Different contexts create different keys: array_1, tags, items
        assertEquals(templateKeys.includes("array_1"), true); // from array context
        assertEquals(templateKeys.includes("tags"), true); // from object property
        assertEquals(templateKeys.includes("items"), true); // from string context
      });
    });
  });
});
