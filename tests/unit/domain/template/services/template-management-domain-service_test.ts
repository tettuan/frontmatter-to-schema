import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { TemplateManagementDomainService } from "../../../../../src/domain/template/services/template-management-domain-service.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { err, ok } from "../../../../../src/domain/shared/types/result.ts";
import { createError } from "../../../../../src/domain/shared/types/errors.ts";

// Test helpers for reproducibility
class MockFileReader {
  constructor(private mockFiles: Map<string, string> = new Map()) {}

  read(path: string) {
    const content = this.mockFiles.get(path);
    if (content === undefined) {
      return err(createError({
        kind: "FileNotFound",
        path,
      }));
    }
    return ok(content);
  }

  setMockFile(path: string, content: string) {
    this.mockFiles.set(path, content);
  }
}

// Test fixtures
const createTestSchema = () => {
  const definition = SchemaDefinition.create({
    type: "object",
    properties: {
      // Add x-frontmatter-part directive as boolean marker to the title property
      title: { type: "string", "x-frontmatter-part": true },
      "x-template": { type: "string" },
      "x-template-format": { type: "string" },
    },
  });
  const path = SchemaPath.create("template-test-schema.json");

  if (!definition.ok) throw new Error("Failed to create schema definition");
  if (!path.ok) throw new Error("Failed to create schema path");

  return Schema.create(path.data, definition.data);
};

const createSimpleTemplate = () =>
  `# {{title}}

Author: {{author}}
Date: {{date}}

{{content}}
`;

describe("TemplateManagementDomainService", () => {
  describe("Domain Service Creation", () => {
    it("should create service successfully with valid dependencies", () => {
      const fileReader = new MockFileReader();

      const result = TemplateManagementDomainService.create(fileReader);

      assertEquals(result.ok, true);
      assertExists(result.ok && result.data);
    });
  });

  describe("Template Configuration Extraction", () => {
    it("should extract template configuration from schema successfully", () => {
      const fileReader = new MockFileReader();

      // Create schema with inline template
      const definition = SchemaDefinition.create({
        type: "object",
        properties: {
          title: { type: "string" },
          "x-template": {
            type: "string",
            default: createSimpleTemplate(),
          },
        },
      });

      assertEquals(definition.ok, true);

      if (definition.ok) {
        const path = SchemaPath.create("test-schema.json");
        if (!path.ok) throw new Error("Failed to create schema path");

        const schema = Schema.create(path.data, definition.data);
        assertEquals(schema.ok, true);

        if (schema.ok) {
          const serviceResult = TemplateManagementDomainService.create(
            fileReader,
          );
          assertEquals(serviceResult.ok, true);

          if (serviceResult.ok) {
            const service = serviceResult.data;

            const extractResult = service.extractTemplateConfiguration(
              schema.data,
            );
            assertEquals(extractResult.ok, true);
            assertEquals(service.hasResolvedConfiguration(), false); // Not resolved yet, only extracted
          }
        }
      }
    });

    it("should handle missing x-template directive", () => {
      const fileReader = new MockFileReader();

      const serviceResult = TemplateManagementDomainService.create(fileReader);
      const schemaResult = createTestSchema(); // This schema doesn't have x-template with default

      assertEquals(serviceResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (serviceResult.ok && schemaResult.ok) {
        const service = serviceResult.data;
        const schema = schemaResult.data;

        const extractResult = service.extractTemplateConfiguration(schema);

        assertEquals(extractResult.ok, false);
        if (!extractResult.ok) {
          assertEquals(extractResult.error.kind, "ConfigurationError");
        }
      }
    });
  });

  describe("Template Access", () => {
    it("should provide access to extracted template content", async () => {
      const fileReader = new MockFileReader();

      // Create schema with inline template
      const definition = SchemaDefinition.create({
        type: "object",
        properties: {
          title: { type: "string" },
          "x-template": {
            type: "string",
            default: createSimpleTemplate(),
          },
        },
      });

      assertEquals(definition.ok, true);

      if (definition.ok) {
        const path = SchemaPath.create("test-schema.json");
        if (!path.ok) throw new Error("Failed to create schema path");

        const schema = Schema.create(path.data, definition.data);
        assertEquals(schema.ok, true);

        if (schema.ok) {
          const serviceResult = TemplateManagementDomainService.create(
            fileReader,
          );
          assertEquals(serviceResult.ok, true);

          if (serviceResult.ok) {
            const service = serviceResult.data;

            // Extract configuration
            const extractResult = service.extractTemplateConfiguration(
              schema.data,
            );
            assertEquals(extractResult.ok, true);

            // Try to get template without resolving - should fail
            const templateResult1 = service.getMainTemplate();
            assertEquals(templateResult1.ok, false);

            // Resolve template files
            const resolveResult = await service.resolveTemplateFiles();
            assertEquals(resolveResult.ok, true);

            // Now should be able to get template
            const templateResult2 = service.getMainTemplate();
            assertEquals(templateResult2.ok, true);

            if (templateResult2.ok) {
              const template = templateResult2.data;
              assertEquals(template.includes("{{title}}"), true);
              assertEquals(template.includes("{{author}}"), true);
            }
          }
        }
      }
    });

    it("should handle template access without resolution", () => {
      const fileReader = new MockFileReader();

      const serviceResult = TemplateManagementDomainService.create(fileReader);
      assertEquals(serviceResult.ok, true);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        // Try to get template without extracting configuration first
        const templateResult = service.getMainTemplate();

        assertEquals(templateResult.ok, false);
        if (!templateResult.ok) {
          assertEquals(templateResult.error.kind, "InitializationError");
        }
      }
    });
  });

  describe("Template Processing with x-directives", () => {
    it("should process x-template directive from schema", async () => {
      const fileReader = new MockFileReader();

      // Create schema with inline template
      const definition = SchemaDefinition.create({
        type: "object",
        properties: {
          title: { type: "string" },
          "x-template": {
            type: "string",
            default: "# {{title}}\n\nContent: {{content}}",
          },
        },
      });

      assertEquals(definition.ok, true);

      if (definition.ok) {
        const path = SchemaPath.create("inline-template-schema.json");
        if (!path.ok) throw new Error("Failed to create schema path");

        const schema = Schema.create(path.data, definition.data);

        assertEquals(schema.ok, true);

        if (schema.ok) {
          const serviceResult = TemplateManagementDomainService.create(
            fileReader,
          );
          assertEquals(serviceResult.ok, true);

          if (serviceResult.ok) {
            const service = serviceResult.data;

            // Extract template configuration from schema (x-template directive)
            const extractResult = service.extractTemplateConfiguration(
              schema.data,
            );
            assertEquals(extractResult.ok, true);

            // Resolve template files
            const resolveResult = await service.resolveTemplateFiles();
            assertEquals(resolveResult.ok, true);

            // Get main template
            const templateResult = service.getMainTemplate();
            assertEquals(templateResult.ok, true);

            if (templateResult.ok) {
              const template = templateResult.data;
              assertEquals(template.includes("{{title}}"), true);
              assertEquals(template.includes("{{content}}"), true);
            }
          }
        }
      }
    });

    it("should handle x-template-format directive", async () => {
      const fileReader = new MockFileReader();

      // Create schema with template format specification
      const definition = SchemaDefinition.create({
        type: "object",
        properties: {
          title: { type: "string" },
          "x-template": { type: "string", default: "{{title}}: {{value}}" },
          "x-template-format": { type: "string", default: "yaml" },
        },
      });

      assertEquals(definition.ok, true);

      if (definition.ok) {
        const path = SchemaPath.create("template-format-schema.json");
        if (!path.ok) throw new Error("Failed to create schema path");

        const schema = Schema.create(path.data, definition.data);

        assertEquals(schema.ok, true);

        if (schema.ok) {
          const serviceResult = TemplateManagementDomainService.create(
            fileReader,
          );
          assertEquals(serviceResult.ok, true);

          if (serviceResult.ok) {
            const service = serviceResult.data;

            // Extract template configuration from schema
            const extractResult = service.extractTemplateConfiguration(
              schema.data,
            );
            assertEquals(extractResult.ok, true);

            // Resolve template files
            const resolveResult = await service.resolveTemplateFiles();
            assertEquals(resolveResult.ok, true);

            // Get format specification
            const formatResult = service.getOutputFormat();
            assertEquals(formatResult.ok, true);

            if (formatResult.ok) {
              assertEquals(formatResult.data, "yaml");
            }
          }
        }
      }
    });
  });

  describe("Domain Boundary Protection", () => {
    it("should maintain template integrity across operations", async () => {
      const fileReader = new MockFileReader();

      // Create schema with inline template
      const definition = SchemaDefinition.create({
        type: "object",
        properties: {
          title: { type: "string" },
          "x-template": {
            type: "string",
            default: createSimpleTemplate(),
          },
        },
      });

      assertEquals(definition.ok, true);

      if (definition.ok) {
        const path = SchemaPath.create("test-schema.json");
        if (!path.ok) throw new Error("Failed to create schema path");

        const schema = Schema.create(path.data, definition.data);
        assertEquals(schema.ok, true);

        if (schema.ok) {
          const serviceResult = TemplateManagementDomainService.create(
            fileReader,
          );
          assertEquals(serviceResult.ok, true);

          if (serviceResult.ok) {
            const service = serviceResult.data;

            // Extract and resolve configuration
            const extractResult = service.extractTemplateConfiguration(
              schema.data,
            );
            assertEquals(extractResult.ok, true);

            const resolveResult = await service.resolveTemplateFiles();
            assertEquals(resolveResult.ok, true);

            // Multiple template access operations should be consistent
            const templateResult1 = service.getMainTemplate();
            const templateResult2 = service.getMainTemplate();

            assertEquals(templateResult1.ok, true);
            assertEquals(templateResult2.ok, true);

            if (templateResult1.ok && templateResult2.ok) {
              // Both should return the same template content
              assertEquals(templateResult1.data, templateResult2.data);
              assertEquals(templateResult1.data.includes("{{title}}"), true);
              assertEquals(templateResult2.data.includes("{{author}}"), true);
            }
          }
        }
      }
    });

    it("should handle configuration changes correctly", async () => {
      const fileReader = new MockFileReader();

      const serviceResult = TemplateManagementDomainService.create(fileReader);
      assertEquals(serviceResult.ok, true);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        // Create first schema with template
        const definition1 = SchemaDefinition.create({
          type: "object",
          properties: {
            title: { type: "string" },
            "x-template": {
              type: "string",
              default: "# Template 1: {{title}}",
            },
          },
        });

        assertEquals(definition1.ok, true);

        if (definition1.ok) {
          const path1 = SchemaPath.create("schema1.json");
          if (!path1.ok) throw new Error("Failed to create schema path");

          const schema1 = Schema.create(path1.data, definition1.data);
          assertEquals(schema1.ok, true);

          if (schema1.ok) {
            // Extract first configuration
            const extractResult1 = service.extractTemplateConfiguration(
              schema1.data,
            );
            assertEquals(extractResult1.ok, true);

            const resolveResult1 = await service.resolveTemplateFiles();
            assertEquals(resolveResult1.ok, true);

            const templateResult1 = service.getMainTemplate();
            assertEquals(templateResult1.ok, true);

            // Create second schema with different template
            const definition2 = SchemaDefinition.create({
              type: "object",
              properties: {
                title: { type: "string" },
                "x-template": {
                  type: "string",
                  default: "# Template 2: {{title}}",
                },
              },
            });

            assertEquals(definition2.ok, true);

            if (definition2.ok) {
              const path2 = SchemaPath.create("schema2.json");
              if (!path2.ok) throw new Error("Failed to create schema path 2");

              const schema2 = Schema.create(path2.data, definition2.data);
              assertEquals(schema2.ok, true);

              if (schema2.ok) {
                // Extract second configuration (should replace first)
                const extractResult2 = service.extractTemplateConfiguration(
                  schema2.data,
                );
                assertEquals(extractResult2.ok, true);

                const resolveResult2 = await service.resolveTemplateFiles();
                assertEquals(resolveResult2.ok, true);

                const templateResult2 = service.getMainTemplate();
                assertEquals(templateResult2.ok, true);

                if (templateResult1.ok && templateResult2.ok) {
                  assertEquals(
                    templateResult1.data.includes("Template 1"),
                    true,
                  );
                  assertEquals(
                    templateResult2.data.includes("Template 2"),
                    true,
                  );
                  assertEquals(
                    templateResult2.data.includes("Template 1"),
                    false,
                  );
                }
              }
            }
          }
        }
      }
    });
  });
});
