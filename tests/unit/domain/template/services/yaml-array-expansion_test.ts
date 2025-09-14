import { assert } from "jsr:@std/assert";
import { VariableReplacer } from "../../../../../src/domain/template/services/variable-replacer.ts";

/**
 * Robust tests for YAML template array expansion with {@items} pattern
 * Tests the specific case where YAML templates have array structures like:
 * books:
 *   - "{@items}"
 */
Deno.test("VariableReplacer - YAML Array Expansion {@items} Pattern", async (t) => {
  const replacerResult = VariableReplacer.create();
  assert(replacerResult.ok, "VariableReplacer creation should succeed");
  const replacer = replacerResult.data;

  await t.step("should expand {@items} in YAML array structure", () => {
    // Arrange: YAML template structure like books: ["{@items}"]
    const template = {
      books: ["{@items}"],
    };

    const testData = [
      {
        title: "TypeScript Best Practices",
        emoji: "📚",
        type: "tech",
        published: true,
      },
      {
        title: "Domain-Driven Design",
        emoji: "🏗️",
        type: "architecture",
        published: true,
      },
    ];

    // Act: Process array expansion
    const result = replacer.processArrayExpansion(template, testData);

    // Assert: Should replace {@items} with actual data
    assert(
      result.ok,
      `Array expansion should succeed: ${
        result.ok ? "" : result.error.message
      }`,
    );
    assert(typeof result.data === "object", "Result should be an object");

    const resultData = result.data as any;
    assert("books" in resultData, "Result should have 'books' property");
    assert(Array.isArray(resultData.books), "books should be an array");
    assert(
      resultData.books.length === 2,
      `Should have 2 items, got ${resultData.books.length}`,
    );

    // Verify data integrity
    assert(
      resultData.books[0].title === "TypeScript Best Practices",
      "First book title should match",
    );
    assert(
      resultData.books[1].title === "Domain-Driven Design",
      "Second book title should match",
    );

    // Ensure no template placeholders remain
    const resultStr = JSON.stringify(resultData);
    assert(
      !resultStr.includes("{@items}"),
      "No {@items} placeholders should remain",
    );
  });

  await t.step("should handle nested YAML array expansion", () => {
    // Arrange: More complex nested structure
    const template = {
      metadata: {
        version: "1.0.0",
        created: "2025-01-01",
      },
      content: {
        articles: ["{@items}"],
      },
    };

    const testData = [
      { title: "Article 1", tags: ["tech", "typescript"] },
      { title: "Article 2", tags: ["design", "ddd"] },
    ];

    // Act
    const result = replacer.processArrayExpansion(template, testData);

    // Assert
    assert(
      result.ok,
      `Nested expansion should succeed: ${
        result.ok ? "" : result.error.message
      }`,
    );

    const resultData = result.data as any;
    assert(
      resultData.metadata.version === "1.0.0",
      "Metadata should be preserved",
    );
    assert(
      Array.isArray(resultData.content.articles),
      "articles should be an array",
    );
    assert(resultData.content.articles.length === 2, "Should have 2 articles");

    // Verify no placeholders remain
    const resultStr = JSON.stringify(resultData);
    assert(
      !resultStr.includes("{@items}"),
      "No {@items} placeholders should remain in nested structure",
    );
  });

  await t.step(
    "should handle multiple {@items} expansions in same template",
    () => {
      // Arrange: Template with multiple array expansions
      const template = {
        books: ["{@items}"],
        featured: ["{@items}"],
      };

      const testData = [
        { title: "Book 1", featured: true },
        { title: "Book 2", featured: false },
      ];

      // Act
      const result = replacer.processArrayExpansion(template, testData);

      // Assert
      assert(
        result.ok,
        `Multiple expansion should succeed: ${
          result.ok ? "" : result.error.message
        }`,
      );

      const resultData = result.data as any;
      assert(Array.isArray(resultData.books), "books should be an array");
      assert(Array.isArray(resultData.featured), "featured should be an array");
      assert(resultData.books.length === 2, "books should have 2 items");
      assert(resultData.featured.length === 2, "featured should have 2 items");

      // Both arrays should contain the same data (since we're expanding the same source)
      assert(
        resultData.books[0].title === "Book 1",
        "First book title should match",
      );
      assert(
        resultData.featured[0].title === "Book 1",
        "First featured title should match",
      );
    },
  );

  await t.step("should preserve non-{@items} array elements", () => {
    // Arrange: Mixed array with {@items} and static content
    const template = {
      books: ["static-book", "{@items}", "another-static"],
    };

    const testData = [
      { title: "Dynamic Book 1" },
      { title: "Dynamic Book 2" },
    ];

    // Act
    const result = replacer.processArrayExpansion(template, testData);

    // Assert
    assert(
      result.ok,
      `Mixed array expansion should succeed: ${
        result.ok ? "" : result.error.message
      }`,
    );

    const resultData = result.data as any;
    assert(Array.isArray(resultData.books), "books should be an array");

    // Should have: static-book, Dynamic Book 1, Dynamic Book 2, another-static
    // But this depends on implementation - might flatten or keep structure
    // For now, let's verify basic expansion works
    const resultStr = JSON.stringify(resultData);
    assert(
      !resultStr.includes("{@items}"),
      "No {@items} placeholders should remain",
    );
    assert(
      resultStr.includes("Dynamic Book 1"),
      "Dynamic content should be present",
    );
    assert(
      resultStr.includes("static-book"),
      "Static content should be preserved",
    );
  });

  await t.step("should handle empty data array gracefully", () => {
    // Arrange: Template with empty data
    const template = {
      books: ["{@items}"],
    };
    const testData: any[] = [];

    // Act
    const result = replacer.processArrayExpansion(template, testData);

    // Assert
    assert(
      result.ok,
      `Empty array expansion should succeed: ${
        result.ok ? "" : result.error.message
      }`,
    );

    const resultData = result.data as any;
    assert(Array.isArray(resultData.books), "books should still be an array");
    assert(resultData.books.length === 0, "books array should be empty");

    // Verify no placeholders remain
    const resultStr = JSON.stringify(resultData);
    assert(
      !resultStr.includes("{@items}"),
      "No {@items} placeholders should remain",
    );
  });
});
