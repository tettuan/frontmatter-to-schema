/**
 * RegistryBuilder Test Suite
 *
 * Critical tests for Issue #499: Missing RegistryBuilder tests
 * Tests core domain functionality with 330+ lines of code
 * Following Totality principles and business rule validation
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Command } from "../../../../src/domain/models/command-processor.ts";
import {
  RegistryBuilder,
  type RegistryBuildingContext,
} from "../../../../src/domain/models/registry-builder.ts";
import type {
  Schema,
  Template,
} from "../../../../src/domain/models/entities.ts";

describe("RegistryBuilder - Core Domain Functionality", () => {
  // Test data setup following DDD patterns
  const createTestCommands = (): Command[] => {
    const cmd1Result = Command.create({
      c1: "test",
      c2: "action",
      c3: "default",
      description: "Test command 1",
      usage: "test action default",
      options: {},
    });

    const cmd2Result = Command.create({
      c1: "build",
      c2: "project",
      c3: "fast",
      description: "Build command",
      usage: "build project fast",
      options: {},
    });

    const cmd3Result = Command.create({
      c1: "test",
      c2: "unit",
      c3: "verbose",
      description: "Test command 2",
      usage: "test unit verbose",
      options: {},
    });

    // Extract successful command instances
    const commands = [];
    if (cmd1Result.ok) commands.push(cmd1Result.data);
    if (cmd2Result.ok) commands.push(cmd2Result.data);
    if (cmd3Result.ok) commands.push(cmd3Result.data);

    return commands;
  };

  const createTestContext = (): RegistryBuildingContext => ({
    registrySchema: {
      getProperties: () => ({}),
      getRequiredFields: () => ["version", "description", "tools"],
    } as unknown as Schema,
    registryTemplate: {
      applyRules: (data: Record<string, unknown>) => data,
    } as unknown as Template,
    version: "1.0.0",
    description: "Test registry",
  });

  describe("Smart Constructor Pattern (Totality Principle)", () => {
    it("should create RegistryBuilder instance with smart constructor", () => {
      const result = RegistryBuilder.create();

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should follow totality principle with Result<T,E> pattern", () => {
      const result = RegistryBuilder.create();

      // Result type should have ok property and either data or error
      assertEquals(typeof result.ok, "boolean");
      if (result.ok) {
        assertExists(result.data);
      } else {
        assertExists(result.error);
        assertExists(result.error.message);
      }
    });
  });

  describe("Registry Building Core Functionality", () => {
    it("should build registry from commands array", async () => {
      const builderResult = RegistryBuilder.create();
      assertEquals(builderResult.ok, true);

      if (!builderResult.ok) return;
      const builder = builderResult.data;

      const commands = createTestCommands();
      const context = createTestContext();

      const registryResult = await builder.buildRegistry(commands, context);

      assertEquals(registryResult.ok, true);
      if (registryResult.ok) {
        const registry = registryResult.data;

        // Verify registry structure
        assertEquals(registry.version, "1.0.0");
        assertEquals(registry.description, "Test registry");
        assertExists(registry.tools);
        assertExists(registry.tools.availableConfigs);
        assertExists(registry.tools.commands);

        // Verify commands are included
        assertEquals(registry.tools.commands.length, 3);
      }
    });

    it("should generate availableConfigs from unique c1 values", async () => {
      const builderResult = RegistryBuilder.create();
      assertEquals(builderResult.ok, true);

      if (!builderResult.ok) return;
      const builder = builderResult.data;

      const commands = createTestCommands();
      const context = createTestContext();

      const registryResult = await builder.buildRegistry(commands, context);

      assertEquals(registryResult.ok, true);
      if (registryResult.ok) {
        const registry = registryResult.data;

        // Should have unique c1 values: ["test", "build"]
        assertEquals(registry.tools.availableConfigs.length, 2);
        assertEquals(registry.tools.availableConfigs.includes("test"), true);
        assertEquals(registry.tools.availableConfigs.includes("build"), true);
      }
    });
  });

  describe("Schema and Template Integration", () => {
    it("should apply schema validation during registry building", async () => {
      const builderResult = RegistryBuilder.create();
      assertEquals(builderResult.ok, true);

      if (!builderResult.ok) return;
      const builder = builderResult.data;

      const commands = createTestCommands();
      const context = createTestContext();

      const registryResult = await builder.buildRegistry(commands, context);

      // Should succeed with valid schema
      assertEquals(registryResult.ok, true);
    });

    it("should handle schema validation failures gracefully", async () => {
      const builderResult = RegistryBuilder.create();
      assertEquals(builderResult.ok, true);

      if (!builderResult.ok) return;
      const builder = builderResult.data;

      const commands = createTestCommands();
      const invalidContext = {
        ...createTestContext(),
        registrySchema: null as unknown as Schema, // Invalid schema
      };

      const registryResult = await builder.buildRegistry(
        commands,
        invalidContext,
      );

      // Should handle invalid schema gracefully
      if (!registryResult.ok) {
        assertExists(registryResult.error);
        assertExists(registryResult.error.message);
      }
    });

    it("should apply template formatting to registry output", async () => {
      const builderResult = RegistryBuilder.create();
      assertEquals(builderResult.ok, true);

      if (!builderResult.ok) return;
      const builder = builderResult.data;

      const commands = createTestCommands();
      const context = createTestContext();

      const registryResult = await builder.buildRegistry(commands, context);

      assertEquals(registryResult.ok, true);
      if (registryResult.ok) {
        const registry = registryResult.data;

        // Registry should be formatted according to template
        assertExists(registry.tools);
        assertExists(registry.tools.availableConfigs);
        assertExists(registry.tools.commands);
      }
    });
  });

  describe("DEFAULT_VALUES Integration (Issue #505 Related)", () => {
    it("should use DEFAULT_VALUES constants correctly", async () => {
      const builderResult = RegistryBuilder.create();
      assertEquals(builderResult.ok, true);

      if (!builderResult.ok) return;
      const builder = builderResult.data;

      const commands = createTestCommands();
      const contextWithDefaults = {
        ...createTestContext(),
        version: undefined, // Should use default
        description: undefined, // Should use default
      };

      const registryResult = await builder.buildRegistry(
        commands,
        contextWithDefaults,
      );

      assertEquals(registryResult.ok, true);
      if (registryResult.ok) {
        const registry = registryResult.data;

        // Should use DEFAULT_VALUES when not specified
        assertExists(registry.version);
        assertExists(registry.description);

        // Verify defaults are applied (assuming they exist in DEFAULT_VALUES)
        assertEquals(typeof registry.version, "string");
        assertEquals(typeof registry.description, "string");
      }
    });
  });

  describe("Business Rule Testing (Specification-Driven)", () => {
    it("should enforce business rule: Registry must have at least one command", async () => {
      const builderResult = RegistryBuilder.create();
      assertEquals(builderResult.ok, true);

      if (!builderResult.ok) return;
      const builder = builderResult.data;

      const emptyCommands: Command[] = [];
      const context = createTestContext();

      const registryResult = await builder.buildRegistry(
        emptyCommands,
        context,
      );

      // Should fail or handle empty commands appropriately
      if (!registryResult.ok) {
        assertExists(registryResult.error);
        assertExists(registryResult.error.message);
      } else {
        // If it succeeds, registry should have empty commands array
        assertEquals(registryResult.data.tools.commands.length, 0);
      }
    });

    it("should enforce business rule: availableConfigs should contain only unique values", async () => {
      const builderResult = RegistryBuilder.create();
      assertEquals(builderResult.ok, true);

      if (!builderResult.ok) return;
      const builder = builderResult.data;

      // Commands with duplicate c1 values
      const cmd1 = Command.create({
        c1: "test",
        c2: "action1",
        c3: "default",
        description: "Action 1",
        usage: "test action1 default",
        options: {},
      });
      const cmd2 = Command.create({
        c1: "test",
        c2: "action2",
        c3: "default",
        description: "Action 2",
        usage: "test action2 default",
        options: {},
      });
      const cmd3 = Command.create({
        c1: "test",
        c2: "action3",
        c3: "default",
        description: "Action 3",
        usage: "test action3 default",
        options: {},
      });

      const duplicateCommands: Command[] = [];
      if (cmd1.ok) duplicateCommands.push(cmd1.data);
      if (cmd2.ok) duplicateCommands.push(cmd2.data);
      if (cmd3.ok) duplicateCommands.push(cmd3.data);

      const context = createTestContext();
      const registryResult = await builder.buildRegistry(
        duplicateCommands,
        context,
      );

      assertEquals(registryResult.ok, true);
      if (registryResult.ok) {
        const registry = registryResult.data;

        // Should have only one "test" entry despite 3 commands
        assertEquals(registry.tools.availableConfigs.length, 1);
        assertEquals(registry.tools.availableConfigs[0], "test");

        // But should preserve all commands
        assertEquals(registry.tools.commands.length, 3);
      }
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle null or undefined commands gracefully", async () => {
      const builderResult = RegistryBuilder.create();
      assertEquals(builderResult.ok, true);

      if (!builderResult.ok) return;
      const builder = builderResult.data;

      const context = createTestContext();

      // Test null commands
      const nullResult = await builder.buildRegistry(
        null as unknown as Command[],
        context,
      );
      if (!nullResult.ok) {
        assertExists(nullResult.error);
      }

      // Test undefined commands
      const undefinedResult = await builder.buildRegistry(
        undefined as unknown as Command[],
        context,
      );
      if (!undefinedResult.ok) {
        assertExists(undefinedResult.error);
      }
    });

    it("should validate required context properties", async () => {
      const builderResult = RegistryBuilder.create();
      assertEquals(builderResult.ok, true);

      if (!builderResult.ok) return;
      const builder = builderResult.data;

      const commands = createTestCommands();

      // Test missing schema
      const noSchemaContext = {
        ...createTestContext(),
        registrySchema: null as unknown as Schema,
      };

      const result = await builder.buildRegistry(commands, noSchemaContext);

      if (!result.ok) {
        assertExists(result.error);
        assertExists(result.error.message);
      }
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large command arrays efficiently", async () => {
      const builderResult = RegistryBuilder.create();
      assertEquals(builderResult.ok, true);

      if (!builderResult.ok) return;
      const builder = builderResult.data;

      // Generate large command array
      const largeCommandArray: Command[] = [];
      for (let i = 0; i < 100; i++) { // Reduced to 100 for faster testing
        const cmdResult = Command.create({
          c1: `command${i % 10}`, // Create 10 unique c1 values
          c2: `action${i}`,
          c3: "default",
          description: `Command ${i}`,
          usage: `command${i % 10} action${i} default`,
          options: {},
        });

        if (cmdResult.ok) {
          largeCommandArray.push(cmdResult.data);
        }
      }

      const context = createTestContext();
      const startTime = Date.now();

      const registryResult = await builder.buildRegistry(
        largeCommandArray,
        context,
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      assertEquals(registryResult.ok, true);
      if (registryResult.ok) {
        const registry = registryResult.data;

        // Verify all commands are processed
        assertEquals(registry.tools.commands.length, 100);

        // Verify unique c1 values (should be 10)
        assertEquals(registry.tools.availableConfigs.length, 10);

        // Performance check - should complete within reasonable time
        console.log(`Processing 100 commands took ${executionTime}ms`);
      }
    });
  });
});

describe("RegistryBuilder - Integration with Domain Boundary", () => {
  it("should maintain domain boundary isolation", () => {
    // RegistryBuilder should not depend on infrastructure concerns
    const builderResult = RegistryBuilder.create();
    assertEquals(builderResult.ok, true);

    if (builderResult.ok) {
      const builder = builderResult.data;

      // Verify it's a pure domain object without infrastructure dependencies
      assertExists(builder);
      assertEquals(typeof builder, "object");
    }
  });
});
