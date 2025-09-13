/**
 * ClimptConfigurationProvider Tests - Robust Test Implementation
 *
 * Following DDD and Totality principles for complete coverage
 * Addresses Issue #723: Test Coverage Below Target - CLI Services
 */

import { assertEquals, assertExists } from "@std/assert";
import { ClimptConfigurationProvider } from "../../../../../src/application/climpt/services/climpt-configuration.service.ts";

Deno.test("ClimptConfigurationProvider - Robust Test Suite", async (t) => {
  await t.step("Service Interface Implementation", async (t) => {
    await t.step("should implement ConfigurationProvider interface", () => {
      const provider = new ClimptConfigurationProvider();
      assertExists(provider, "Provider instance should be created");
      assertEquals(
        typeof provider.getSchema,
        "function",
        "Should have getSchema method",
      );
      assertEquals(
        typeof provider.getTemplate,
        "function",
        "Should have getTemplate method",
      );
      assertEquals(
        typeof provider.getPrompts,
        "function",
        "Should have getPrompts method",
      );
    });

    await t.step("should create instance with default parameters", () => {
      const provider = new ClimptConfigurationProvider();
      assertExists(provider, "Should create provider with defaults");
    });

    await t.step("should create instance with custom parameters", () => {
      const provider = new ClimptConfigurationProvider(
        "/custom/schema.json",
        "/custom/template.json",
        "/custom/extract.md",
        "/custom/map.md",
      );
      assertExists(provider, "Should create provider with custom paths");
    });
  });

  await t.step("getSchema Method - Successful Scenarios", async (t) => {
    await t.step(
      "should return default schema when no schemaPath provided",
      async () => {
        const provider = new ClimptConfigurationProvider();

        const schema = await provider.getSchema();

        assertEquals(typeof schema, "object", "Should return schema object");
        assertExists(schema.version, "Should have version field");
        assertExists(schema.description, "Should have description field");
        assertExists(schema.tools, "Should have tools field");
        assertExists(
          schema.tools.availableConfigs,
          "Should have availableConfigs",
        );
        assertExists(schema.tools.commands, "Should have commands array");
        assertEquals(
          Array.isArray(schema.tools.availableConfigs),
          true,
          "availableConfigs should be array",
        );
        assertEquals(
          Array.isArray(schema.tools.commands),
          true,
          "commands should be array",
        );
      },
    );

    await t.step(
      "should read schema from file when schemaPath provided",
      async () => {
        const mockSchemaContent = {
          version: "1.0.0",
          description: "Mock schema",
          tools: {
            availableConfigs: ["test", "mock"],
            commands: [{
              c1: "test",
              c2: "action",
              c3: "target",
              description: "Test command",
            }],
          },
        };

        const originalReadTextFile = Deno.readTextFile;

        try {
          // Mock Deno.readTextFile
          (Deno as unknown as Record<string, unknown>).readTextFile = (
            path: string,
          ) => {
            if (path === "/test/schema.json") {
              return Promise.resolve(JSON.stringify(mockSchemaContent));
            }
            throw new Error(`Unexpected file path: ${path}`);
          };

          const provider = new ClimptConfigurationProvider("/test/schema.json");
          const schema = await provider.getSchema();

          assertEquals(
            schema.version,
            "1.0.0",
            "Should return schema from file",
          );
          assertEquals(
            schema.description,
            "Mock schema",
            "Should have correct description",
          );
          assertEquals(
            schema.tools.availableConfigs.length,
            2,
            "Should have correct configs",
          );
          assertEquals(
            schema.tools.commands.length,
            1,
            "Should have correct commands",
          );
        } finally {
          (Deno as unknown as Record<string, unknown>).readTextFile =
            originalReadTextFile;
        }
      },
    );

    await t.step("should handle empty schema file", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = () => {
          return Promise.resolve("{}");
        };

        const provider = new ClimptConfigurationProvider("/empty/schema.json");
        const schema = await provider.getSchema();

        assertEquals(
          typeof schema,
          "object",
          "Should return object for empty schema",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });
  });

  await t.step("getTemplate Method - Successful Scenarios", async (t) => {
    await t.step(
      "should return default template when no templatePath provided",
      async () => {
        const provider = new ClimptConfigurationProvider();

        const template = await provider.getTemplate();

        assertEquals(
          typeof template,
          "object",
          "Should return template object",
        );
        assertExists(template.version, "Should have version field");
        assertExists(template.description, "Should have description field");
        assertExists(template.tools, "Should have tools field");
        assertEquals(
          Array.isArray(template.tools.availableConfigs),
          true,
          "Should have availableConfigs array",
        );
        assertEquals(
          Array.isArray(template.tools.commands),
          true,
          "Should have commands array",
        );
        assertEquals(
          template.tools.commands.length,
          0,
          "Default template should have empty commands",
        );
      },
    );

    await t.step(
      "should read template from file when templatePath provided",
      async () => {
        const mockTemplateContent = {
          version: "2.0.0",
          description: "Mock template",
          tools: {
            availableConfigs: ["build", "test", "deploy"],
            commands: [{
              c1: "build",
              c2: "compile",
              c3: "source",
              description: "Build command",
              usage: "build compile source --target=prod",
            }],
          },
        };

        const originalReadTextFile = Deno.readTextFile;

        try {
          (Deno as unknown as Record<string, unknown>).readTextFile = (
            path: string,
          ) => {
            if (path === "/test/template.json") {
              return Promise.resolve(JSON.stringify(mockTemplateContent));
            }
            throw new Error(`Unexpected file path: ${path}`);
          };

          const provider = new ClimptConfigurationProvider(
            undefined,
            "/test/template.json",
          );
          const template = await provider.getTemplate();

          assertEquals(
            template.version,
            "2.0.0",
            "Should return template from file",
          );
          assertEquals(
            template.description,
            "Mock template",
            "Should have correct description",
          );
          assertEquals(
            template.tools.availableConfigs.length,
            3,
            "Should have correct configs",
          );
          assertEquals(
            template.tools.commands.length,
            1,
            "Should have correct commands",
          );
          assertEquals(
            template.tools.commands[0].usage,
            "build compile source --target=prod",
            "Should preserve usage field",
          );
        } finally {
          (Deno as unknown as Record<string, unknown>).readTextFile =
            originalReadTextFile;
        }
      },
    );
  });

  await t.step("getPrompts Method - Successful Scenarios", async (t) => {
    await t.step("should read prompts from default paths", async () => {
      const originalReadTextFile = Deno.readTextFile;
      const readPaths: string[] = [];

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          readPaths.push(path);

          if (path === "scripts/prompts/extract_frontmatter.md") {
            return Promise.resolve(
              "# Extract Frontmatter Prompt\nExtract frontmatter from documents.",
            );
          }
          if (path === "scripts/prompts/map_to_schema.md") {
            return Promise.resolve(
              "# Map to Schema Prompt\nMap data to schema structure.",
            );
          }
          throw new Error(`Unexpected file path: ${path}`);
        };

        const provider = new ClimptConfigurationProvider();
        const prompts = await provider.getPrompts();

        assertEquals(readPaths.length, 2, "Should read both prompt files");
        assertEquals(
          readPaths.includes("scripts/prompts/extract_frontmatter.md"),
          true,
          "Should read extraction prompt",
        );
        assertEquals(
          readPaths.includes("scripts/prompts/map_to_schema.md"),
          true,
          "Should read mapping prompt",
        );

        assertExists(prompts.extractionPrompt, "Should have extraction prompt");
        assertExists(prompts.mappingPrompt, "Should have mapping prompt");
        assertEquals(
          prompts.extractionPrompt.includes("Extract frontmatter"),
          true,
          "Should contain extraction content",
        );
        assertEquals(
          prompts.mappingPrompt.includes("Map data to schema"),
          true,
          "Should contain mapping content",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should read prompts from custom paths", async () => {
      const originalReadTextFile = Deno.readTextFile;
      const readPaths: string[] = [];

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          readPaths.push(path);

          if (path === "/custom/extract.md") {
            return Promise.resolve("Custom extraction prompt content");
          }
          if (path === "/custom/map.md") {
            return Promise.resolve("Custom mapping prompt content");
          }
          throw new Error(`Unexpected file path: ${path}`);
        };

        const provider = new ClimptConfigurationProvider(
          undefined,
          undefined,
          "/custom/extract.md",
          "/custom/map.md",
        );
        const prompts = await provider.getPrompts();

        assertEquals(
          readPaths.length,
          2,
          "Should read both custom prompt files",
        );
        assertEquals(
          readPaths.includes("/custom/extract.md"),
          true,
          "Should read custom extraction prompt",
        );
        assertEquals(
          readPaths.includes("/custom/map.md"),
          true,
          "Should read custom mapping prompt",
        );

        assertEquals(
          prompts.extractionPrompt,
          "Custom extraction prompt content",
          "Should return custom extraction content",
        );
        assertEquals(
          prompts.mappingPrompt,
          "Custom mapping prompt content",
          "Should return custom mapping content",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });
  });

  await t.step("Error Handling Scenarios", async (t) => {
    await t.step("should handle schema file read errors", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = () => {
          return Promise.reject(new Error("File not found"));
        };

        const provider = new ClimptConfigurationProvider(
          "/nonexistent/schema.json",
        );

        let caughtError: Error | undefined;
        try {
          await provider.getSchema();
        } catch (error) {
          caughtError = error as Error;
        }

        assertExists(caughtError, "Should throw error for file read failure");
        assertEquals(
          caughtError.message,
          "File not found",
          "Should preserve original error message",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should handle invalid JSON in schema file", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = () => {
          return Promise.resolve("{ invalid json content");
        };

        const provider = new ClimptConfigurationProvider(
          "/invalid/schema.json",
        );

        let caughtError: Error | undefined;
        try {
          await provider.getSchema();
        } catch (error) {
          caughtError = error as Error;
        }

        assertExists(caughtError, "Should throw error for invalid JSON");
        assertEquals(
          caughtError instanceof SyntaxError,
          true,
          "Should be JSON syntax error",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should handle template file read errors", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = () => {
          return Promise.reject(new Error("Permission denied"));
        };

        const provider = new ClimptConfigurationProvider(
          undefined,
          "/restricted/template.json",
        );

        let caughtError: Error | undefined;
        try {
          await provider.getTemplate();
        } catch (error) {
          caughtError = error as Error;
        }

        assertExists(
          caughtError,
          "Should throw error for template read failure",
        );
        assertEquals(
          caughtError.message,
          "Permission denied",
          "Should preserve error message",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should handle prompt file read errors", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          if (path === "scripts/prompts/extract_frontmatter.md") {
            return Promise.reject(new Error("Extract prompt not found"));
          }
          return Promise.resolve("Some content");
        };

        const provider = new ClimptConfigurationProvider();

        let caughtError: Error | undefined;
        try {
          await provider.getPrompts();
        } catch (error) {
          caughtError = error as Error;
        }

        assertExists(caughtError, "Should throw error for prompt read failure");
        assertEquals(
          caughtError.message,
          "Extract prompt not found",
          "Should preserve error message",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });
  });

  await t.step("Default Schema Structure Validation", async (t) => {
    await t.step("should provide valid default schema structure", async () => {
      const provider = new ClimptConfigurationProvider();
      const schema = await provider.getSchema();

      // Validate schema structure matches ClimptRegistrySchema
      assertEquals(typeof schema.version, "string", "Version should be string");
      assertEquals(
        typeof schema.description,
        "string",
        "Description should be string",
      );

      assertExists(schema.tools, "Should have tools object");
      assertEquals(
        Array.isArray(schema.tools.availableConfigs),
        true,
        "availableConfigs should be array",
      );
      assertEquals(
        Array.isArray(schema.tools.commands),
        true,
        "commands should be array",
      );

      // Validate command structure
      if (schema.tools.commands.length > 0) {
        const command = schema.tools.commands[0];
        assertEquals(typeof command.c1, "string", "c1 should be string");
        assertEquals(typeof command.c2, "string", "c2 should be string");
        assertEquals(typeof command.c3, "string", "c3 should be string");
        assertEquals(
          typeof command.description,
          "string",
          "description should be string",
        );
      }
    });

    await t.step(
      "should provide valid default template structure",
      async () => {
        const provider = new ClimptConfigurationProvider();
        const template = await provider.getTemplate();

        // Validate template includes expected configurations
        assertEquals(
          template.tools.availableConfigs.includes("code"),
          true,
          "Should include code config",
        );
        assertEquals(
          template.tools.availableConfigs.includes("docs"),
          true,
          "Should include docs config",
        );
        assertEquals(
          template.tools.availableConfigs.includes("git"),
          true,
          "Should include git config",
        );
        assertEquals(
          template.tools.availableConfigs.includes("meta"),
          true,
          "Should include meta config",
        );
        assertEquals(
          template.tools.availableConfigs.includes("spec"),
          true,
          "Should include spec config",
        );
        assertEquals(
          template.tools.availableConfigs.includes("test"),
          true,
          "Should include test config",
        );

        assertEquals(
          template.description.includes("Climpt"),
          true,
          "Description should mention Climpt",
        );
        assertEquals(
          template.description.includes("MCP"),
          true,
          "Description should mention MCP",
        );
      },
    );
  });

  await t.step("Edge Cases and Complex Scenarios", async (t) => {
    await t.step("should handle very large schema files", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = () => {
          // Create large schema with many commands
          const largeSchema = {
            version: "1.0.0",
            description: "Large schema",
            tools: {
              availableConfigs: Array.from(
                { length: 100 },
                (_, i) => `config${i}`,
              ),
              commands: Array.from({ length: 1000 }, (_, i) => ({
                c1: `domain${i}`,
                c2: `action${i}`,
                c3: `target${i}`,
                description: `Command ${i} description`,
              })),
            },
          };
          return Promise.resolve(JSON.stringify(largeSchema));
        };

        const provider = new ClimptConfigurationProvider("/large/schema.json");
        const schema = await provider.getSchema();

        assertEquals(
          schema.tools.availableConfigs.length,
          100,
          "Should handle large configs array",
        );
        assertEquals(
          schema.tools.commands.length,
          1000,
          "Should handle large commands array",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should handle schema with special characters", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = () => {
          const specialSchema = {
            version: "1.0.0-α",
            description: "Schema with special chars: 你好 🚀 ñáéíóú",
            tools: {
              availableConfigs: [
                "config-with-dash",
                "config_with_underscore",
                "config.with.dots",
              ],
              commands: [{
                c1: "domain-α",
                c2: "action_β",
                c3: "target.γ",
                description: "Command with unicode: 🔧 ñáéíóú 中文",
              }],
            },
          };
          return Promise.resolve(JSON.stringify(specialSchema));
        };

        const provider = new ClimptConfigurationProvider(
          "/special/schema.json",
        );
        const schema = await provider.getSchema();

        assertEquals(
          schema.version,
          "1.0.0-α",
          "Should handle version with special chars",
        );
        assertEquals(
          schema.description.includes("🚀"),
          true,
          "Should handle emoji in description",
        );
        assertEquals(
          schema.tools.commands[0].description.includes("🔧"),
          true,
          "Should handle emoji in commands",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should handle concurrent method calls", async () => {
      const originalReadTextFile = Deno.readTextFile;
      let callCount = 0;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = async (
          path: string,
        ) => {
          callCount++;
          await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate async delay

          if (path.includes("schema")) {
            return JSON.stringify({
              version: "1.0.0",
              description: "Schema",
              tools: { availableConfigs: [], commands: [] },
            });
          }
          if (path.includes("template")) {
            return JSON.stringify({
              version: "1.0.0",
              description: "Template",
              tools: { availableConfigs: [], commands: [] },
            });
          }
          if (path.includes("extract")) {
            return "Extract prompt";
          }
          if (path.includes("map")) {
            return "Map prompt";
          }
          return Promise.resolve("{}");
        };

        const provider = new ClimptConfigurationProvider(
          "/test/schema.json",
          "/test/template.json",
        );

        // Call methods concurrently
        const [schema, template, prompts] = await Promise.all([
          provider.getSchema(),
          provider.getTemplate(),
          provider.getPrompts(),
        ]);

        assertExists(schema, "Should return schema");
        assertExists(template, "Should return template");
        assertExists(prompts, "Should return prompts");
        assertEquals(callCount, 4, "Should handle concurrent file reads");
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });
  });
});
