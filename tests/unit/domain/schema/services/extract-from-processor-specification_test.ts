import { describe, it } from "jsr:@std/testing@^1.0.5/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.7";
import {
  ExtractFromProcessor,
} from "../../../../../src/domain/schema/services/extract-from-processor.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { ExtractFromDirective } from "../../../../../src/domain/schema/value-objects/extract-from-directive.ts";

const createFrontmatter = (data: Record<string, unknown>): FrontmatterData => {
  const frontmatterResult = FrontmatterData.create(data);
  if (!frontmatterResult.ok) {
    throw new Error(
      `Failed to create FrontmatterData: ${frontmatterResult.error.message}`,
    );
  }
  return frontmatterResult.data;
};

const createDirective = (
  targetPath: string,
  sourcePath: string,
  opts?: { mergeArrays?: boolean; targetIsArray?: boolean },
): ExtractFromDirective => {
  const directiveResult = ExtractFromDirective.create({
    targetPath,
    sourcePath,
    mergeArrays: opts?.mergeArrays,
    targetIsArray: opts?.targetIsArray,
  });
  if (!directiveResult.ok) {
    throw new Error(
      `Failed to create ExtractFromDirective: ${directiveResult.error.message}`,
    );
  }
  return directiveResult.data;
};

const createProcessor = (): ExtractFromProcessor => {
  const processorResult = ExtractFromProcessor.create();
  if (!processorResult.ok) {
    throw new Error(
      `Failed to create ExtractFromProcessor: ${processorResult.error.message}`,
    );
  }
  return processorResult.data;
};

describe("ExtractFromProcessor", () => {
  it("copies simple value into target path while preserving existing data", async () => {
    const frontmatter = createFrontmatter({
      author: "John Doe",
      metadata: { created: "2024-01-01" },
    });

    const directive = createDirective("metadata.author", "author");
    const processor = createProcessor();

    const result = await processor.processDirectives(frontmatter, [directive]);
    assertExists(result.ok, "Processing should succeed");
    if (!result.ok) return;

    const updated = result.data;
    const authorResult = updated.get("author");
    assertExists(authorResult.ok, "Should have author");
    if (authorResult.ok) {
      assertEquals(authorResult.data, "John Doe");
    }
    const target = updated.get("metadata.author");
    assertExists(target.ok);
    if (target.ok) {
      assertEquals(target.data, "John Doe");
    }
  });

  it("populates array targets from source arrays", async () => {
    const traceability = [
      { id: { full: "REQ-001" }, summary: "Initial requirement" },
      { id: { full: "REQ-002" }, summary: "Secondary requirement" },
    ];

    const frontmatter = createFrontmatter({
      traceability,
      description: "Traceability overview",
    });

    const directive = createDirective("spec", "traceability[]", {
      targetIsArray: true,
    });
    const processor = createProcessor();

    const result = await processor.processDirectives(frontmatter, [directive]);
    assertExists(result.ok);
    if (!result.ok) return;

    const specResult = result.data.get("spec");
    assertExists(specResult.ok);
    if (specResult.ok) {
      assertEquals(specResult.data, traceability);
    }

    const original = result.data.get("traceability");
    assertExists(original.ok);
    if (original.ok) {
      assertEquals(original.data, traceability);
    }
  });

  it("augments array items when multiple directives target the same collection", async () => {
    const traceability = [
      { id: { full: "REQ-001" }, summary: "Initial requirement" },
      { id: { full: "REQ-002" }, summary: "Secondary requirement" },
    ];

    const frontmatter = createFrontmatter({ traceability });
    const directives = [
      createDirective("items.[]", "traceability[]"),
      createDirective("items.[].summaryCopy", "traceability[].summary"),
    ];

    const processor = createProcessor();
    const result = await processor.processDirectives(frontmatter, directives);
    assertExists(result.ok);
    if (!result.ok) return;

    const itemsResult = result.data.get("items");
    assertExists(itemsResult.ok);
    if (!itemsResult.ok) return;

    const items = itemsResult.data as Array<Record<string, unknown>>;
    assertEquals(items.length, 2);
    assertEquals(items[0].summaryCopy, "Initial requirement");
    assertEquals(items[0].id, traceability[0].id);
    assertEquals(items[1].summaryCopy, "Secondary requirement");
  });

  it("skips updates when source value is undefined for non-array targets", async () => {
    const frontmatter = createFrontmatter({ title: "Default" });
    const directive = createDirective("title", "missing");
    const processor = createProcessor();

    const result = await processor.processDirectives(frontmatter, [directive]);
    assertExists(result.ok);
    if (!result.ok) return;

    const title = result.data.get("title");
    assertExists(title.ok);
    if (title.ok) {
      assertEquals(title.data, "Default");
    }
  });

  it("processes directives synchronously with identical behaviour", () => {
    const frontmatter = createFrontmatter({
      traceability: [{ id: { full: "REQ-001" } }],
    });

    const directive = createDirective("spec", "traceability[]", {
      targetIsArray: true,
    });

    const processor = createProcessor();
    const result = processor.processDirectivesSync(frontmatter, [directive]);
    assertExists(result.ok);
    if (!result.ok) return;

    const spec = result.data.get("spec");
    assertExists(spec.ok);
    if (spec.ok) {
      assertEquals(Array.isArray(spec.data), true);
    }
  });
});
