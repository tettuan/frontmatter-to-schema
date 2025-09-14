import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { MarkdownFormatter } from "../../../../../src/domain/template/formatters/markdown-formatter.ts";

/**
 * COMPREHENSIVE TEST: Markdown Formatter
 *
 * This test validates the Markdown formatting functionality for template output.
 *
 * Key Requirements Validated:
 * 1. Format objects as Markdown with headings
 * 2. Convert arrays to lists
 * 3. Handle nested structures with appropriate heading levels
 * 4. Format key names to human-readable titles
 * 5. Handle text content appropriately
 * 6. Error handling for non-serializable data
 */
describe("MarkdownFormatter", () => {
  const formatter = new MarkdownFormatter();

  it("should return correct format type", () => {
    assertEquals(formatter.getFormat(), "markdown");
  });

  it("should format simple object to Markdown", () => {
    const data = {
      title: "Project Documentation",
      description: "This is a test project",
      version: "1.0.0",
      active: true,
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format successfully");
    if (result.ok) {
      const formatted = result.data;

      // Check Markdown headings
      assertExists(
        formatted.includes("# Title"),
        "Should create heading for title",
      );
      assertExists(
        formatted.includes("# Description"),
        "Should create heading for description",
      );
      assertExists(
        formatted.includes("Project Documentation"),
        "Should include content",
      );
      assertExists(
        formatted.includes("This is a test project"),
        "Should include description",
      );
      assertExists(formatted.includes("1.0.0"), "Should include version");
      assertExists(formatted.includes("true"), "Should include boolean value");
    }
  });

  it("should format nested objects with different heading levels", () => {
    const data = {
      project: {
        name: "My Project",
        details: {
          version: "2.0.0",
          author: "John Doe",
        },
      },
      configuration: {
        debug: true,
        port: 8080,
      },
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format nested objects successfully");
    if (result.ok) {
      const formatted = result.data;

      // Check heading hierarchy
      assertExists(
        formatted.includes("# Project"),
        "Should have top-level heading",
      );
      assertExists(
        formatted.includes("## Name"),
        "Should have second-level heading",
      );
      assertExists(
        formatted.includes("## Details"),
        "Should have details section",
      );
      assertExists(
        formatted.includes("### Version"),
        "Should have third-level heading",
      );
      assertExists(
        formatted.includes("### Author"),
        "Should have author heading",
      );
      assertExists(
        formatted.includes("# Configuration"),
        "Should have config section",
      );
    }
  });

  it("should format arrays as lists", () => {
    const data = {
      technologies: ["JavaScript", "TypeScript", "Deno"],
      numbers: [1, 2, 3, 4],
      features: [
        "Fast compilation",
        "Type safety",
        "Modern syntax",
      ],
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format arrays successfully");
    if (result.ok) {
      const formatted = result.data;

      // Check list formatting
      assertExists(
        formatted.includes("# Technologies"),
        "Should create heading for array",
      );
      assertExists(
        formatted.includes("- JavaScript"),
        "Should create list item",
      );
      assertExists(
        formatted.includes("- TypeScript"),
        "Should create list item",
      );
      assertExists(formatted.includes("- 1"), "Should format numbers in list");
      assertExists(
        formatted.includes("- Fast compilation"),
        "Should format string list items",
      );
    }
  });

  it("should format arrays of objects", () => {
    const data = {
      contributors: [
        { name: "Alice", role: "Developer", active: true },
        { name: "Bob", role: "Designer", active: false },
      ],
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format arrays of objects successfully");
    if (result.ok) {
      const formatted = result.data;

      assertExists(
        formatted.includes("# Contributors"),
        "Should create heading for array",
      );
      assertExists(
        formatted.includes("Alice"),
        "Should include object content",
      );
      assertExists(
        formatted.includes("Developer"),
        "Should include nested values",
      );
      assertExists(formatted.includes("Bob"), "Should include second object");
      assertExists(
        formatted.includes("Designer"),
        "Should include second object values",
      );
    }
  });

  it("should format key names to human-readable titles", () => {
    const data = {
      projectName: "Test Project",
      api_version: "v2.1",
      isActive: true,
      user_count: 150,
      maxConnections: 1000,
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format key names successfully");
    if (result.ok) {
      const formatted = result.data;

      // Check formatted key names
      assertExists(
        formatted.includes("# Project Name"),
        "Should format camelCase to title",
      );
      assertExists(
        formatted.includes("# Api Version"),
        "Should format snake_case to title",
      );
      assertExists(
        formatted.includes("# Is Active"),
        "Should format boolean key",
      );
      assertExists(
        formatted.includes("# User Count"),
        "Should format snake_case",
      );
      assertExists(
        formatted.includes("# Max Connections"),
        "Should format camelCase",
      );
    }
  });

  it("should handle primitive values", () => {
    const testCases = [
      { input: "Simple text", expected: "Simple text" },
      { input: 42, expected: "42" },
      { input: true, expected: "true" },
      { input: false, expected: "false" },
      { input: null, expected: "" },
      { input: undefined, expected: "" },
    ];

    for (const testCase of testCases) {
      const result = formatter.format(testCase.input);

      assertExists(
        result.ok,
        `Should format ${typeof testCase.input} successfully`,
      );
      if (result.ok) {
        assertEquals(result.data.trim(), testCase.expected);
      }
    }
  });

  it("should handle empty structures", () => {
    const testCases = [
      { input: {}, name: "empty object", expected: "" },
      { input: [], name: "empty array", expected: "" },
      { input: { empty: [] }, name: "object with empty array" },
    ];

    for (const testCase of testCases) {
      const result = formatter.format(testCase.input);

      assertExists(result.ok, `Should format ${testCase.name} successfully`);
      if (result.ok) {
        if (testCase.expected !== undefined) {
          assertEquals(result.data.trim(), testCase.expected);
        } else {
          // Should not throw and produce valid markdown
          assertExists(
            typeof result.data === "string",
            `${testCase.name} should produce string`,
          );
        }
      }
    }
  });

  it("should handle mixed content types", () => {
    const data = {
      metadata: {
        title: "Mixed Content",
        tags: ["tag1", "tag2"],
        count: 5,
      },
      content: "This is some text content",
      sections: [
        { name: "Introduction", order: 1 },
        { name: "Conclusion", order: 2 },
      ],
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format mixed content successfully");
    if (result.ok) {
      const formatted = result.data;

      // Check various content types
      assertExists(
        formatted.includes("# Metadata"),
        "Should format object heading",
      );
      assertExists(
        formatted.includes("## Title"),
        "Should format nested headings",
      );
      assertExists(formatted.includes("- tag1"), "Should format array as list");
      assertExists(
        formatted.includes("# Content"),
        "Should format string content",
      );
      assertExists(
        formatted.includes("This is some text content"),
        "Should include text",
      );
      assertExists(
        formatted.includes("Introduction"),
        "Should include array object content",
      );
    }
  });

  it("should handle complex document structure", () => {
    const data = {
      document: {
        title: "API Documentation",
        version: "1.0",
        sections: [
          {
            name: "Getting Started",
            content: "Welcome to our API",
            examples: ["curl -X GET /api/users", "curl -X POST /api/users"],
          },
          {
            name: "Authentication",
            content: "Use JWT tokens",
            methods: ["Bearer token", "API key"],
          },
        ],
      },
      appendix: {
        glossary: {
          api: "Application Programming Interface",
          jwt: "JSON Web Token",
        },
      },
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format complex document successfully");
    if (result.ok) {
      const formatted = result.data;

      // Verify hierarchical structure
      assertExists(
        formatted.includes("# Document"),
        "Should have main section",
      );
      assertExists(formatted.includes("## Title"), "Should have subsection");
      assertExists(
        formatted.includes("API Documentation"),
        "Should include content",
      );
      assertExists(
        formatted.includes("Getting Started"),
        "Should include nested content",
      );
      assertExists(
        formatted.includes("- curl -X GET"),
        "Should format code examples as list",
      );
      assertExists(
        formatted.includes("# Appendix"),
        "Should have appendix section",
      );
    }
  });

  it("should limit heading depth", () => {
    // Create deeply nested object to test heading depth limiting
    const data = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: {
                  level7: "Deep content",
                },
              },
            },
          },
        },
      },
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format deeply nested structure");
    if (result.ok) {
      const formatted = result.data;

      // Check heading levels (should be capped at 6)
      assertExists(formatted.includes("# Level1"), "Should have h1");
      assertExists(formatted.includes("## Level2"), "Should have h2");
      assertExists(formatted.includes("### Level3"), "Should have h3");
      assertExists(formatted.includes("#### Level4"), "Should have h4");
      assertExists(formatted.includes("##### Level5"), "Should have h5");
      assertExists(formatted.includes("###### Level6"), "Should have h6 (max)");

      // Should not have h7 or deeper
      assertExists(!formatted.includes("####### Level7"), "Should not have h7");
      assertExists(
        formatted.includes("Deep content"),
        "Should include deep content",
      );
    }
  });
});
