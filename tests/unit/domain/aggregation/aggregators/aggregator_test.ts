import { assert, assertEquals } from "jsr:@std/assert";
import { Aggregator } from "../../../../../src/domain/aggregation/aggregators/aggregator.ts";
import { DerivationRule } from "../../../../../src/domain/aggregation/value-objects/derivation-rule.ts";
import { TestDataFactory } from "../../../../helpers/test-data-factory.ts";

Deno.test("Aggregator - x-derived-from - should aggregate simple array property", () => {
  const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
  assert(aggregatorResult.ok);
  const aggregator = aggregatorResult.data;

  // Create test data with commands array
  const data1Result = TestDataFactory.createFrontmatterData({
    commands: [
      { c1: "meta", c2: "resolve" },
      { c1: "spec", c2: "analyze" },
    ],
  });
  const data2Result = TestDataFactory.createFrontmatterData({
    commands: [
      { c1: "git", c2: "commit" },
      { c1: "meta", c2: "update" },
    ],
  });
  assert(data1Result.ok && data2Result.ok);

  // Create derivation rule for x-derived-from
  const ruleResult = DerivationRule.create(
    "commands[].c1",
    "allC1Categories",
    false,
  );
  assert(ruleResult.ok);

  const result = aggregator.aggregate([data1Result.data, data2Result.data], [
    ruleResult.data!,
  ]);
  assert(result.ok);

  if (result.ok) {
    const derivedFields = result.data.derivedFields;
    assert(Array.isArray(derivedFields.allC1Categories));
    assertEquals(derivedFields.allC1Categories, [
      "meta",
      "spec",
      "git",
      "meta",
    ]);
  }
});

Deno.test("Aggregator - x-derived-unique - should aggregate with unique values", () => {
  const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
  assert(aggregatorResult.ok);
  const aggregator = aggregatorResult.data;

  // Create test data with duplicate values
  const data1Result = TestDataFactory.createFrontmatterData({
    commands: [
      { c1: "meta", c2: "resolve" },
      { c1: "spec", c2: "analyze" },
      { c1: "meta", c2: "check" },
    ],
  });
  const data2Result = TestDataFactory.createFrontmatterData({
    commands: [
      { c1: "git", c2: "commit" },
      { c1: "spec", c2: "validate" },
    ],
  });
  assert(data1Result.ok && data2Result.ok);

  // Create derivation rule with unique flag (x-derived-unique: true)
  const ruleResult = DerivationRule.create(
    "commands[].c1",
    "availableConfigs",
    true,
  );
  assert(ruleResult.ok);

  const result = aggregator.aggregate([data1Result.data, data2Result.data], [
    ruleResult.data!,
  ]);
  assert(result.ok);

  if (result.ok) {
    const derivedFields = result.data.derivedFields;
    assert(Array.isArray(derivedFields.availableConfigs));
    // Should have unique values only
    assertEquals(derivedFields.availableConfigs.sort(), [
      "git",
      "meta",
      "spec",
    ]);
  }
});

Deno.test("Aggregator - should handle multiple derivation rules", () => {
  const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
  assert(aggregatorResult.ok);
  const aggregator = aggregatorResult.data;

  const data1Result = TestDataFactory.createFrontmatterData({
    commands: [
      { c1: "meta", c2: "resolve", c3: "registered-commands" },
      { c1: "spec", c2: "analyze", c3: "quality-metrics" },
    ],
  });
  const data2Result = TestDataFactory.createFrontmatterData({
    commands: [
      { c1: "git", c2: "commit", c3: "changes" },
      { c1: "meta", c2: "resolve", c3: "dependencies" },
    ],
  });
  assert(data1Result.ok && data2Result.ok);

  // Create multiple derivation rules
  const rule1Result = DerivationRule.create(
    "commands[].c1",
    "allC1Categories",
    true,
  );
  const rule2Result = DerivationRule.create(
    "commands[].c2",
    "allC2Actions",
    true,
  );
  const rule3Result = DerivationRule.create(
    "commands[].c3",
    "allC3Targets",
    false,
  );

  assert(rule1Result.ok);
  assert(rule2Result.ok);
  assert(rule3Result.ok);

  const result = aggregator.aggregate(
    [data1Result.data, data2Result.data],
    [rule1Result.data!, rule2Result.data!, rule3Result.data!],
  );
  assert(result.ok);

  if (result.ok) {
    const derivedFields = result.data.derivedFields;

    // Check x-derived-unique fields
    assertEquals((derivedFields.allC1Categories as string[]).sort(), [
      "git",
      "meta",
      "spec",
    ]);
    assertEquals((derivedFields.allC2Actions as string[]).sort(), [
      "analyze",
      "commit",
      "resolve",
    ]);

    // Check non-unique field
    assertEquals(derivedFields.allC3Targets, [
      "registered-commands",
      "quality-metrics",
      "changes",
      "dependencies",
    ]);
  }
});

Deno.test("Aggregator - should handle nested property paths", () => {
  const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
  assert(aggregatorResult.ok);
  const aggregator = aggregatorResult.data;

  const data1Result = TestDataFactory.createFrontmatterData({
    tools: {
      commands: [
        { name: "meta-resolve", category: "meta" },
        { name: "spec-analyze", category: "spec" },
      ],
    },
  });
  const data2Result = TestDataFactory.createFrontmatterData({
    tools: {
      commands: [
        { name: "git-commit", category: "git" },
        { name: "meta-update", category: "meta" },
      ],
    },
  });
  assert(data1Result.ok && data2Result.ok);

  // Create derivation rule for nested path
  const ruleResult = DerivationRule.create(
    "tools.commands[].category",
    "categories",
    true,
  );
  assert(ruleResult.ok);

  const result = aggregator.aggregate([data1Result.data, data2Result.data], [
    ruleResult.data!,
  ]);
  assert(result.ok);

  if (result.ok) {
    const derivedFields = result.data.derivedFields;
    assertEquals((derivedFields.categories as string[]).sort(), [
      "git",
      "meta",
      "spec",
    ]);
  }
});

Deno.test("Aggregator - should handle empty data gracefully", () => {
  const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
  assert(aggregatorResult.ok);
  const aggregator = aggregatorResult.data;

  const data1Result = TestDataFactory.createFrontmatterData({
    commands: [],
  });
  const data2Result = TestDataFactory.createFrontmatterData({
    // No commands property at all
    other: "value",
  });
  assert(data1Result.ok && data2Result.ok);

  const ruleResult = DerivationRule.create("commands[].c1", "configs", true);
  assert(ruleResult.ok);

  const result = aggregator.aggregate([data1Result.data, data2Result.data], [
    ruleResult.data!,
  ]);
  assert(result.ok);

  if (result.ok) {
    const derivedFields = result.data.derivedFields;
    assert(Array.isArray(derivedFields.configs));
    assertEquals(derivedFields.configs, []);
  }
});

Deno.test("Aggregator - should merge derived fields with base data", () => {
  const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
  assert(aggregatorResult.ok);
  const aggregator = aggregatorResult.data;

  const baseDataResult = TestDataFactory.createFrontmatterData({
    version: "1.0.0",
    description: "Test configuration",
  });
  assert(baseDataResult.ok);

  const data1Result = TestDataFactory.createFrontmatterData({
    commands: [
      { c1: "meta" },
      { c1: "spec" },
    ],
  });
  assert(data1Result.ok);

  const ruleResult = DerivationRule.create(
    "commands[].c1",
    "availableConfigs",
    true,
  );
  assert(ruleResult.ok);

  const aggregateResult = aggregator.aggregate(
    [data1Result.data],
    [ruleResult.data!],
    baseDataResult.data!,
  );
  assert(aggregateResult.ok);

  if (aggregateResult.ok) {
    const mergeResult = aggregator.mergeWithBase(aggregateResult.data);
    assert(mergeResult.ok);

    if (mergeResult.ok) {
      const finalData = mergeResult.data.getData();
      // Base data should be preserved
      assertEquals(finalData.version, "1.0.0");
      assertEquals(finalData.description, "Test configuration");
      // Derived fields should be added
      assertEquals(finalData.availableConfigs, ["meta", "spec"]);
    }
  }
});

Deno.test("Aggregator - should handle complex real-world scenario", () => {
  const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
  assert(aggregatorResult.ok);
  const aggregator = aggregatorResult.data;

  // Simulate real climpt registry data
  const metaResolveResult = TestDataFactory.createFrontmatterData({
    c1: "meta",
    c2: "resolve",
    c3: "registered-commands",
    title: "Resolve Registered Commands",
    description: "Resolve and display all registered commands",
  });

  const specAnalyzeResult = TestDataFactory.createFrontmatterData({
    c1: "spec",
    c2: "analyze",
    c3: "quality-metrics",
    title: "Analyze Quality Metrics",
    description: "Analyze specification quality and completeness metrics",
  });

  const gitCommitResult = TestDataFactory.createFrontmatterData({
    c1: "git",
    c2: "commit",
    c3: "changes",
    title: "Commit Changes",
    description: "Create a git commit with changes",
  });

  // Create rules as defined in schema
  const c1Rule = DerivationRule.create(
    "commands[].c1",
    "tools.availableConfigs",
    true,
  );
  const c2Rule = DerivationRule.create(
    "commands[].c2",
    "tools.allC2Actions",
    true,
  );
  const c3Rule = DerivationRule.create(
    "commands[].c3",
    "tools.allC3Targets",
    true,
  );

  assert(c1Rule.ok);
  assert(c2Rule.ok);
  assert(c3Rule.ok);

  assert(metaResolveResult.ok && specAnalyzeResult.ok && gitCommitResult.ok);

  // Process as frontmatter-part would structure it
  const structuredDataResult = TestDataFactory.createFrontmatterData({
    commands: [
      metaResolveResult.data.getData(),
      specAnalyzeResult.data.getData(),
      gitCommitResult.data.getData(),
    ],
  });
  assert(structuredDataResult.ok);

  const result = aggregator.aggregate(
    [structuredDataResult.data],
    [c1Rule.data!, c2Rule.data!, c3Rule.data!],
  );

  assert(result.ok);
  if (result.ok) {
    const derivedFields = result.data.derivedFields;

    // Verify all derived fields match expected schema structure
    assertEquals((derivedFields["tools.availableConfigs"] as string[]).sort(), [
      "git",
      "meta",
      "spec",
    ]);
    assertEquals((derivedFields["tools.allC2Actions"] as string[]).sort(), [
      "analyze",
      "commit",
      "resolve",
    ]);
    assertEquals((derivedFields["tools.allC3Targets"] as string[]).sort(), [
      "changes",
      "quality-metrics",
      "registered-commands",
    ]);
  }
});

Deno.test("Aggregator - should handle evaluation errors gracefully", () => {
  const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
  assert(aggregatorResult.ok);
  const aggregator = aggregatorResult.data;

  const dataResult = TestDataFactory.createFrontmatterData({
    notAnArray: "string value",
  });
  assert(dataResult.ok);

  // Try to extract from non-existent array
  const ruleResult = DerivationRule.create(
    "nonExistent[].property",
    "target",
    false,
  );
  assert(ruleResult.ok);

  const result = aggregator.aggregate([dataResult.data], [ruleResult.data!]);
  assert(result.ok);

  if (result.ok) {
    // Should handle gracefully with empty result
    const derivedFields = result.data.derivedFields;
    assert(Array.isArray(derivedFields.target));
    assertEquals(derivedFields.target, []);
  }
});

// Issue #527: Missing test for multiple registry merge functionality
Deno.test("Aggregator - Multiple Registry Merge - should merge commands from multiple registries and derive availableConfigs", () => {
  const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
  assert(aggregatorResult.ok);
  const aggregator = aggregatorResult.data;

  // Simulate Registry 1: meta and spec commands
  const registry1Result = TestDataFactory.createFrontmatterData({
    tools: {
      commands: [
        {
          c1: "meta",
          c2: "resolve",
          c3: "registered-commands",
          title: "Resolve Registered Commands",
          description: "Resolve and display all registered commands",
        },
        {
          c1: "spec",
          c2: "analyze",
          c3: "quality-metrics",
          title: "Analyze Quality Metrics",
          description: "Analyze specification quality and completeness metrics",
        },
      ],
    },
  });

  // Simulate Registry 2: git and build commands
  const registry2Result = TestDataFactory.createFrontmatterData({
    tools: {
      commands: [
        {
          c1: "git",
          c2: "commit",
          c3: "changes",
          title: "Commit Changes",
          description: "Create a git commit with changes",
        },
        {
          c1: "build",
          c2: "robust",
          c3: "code",
          title: "Build Robust Code",
          description: "Build robust and reliable code",
        },
      ],
    },
  });

  // Simulate Registry 3: additional meta and debug commands (with duplicates)
  const registry3Result = TestDataFactory.createFrontmatterData({
    tools: {
      commands: [
        {
          c1: "meta",
          c2: "build-list",
          c3: "command-registry",
          title: "Build Command Registry",
          description: "Build list of available commands",
        },
        {
          c1: "debug",
          c2: "analyze-deep",
          c3: "project-issues",
          title: "Deep Project Analysis",
          description: "Analyze project issues in depth",
        },
      ],
    },
  });

  assert(registry1Result.ok && registry2Result.ok && registry3Result.ok);

  // Create derivation rules matching the registry schema pattern
  const availableConfigsRule = DerivationRule.create(
    "tools.commands[].c1",
    "tools.availableConfigs",
    true, // x-derived-unique: true
  );
  assert(availableConfigsRule.ok);

  // Act: Aggregate multiple registries
  const result = aggregator.aggregate(
    [registry1Result.data, registry2Result.data, registry3Result.data],
    [availableConfigsRule.data!],
  );

  // Assert: Successful aggregation
  assert(result.ok);
  if (result.ok) {
    const derivedFields = result.data.derivedFields;

    // Verify availableConfigs contains unique c1 values from all registries
    const availableConfigs =
      derivedFields["tools.availableConfigs"] as string[];
    assert(Array.isArray(availableConfigs));

    // Should contain all unique c1 values: meta, spec, git, build, debug
    const expectedConfigs = ["build", "debug", "git", "meta", "spec"];
    assertEquals(availableConfigs.sort(), expectedConfigs);

    // Verify no duplicates (meta appears in both registry1 and registry3)
    const duplicateCount = availableConfigs.filter((config) =>
      config === "meta"
    ).length;
    assertEquals(
      duplicateCount,
      1,
      "meta should appear only once despite being in multiple registries",
    );
  }
});

Deno.test("Aggregator - Multiple Registry Merge - should handle empty registries gracefully", () => {
  const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
  assert(aggregatorResult.ok);
  const aggregator = aggregatorResult.data;

  // Registry with commands
  const fullRegistryResult = TestDataFactory.createFrontmatterData({
    tools: {
      commands: [
        { c1: "git", c2: "commit", c3: "changes" },
        { c1: "spec", c2: "analyze", c3: "quality" },
      ],
    },
  });

  // Empty registry
  const emptyRegistryResult = TestDataFactory.createFrontmatterData({
    tools: {
      commands: [],
    },
  });

  // Registry with no commands property
  const noCommandsRegistryResult = TestDataFactory.createFrontmatterData({
    tools: {
      other: "value",
    },
  });

  assert(
    fullRegistryResult.ok && emptyRegistryResult.ok &&
      noCommandsRegistryResult.ok,
  );

  const availableConfigsRule = DerivationRule.create(
    "tools.commands[].c1",
    "tools.availableConfigs",
    true,
  );
  assert(availableConfigsRule.ok);

  const result = aggregator.aggregate(
    [
      fullRegistryResult.data,
      emptyRegistryResult.data,
      noCommandsRegistryResult.data,
    ],
    [availableConfigsRule.data!],
  );

  assert(result.ok);
  if (result.ok) {
    const derivedFields = result.data.derivedFields;
    const availableConfigs =
      derivedFields["tools.availableConfigs"] as string[];

    // Should only contain configs from the non-empty registry
    assertEquals(availableConfigs.sort(), ["git", "spec"]);
  }
});

Deno.test("Aggregator - Multiple Registry Merge - should preserve latest version in base data", () => {
  const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
  assert(aggregatorResult.ok);
  const aggregator = aggregatorResult.data;

  // Base data with version and description
  const baseDataResult = TestDataFactory.createFrontmatterData({
    version: "1.0.0",
    description: "Command Registry",
  });

  // Registry data to merge
  const registryDataResult = TestDataFactory.createFrontmatterData({
    tools: {
      commands: [
        { c1: "meta", c2: "resolve", c3: "commands" },
        { c1: "git", c2: "commit", c3: "changes" },
      ],
    },
  });

  assert(baseDataResult.ok && registryDataResult.ok);

  const availableConfigsRule = DerivationRule.create(
    "tools.commands[].c1",
    "availableConfigs",
    true,
  );
  assert(availableConfigsRule.ok);

  // Aggregate with base data
  const aggregateResult = aggregator.aggregate(
    [registryDataResult.data],
    [availableConfigsRule.data!],
    baseDataResult.data,
  );
  assert(aggregateResult.ok);

  if (aggregateResult.ok) {
    // Merge with base data
    const mergeResult = aggregator.mergeWithBase(aggregateResult.data);
    assert(mergeResult.ok);

    if (mergeResult.ok) {
      const finalData = mergeResult.data.getData();

      // Verify base data is preserved
      assertEquals(finalData.version, "1.0.0");
      assertEquals(finalData.description, "Command Registry");

      // Verify derived fields are added
      assertEquals((finalData.availableConfigs as string[]).sort(), [
        "git",
        "meta",
      ]);
    }
  }
});

Deno.test("Aggregator - Multiple Registry Merge - should handle conflicting command data", () => {
  const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
  assert(aggregatorResult.ok);
  const aggregator = aggregatorResult.data;

  // Registry 1: meta command with one description
  const registry1Result = TestDataFactory.createFrontmatterData({
    tools: {
      commands: [
        {
          c1: "meta",
          c2: "resolve",
          c3: "commands",
          title: "Original Meta Command",
          description: "Original description",
        },
      ],
    },
  });

  // Registry 2: different meta command (same c1, different details)
  const registry2Result = TestDataFactory.createFrontmatterData({
    tools: {
      commands: [
        {
          c1: "meta",
          c2: "build-list",
          c3: "registry",
          title: "Updated Meta Command",
          description: "Updated description",
        },
        {
          c1: "git",
          c2: "commit",
          c3: "changes",
          title: "Git Commit",
          description: "Commit changes",
        },
      ],
    },
  });

  assert(registry1Result.ok && registry2Result.ok);

  // Test both command aggregation and config derivation
  const commandsRule = DerivationRule.create(
    "tools.commands[]",
    "aggregatedCommands",
    false, // Don't unique - keep all commands
  );
  const availableConfigsRule = DerivationRule.create(
    "tools.commands[].c1",
    "tools.availableConfigs",
    true, // Unique c1 values only
  );
  assert(commandsRule.ok && availableConfigsRule.ok);

  const result = aggregator.aggregate(
    [registry1Result.data, registry2Result.data],
    [commandsRule.data!, availableConfigsRule.data!],
  );

  assert(result.ok);
  if (result.ok) {
    const derivedFields = result.data.derivedFields;

    // All commands should be aggregated (3 total)
    const aggregatedCommands = derivedFields.aggregatedCommands as any[];
    assertEquals(aggregatedCommands.length, 3);

    // But availableConfigs should be unique (only 'git' and 'meta')
    const availableConfigs =
      derivedFields["tools.availableConfigs"] as string[];
    assertEquals(availableConfigs.sort(), ["git", "meta"]);
  }
});
