import { RegistryAggregator } from "../../src/application/services/RegistryAggregator.ts";
import { AnalysisResult } from "../../src/domain/analysis/Analyzer.ts";
import type { Command } from "../../src/domain/core/types.ts";
import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

Deno.test("RegistryAggregator - should build registry from analysis results", () => {
  const aggregator = new RegistryAggregator();

  const commands: Command[] = [
    {
      c1: "git",
      c2: "create",
      c3: "refinement-issue",
      description: "Create refinement issue",
    },
    {
      c1: "spec",
      c2: "analyze",
      c3: "quality-metrics",
      description: "Analyze quality metrics",
    },
  ];

  const result1 = new AnalysisResult("file1.md", [commands[0]]);
  const result2 = new AnalysisResult("file2.md", [commands[1]]);

  aggregator.addAnalysisResult(result1);
  aggregator.addAnalysisResult(result2);

  const registry = aggregator.build();

  assertEquals(registry.version, "1.0.0");
  assertEquals(registry.tools.commands.length, 2);
  assertEquals(registry.tools.availableConfigs.length, 2);
  assertEquals(registry.tools.availableConfigs.includes("git"), true);
  assertEquals(registry.tools.availableConfigs.includes("spec"), true);
});

Deno.test("RegistryAggregator - should sort commands and configs", () => {
  const aggregator = new RegistryAggregator();

  const commands: Command[] = [
    {
      c1: "spec",
      c2: "validate",
      c3: "requirements",
      description: "Validate requirements",
    },
    {
      c1: "git",
      c2: "analyze",
      c3: "commit-history",
      description: "Analyze commits",
    },
    {
      c1: "git",
      c2: "create",
      c3: "issue",
      description: "Create issue",
    },
  ];

  commands.forEach((cmd) => {
    aggregator.addAnalysisResult(new AnalysisResult("test.md", [cmd]));
  });

  const registry = aggregator.build();

  assertEquals(registry.tools.availableConfigs[0], "git");
  assertEquals(registry.tools.availableConfigs[1], "spec");

  assertEquals(registry.tools.commands[0].c1, "git");
  assertEquals(registry.tools.commands[0].c2, "analyze");
  assertEquals(registry.tools.commands[1].c1, "git");
  assertEquals(registry.tools.commands[1].c2, "create");
  assertEquals(registry.tools.commands[2].c1, "spec");
});
