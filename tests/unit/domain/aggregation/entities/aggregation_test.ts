import { assertEquals } from "@std/assert";
import {
  Aggregation,
  AggregationOptions,
} from "../../../../../src/domain/aggregation/entities/aggregation.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { SingleSourceStrategy } from "../../../../../src/domain/aggregation/services/aggregation-strategy.ts";
import { Result } from "../../../../../src/domain/shared/types/result.ts";
import { AggregationError } from "../../../../../src/domain/shared/types/errors.ts";

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

Deno.test("Aggregation - create with single source", () => {
  const frontmatterData = createTestFrontmatterData({
    title: "Test",
    author: "John",
  });
  const strategy = SingleSourceStrategy.create();

  const result = Aggregation.create([frontmatterData], strategy);

  assertEquals(result.isOk(), true);
  const aggregation = result.unwrap();
  assertEquals(aggregation.getSourceCount(), 1);
  assertEquals(aggregation.getStrategyType(), "single");
});

Deno.test("Aggregation - create with multiple sources", () => {
  const source1 = createTestFrontmatterData({ title: "Doc1" });
  const source2 = createTestFrontmatterData({ title: "Doc2" });
  const strategy = SingleSourceStrategy.create();

  const result = Aggregation.create([source1, source2], strategy);

  assertEquals(result.isOk(), true);
  const aggregation = result.unwrap();
  assertEquals(aggregation.getSourceCount(), 2);
});

Deno.test("Aggregation - reject empty sources array", () => {
  const strategy = SingleSourceStrategy.create();

  const result = Aggregation.create([], strategy);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "EMPTY_SOURCES");
  assertEquals(error.message.includes("empty sources"), true);
});

Deno.test("Aggregation - create with custom options", () => {
  const frontmatterData = createTestFrontmatterData({ title: "Test" });
  const strategy = SingleSourceStrategy.create();
  const options: AggregationOptions = {
    metadata: {
      version: "2.0.0",
    },
  };

  const result = Aggregation.create([frontmatterData], strategy, options);

  assertEquals(result.isOk(), true);
  const aggregation = result.unwrap();
  assertEquals(aggregation.getMetadata().getVersion(), "2.0.0");
});

Deno.test("Aggregation - aggregate single source successfully", () => {
  const testData = { title: "Test Document", content: "Sample content" };
  const frontmatterData = createTestFrontmatterData(testData);
  const strategy = SingleSourceStrategy.create();

  const aggregation = Aggregation.create([frontmatterData], strategy).unwrap();
  const result = aggregation.aggregate();

  assertEquals(result.isOk(), true);
  const aggregationResult = result.unwrap();
  assertEquals(aggregationResult.sourceCount, 1);
  assertEquals(aggregationResult.data.title, "Test Document");
  assertEquals(aggregationResult.data.content, "Sample content");
});

Deno.test("Aggregation - aggregate measures execution time", () => {
  const frontmatterData = createTestFrontmatterData({ title: "Test" });
  const strategy = SingleSourceStrategy.create();

  const aggregation = Aggregation.create([frontmatterData], strategy).unwrap();
  const result = aggregation.aggregate();

  assertEquals(result.isOk(), true);
  const aggregationResult = result.unwrap();
  assertEquals(aggregationResult.metadata.getExecutionTime() >= 0, true);
});

Deno.test("Aggregation - getId returns unique identifier", () => {
  const frontmatterData = createTestFrontmatterData({ title: "Test" });
  const strategy = SingleSourceStrategy.create();

  const aggregation1 = Aggregation.create([frontmatterData], strategy).unwrap();
  const aggregation2 = Aggregation.create([frontmatterData], strategy).unwrap();

  assertEquals(aggregation1.getId().equals(aggregation2.getId()), false);
});

Deno.test("Aggregation - canProcess checks strategy compatibility", () => {
  const frontmatterData = createTestFrontmatterData({ title: "Test" });
  const strategy = SingleSourceStrategy.create();

  const aggregation = Aggregation.create([frontmatterData], strategy).unwrap();

  // Single source strategy should accept exactly one source
  assertEquals(aggregation.canProcess([frontmatterData]), true);
  assertEquals(
    aggregation.canProcess([frontmatterData, frontmatterData]),
    false,
  );
  assertEquals(aggregation.canProcess([]), false);
});

Deno.test("Aggregation - toString provides meaningful representation", () => {
  const frontmatterData = createTestFrontmatterData({ title: "Test" });
  const strategy = SingleSourceStrategy.create();

  const aggregation = Aggregation.create([frontmatterData], strategy).unwrap();
  const stringRep = aggregation.toString();

  assertEquals(stringRep.includes("Aggregation"), true);
  assertEquals(stringRep.includes("1 sources"), true);
  assertEquals(stringRep.includes("single"), true);
});

Deno.test("Aggregation - equals compares by ID", () => {
  const frontmatterData = createTestFrontmatterData({ title: "Test" });
  const strategy = SingleSourceStrategy.create();

  const aggregation1 = Aggregation.create([frontmatterData], strategy).unwrap();
  const aggregation2 = Aggregation.create([frontmatterData], strategy).unwrap();

  assertEquals(aggregation1.equals(aggregation1), true);
  assertEquals(aggregation1.equals(aggregation2), false);
});

Deno.test("Aggregation - getMetadata returns aggregation metadata", () => {
  const frontmatterData = createTestFrontmatterData({ title: "Test" });
  const strategy = SingleSourceStrategy.create();

  const aggregation = Aggregation.create([frontmatterData], strategy).unwrap();
  const metadata = aggregation.getMetadata();

  assertEquals(metadata.getSourceCount(), 1);
  assertEquals(metadata.getStrategyType(), "single");
  assertEquals(metadata.getVersion(), "1.0.0");
  assertEquals(metadata.getExecutionTime(), 0);
});

Deno.test("Aggregation - metadata withExecutionTime creates new instance", () => {
  const frontmatterData = createTestFrontmatterData({ title: "Test" });
  const strategy = SingleSourceStrategy.create();

  const aggregation = Aggregation.create([frontmatterData], strategy).unwrap();
  const originalMetadata = aggregation.getMetadata();
  const updatedMetadata = originalMetadata.withExecutionTime(100);

  assertEquals(originalMetadata.getExecutionTime(), 0);
  assertEquals(updatedMetadata.getExecutionTime(), 100);
  assertEquals(
    updatedMetadata.getSourceCount(),
    originalMetadata.getSourceCount(),
  );
});

Deno.test("Aggregation - metadata toJSON provides serializable data", () => {
  const frontmatterData = createTestFrontmatterData({ title: "Test" });
  const strategy = SingleSourceStrategy.create();

  const aggregation = Aggregation.create([frontmatterData], strategy).unwrap();
  const metadata = aggregation.getMetadata();
  const json = metadata.toJSON();

  assertEquals(typeof json, "object");
  assertEquals(json.sourceCount, 1);
  assertEquals(json.strategyType, "single");
  assertEquals(json.version, "1.0.0");
  assertEquals(json.executionTime, 0);
  assertEquals(json.createdAt instanceof Date, true);
});

Deno.test("Aggregation - aggregate handles strategy errors", () => {
  // Create a mock strategy that always fails
  const failingStrategy = {
    getType: () => "failing",
    combine: (): Result<Record<string, unknown>, AggregationError> => {
      throw new Error("Strategy failure");
    },
    isCompatible: () => true,
    getConfiguration: () => ({
      name: "Failing Strategy",
      description: "Always fails",
      supportedSourceTypes: ["frontmatter"],
      minimumSources: 1,
    }),
  };

  const frontmatterData = createTestFrontmatterData({ title: "Test" });
  const aggregation = Aggregation.create([frontmatterData], failingStrategy)
    .unwrap();
  const result = aggregation.aggregate();

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "EXECUTION_ERROR");
  assertEquals(error.message.includes("Strategy failure"), true);
});

Deno.test("Aggregation - aggregate handles strategy result errors", () => {
  // Create a mock strategy that returns an error result
  const errorStrategy = {
    getType: () => "error",
    combine: (): Result<Record<string, unknown>, AggregationError> => {
      return Result.error(
        new AggregationError("Strategy processing error", "STRATEGY_ERROR", {}),
      );
    },
    isCompatible: () => true,
    getConfiguration: () => ({
      name: "Error Strategy",
      description: "Returns error result",
      supportedSourceTypes: ["frontmatter"],
      minimumSources: 1,
    }),
  };

  const frontmatterData = createTestFrontmatterData({ title: "Test" });
  const aggregation = Aggregation.create([frontmatterData], errorStrategy)
    .unwrap();
  const result = aggregation.aggregate();

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "STRATEGY_ERROR");
  assertEquals(error.message.includes("Strategy processing error"), true);
});
