import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { Registry } from "../../../src/domain/core/registry.ts";
import { AnalysisResult, ValidFilePath } from "../../../src/domain/core/types.ts";
import { ResultUtils } from "../../../src/domain/core/result.ts";

Deno.test("Registry", async (t) => {
  await t.step("should add and retrieve results", () => {
    const registry = new Registry<string>();
    const result = new AnalysisResult(
      ResultUtils.unwrap(ValidFilePath.create("/test.md")),
      "test data",
    );

    registry.add("key1", result);

    assertEquals(registry.has("key1"), true);
    assertEquals(registry.get("key1"), result);
    assertEquals(registry.size(), 1);
  });

  await t.step("should return all keys and values", () => {
    const registry = new Registry<number>();

    registry.add("a", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/a.md")), 1));
    registry.add("b", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/b.md")), 2));
    registry.add("c", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/c.md")), 3));

    const keys = registry.keys();
    assertEquals(keys.length, 3);
    assertEquals(keys.includes("a"), true);

    const values = registry.values();
    assertEquals(values.length, 3);
    assertEquals(values[0].extractedData, 1);
  });

  await t.step("should filter results", () => {
    const registry = new Registry<number>();

    registry.add("a", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/a.md")), 10));
    registry.add("b", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/b.md")), 20));
    registry.add("c", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/c.md")), 30));

    const filtered = registry.filter((result) => result.extractedData > 15);

    assertEquals(filtered.size(), 2);
    assertEquals(filtered.has("b"), true);
    assertEquals(filtered.has("c"), true);
    assertEquals(filtered.has("a"), false);
  });

  await t.step("should map results", () => {
    const registry = new Registry<number>();

    registry.add("a", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/a.md")), 10));
    registry.add("b", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/b.md")), 20));

    const mapped = registry.map((result) =>
      new AnalysisResult(
        result.sourceFile,
        result.extractedData * 2,
      )
    );

    assertEquals(mapped.get("a")?.extractedData, 20);
    assertEquals(mapped.get("b")?.extractedData, 40);
  });

  await t.step("should merge registries", () => {
    const registry1 = new Registry<string>();
    const registry2 = new Registry<string>();

    registry1.add("a", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/a.md")), "data1"));
    registry2.add("b", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/b.md")), "data2"));
    registry2.add("c", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/c.md")), "data3"));

    registry1.merge(registry2);

    assertEquals(registry1.size(), 3);
    assertEquals(registry1.has("a"), true);
    assertEquals(registry1.has("b"), true);
    assertEquals(registry1.has("c"), true);
  });

  await t.step("should convert to object", () => {
    const registry = new Registry<string>();

    registry.add("key1", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/a.md")), "value1"));
    registry.add("key2", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/b.md")), "value2"));

    const obj = registry.toObject();

    assertEquals(obj.key1, "value1");
    assertEquals(obj.key2, "value2");
  });

  await t.step("should convert to array", () => {
    const registry = new Registry<number>();

    registry.add("a", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/a.md")), 1));
    registry.add("b", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/b.md")), 2));

    const arr = registry.toArray();

    assertEquals(arr.length, 2);
    assertEquals(arr[0].key, "a");
    assertEquals(arr[0].result.extractedData, 1);
    assertEquals(arr[1].key, "b");
    assertEquals(arr[1].result.extractedData, 2);
  });

  await t.step("should clear all results", () => {
    const registry = new Registry();

    registry.add("a", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/a.md")), "data"));
    registry.add("b", new AnalysisResult(ResultUtils.unwrap(ValidFilePath.create("/b.md")), "data"));

    assertEquals(registry.size(), 2);

    registry.clear();

    assertEquals(registry.size(), 0);
    assertEquals(registry.has("a"), false);
    assertEquals(registry.has("b"), false);
  });
});
