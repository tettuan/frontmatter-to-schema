import { assertEquals } from "jsr:@std/assert";
import { AggregationId } from "../../../../../src/domain/aggregation/value-objects/aggregation-id.ts";

Deno.test("AggregationId - create with valid string", () => {
  const result = AggregationId.create("test-id-123");

  assertEquals(result.isOk(), true);
  const id = result.unwrap();
  assertEquals(id.toString(), "test-id-123");
  assertEquals(id.getValue(), "test-id-123");
});

Deno.test("AggregationId - create with minimum length", () => {
  const result = AggregationId.create("abc");

  assertEquals(result.isOk(), true);
  const id = result.unwrap();
  assertEquals(id.toString(), "abc");
});

Deno.test("AggregationId - reject empty string", () => {
  const result = AggregationId.create("");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_AGGREGATION_ID");
  assertEquals(error.message.includes("empty"), true);
});

Deno.test("AggregationId - reject whitespace only", () => {
  const result = AggregationId.create("   ");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_AGGREGATION_ID");
  assertEquals(error.message.includes("empty or whitespace"), true);
});

Deno.test("AggregationId - reject too short string", () => {
  const result = AggregationId.create("ab");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_AGGREGATION_ID");
  assertEquals(error.message.includes("at least 3 characters"), true);
});

Deno.test("AggregationId - reject null input", () => {
  const result = AggregationId.create(null as any);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_AGGREGATION_ID");
  assertEquals(error.message.includes("non-empty string"), true);
});

Deno.test("AggregationId - reject undefined input", () => {
  const result = AggregationId.create(undefined as any);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_AGGREGATION_ID");
  assertEquals(error.message.includes("non-empty string"), true);
});

Deno.test("AggregationId - trim whitespace from input", () => {
  const result = AggregationId.create("  test-id  ");

  assertEquals(result.isOk(), true);
  const id = result.unwrap();
  assertEquals(id.toString(), "test-id");
});

Deno.test("AggregationId - generate unique IDs", () => {
  const id1 = AggregationId.generate();
  const id2 = AggregationId.generate();

  assertEquals(id1.equals(id2), false);
  assertEquals(id1.toString() !== id2.toString(), true);
  assertEquals(id1.isGenerated(), true);
  assertEquals(id2.isGenerated(), true);
});

Deno.test("AggregationId - generated IDs have proper format", () => {
  const id = AggregationId.generate();

  assertEquals(id.toString().startsWith("agg_"), true);
  assertEquals(id.toString().includes("_"), true);
  assertEquals(id.isGenerated(), true);
});

Deno.test("AggregationId - fromSource creates valid ID", () => {
  const result = AggregationId.fromSource("document-123");

  assertEquals(result.isOk(), true);
  const id = result.unwrap();
  assertEquals(id.toString().startsWith("agg_"), true);
  assertEquals(id.toString().includes("document_123"), true);
  assertEquals(id.isGenerated(), true);
});

Deno.test("AggregationId - fromSource with suffix", () => {
  const result = AggregationId.fromSource("doc", "merge");

  assertEquals(result.isOk(), true);
  const id = result.unwrap();
  assertEquals(id.toString().includes("doc"), true);
  assertEquals(id.toString().includes("merge"), true);
  assertEquals(id.isGenerated(), true);
});

Deno.test("AggregationId - fromSource cleans invalid characters", () => {
  const result = AggregationId.fromSource("doc@#$%ument!!");

  assertEquals(result.isOk(), true);
  const id = result.unwrap();
  assertEquals(id.toString().includes("doc____ument__"), true);
});

Deno.test("AggregationId - equals comparison", () => {
  const id1 = AggregationId.create("test-id").unwrap();
  const id2 = AggregationId.create("test-id").unwrap();
  const id3 = AggregationId.create("different-id").unwrap();

  assertEquals(id1.equals(id2), true);
  assertEquals(id1.equals(id3), false);
  assertEquals(id2.equals(id3), false);
});

Deno.test("AggregationId - hashCode generates consistent values", () => {
  const id1 = AggregationId.create("test-id").unwrap();
  const id2 = AggregationId.create("test-id").unwrap();
  const id3 = AggregationId.create("different-id").unwrap();

  assertEquals(id1.hashCode(), id2.hashCode());
  assertEquals(id1.hashCode() !== id3.hashCode(), true);
});

Deno.test("AggregationId - getTimestamp from generated ID", () => {
  const beforeTime = Date.now();
  const id = AggregationId.generate();
  const afterTime = Date.now();

  const timestamp = id.getTimestamp();
  assertEquals(timestamp !== null, true);
  assertEquals(timestamp! >= beforeTime, true);
  assertEquals(timestamp! <= afterTime, true);
});

Deno.test("AggregationId - getTimestamp returns null for non-generated ID", () => {
  const id = AggregationId.create("custom-id").unwrap();

  const timestamp = id.getTimestamp();
  assertEquals(timestamp, null);
});

Deno.test("AggregationId - createChild creates derived ID", () => {
  const parentId = AggregationId.create("parent-id").unwrap();
  const childResult = parentId.createChild("child");

  assertEquals(childResult.isOk(), true);
  const childId = childResult.unwrap();
  assertEquals(childId.toString().includes("parent-id"), true);
  assertEquals(childId.toString().includes("child"), true);
  assertEquals(childId.equals(parentId), false);
});

Deno.test("AggregationId - createChild with empty suffix fails", () => {
  const parentId = AggregationId.create("parent-id").unwrap();
  const childResult = parentId.createChild("");

  assertEquals(childResult.isError(), true);
});

Deno.test("AggregationId - isGenerated detects generated vs custom IDs", () => {
  const generatedId = AggregationId.generate();
  const customId = AggregationId.create("custom-id").unwrap();
  const sourceId = AggregationId.fromSource("source").unwrap();

  assertEquals(generatedId.isGenerated(), true);
  assertEquals(customId.isGenerated(), false);
  assertEquals(sourceId.isGenerated(), true);
});

Deno.test("AggregationId - toString provides readable representation", () => {
  const id = AggregationId.create("test-aggregation-id").unwrap();
  const toString = id.toString();

  assertEquals(toString, "test-aggregation-id");
  assertEquals(typeof toString, "string");
  assertEquals(toString.length > 0, true);
});
