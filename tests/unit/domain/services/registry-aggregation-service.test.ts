/**
 * Tests for Registry Aggregation Service
 *
 * Tests the domain service responsible for aggregating transformation results
 * into registry structures following totality principles.
 */

import { assertEquals } from "jsr:@std/assert";
import {
  Command,
  RegistryAggregationService,
  RegistryData,
  type RegistryStructure as _RegistryStructure,
} from "../../../../src/domain/services/registry-aggregation-service.ts";
import { FrontMatter } from "../../../../src/domain/models/entities.ts";
import { FrontMatterContent } from "../../../../src/domain/models/value-objects.ts";

Deno.test("RegistryAggregationService: Command creation from frontmatter", () => {
  // Create test frontmatter
  const frontMatterResult = FrontMatterContent.create(`---
name: test-command
description: Test command
c1: config1
---`);

  assertEquals(frontMatterResult.ok, true);
  if (!frontMatterResult.ok) return;

  const frontMatter = FrontMatter.create(
    frontMatterResult.data,
    `---
name: test-command
description: Test command
c1: config1
---`,
  );

  // Test command creation
  const commandResult = Command.fromFrontMatter(frontMatter);
  assertEquals(commandResult.ok, true);
  if (!commandResult.ok) return;

  const command = commandResult.data;
  assertEquals(command.hasConfig(), true);
  assertEquals(command.getConfig(), "config1");

  const data = command.getData();
  assertEquals(data.name, "test-command");
  assertEquals(data.description, "Test command");
  assertEquals(data.c1, "config1");
});

Deno.test("RegistryAggregationService: Command creation from object", () => {
  const testData = {
    name: "test-command",
    description: "Test command",
    c1: "config1",
  };

  const commandResult = Command.fromObject(testData);
  assertEquals(commandResult.ok, true);
  if (!commandResult.ok) return;

  const command = commandResult.data;
  assertEquals(command.hasConfig(), true);
  assertEquals(command.getConfig(), "config1");
  assertEquals(command.getData().name, "test-command");
});

Deno.test("RegistryAggregationService: Command creation without config", () => {
  const testData = {
    name: "test-command",
    description: "Test command",
  };

  const commandResult = Command.fromObject(testData);
  assertEquals(commandResult.ok, true);
  if (!commandResult.ok) return;

  const command = commandResult.data;
  assertEquals(command.hasConfig(), false);
  assertEquals(command.getConfig(), undefined);
});

Deno.test("RegistryAggregationService: RegistryData creation", () => {
  const command1Result = Command.fromObject({
    name: "cmd1",
    c1: "config1",
  });
  const command2Result = Command.fromObject({
    name: "cmd2",
    c1: "config2",
  });

  assertEquals(command1Result.ok, true);
  assertEquals(command2Result.ok, true);
  if (!command1Result.ok || !command2Result.ok) return;

  const commands = [command1Result.data, command2Result.data];
  const configs = ["config1", "config2"];

  const registryResult = RegistryData.create(
    "1.0.0",
    "Test Registry",
    commands,
    configs,
  );

  assertEquals(registryResult.ok, true);
  if (!registryResult.ok) return;

  const registry = registryResult.data;
  assertEquals(registry.getVersion(), "1.0.0");
  assertEquals(registry.getDescription(), "Test Registry");

  const tools = registry.getTools();
  assertEquals(tools.commands.length, 2);
  assertEquals(tools.availableConfigs.length, 2);
  assertEquals(tools.availableConfigs[0], "config1");
  assertEquals(tools.availableConfigs[1], "config2");
});

Deno.test("RegistryAggregationService: RegistryData validation", () => {
  const emptyVersionResult = RegistryData.create(
    "",
    "Test Registry",
    [],
    [],
  );
  assertEquals(emptyVersionResult.ok, false);
  if (emptyVersionResult.ok) return;
  assertEquals(emptyVersionResult.error.kind, "EmptyInput");

  const emptyDescriptionResult = RegistryData.create(
    "1.0.0",
    "",
    [],
    [],
  );
  assertEquals(emptyDescriptionResult.ok, false);
  if (emptyDescriptionResult.ok) return;
  assertEquals(emptyDescriptionResult.error.kind, "EmptyInput");
});

Deno.test("RegistryAggregationService: Structure detection", () => {
  const service = new RegistryAggregationService();

  // Test empty data
  const emptyStructure = service.detectStructureType([]);
  assertEquals(emptyStructure.kind, "Generic");

  // Test registry structure
  const registryData = [{
    version: "1.0.0",
    tools: {
      availableConfigs: ["config1"],
      commands: [{ name: "test" }],
    },
  }];
  const registryStructure = service.detectStructureType(registryData);
  assertEquals(registryStructure.kind, "Registry");

  // Test command list structure
  const commandData = [
    { name: "cmd1", c1: "config1" },
    { name: "cmd2", c1: "config2" },
  ];
  const commandStructure = service.detectStructureType(commandData);
  assertEquals(commandStructure.kind, "CommandList");

  // Test generic structure
  const genericData = [
    { name: "item1" },
    { name: "item2" },
  ];
  const genericStructure = service.detectStructureType(genericData);
  assertEquals(genericStructure.kind, "Generic");
});

Deno.test("RegistryAggregationService: Configuration extraction", () => {
  const service = new RegistryAggregationService();

  const cmd1Result = Command.fromObject({ name: "cmd1", c1: "config1" });
  const cmd2Result = Command.fromObject({ name: "cmd2", c1: "config2" });
  const cmd3Result = Command.fromObject({ name: "cmd3" }); // No config
  const cmd4Result = Command.fromObject({ name: "cmd4", c1: "config1" }); // Duplicate

  assertEquals(cmd1Result.ok, true);
  assertEquals(cmd2Result.ok, true);
  assertEquals(cmd3Result.ok, true);
  assertEquals(cmd4Result.ok, true);
  if (!cmd1Result.ok || !cmd2Result.ok || !cmd3Result.ok || !cmd4Result.ok) {
    return;
  }

  const commands = [
    cmd1Result.data,
    cmd2Result.data,
    cmd3Result.data,
    cmd4Result.data,
  ];
  const configs = service.extractConfigurations(commands);

  assertEquals(configs.length, 2);
  assertEquals(configs[0], "config1");
  assertEquals(configs[1], "config2");
});

Deno.test("RegistryAggregationService: Aggregate from mapped data", () => {
  const service = new RegistryAggregationService();

  const mappedData = [
    { name: "cmd1", description: "Command 1", c1: "config1" },
    { name: "cmd2", description: "Command 2", c1: "config2" },
  ];

  const result = service.aggregateFromMappedData(mappedData);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  const registry = result.data;
  assertEquals(registry.getVersion(), "1.0.0");

  const tools = registry.getTools();
  assertEquals(tools.commands.length, 2);
  assertEquals(tools.availableConfigs.length, 2);
  assertEquals(tools.availableConfigs.includes("config1"), true);
  assertEquals(tools.availableConfigs.includes("config2"), true);
});
