import { assertEquals } from "jsr:@std/assert";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

Deno.test("FrontmatterData - create with valid data", () => {
  const data = { title: "Test Article", tags: ["test", "demo"] };
  const result = FrontmatterData.create(data);

  assertEquals(result.isOk(), true);
  const frontmatter = result.unwrap();
  assertEquals(frontmatter.getData(), data);
});

Deno.test("FrontmatterData - reject null data", () => {
  const result = FrontmatterData.create(null);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DATA");
});

Deno.test("FrontmatterData - reject undefined data", () => {
  const result = FrontmatterData.create(undefined);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DATA");
});

Deno.test("FrontmatterData - accept empty object", () => {
  const result = FrontmatterData.create({});

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().getData(), {});
});

Deno.test("FrontmatterData - getProperty returns existing property", () => {
  const data = { title: "Test Article", author: "John Doe" };
  const frontmatter = FrontmatterData.create(data).unwrap();

  assertEquals(frontmatter.getProperty("title"), "Test Article");
  assertEquals(frontmatter.getProperty("author"), "John Doe");
});

Deno.test("FrontmatterData - getProperty returns undefined for missing property", () => {
  const data = { title: "Test Article" };
  const frontmatter = FrontmatterData.create(data).unwrap();

  assertEquals(frontmatter.getProperty("missing"), undefined);
});

Deno.test("FrontmatterData - hasProperty checks existence", () => {
  const data = { title: "Test Article", tags: null };
  const frontmatter = FrontmatterData.create(data).unwrap();

  assertEquals(frontmatter.hasProperty("title"), true);
  assertEquals(frontmatter.hasProperty("tags"), true);
  assertEquals(frontmatter.hasProperty("missing"), false);
});

Deno.test("FrontmatterData - getNestedProperty with dot notation", () => {
  const data = {
    metadata: {
      title: "Nested Title",
      author: { name: "John", email: "john@example.com" },
    },
  };
  const frontmatter = FrontmatterData.create(data).unwrap();

  assertEquals(frontmatter.getNestedProperty("metadata.title"), "Nested Title");
  assertEquals(frontmatter.getNestedProperty("metadata.author.name"), "John");
  assertEquals(frontmatter.getNestedProperty("metadata.missing"), undefined);
});

Deno.test("FrontmatterData - getArrayProperty returns array values", () => {
  const data = {
    tags: ["test", "demo"],
    categories: ["tech"],
    description: "Not an array",
  };
  const frontmatter = FrontmatterData.create(data).unwrap();

  assertEquals(frontmatter.getArrayProperty("tags"), ["test", "demo"]);
  assertEquals(frontmatter.getArrayProperty("categories"), ["tech"]);
  assertEquals(frontmatter.getArrayProperty("description"), undefined);
  assertEquals(frontmatter.getArrayProperty("missing"), undefined);
});

Deno.test("FrontmatterData - merge combines data from multiple sources", () => {
  const data1 = { title: "Article", author: "John" };
  const data2 = { title: "Updated Title", tags: ["test"] };

  const frontmatter1 = FrontmatterData.create(data1).unwrap();
  const frontmatter2 = FrontmatterData.create(data2).unwrap();

  const merged = frontmatter1.merge(frontmatter2);
  const mergedData = merged.getData();

  assertEquals(mergedData.title, "Updated Title"); // data2 overwrites
  assertEquals(mergedData.author, "John"); // from data1
  assertEquals(mergedData.tags, ["test"]); // from data2
});

Deno.test("FrontmatterData - isEmpty checks for empty data", () => {
  const emptyFrontmatter = FrontmatterData.create({}).unwrap();
  const nonEmptyFrontmatter = FrontmatterData.create({ title: "Test" })
    .unwrap();

  assertEquals(emptyFrontmatter.isEmpty(), true);
  assertEquals(nonEmptyFrontmatter.isEmpty(), false);
});
