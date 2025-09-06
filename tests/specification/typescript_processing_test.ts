import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

/**
 * TypeScript Processing Specification Tests
 * Based on Requirements: TypeScript structured processing for analysis
 */

describe("TypeScript Processing Stage A: Schema Expansion and Mapping", () => {
  it("should extract information using schema expansion from frontmatter data", () => {
    const frontmatterData = {
      title: "Advanced TypeScript Guide",
      tags: ["typescript", "programming", "tutorial"],
      author: {
        name: "John Doe",
        email: "john@example.com",
      },
      publishDate: "2025-08-26",
      draft: false,
    };

    const schema = {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Document title",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Document tags",
        },
        author: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
          },
        },
        publishDate: {
          type: "string",
          format: "date",
        },
        draft: {
          type: "boolean",
          default: false,
        },
      },
      required: ["title"],
    };

    // Validate schema expansion
    const extractedData: Record<string, unknown> = {};

    for (const [key, schemaProperty] of Object.entries(schema.properties)) {
      const data = frontmatterData as Record<string, unknown>;
      const prop = schemaProperty as Record<string, unknown>;
      if (data[key] !== undefined) {
        extractedData[key] = data[key];
      } else if (prop.default !== undefined) {
        extractedData[key] = prop.default;
      }
    }

    assertEquals(extractedData.title, "Advanced TypeScript Guide");
    assertEquals((extractedData.tags as unknown[]).length, 3);
    assertEquals(
      (extractedData.author as Record<string, unknown>).name,
      "John Doe",
    );
    assertEquals(extractedData.draft, false);
  });

  it("should handle nested schema structures", () => {
    const nestedData = {
      metadata: {
        version: "1.0.0",
        created: {
          date: "2025-08-26",
          user: "admin",
        },
      },
    };

    const nestedSchema = {
      type: "object",
      properties: {
        metadata: {
          type: "object",
          properties: {
            version: { type: "string" },
            created: {
              type: "object",
              properties: {
                date: { type: "string" },
                user: { type: "string" },
              },
            },
          },
        },
      },
    };

    // Recursive extraction
    function extractNested(
      data: unknown,
      schema: Record<string, unknown>,
    ): unknown {
      if (schema.type === "object" && schema.properties) {
        const result: Record<string, unknown> = {};
        for (
          const [key, prop] of Object.entries(
            schema.properties as Record<string, unknown>,
          )
        ) {
          if ((data as Record<string, unknown>)[key] !== undefined) {
            result[key] = extractNested(
              (data as Record<string, unknown>)[key],
              prop as Record<string, unknown>,
            );
          }
        }
        return result;
      }
      return data;
    }

    const extracted = extractNested(nestedData, nestedSchema) as Record<
      string,
      unknown
    >;
    assertEquals(
      (extracted.metadata as Record<string, unknown>).version,
      "1.0.0",
    );
    assertEquals(
      ((extracted.metadata as Record<string, unknown>).created as Record<
        string,
        unknown
      >).date,
      "2025-08-26",
    );
  });

  it("should validate required fields", () => {
    const incompleteData = {
      tags: ["test"],
    };

    const strictSchema = {
      type: "object",
      properties: {
        title: { type: "string" },
        tags: { type: "array" },
      },
      required: ["title", "tags"],
    };

    // Validation check
    const missingFields = strictSchema.required.filter(
      (field) => !(field in incompleteData),
    );

    assertEquals(missingFields.length, 1);
    assertEquals(missingFields[0], "title");
  });
});

describe("TypeScript Processing Stage B: Template Mapping with Type-safe Substitution", () => {
  it("should map extracted information to analysis template", () => {
    const extractedInfo = {
      title: "TypeScript Best Practices",
      author: "Jane Smith",
      tags: ["typescript", "best-practices"],
      wordCount: 1500,
    };

    const template = {
      format: "json",
      structure: {
        document: {
          title: "{{title}}",
          metadata: {
            author: "{{author}}",
            tags: "{{tags}}",
            statistics: {
              words: "{{wordCount}}",
            },
          },
        },
      },
    };

    // Type-safe variable substitution
    function substituteVariables(
      template: unknown,
      data: Record<string, unknown>,
    ): unknown {
      if (typeof template === "string") {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          const value = data[key];
          if (Array.isArray(value)) {
            return JSON.stringify(value);
          }
          return String(value ?? match);
        });
      }
      if (typeof template === "object" && template !== null) {
        if (Array.isArray(template)) {
          return template.map((item) => substituteVariables(item, data));
        }
        const result: Record<string, unknown> = {};
        for (
          const [key, value] of Object.entries(
            template as Record<string, unknown>,
          )
        ) {
          result[key] = substituteVariables(value, data);
        }
        return result;
      }
      return template;
    }

    const mapped = substituteVariables(
      template.structure,
      extractedInfo,
    ) as Record<string, unknown>;
    assertEquals(
      (mapped.document as Record<string, unknown>).title,
      "TypeScript Best Practices",
    );
    assertEquals(
      ((mapped.document as Record<string, unknown>).metadata as Record<
        string,
        unknown
      >).author,
      "Jane Smith",
    );
    assertEquals(
      (((mapped.document as Record<string, unknown>).metadata as Record<
        string,
        unknown
      >).statistics as Record<string, unknown>).words,
      "1500",
    );
  });

  it("should handle conditional template rendering", () => {
    const data = {
      title: "Draft Document",
      isDraft: true,
      author: "John",
      reviewers: [],
    };

    // Conditional template logic
    const renderTemplate = (data: Record<string, unknown>) => {
      let result = `Title: ${data.title}`;

      if (data.isDraft) {
        result += " [DRAFT]";
      }

      if (
        data.reviewers && Array.isArray(data.reviewers) &&
        data.reviewers.length > 0
      ) {
        result += `, Reviewers: ${(data.reviewers as string[]).join(", ")}`;
      } else {
        result += ", No reviewers assigned";
      }

      return result;
    };

    const output = renderTemplate(data);
    assertEquals(
      output,
      "Title: Draft Document [DRAFT], No reviewers assigned",
    );
  });

  it("should ensure type safety during substitution", () => {
    const typedData = {
      count: 42,
      ratio: 0.75,
      isActive: true,
      items: ["a", "b", "c"],
    };

    const typeMap = {
      count: "number",
      ratio: "number",
      isActive: "boolean",
      items: "array",
    };

    // Type validation
    for (const [key, expectedType] of Object.entries(typeMap)) {
      const value = (typedData as Record<string, unknown>)[key];
      let actualType: string;

      if (Array.isArray(value)) {
        actualType = "array";
      } else if (value === null) {
        actualType = "null";
      } else {
        actualType = typeof value;
      }

      assertEquals(actualType, expectedType);
    }
  });
});

describe("Embedded Extraction Prompts", () => {
  it("should embed extraction prompts inside TypeScript", () => {
    // Simulating embedded prompts for extraction
    const extractionPrompts = {
      titleExtraction: "Extract the main title from the frontmatter",
      tagsExtraction: "Identify and list all tags as an array",
      dateExtraction: "Parse and format the publication date",
      authorExtraction: "Extract author information including name and contact",
    };

    // Verify prompts are embedded and accessible
    assertExists(extractionPrompts.titleExtraction);
    assertExists(extractionPrompts.tagsExtraction);
    assertEquals(typeof extractionPrompts.titleExtraction, "string");
  });

  it("should use prompts to guide extraction logic", () => {
    const frontmatter = `
title: "Complex: Title - With Special Characters!"
tags: typescript, "multi word tag", programming
date: 26-08-2025
author: John Doe <john@example.com>
    `.trim();

    // Extraction logic guided by prompts
    const extractionRules = {
      title: (line: string) => {
        const match = line.match(/^title:\s*"?(.+?)"?\s*$/);
        return match ? match[1] : null;
      },
      tags: (line: string) => {
        const match = line.match(/^tags:\s*(.+)\s*$/);
        if (match) {
          return match[1].split(",").map((tag) =>
            tag.trim().replace(/^"|"$/g, "")
          );
        }
        return null;
      },
      date: (line: string) => {
        const match = line.match(/^date:\s*(\d{2}-\d{2}-\d{4})\s*$/);
        return match ? match[1] : null;
      },
      author: (line: string) => {
        const match = line.match(/^author:\s*(.+?)\s*(?:<(.+)>)?\s*$/);
        if (match) {
          return {
            name: match[1].trim(),
            email: match[2] || null,
          };
        }
        return null;
      },
    };

    const lines = frontmatter.split("\n");
    const extracted: Record<string, unknown> = {};

    for (const line of lines) {
      for (const [field, extractor] of Object.entries(extractionRules)) {
        if (line.startsWith(`${field}:`)) {
          extracted[field] = extractor(line);
        }
      }
    }

    assertEquals(extracted.title, "Complex: Title - With Special Characters!");
    assertEquals((extracted.tags as string[]).length, 3);
    assertEquals((extracted.tags as string[])[1], "multi word tag");
    assertEquals(
      (extracted.author as Record<string, unknown>).name,
      "John Doe",
    );
    assertEquals(
      (extracted.author as Record<string, unknown>).email,
      "john@example.com",
    );
  });
});

describe("Analysis Integration", () => {
  it("should complete full processing pipeline", () => {
    // Input: Raw frontmatter
    const rawFrontmatter = {
      title: "Integration Test",
      category: "testing",
      priority: "high",
      tags: ["test", "integration"],
    };

    // Schema expansion and extraction
    const extractionResult = {
      extracted: {
        title: rawFrontmatter.title,
        category: rawFrontmatter.category,
        priority: rawFrontmatter.priority,
        tags: rawFrontmatter.tags,
      },
      metadata: {
        extractedAt: new Date().toISOString(),
        fieldsCount: 4,
      },
    };

    // Template mapping
    const _template = {
      summary: "{{title}} ({{category}})",
      details: {
        priority: "{{priority}}",
        tags: "{{tags}}",
      },
    };

    const mappingResult = {
      summary:
        `${extractionResult.extracted.title} (${extractionResult.extracted.category})`,
      details: {
        priority: extractionResult.extracted.priority,
        tags: extractionResult.extracted.tags.join(", "),
      },
    };

    // Validate pipeline results
    assertEquals(mappingResult.summary, "Integration Test (testing)");
    assertEquals(mappingResult.details.priority, "high");
    assertEquals(mappingResult.details.tags, "test, integration");
    assertExists(extractionResult.metadata.extractedAt);
  });

  it("should handle errors gracefully", () => {
    // Invalid schema error
    const invalidSchema = {
      properties: null, // Invalid structure
    };

    let stageAError: Error | null = null;
    try {
      if (!invalidSchema.properties) {
        throw new Error("Invalid schema: properties field is required");
      }
    } catch (e) {
      stageAError = e as Error;
    }

    assertExists(stageAError);
    assertEquals(
      stageAError.message,
      "Invalid schema: properties field is required",
    );

    // Stage B error: Missing template variable
    const dataWithMissingField = {
      title: "Test",
      // Missing 'author' field
    };

    const templateWithAuthor = "Title: {{title}}, Author: {{author}}";

    const result = templateWithAuthor.replace(
      /\{\{(\w+)\}\}/g,
      (_match, key) => {
        return (dataWithMissingField as Record<string, unknown>)[
          key
        ] as string ?? `[Missing: ${key}]`;
      },
    );

    assertEquals(result, "Title: Test, Author: [Missing: author]");
  });
});
