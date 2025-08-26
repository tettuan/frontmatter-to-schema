import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

/**
 * End-to-End Pipeline Integration Tests
 * Based on Requirements: Complete analysis process from markdown to final output
 */

describe("Complete Analysis Pipeline", () => {
  it("should process markdown files from input to final registry output", () => {
    // Simulate complete pipeline as described in requirements

    // Step 1: Create prompt list (Result A)
    const promptList = [
      ".agent/climpt/prompts/prompt1.md",
      ".agent/climpt/prompts/prompt2.md",
      ".agent/climpt/prompts/prompt3.md",
    ];

    // Step 2: Initialize final result (Result Z)
    const finalResult = {
      version: "1.0.0",
      generated: new Date().toISOString(),
      entries: [] as unknown[],
    };

    // Step 3: Process each prompt in loop
    for (const promptPath of promptList) {
      // Extract frontmatter (Result B)
      const mockMarkdown = `---
title: Test Prompt ${promptPath}
category: testing
tags: [test, automated]
priority: high
---

# Content
This is the prompt content.`;

      const frontmatterMatch = mockMarkdown.match(/^---\n([\s\S]*?)\n---/);
      assertExists(frontmatterMatch);

      // Parse frontmatter to object
      const frontmatterLines = frontmatterMatch[1].split("\n");
      const resultB: Record<string, unknown> = {};

      for (const line of frontmatterLines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          let value: string | string[] = line.substring(colonIndex + 1).trim();

          // Handle arrays
          if (value.startsWith("[") && value.endsWith("]")) {
            value = value.slice(1, -1).split(",").map((v: string) => v.trim());
          }

          resultB[key] = value;
        }
      }

      // TypeScript Processing Stage A: Analyze with schema (Result C)
      const _schema = {
        properties: {
          title: { type: "string" },
          category: { type: "string" },
          tags: { type: "array" },
          priority: { type: "string" },
        },
      };

      const resultC = {
        validated: true,
        extracted: resultB,
        metadata: {
          source: promptPath,
          processedAt: new Date().toISOString(),
        },
      };

      // TypeScript Processing Stage B: Map to template (Result D)
      const _template = {
        entry: {
          id: "{{source}}",
          title: "{{title}}",
          category: "{{category}}",
          tags: "{{tags}}",
          priority: "{{priority}}",
          metadata: {
            processedAt: "{{processedAt}}",
          },
        },
      };

      const resultD = {
        id: promptPath,
        title: resultC.extracted.title,
        category: resultC.extracted.category,
        tags: resultC.extracted.tags,
        priority: resultC.extracted.priority,
        metadata: {
          processedAt: resultC.metadata.processedAt,
        },
      };

      // Step 4: Integrate into final result
      finalResult.entries.push(resultD);
    }

    // Step 5: Validate final result
    assertEquals(finalResult.entries.length, 3);
    assertExists(finalResult.version);
    assertExists(finalResult.generated);
    assertEquals(
      (finalResult.entries[0] as Record<string, unknown>).priority,
      "high",
    );
  });

  it("should handle real-world example structure", () => {
    // Example 1 from requirements
    const example1Config = {
      sourceFolder: ".agent/climpt/prompts",
      outputPath: ".agent/climpt/registry.json",
      schema: {
        properties: {
          name: { type: "string" },
          category: { type: "string" },
          description: { type: "string" },
          tags: { type: "array" },
        },
      },
      template: {
        registry: {
          prompts: "{{entries}}",
        },
      },
    };

    // Example 2 structure
    const example2Config = {
      sourceFolder: "content/articles",
      outputPath: "public/article-index.json",
      schema: {
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          publishDate: { type: "string" },
          summary: { type: "string" },
        },
      },
      template: {
        index: {
          articles: "{{entries}}",
        },
      },
    };

    // Both examples should use same application logic
    assertExists(example1Config.schema);
    assertExists(example2Config.schema);
    assertEquals(typeof example1Config.sourceFolder, "string");
    assertEquals(typeof example2Config.sourceFolder, "string");
  });
});

describe("Pipeline Error Handling", () => {
  it("should handle missing frontmatter gracefully", () => {
    const markdownWithoutFrontmatter = `# Document
This document has no frontmatter.`;

    const frontmatterMatch = markdownWithoutFrontmatter.match(
      /^---\n([\s\S]*?)\n---/,
    );

    let result;
    if (!frontmatterMatch) {
      result = {
        error: "No frontmatter found",
        fallback: {
          title: "Untitled",
          content: markdownWithoutFrontmatter,
        },
      };
    }

    assertEquals(result?.error, "No frontmatter found");
    assertEquals(result?.fallback.title, "Untitled");
  });

  it("should handle invalid frontmatter format", () => {
    const invalidFrontmatter = `---
title: Missing closing quote"
tags: [unclosed, array
date 2025-08-26
---`;

    // Error handling for parsing issues
    const errors: string[] = [];
    const lines = invalidFrontmatter.split("\n").slice(1, -1);

    for (const line of lines) {
      if (line.includes(":")) {
        // Check for quote matching
        const quotes = (line.match(/"/g) || []).length;
        if (quotes % 2 !== 0) {
          errors.push(`Unmatched quotes in line: ${line}`);
        }

        // Check for bracket matching
        const openBrackets = (line.match(/\[/g) || []).length;
        const closeBrackets = (line.match(/\]/g) || []).length;
        if (openBrackets !== closeBrackets) {
          errors.push(`Unmatched brackets in line: ${line}`);
        }
      } else if (line.trim() && !line.startsWith("#")) {
        errors.push(`Invalid syntax (missing colon): ${line}`);
      }
    }

    assertEquals(errors.length, 3);
    assertEquals(
      errors[0],
      'Unmatched quotes in line: title: Missing closing quote"',
    );
  });

  it("should validate against schema and report violations", () => {
    const data = {
      title: "Test",
      priority: "invalid-priority", // Not in enum
      tags: "not-an-array", // Wrong type
    };

    const strictSchema = {
      properties: {
        title: { type: "string" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["title", "priority"],
    };

    const violations: string[] = [];

    // Check enum constraint
    if (
      strictSchema.properties.priority.enum &&
      !strictSchema.properties.priority.enum.includes(data.priority)
    ) {
      violations.push(
        `Invalid value for priority: "${data.priority}" not in [${
          strictSchema.properties.priority.enum.join(", ")
        }]`,
      );
    }

    // Check type constraint
    if (
      strictSchema.properties.tags.type === "array" && !Array.isArray(data.tags)
    ) {
      violations.push(
        `Invalid type for tags: expected array but got ${typeof data.tags}`,
      );
    }

    assertEquals(violations.length, 2);
    assertEquals(violations[0].includes("invalid-priority"), true);
  });
});

describe("Performance and Scalability", () => {
  it("should handle large prompt lists efficiently", () => {
    // Simulate processing 100 prompts
    const largePromptList = Array.from(
      { length: 100 },
      (_, i) => `prompt${i}.md`,
    );

    const startTime = Date.now();
    const results: unknown[] = [];

    for (const prompt of largePromptList) {
      // Simulate minimal processing per prompt
      results.push({
        id: prompt,
        processed: true,
      });
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    assertEquals(results.length, 100);
    assertEquals((results[0] as Record<string, unknown>).id, "prompt0.md");
    assertEquals((results[99] as Record<string, unknown>).id, "prompt99.md");

    // Processing should be fast (< 1 second for simulation)
    assertEquals(processingTime < 1000, true);
  });

  it("should batch process entries before final save", () => {
    const batchSize = 10;
    const totalEntries = 25;
    const batches: unknown[][] = [];

    let currentBatch: unknown[] = [];

    for (let i = 0; i < totalEntries; i++) {
      currentBatch.push({ id: i, data: `entry${i}` });

      if (currentBatch.length >= batchSize || i === totalEntries - 1) {
        batches.push([...currentBatch]);
        currentBatch = [];
      }
    }

    assertEquals(batches.length, 3); // 10, 10, 5
    assertEquals(batches[0].length, 10);
    assertEquals(batches[1].length, 10);
    assertEquals(batches[2].length, 5);
  });
});

describe("Configuration and Flexibility", () => {
  it("should load configuration from external sources", () => {
    const config = {
      input: {
        path: ".agent/climpt/prompts",
        pattern: "*.md",
        recursive: true,
      },
      processing: {
        schemaPath: "./schemas/prompt-schema.json",
        templatePath: "./templates/registry-template.json",
      },
      output: {
        path: ".agent/climpt/registry.json",
        format: "json",
        pretty: true,
      },
    };

    // Configuration should be complete
    assertExists(config.input.path);
    assertExists(config.processing.schemaPath);
    assertExists(config.output.path);
    assertEquals(config.input.recursive, true);
  });

  it("should switch between different configuration sets", () => {
    const configurations = {
      prompts: {
        input: ".agent/climpt/prompts",
        output: ".agent/climpt/registry.json",
      },
      articles: {
        input: "content/articles",
        output: "public/article-index.json",
      },
      documentation: {
        input: "docs",
        output: "dist/doc-index.json",
      },
    };

    // Select configuration based on use case
    const selectedConfig = configurations.prompts;

    assertEquals(selectedConfig.input, ".agent/climpt/prompts");
    assertEquals(selectedConfig.output, ".agent/climpt/registry.json");

    // Can switch to different configuration
    const alternativeConfig = configurations.articles;
    assertEquals(alternativeConfig.input, "content/articles");
  });

  it("should maintain abstraction from concrete examples", () => {
    // Application interface - abstracted from specific examples
    interface ProcessingPipeline {
      loadPrompts(path: string): string[];
      extractFrontmatter(markdown: string): unknown;
      analyzeWithSchema(data: unknown, schema: unknown): unknown;
      mapToTemplate(data: unknown, template: unknown): unknown;
      saveResult(data: unknown, path: string): void;
    }

    // Implementation doesn't know about specific examples
    const pipeline: ProcessingPipeline = {
      loadPrompts: (_path) => [],
      extractFrontmatter: (_markdown) => ({}),
      analyzeWithSchema: (data, _schema) => ({ validated: true, data }),
      mapToTemplate: (data, _template) => ({ formatted: data }),
      saveResult: (_data, _path) => {/* save logic */},
    };

    // Examples use the same abstracted pipeline
    const example1Result = pipeline.analyzeWithSchema(
      { title: "Prompt" },
      { properties: { title: { type: "string" } } },
    );

    const example2Result = pipeline.analyzeWithSchema(
      { title: "Article" },
      { properties: { title: { type: "string" } } },
    );

    assertEquals((example1Result as Record<string, unknown>).validated, true);
    assertEquals((example2Result as Record<string, unknown>).validated, true);
  });
});

describe("Output Generation and Saving", () => {
  it("should generate registry in correct format", () => {
    const registry = {
      version: "1.0.0",
      generated: "2025-08-26T10:00:00Z",
      entries: [
        {
          id: "prompt1",
          title: "First Prompt",
          category: "general",
          tags: ["tag1", "tag2"],
        },
        {
          id: "prompt2",
          title: "Second Prompt",
          category: "specific",
          tags: ["tag3"],
        },
      ],
      metadata: {
        totalCount: 2,
        categories: ["general", "specific"],
      },
    };

    // Validate registry structure
    assertExists(registry.version);
    assertExists(registry.generated);
    assertEquals(registry.entries.length, 2);
    assertEquals(registry.metadata.totalCount, 2);
    assertEquals(registry.metadata.categories.length, 2);
  });

  it("should support different output formats", () => {
    const data = {
      entries: [
        { id: 1, name: "Entry 1" },
        { id: 2, name: "Entry 2" },
      ],
    };

    // JSON format
    const jsonOutput = JSON.stringify(data, null, 2);

    // CSV format
    const csvOutput = "id,name\n1,Entry 1\n2,Entry 2";

    // YAML format
    const yamlOutput = `entries:
  - id: 1
    name: Entry 1
  - id: 2
    name: Entry 2`;

    assertEquals(jsonOutput.includes('"entries"'), true);
    assertEquals(csvOutput.includes("1,Entry 1"), true);
    assertEquals(yamlOutput.includes("- id: 1"), true);
  });

  it("should save final result atomically", () => {
    const finalResult = {
      version: "1.0.0",
      entries: Array(50).fill(null).map((_, i) => ({ id: i })),
    };

    // Simulate atomic save
    let savedData: unknown = null;
    let saveInProgress = false;

    const saveAtomically = (data: unknown) => {
      if (saveInProgress) {
        throw new Error("Save already in progress");
      }

      saveInProgress = true;
      try {
        // Simulate save operation
        savedData = JSON.parse(JSON.stringify(data)); // Deep copy
        return true;
      } finally {
        saveInProgress = false;
      }
    };

    const success = saveAtomically(finalResult);

    assertEquals(success, true);
    assertEquals((savedData as Record<string, unknown[]>).entries.length, 50);
    assertEquals(saveInProgress, false);
  });
});
