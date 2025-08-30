/**
 * Tests for RegistryBuilderAdapter - Stage 2 Processing
 *
 * Tests command aggregation, availableConfigs extraction, and registry generation
 * following TDD and Totality principles.
 */

import { assertEquals, assertExists } from "@std/assert";
import { beforeEach, describe, it } from "@std/testing/bdd";

import { RegistryBuilderAdapter } from "../../../../src/application/adapters/registry-builder-adapter.ts";
import { createDomainError } from "../../../../src/domain/core/result.ts";
import type { Command } from "../../../../src/application/adapters/command-processor-adapter.ts";
import { MockTemplateMapper } from "../../../mocks/template-mapper-mock.ts";
import {
  createMockSchema,
  createMockTemplate,
} from "../../../test-helpers/mock-factories.ts";

describe("RegistryBuilderAdapter", () => {
  const mockMapper = new MockTemplateMapper();
  const adapter = new RegistryBuilderAdapter(mockMapper);

  // Reset mocks before each test
  beforeEach(() => {
    mockMapper.reset();
  });

  describe("buildRegistry - Success Cases", () => {
    it("should build registry from multiple commands with different c1 values", async () => {
      // Arrange
      const commands: Command[] = [
        {
          c1: "climpt-build",
          c2: "robust",
          c3: "test",
          options: { description: "Build robust tests" },
          sourcePath: "/test/build-test.md",
          originalFrontMatter: { c1: "climpt-build", c2: "robust", c3: "test" },
        },
        {
          c1: "climpt-design",
          c2: "domain",
          c3: "architecture",
          options: { description: "Design domain architecture" },
          sourcePath: "/test/design-architecture.md",
          originalFrontMatter: {
            c1: "climpt-design",
            c2: "domain",
            c3: "architecture",
          },
        },
        {
          c1: "climpt-spec",
          c2: "analyze",
          c3: "quality-metrics",
          options: { description: "Analyze quality metrics" },
          sourcePath: "/test/spec-quality.md",
          originalFrontMatter: {
            c1: "climpt-spec",
            c2: "analyze",
            c3: "quality-metrics",
          },
        },
      ];

      const schema = createMockSchema("registry-schema");
      const template = createMockTemplate("registry-template");

      // Act
      const result = await adapter.buildRegistry(commands, schema, template);

      // Assert
      assertEquals(result.kind, "Success");
      if (result.kind === "Success") {
        const registry = result.registry;

        // Check availableConfigs (unique c1 values, sorted)
        assertEquals(registry.availableConfigs.length, 3);
        assertEquals(registry.availableConfigs[0], "climpt-build");
        assertEquals(registry.availableConfigs[1], "climpt-design");
        assertEquals(registry.availableConfigs[2], "climpt-spec");

        // Check commands are properly structured
        assertEquals(registry.commands.length, 3);
        assertEquals(registry.commands[0].category, "climpt-build");
        assertEquals(registry.commands[1].category, "climpt-design");
        assertEquals(registry.commands[2].category, "climpt-spec");

        // Check metadata
        assertEquals(registry.metadata.totalCommands, 3);
        assertEquals(registry.metadata.totalCategories, 3);
        assertEquals(registry.metadata.sourceFiles.length, 3);
        assertExists(registry.metadata.generatedAt);
      }
    });

    it("should handle commands with duplicate c1 values correctly", async () => {
      // Arrange
      const commands: Command[] = [
        {
          c1: "climpt-build",
          c2: "robust",
          c3: "test",
          options: { description: "Build robust tests" },
          sourcePath: "/test/build-test.md",
          originalFrontMatter: {},
        },
        {
          c1: "climpt-build",
          c2: "robust",
          c3: "code",
          options: { description: "Build robust code" },
          sourcePath: "/test/build-code.md",
          originalFrontMatter: {},
        },
        {
          c1: "climpt-design",
          c2: "domain",
          c3: "boundary",
          options: { description: "Design domain boundaries" },
          sourcePath: "/test/design-boundary.md",
          originalFrontMatter: {},
        },
      ];

      const schema = createMockSchema("registry-schema");
      const template = createMockTemplate("registry-template");

      // Act
      const result = await adapter.buildRegistry(commands, schema, template);

      // Assert
      assertEquals(result.kind, "Success");
      if (result.kind === "Success") {
        const registry = result.registry;

        // availableConfigs should contain unique c1 values only
        assertEquals(registry.availableConfigs.length, 2);
        assertEquals(registry.availableConfigs[0], "climpt-build");
        assertEquals(registry.availableConfigs[1], "climpt-design");

        // All commands should still be present
        assertEquals(registry.commands.length, 3);

        // Commands should be sorted by category, layer, directive
        assertEquals(registry.commands[0].id, "climpt-build-robust-code");
        assertEquals(registry.commands[1].id, "climpt-build-robust-test");
        assertEquals(registry.commands[2].id, "climpt-design-domain-boundary");

        // Metadata should reflect correct counts
        assertEquals(registry.metadata.totalCommands, 3);
        assertEquals(registry.metadata.totalCategories, 2);
      }
    });

    it("should generate proper command IDs and descriptions", async () => {
      // Arrange
      const commands: Command[] = [
        {
          c1: "climpt-git",
          c2: "merge-up",
          c3: "base-branch",
          options: {
            description: "Custom description for merge command",
            usage: "climpt-git merge-up base-branch --force",
            example: "climpt-git merge-up base-branch",
          },
          sourcePath: "/test/git-merge.md",
          originalFrontMatter: {},
        },
      ];

      const schema = createMockSchema("registry-schema");
      const template = createMockTemplate("registry-template");

      // Act
      const result = await adapter.buildRegistry(commands, schema, template);

      // Assert
      assertEquals(result.kind, "Success");
      if (result.kind === "Success") {
        const registryCommand = result.registry.commands[0];

        assertEquals(registryCommand.id, "climpt-git-merge-up-base-branch");
        assertEquals(registryCommand.category, "climpt-git");
        assertEquals(registryCommand.layer, "merge-up");
        assertEquals(registryCommand.directive, "base-branch");
        assertEquals(
          registryCommand.description,
          "Custom description for merge command",
        );
        assertEquals(
          registryCommand.usage,
          "climpt-git merge-up base-branch --force",
        );
        assertEquals(
          registryCommand.examples?.[0],
          "climpt-git merge-up base-branch",
        );
      }
    });

    it("should sort commands correctly by category, layer, directive", async () => {
      // Arrange - Commands in random order
      const commands: Command[] = [
        {
          c1: "climpt-spec",
          c2: "analyze",
          c3: "quality-metrics",
          options: {},
          sourcePath: "/test/spec.md",
          originalFrontMatter: {},
        },
        {
          c1: "climpt-build",
          c2: "robust",
          c3: "test",
          options: {},
          sourcePath: "/test/build-test.md",
          originalFrontMatter: {},
        },
        {
          c1: "climpt-build",
          c2: "robust",
          c3: "code",
          options: {},
          sourcePath: "/test/build-code.md",
          originalFrontMatter: {},
        },
        {
          c1: "climpt-design",
          c2: "domain",
          c3: "architecture",
          options: {},
          sourcePath: "/test/design.md",
          originalFrontMatter: {},
        },
      ];

      const schema = createMockSchema("registry-schema");
      const template = createMockTemplate("registry-template");

      // Act
      const result = await adapter.buildRegistry(commands, schema, template);

      // Assert
      assertEquals(result.kind, "Success");
      if (result.kind === "Success") {
        const sortedCommands = result.registry.commands;

        // Should be sorted: climpt-build (code, test), climpt-design (architecture), climpt-spec (quality-metrics)
        assertEquals(sortedCommands[0].id, "climpt-build-robust-code");
        assertEquals(sortedCommands[1].id, "climpt-build-robust-test");
        assertEquals(sortedCommands[2].id, "climpt-design-domain-architecture");
        assertEquals(
          sortedCommands[3].id,
          "climpt-spec-analyze-quality-metrics",
        );
      }
    });
  });

  describe("buildRegistry - Error Cases", () => {
    it("should return NoCommands when empty array is provided", async () => {
      // Arrange
      const commands: Command[] = [];
      const schema = createMockSchema("registry-schema");
      const template = createMockTemplate("registry-template");

      // Act
      const result = await adapter.buildRegistry(commands, schema, template);

      // Assert
      assertEquals(result.kind, "NoCommands");
    });

    it("should return TemplateMappingError when template mapping fails", async () => {
      // Arrange
      const commands: Command[] = [
        {
          c1: "climpt-build",
          c2: "robust",
          c3: "test",
          options: {},
          sourcePath: "/test/build.md",
          originalFrontMatter: {},
        },
      ];

      const baseError = {
        kind: "TemplateMappingFailed" as const,
        template: "registry-template",
        source: [],
      };
      const error = createDomainError(baseError, "Template mapping failed");
      mockMapper.setMappingError(error);

      const schema = createMockSchema("registry-schema");
      const template = createMockTemplate("registry-template");

      // Act
      const result = await adapter.buildRegistry(commands, schema, template);

      // Assert
      assertEquals(result.kind, "TemplateMappingError");
      if (result.kind === "TemplateMappingError") {
        assertEquals(result.error.message, "Template mapping failed");
      }
    });
  });

  describe("availableConfigs Extraction", () => {
    it("should extract unique c1 values and sort them", async () => {
      // Arrange - Mix of c1 values with duplicates
      const commands: Command[] = [
        {
          c1: "zebra",
          c2: "layer",
          c3: "directive",
          options: {},
          sourcePath: "/z.md",
          originalFrontMatter: {},
        },
        {
          c1: "alpha",
          c2: "layer",
          c3: "directive",
          options: {},
          sourcePath: "/a.md",
          originalFrontMatter: {},
        },
        {
          c1: "beta",
          c2: "layer",
          c3: "directive",
          options: {},
          sourcePath: "/b1.md",
          originalFrontMatter: {},
        },
        {
          c1: "alpha",
          c2: "layer",
          c3: "directive",
          options: {},
          sourcePath: "/a2.md",
          originalFrontMatter: {},
        }, // duplicate
        {
          c1: "gamma",
          c2: "layer",
          c3: "directive",
          options: {},
          sourcePath: "/g.md",
          originalFrontMatter: {},
        },
        {
          c1: "beta",
          c2: "layer",
          c3: "directive",
          options: {},
          sourcePath: "/b2.md",
          originalFrontMatter: {},
        }, // duplicate
      ];

      const schema = createMockSchema("registry-schema");
      const template = createMockTemplate("registry-template");

      // Act
      const result = await adapter.buildRegistry(commands, schema, template);

      // Assert
      assertEquals(result.kind, "Success");
      if (result.kind === "Success") {
        const availableConfigs = result.registry.availableConfigs;

        // Should be unique and sorted
        assertEquals(availableConfigs.length, 4);
        assertEquals(availableConfigs[0], "alpha");
        assertEquals(availableConfigs[1], "beta");
        assertEquals(availableConfigs[2], "gamma");
        assertEquals(availableConfigs[3], "zebra");
      }
    });

    it("should handle single command correctly", async () => {
      // Arrange
      const commands: Command[] = [
        {
          c1: "climpt-only",
          c2: "single",
          c3: "command",
          options: { description: "Only one command" },
          sourcePath: "/single.md",
          originalFrontMatter: {},
        },
      ];

      const schema = createMockSchema("registry-schema");
      const template = createMockTemplate("registry-template");

      // Act
      const result = await adapter.buildRegistry(commands, schema, template);

      // Assert
      assertEquals(result.kind, "Success");
      if (result.kind === "Success") {
        const registry = result.registry;

        assertEquals(registry.availableConfigs.length, 1);
        assertEquals(registry.availableConfigs[0], "climpt-only");
        assertEquals(registry.commands.length, 1);
        assertEquals(registry.metadata.totalCommands, 1);
        assertEquals(registry.metadata.totalCategories, 1);
      }
    });
  });

  describe("Metadata Generation", () => {
    it("should generate correct metadata", async () => {
      // Arrange
      const commands: Command[] = [
        {
          c1: "cat1",
          c2: "layer1",
          c3: "dir1",
          options: {},
          sourcePath: "/path1.md",
          originalFrontMatter: {},
        },
        {
          c1: "cat1",
          c2: "layer2",
          c3: "dir2",
          options: {},
          sourcePath: "/path2.md",
          originalFrontMatter: {},
        },
        {
          c1: "cat2",
          c2: "layer3",
          c3: "dir3",
          options: {},
          sourcePath: "/path3.md",
          originalFrontMatter: {},
        },
        {
          c1: "cat3",
          c2: "layer4",
          c3: "dir4",
          options: {},
          sourcePath: "/path1.md",
          originalFrontMatter: {},
        }, // duplicate path
      ];

      const schema = createMockSchema("registry-schema");
      const template = createMockTemplate("registry-template");

      // Act
      const result = await adapter.buildRegistry(commands, schema, template);

      // Assert
      assertEquals(result.kind, "Success");
      if (result.kind === "Success") {
        const metadata = result.registry.metadata;

        assertEquals(metadata.totalCommands, 4);
        assertEquals(metadata.totalCategories, 3); // cat1, cat2, cat3

        // Source files should be unique and sorted
        assertEquals(metadata.sourceFiles.length, 3); // /path1.md appears twice but should be unique
        assertEquals(metadata.sourceFiles[0], "/path1.md");
        assertEquals(metadata.sourceFiles[1], "/path2.md");
        assertEquals(metadata.sourceFiles[2], "/path3.md");

        // Generated timestamp should be ISO string
        assertExists(metadata.generatedAt);
        assertEquals(typeof metadata.generatedAt, "string");
        // Should be valid ISO date
        const date = new Date(metadata.generatedAt);
        assertEquals(date instanceof Date && !isNaN(date.getTime()), true);
      }
    });
  });
});
