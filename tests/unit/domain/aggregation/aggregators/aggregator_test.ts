import { assert, assertEquals } from "jsr:@std/assert";
import { Aggregator } from "../../../../../src/domain/aggregation/aggregators/aggregator.ts";
import { DerivationRule } from "../../../../../src/domain/aggregation/value-objects/derivation-rule.ts";
import { TestDataFactory } from "../../../../helpers/test-data-factory.ts";

Deno.test("Aggregator - x-derived-from - should aggregate simple array property", () => {
  const aggregator = Aggregator.createWithDisabledCircuitBreaker();

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
  const aggregator = Aggregator.createWithDisabledCircuitBreaker();

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
  const aggregator = Aggregator.createWithDisabledCircuitBreaker();

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
  const aggregator = Aggregator.createWithDisabledCircuitBreaker();

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
  const aggregator = Aggregator.createWithDisabledCircuitBreaker();

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
  const aggregator = Aggregator.createWithDisabledCircuitBreaker();

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
  const aggregator = Aggregator.createWithDisabledCircuitBreaker();

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
  const aggregator = Aggregator.createWithDisabledCircuitBreaker();

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
