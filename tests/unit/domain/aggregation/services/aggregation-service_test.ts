import { assertEquals } from "@std/assert";
import { AggregationService } from "../../../../../src/domain/aggregation/services/aggregation-service.ts";
import {
  ArrayAggregationStrategy,
  SingleSourceStrategy,
} from "../../../../../src/domain/aggregation/services/aggregation-strategy.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

// Helper function to create test frontmatter data
function createTestFrontmatterData(
  data: Record<string, unknown>,
): FrontmatterData {
  const result = FrontmatterData.create(data);
  if (result.isError()) {
    throw new Error("Failed to create test frontmatter data");
  }
  return result.unwrap();
}

Deno.test("AggregationService - create with default strategies", () => {
  const result = AggregationService.create();

  assertEquals(result.isOk(), true);
  const service = result.unwrap();
  const strategies = service.getAvailableStrategies();
  assertEquals(strategies.includes("single"), true);
  assertEquals(strategies.includes("array"), true);
  assertEquals(strategies.includes("merge"), true);
});

Deno.test("AggregationService - createWithStrategies custom strategies", () => {
  const customStrategies = {
    single: SingleSourceStrategy.create(),
    array: ArrayAggregationStrategy.create(),
  };

  const result = AggregationService.createWithStrategies(customStrategies);

  assertEquals(result.isOk(), true);
  const service = result.unwrap();
  const strategies = service.getAvailableStrategies();
  assertEquals(strategies.length, 2);
  assertEquals(strategies.includes("single"), true);
  assertEquals(strategies.includes("array"), true);
  assertEquals(strategies.includes("merge"), false);
});

Deno.test("AggregationService - createWithStrategies rejects invalid strategy", () => {
  const invalidStrategies = {
    valid: SingleSourceStrategy.create(),
    invalid: { notAStrategy: true },
  };

  const result = AggregationService.createWithStrategies(
    invalidStrategies as any,
  );

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_STRATEGY");
  assertEquals(error.message.includes("invalid"), true);
});

Deno.test("AggregationService - aggregate with single strategy", () => {
  const service = AggregationService.create().unwrap();
  const source = createTestFrontmatterData({ title: "Test", author: "John" });

  const result = service.aggregate([source], "single");

  assertEquals(result.isOk(), true);
  const aggregationResult = result.unwrap();
  assertEquals(aggregationResult.sourceCount, 1);
  assertEquals(aggregationResult.data.title, "Test");
  assertEquals(aggregationResult.data.author, "John");
});

Deno.test("AggregationService - aggregate with array strategy", () => {
  const service = AggregationService.create().unwrap();
  const source1 = createTestFrontmatterData({ title: "Doc1" });
  const source2 = createTestFrontmatterData({ title: "Doc2" });

  const result = service.aggregate([source1, source2], "array");

  assertEquals(result.isOk(), true);
  const aggregationResult = result.unwrap();
  assertEquals(aggregationResult.sourceCount, 2);
  assertEquals(Array.isArray(aggregationResult.data.documents), true);
  assertEquals((aggregationResult.data.documents as any[]).length, 2);
});

Deno.test("AggregationService - aggregate with merge strategy", () => {
  const service = AggregationService.create().unwrap();
  const source1 = createTestFrontmatterData({ title: "Test", version: 1 });
  const source2 = createTestFrontmatterData({
    author: "John",
    category: "docs",
  });

  const result = service.aggregate([source1, source2], "merge");

  assertEquals(result.isOk(), true);
  const aggregationResult = result.unwrap();
  assertEquals(aggregationResult.sourceCount, 2);
  assertEquals(aggregationResult.data.title, "Test");
  assertEquals(aggregationResult.data.author, "John");
  assertEquals(aggregationResult.data.category, "docs");
});

Deno.test("AggregationService - aggregate with unknown strategy", () => {
  const service = AggregationService.create().unwrap();
  const source = createTestFrontmatterData({ title: "Test" });

  const result = service.aggregate([source], "unknown");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "UNKNOWN_STRATEGY");
  assertEquals(error.message.includes("unknown"), true);
});

Deno.test("AggregationService - aggregate with incompatible strategy", () => {
  const service = AggregationService.create().unwrap();
  const source1 = createTestFrontmatterData({ title: "Doc1" });
  const source2 = createTestFrontmatterData({ title: "Doc2" });

  // Single strategy doesn't accept multiple sources
  const result = service.aggregate([source1, source2], "single");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INCOMPATIBLE_STRATEGY");
});

Deno.test("AggregationService - aggregate with invalid sources", () => {
  const service = AggregationService.create().unwrap();

  const result = service.aggregate("not an array" as any, "single");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_SOURCES");
});

Deno.test("AggregationService - aggregate with empty sources", () => {
  const service = AggregationService.create().unwrap();

  const result = service.aggregate([], "single");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "EMPTY_SOURCES");
});

Deno.test("AggregationService - autoAggregate selects appropriate strategy", () => {
  const service = AggregationService.create().unwrap();

  // Single source should select "single" strategy
  const singleSource = createTestFrontmatterData({ title: "Test" });
  const singleResult = service.autoAggregate([singleSource]);
  assertEquals(singleResult.isOk(), true);

  // Multiple sources should select "array" strategy
  const source1 = createTestFrontmatterData({ title: "Doc1" });
  const source2 = createTestFrontmatterData({ title: "Doc2" });
  const multiResult = service.autoAggregate([source1, source2]);
  assertEquals(multiResult.isOk(), true);
  const multiAggregation = multiResult.unwrap();
  assertEquals(Array.isArray(multiAggregation.data.documents), true);
});

Deno.test("AggregationService - selectBestStrategy logic", () => {
  const service = AggregationService.create().unwrap();
  const source = createTestFrontmatterData({ title: "Test" });

  assertEquals(service.selectBestStrategy([]), "array");
  assertEquals(service.selectBestStrategy([source]), "single");
  assertEquals(service.selectBestStrategy([source, source]), "array");
});

Deno.test("AggregationService - registerStrategy adds new strategy", () => {
  const service = AggregationService.create().unwrap();
  const customStrategy = SingleSourceStrategy.create();

  const result = service.registerStrategy("custom", customStrategy);

  assertEquals(result.isOk(), true);
  const strategies = service.getAvailableStrategies();
  assertEquals(strategies.includes("custom"), true);
});

Deno.test("AggregationService - registerStrategy rejects invalid name", () => {
  const service = AggregationService.create().unwrap();
  const strategy = SingleSourceStrategy.create();

  const result = service.registerStrategy("", strategy);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_STRATEGY_NAME");
});

Deno.test("AggregationService - registerStrategy rejects invalid strategy", () => {
  const service = AggregationService.create().unwrap();

  const result = service.registerStrategy("test", { invalid: true } as any);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_STRATEGY");
});

Deno.test("AggregationService - unregisterStrategy removes strategy", () => {
  const service = AggregationService.create().unwrap();

  const result = service.unregisterStrategy("single");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), true); // Strategy existed and was removed
  const strategies = service.getAvailableStrategies();
  assertEquals(strategies.includes("single"), false);
});

Deno.test("AggregationService - unregisterStrategy handles non-existent strategy", () => {
  const service = AggregationService.create().unwrap();

  const result = service.unregisterStrategy("nonexistent");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), false); // Strategy didn't exist
});

Deno.test("AggregationService - getStrategyConfiguration returns config", () => {
  const service = AggregationService.create().unwrap();

  const result = service.getStrategyConfiguration("single");

  assertEquals(result.isOk(), true);
  const config = result.unwrap();
  assertEquals(config.name, "Single Source");
  assertEquals(config.minimumSources, 1);
  assertEquals(config.maximumSources, 1);
});

Deno.test("AggregationService - getStrategyConfiguration handles unknown strategy", () => {
  const service = AggregationService.create().unwrap();

  const result = service.getStrategyConfiguration("unknown");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "STRATEGY_NOT_FOUND");
});

Deno.test("AggregationService - validateConfiguration validates service state", () => {
  const service = AggregationService.create().unwrap();

  const result = service.validateConfiguration();

  assertEquals(result.isOk(), true);
  const validation = result.unwrap();
  assertEquals(validation.isValid, true);
  assertEquals(validation.issues.length, 0);
  assertEquals(validation.registeredStrategies.length >= 3, true);
});

Deno.test("AggregationService - validateConfiguration detects missing strategies", () => {
  const emptyService = AggregationService.createWithStrategies({}).unwrap();

  const result = emptyService.validateConfiguration();

  assertEquals(result.isOk(), true);
  const validation = result.unwrap();
  assertEquals(validation.isValid, false);
  assertEquals(validation.issues.length > 0, true);
  assertEquals(
    validation.issues.some((issue) =>
      issue.includes("No aggregation strategies")
    ),
    true,
  );
});

Deno.test("AggregationService - validateConfiguration detects missing required strategies", () => {
  const partialService = AggregationService.createWithStrategies({
    merge: ArrayAggregationStrategy.create(), // Missing single and array
  }).unwrap();

  const result = partialService.validateConfiguration();

  assertEquals(result.isOk(), true);
  const validation = result.unwrap();
  assertEquals(validation.isValid, false);
  assertEquals(
    validation.issues.some((issue) => issue.includes("single")),
    true,
  );
  assertEquals(
    validation.issues.some((issue) => issue.includes("array")),
    true,
  );
});

Deno.test("AggregationService - aggregate with custom options", () => {
  const service = AggregationService.create().unwrap();
  const source = createTestFrontmatterData({ title: "Test" });
  const options = {
    metadata: {
      version: "2.0.0",
    },
  };

  const result = service.aggregate([source], "single", options);

  assertEquals(result.isOk(), true);
  const aggregationResult = result.unwrap();
  assertEquals(aggregationResult.metadata.getVersion(), "2.0.0");
});
