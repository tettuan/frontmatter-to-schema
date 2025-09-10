// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  isRegistry,
  type Registry,
  RegistryBuilder,
  type RegistryBuildingContext,
} from "../../../../src/domain/models/registry-builder.ts";
import type { Command } from "../../../../src/domain/core/command-types.ts";
import { createCommand } from "../../../../src/domain/core/command-types.ts";
import { DEFAULT_VALUES } from "../../../../src/domain/constants/index.ts";
import { isError, isOk } from "../../../../src/domain/core/result.ts";

describe("RegistryBuilder", () => {
  describe("create()", () => {
    it("should create a RegistryBuilder instance using smart constructor", () => {
      const result = RegistryBuilder.create();

      assertEquals(isOk(result), true);
      if (isOk(result)) {
        assertExists(result.data);
      }
    });

    it("should follow totality principle - always returns Result", () => {
      const result = RegistryBuilder.create();

      assertExists(result);
      assertEquals(typeof result.ok, "boolean");
    });
  });

  describe("buildRegistry()", () => {
    // Create mock commands using the createCommand function
    const createMockCommand = (c1: string, c2: string, c3: string) => {
      return createCommand({
        c1,
        c2,
        c3,
        description: `Test command for ${c1}`,
        usage: `${c1}-${c2} ${c3} default`,
        options: {},
      });
    };

    // Create minimal mock schema
    const createMockSchema = () => {
      return {
        getProperties: () => ({
          version: { type: "string" },
          description: { type: "string" },
          tools: { type: "object" },
        }),
        getRequiredFields: () => ["version", "description", "tools"],
        getDefinition: () => ({
          getRawDefinition: () => ({
            version: "1.0.0",
            properties: {},
            required: [],
          }),
        }),
      } as any; // Using any for mock
    };

    // Create minimal mock template
    const createMockTemplate = () => {
      return {
        applyRules: (data: any) => {
          // Simply return the data as-is for testing
          return data;
        },
      } as any; // Using any for mock
    };

    it("should build registry with default values when version and description not provided", async () => {
      const builderResult = RegistryBuilder.create();
      if (!isOk(builderResult)) {
        throw new Error("Failed to create builder");
      }

      const commands = [
        createMockCommand("climpt", "build", "test"),
        createMockCommand("climpt", "refactor", "ddd"),
        createMockCommand("climpt", "git", "merge"),
      ];

      const context: RegistryBuildingContext = {
        registrySchema: createMockSchema(),
        registryTemplate: createMockTemplate(),
      };

      const result = await builderResult.data.buildRegistry(commands, context);

      assertEquals(isOk(result), true);
      if (isOk(result)) {
        assertEquals(result.data.version, DEFAULT_VALUES.SCHEMA_VERSION);
        assertEquals(
          result.data.description,
          DEFAULT_VALUES.REGISTRY_DESCRIPTION,
        );
      }
    });

    it("should use provided version and description when specified", async () => {
      const builderResult = RegistryBuilder.create();
      if (!isOk(builderResult)) {
        throw new Error("Failed to create builder");
      }

      const commands = [
        createMockCommand("climpt", "build", "test"),
      ];

      const context: RegistryBuildingContext = {
        registrySchema: createMockSchema(),
        registryTemplate: createMockTemplate(),
        version: "2.0.0",
        description: "Custom registry description",
      };

      const result = await builderResult.data.buildRegistry(commands, context);

      assertEquals(isOk(result), true);
      if (isOk(result)) {
        assertEquals(result.data.version, "2.0.0");
        assertEquals(result.data.description, "Custom registry description");
      }
    });

    it("should extract unique c1 values for availableConfigs", async () => {
      const builderResult = RegistryBuilder.create();
      if (!isOk(builderResult)) {
        throw new Error("Failed to create builder");
      }

      const commands = [
        createMockCommand("climpt", "build", "test"),
        createMockCommand("climpt", "refactor", "ddd"),
        createMockCommand("registry", "create", "schema"),
        createMockCommand("registry", "validate", "template"),
        createMockCommand("climpt", "git", "merge"),
      ];

      const context: RegistryBuildingContext = {
        registrySchema: createMockSchema(),
        registryTemplate: createMockTemplate(),
      };

      const result = await builderResult.data.buildRegistry(commands, context);

      assertEquals(isOk(result), true);
      if (isOk(result)) {
        assertEquals(result.data.tools.availableConfigs.length, 2);
        assertEquals(result.data.tools.availableConfigs, [
          "climpt",
          "registry",
        ]);
      }
    });

    it("should handle empty commands array", async () => {
      const builderResult = RegistryBuilder.create();
      if (!isOk(builderResult)) {
        throw new Error("Failed to create builder");
      }

      const commands: Command[] = [];

      const context: RegistryBuildingContext = {
        registrySchema: createMockSchema(),
        registryTemplate: createMockTemplate(),
      };

      const result = await builderResult.data.buildRegistry(commands, context);

      assertEquals(isOk(result), true);
      if (isOk(result)) {
        assertEquals(result.data.tools.availableConfigs.length, 0);
        assertEquals(result.data.tools.commands.length, 0);
      }
    });

    it("should validate registry structure against schema", async () => {
      const builderResult = RegistryBuilder.create();
      if (!isOk(builderResult)) {
        throw new Error("Failed to create builder");
      }

      const commands = [
        createMockCommand("test", "command", "one"),
      ];

      // Create schema with additional required field that won't be satisfied
      const strictSchema = {
        getProperties: () => ({
          version: { type: "string" },
          description: { type: "string" },
          tools: { type: "object" },
          metadata: { type: "object" }, // Additional required field
        }),
        getRequiredFields:
          () => ["version", "description", "tools", "metadata"],
        getDefinition: () => ({
          getRawDefinition: () => ({
            version: "1.0.0",
            properties: {},
            required: [],
          }),
        }),
      } as any;

      const context: RegistryBuildingContext = {
        registrySchema: strictSchema,
        registryTemplate: createMockTemplate(),
      };

      const result = await builderResult.data.buildRegistry(commands, context);

      assertEquals(isError(result), true);
      if (isError(result)) {
        assertEquals(result.error.kind, "SchemaValidationFailed");
        assertExists(result.error.message);
      }
    });

    it("should validate final registry structure", async () => {
      const builderResult = RegistryBuilder.create();
      if (!isOk(builderResult)) {
        throw new Error("Failed to create builder");
      }

      const commands = [
        createMockCommand("test", "command", "one"),
      ];

      // Create a template that returns invalid structure
      const invalidTemplate = {
        applyRules: () => {
          // Return structure missing required fields
          return {
            tools: {
              availableConfigs: [],
              commands: [],
            },
            // Missing version and description
          };
        },
      } as any;

      const context: RegistryBuildingContext = {
        registrySchema: createMockSchema(),
        registryTemplate: invalidTemplate,
      };

      const result = await builderResult.data.buildRegistry(commands, context);

      assertEquals(isError(result), true);
      if (isError(result)) {
        assertEquals(result.error.kind, "SchemaValidationFailed");
        assertExists(result.error.message);
      }
    });
  });

  describe("isRegistry type guard", () => {
    it("should return true for valid Registry object", () => {
      const validRegistry: Registry = {
        version: "1.0.0",
        description: "Test registry",
        tools: {
          availableConfigs: ["config1", "config2"],
          commands: [],
        },
      };

      assertEquals(isRegistry(validRegistry), true);
    });

    it("should return false for invalid Registry objects", () => {
      const invalidCases = [
        null,
        undefined,
        42,
        "string",
        {},
        { version: "1.0.0" }, // Missing required fields
        { version: "1.0.0", description: "test" }, // Missing tools
        {
          version: "1.0.0",
          description: "test",
          tools: "invalid", // tools not an object
        },
        {
          version: "1.0.0",
          description: "test",
          tools: {
            availableConfigs: "not-an-array", // Should be array
            commands: [],
          },
        },
        {
          version: "1.0.0",
          description: "test",
          tools: {
            availableConfigs: [],
            commands: "not-an-array", // Should be array
          },
        },
      ];

      for (const invalidCase of invalidCases) {
        assertEquals(
          isRegistry(invalidCase),
          false,
          `Failed for: ${JSON.stringify(invalidCase)}`,
        );
      }
    });

    it("should validate all required fields", () => {
      const registryMissingVersion = {
        description: "Test",
        tools: { availableConfigs: [], commands: [] },
      };
      assertEquals(isRegistry(registryMissingVersion), false);

      const registryMissingDescription = {
        version: "1.0.0",
        tools: { availableConfigs: [], commands: [] },
      };
      assertEquals(isRegistry(registryMissingDescription), false);

      const registryMissingTools = {
        version: "1.0.0",
        description: "Test",
      };
      assertEquals(isRegistry(registryMissingTools), false);
    });
  });

  describe("Result<T,E> pattern compliance", () => {
    it("should always return Result type from create()", () => {
      const result = RegistryBuilder.create();

      assertExists(result);
      assertEquals("ok" in result, true);
      assertEquals("data" in result || "error" in result, true);
    });

    it("should always return Result type from buildRegistry()", async () => {
      const builderResult = RegistryBuilder.create();
      if (!isOk(builderResult)) {
        throw new Error("Failed to create builder");
      }

      const mockSchema = {
        getProperties: () => ({}),
        getRequiredFields: () => [],
        getDefinition: () => ({
          getRawDefinition: () => ({
            version: "1.0.0",
            properties: {},
            required: [],
          }),
        }),
      } as any;

      const mockTemplate = {
        applyRules: (data: any) => data,
      } as any;

      const context: RegistryBuildingContext = {
        registrySchema: mockSchema,
        registryTemplate: mockTemplate,
      };

      const result = await builderResult.data.buildRegistry([], context);

      assertExists(result);
      assertEquals("ok" in result, true);
      assertEquals("data" in result || "error" in result, true);
    });

    it("should handle errors gracefully", async () => {
      const builderResult = RegistryBuilder.create();
      if (!isOk(builderResult)) {
        throw new Error("Failed to create builder");
      }

      // Create a template that throws an error
      const errorTemplate = {
        applyRules: () => {
          throw new Error("Template processing error");
        },
      } as any;

      const mockSchema = {
        getProperties: () => ({}),
        getRequiredFields: () => [],
        getDefinition: () => ({
          getRawDefinition: () => ({
            version: "1.0.0",
            properties: {},
            required: [],
          }),
        }),
      } as any;

      const context: RegistryBuildingContext = {
        registrySchema: mockSchema,
        registryTemplate: errorTemplate,
      };

      const result = await builderResult.data.buildRegistry([], context);

      // Should return error Result, not throw
      assertEquals(isError(result), true);
      assertExists(result);
    });
  });

  describe("Schema and Template replacement", () => {
    it("should allow different schemas to be used", async () => {
      const builderResult = RegistryBuilder.create();
      if (!isOk(builderResult)) {
        throw new Error("Failed to create builder");
      }

      const command = createCommand({
        c1: "test",
        c2: "cmd",
        c3: "one",
        description: "Test command",
        usage: "test-cmd one default",
        options: {},
      });

      const commands = [command];

      const mockTemplate = {
        applyRules: (data: any) => data,
      } as any;

      // First schema
      const schema1 = {
        getProperties: () => ({ version: { type: "string" } }),
        getRequiredFields: () => ["version"],
        getDefinition: () => ({
          getRawDefinition: () => ({
            version: "1.0.0",
            properties: {},
            required: [],
          }),
        }),
      } as any;

      const context1: RegistryBuildingContext = {
        registrySchema: schema1,
        registryTemplate: mockTemplate,
        version: "1.0.0",
      };

      const result1 = await builderResult.data.buildRegistry(
        commands,
        context1,
      );
      assertEquals(isOk(result1), true);

      // Different schema
      const schema2 = {
        getProperties: () => ({
          version: { type: "string" },
          description: { type: "string" },
        }),
        getRequiredFields: () => ["version", "description"],
        getDefinition: () => ({
          getRawDefinition: () => ({
            version: "2.0.0",
            properties: {},
            required: [],
          }),
        }),
      } as any;

      const context2: RegistryBuildingContext = {
        registrySchema: schema2,
        registryTemplate: mockTemplate,
        version: "2.0.0",
      };

      const result2 = await builderResult.data.buildRegistry(
        commands,
        context2,
      );
      assertEquals(isOk(result2), true);

      // Results should have different versions
      if (isOk(result1) && isOk(result2)) {
        assertEquals(result1.data.version, "1.0.0");
        assertEquals(result2.data.version, "2.0.0");
      }
    });

    it("should allow different templates to be used", async () => {
      const builderResult = RegistryBuilder.create();
      if (!isOk(builderResult)) {
        throw new Error("Failed to create builder");
      }

      const command = createCommand({
        c1: "test",
        c2: "cmd",
        c3: "one",
        description: "Test command",
        usage: "test-cmd one default",
        options: {},
      });

      const commands = [command];

      const mockSchema = {
        getProperties: () => ({}),
        getRequiredFields: () => [],
        getDefinition: () => ({
          getRawDefinition: () => ({
            version: "1.0.0",
            properties: {},
            required: [],
          }),
        }),
      } as any;

      // Different templates
      const template1 = {
        applyRules: (data: any) => ({
          ...data,
          description: "Template 1 applied",
        }),
      } as any;

      const template2 = {
        applyRules: (data: any) => ({
          ...data,
          description: "Template 2 applied",
        }),
      } as any;

      const context1: RegistryBuildingContext = {
        registrySchema: mockSchema,
        registryTemplate: template1,
      };

      const result1 = await builderResult.data.buildRegistry(
        commands,
        context1,
      );
      assertEquals(isOk(result1), true);

      const context2: RegistryBuildingContext = {
        registrySchema: mockSchema,
        registryTemplate: template2,
      };

      const result2 = await builderResult.data.buildRegistry(
        commands,
        context2,
      );
      assertEquals(isOk(result2), true);

      // Both should work with different templates
      if (isOk(result1) && isOk(result2)) {
        assertEquals(result1.data.description, "Template 1 applied");
        assertEquals(result2.data.description, "Template 2 applied");
      }
    });
  });
});
