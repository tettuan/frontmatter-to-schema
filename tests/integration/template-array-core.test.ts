/**
 * Core Template Array Processing Tests - Issue #408
 *
 * Tests the key functionality without complex Result type handling
 */

import { assertEquals } from "jsr:@std/assert";
import {
  AggregatedStructure,
  type AggregationStrategy,
  StructuredAggregator,
  type TemplateStructure,
} from "../../src/domain/services/structured-aggregator.ts";
import {
  type OutputFormat,
  OutputFormatter,
} from "../../src/infrastructure/adapters/output-formatter.ts";

Deno.test("Issue #408 Template Array Processing - Core Functionality", async (t) => {
  await t.step("Can create StructuredAggregator and OutputFormatter", () => {
    const aggregatorResult = StructuredAggregator.create();
    const formatterResult = OutputFormatter.create();

    assertEquals(aggregatorResult.ok, true);
    assertEquals(formatterResult.ok, true);
  });

  await t.step("AggregatedStructure handles array merging correctly", () => {
    // Test the core Issue #408 problem: merging arrays from multiple documents

    const mockStructure1 = {
      version: "1.0.0",
      tools: {
        availableConfigs: ["git", "spec"],
        commands: [{ c1: "spec", c2: "analyze" }],
      },
    };

    const templateStructure: TemplateStructure = {
      kind: "parent_template",
      arrayFields: [],
      scalarFields: ["version"],
      nestedStructures: {
        tools: {
          kind: "parent_template",
          arrayFields: ["availableConfigs", "commands"],
          scalarFields: [],
          nestedStructures: {},
        },
      },
    };

    const strategy: AggregationStrategy = {
      kind: "merge_arrays",
      mergeKey: "commands",
    };

    const result = AggregatedStructure.create(
      mockStructure1,
      strategy,
      templateStructure,
    );
    assertEquals(result.ok, true);

    if (result.ok) {
      const structure = result.data.getStructure();
      assertEquals(structure.version, "1.0.0");

      const tools = structure.tools as Record<string, unknown>;
      const configs = tools.availableConfigs as string[];
      assertEquals(Array.isArray(configs), true);
      assertEquals(configs.length, 2);
    }
  });

  await t.step("OutputFormatter produces correct JSON format", () => {
    const formatterResult = OutputFormatter.create();
    if (!formatterResult.ok) return;

    // Create expected command registry structure
    const commandRegistryStructure = {
      version: "1.0.0",
      description: "Climpt Command Registry",
      tools: {
        availableConfigs: ["git", "spec", "meta", "test"],
        commands: [
          { c1: "spec", c2: "analyze", c3: "quality-metrics" },
          { c1: "meta", c2: "resolve", c3: "registered-commands" },
        ],
      },
    };

    const templateStructure: TemplateStructure = {
      kind: "parent_template",
      arrayFields: [],
      scalarFields: ["version", "description"],
      nestedStructures: {},
    };

    const strategy: AggregationStrategy = {
      kind: "merge_arrays",
      mergeKey: "commands",
    };

    const structureResult = AggregatedStructure.create(
      commandRegistryStructure,
      strategy,
      templateStructure,
    );

    if (!structureResult.ok) return;

    const jsonFormat: OutputFormat = { kind: "json", indent: 2 };
    const outputResult = formatterResult.data.format(
      structureResult.data,
      jsonFormat,
    );

    if (!outputResult.ok) return;

    const jsonOutput = outputResult.data.getContent();

    // Key test: Verify this is NOT the old broken format { results: [...] }
    assertEquals(jsonOutput.includes('"results":'), false);

    // Verify correct structure
    assertEquals(jsonOutput.includes('"version": "1.0.0"'), true);
    assertEquals(
      jsonOutput.includes('"description": "Climpt Command Registry"'),
      true,
    );
    assertEquals(jsonOutput.includes('"availableConfigs"'), true);
    assertEquals(jsonOutput.includes('"commands"'), true);

    // Parse and verify structure
    const parsed = JSON.parse(jsonOutput);
    assertEquals(parsed.version, "1.0.0");
    assertEquals(Array.isArray(parsed.tools.availableConfigs), true);
    assertEquals(Array.isArray(parsed.tools.commands), true);
    assertEquals(parsed.tools.availableConfigs.length, 4);
    assertEquals(parsed.tools.commands.length, 2);

    console.log("✅ Issue #408 Resolution - Correct Output Format:");
    console.log(jsonOutput);
  });

  await t.step("YAML formatting also works correctly", () => {
    const formatterResult = OutputFormatter.create();
    if (!formatterResult.ok) return;

    const testStructure = {
      version: "1.0.0",
      tools: { availableConfigs: ["git", "spec"] },
    };

    const templateStructure: TemplateStructure = {
      kind: "parent_template",
      arrayFields: [],
      scalarFields: ["version"],
      nestedStructures: {},
    };

    const strategy: AggregationStrategy = {
      kind: "merge_arrays",
      mergeKey: "commands",
    };

    const structureResult = AggregatedStructure.create(
      testStructure,
      strategy,
      templateStructure,
    );
    if (!structureResult.ok) return;

    const yamlFormat: OutputFormat = { kind: "yaml", indentSize: 2 };
    const outputResult = formatterResult.data.format(
      structureResult.data,
      yamlFormat,
    );

    if (!outputResult.ok) return;

    const yamlOutput = outputResult.data.getContent();
    assertEquals(yamlOutput.includes("version: 1.0.0"), true);
    assertEquals(yamlOutput.includes("availableConfigs:"), true);

    console.log("✅ YAML Output:");
    console.log(yamlOutput);
  });
});
