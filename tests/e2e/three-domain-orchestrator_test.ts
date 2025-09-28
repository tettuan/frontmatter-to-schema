import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { ThreeDomainOrchestrator } from "../../src/application/coordinators/three-domain-orchestrator.ts";
import {
  assertServiceResult,
  createMultipleMarkdownFiles,
  createSchemaWithDirectives,
  PerformanceTimer,
  TestEnvironment,
} from "../helpers/test-fixtures.ts";

describe("Three Domain Orchestrator E2E Tests", () => {
  describe("Complete Processing Pipeline", () => {
    it("should orchestrate all three domains for complete document processing", async () => {
      const env = new TestEnvironment();
      const timer = new PerformanceTimer();

      // Setup test environment
      const markdownFiles = createMultipleMarkdownFiles();
      env.setupCustomMarkdownFiles(markdownFiles);

      // Create comprehensive schema with all directives
      const schema = createSchemaWithDirectives({
        "x-template": `# {{title}}

**Author**: {{author}}
**Date**: {{date}}

{{content}}

**Tags**: {{tags}}
---
`,
        "x-template-items": "articles",
        "x-jmespath-filter": "[?contains(tags, 'tech')]",
        "x-derived-from": "frontmatter",
      });

      assertServiceResult(schema);

      // Create orchestrator with mock dependencies
      const orchestratorResult = ThreeDomainOrchestrator.create(
        env.fileReader,
        env.fileLister,
      );

      assertServiceResult(orchestratorResult);

      // Execute complete processing pipeline
      timer.start();

      const processingResult = await orchestratorResult.data
        .processThreeDomainPipeline({
          inputPattern: "*.md",
          schema: schema.data,
        });

      const duration = timer.end();

      // Verify processing succeeded
      assertServiceResult(processingResult);

      // Verify performance
      assertEquals(
        duration < 200,
        true,
        `E2E processing took ${duration}ms, expected < 200ms`,
      );

      // Verify processing result structure
      assertExists(processingResult.data.processedData);
      assertExists(processingResult.data.outputFormat);
      assertExists(processingResult.data.templateContent);

      // Verify content structure in processed data
      const processedDataStr = JSON.stringify(
        processingResult.data.processedData,
      );
      assertEquals(processedDataStr.includes("First Article"), true);
      assertEquals(processedDataStr.includes("Third Article"), true);
      assertEquals(processedDataStr.includes("Second Article"), false); // Filtered out (no 'tech' tag)

      // Clean up
      env.reset();
    });

    it("should handle error scenarios gracefully", async () => {
      const env = new TestEnvironment();

      // Create schema
      const schema = createSchemaWithDirectives({
        "x-template": "# {{title}}\n\n{{content}}",
      });

      assertServiceResult(schema);

      // Create orchestrator
      const orchestratorResult = ThreeDomainOrchestrator.create(
        env.fileReader,
        env.fileLister,
      );

      assertServiceResult(orchestratorResult);

      // Try to process with no input files
      env.fileLister.setMockFiles(["nonexistent.md"]);

      const processingResult = await orchestratorResult.data
        .processThreeDomainPipeline({
          inputPattern: "*.md",
          schema: schema.data,
        });

      // Should handle error gracefully
      assertEquals(processingResult.ok, false);

      if (!processingResult.ok) {
        assertExists(processingResult.error.kind);
        assertExists(processingResult.error.message);
      }

      env.reset();
    });
  });

  describe("Domain Integration Verification", () => {
    it("should properly coordinate data flow between domains", async () => {
      const env = new TestEnvironment();

      // Setup comprehensive test data
      const markdownFiles = {
        "tech1.md": `---
title: Advanced TypeScript
author: Expert Dev
date: 2023-01-01
tags: [tech, typescript, advanced]
category: programming
---

# Advanced TypeScript Features

Deep dive into advanced TypeScript concepts.
`,
        "tech2.md": `---
title: Deno Performance
author: Runtime Engineer
date: 2023-01-02
tags: [tech, deno, performance]
category: runtime
---

# Deno Performance Optimization

How to optimize Deno applications.
`,
        "design1.md": `---
title: UI Design Principles
author: Designer
date: 2023-01-03
tags: [design, ui, principles]
category: design
---

# UI Design Principles

Fundamental principles of user interface design.
`,
      };

      env.setupCustomMarkdownFiles(markdownFiles);

      // Create schema with complex processing rules
      const schema = createSchemaWithDirectives({
        "x-template": `# {{category}} Articles

{% for article in articles %}
## {{article.title}}
**Author**: {{article.author}} | **Date**: {{article.date}}

{{article.content}}

**Tags**: {% for tag in article.tags %}{{tag}}{% if not loop.last %}, {% endif %}{% endfor %}

---
{% endfor %}

Total articles: {{articles.length}}
`,
        "x-jmespath-filter":
          "[?category == 'programming' || category == 'runtime']",
        "x-template-items": "articles",
      });

      assertServiceResult(schema);

      const orchestratorResult = ThreeDomainOrchestrator.create(
        env.fileReader,
        env.fileLister,
      );

      assertServiceResult(orchestratorResult);

      // Process documents
      const processingResult = await orchestratorResult.data
        .processThreeDomainPipeline({
          inputPattern: "*.md",
          schema: schema.data,
        });

      assertServiceResult(processingResult);

      // Verify filtered results
      const processedDataStr = JSON.stringify(
        processingResult.data.processedData,
      );

      // Should include tech articles
      assertEquals(processedDataStr.includes("Advanced TypeScript"), true);
      assertEquals(processedDataStr.includes("Deno Performance"), true);

      // Should exclude design article
      assertEquals(processedDataStr.includes("UI Design Principles"), false);

      env.reset();
    });

    it("should maintain data consistency across all processing stages", async () => {
      const env = new TestEnvironment();

      // Create predictable test data
      const markdownFiles = {
        "article.md": `---
title: Consistent Data Test
author: Test Author
date: 2023-01-01
tags: [test, consistency]
custom_field: "custom_value"
---

# Test Article

This article tests data consistency.
`,
      };

      env.setupCustomMarkdownFiles(markdownFiles);

      // Schema that preserves all data
      const schema = createSchemaWithDirectives({
        "x-template": `# {{title}}

Author: {{author}}
Date: {{date}}
Custom: {{custom_field}}

{{content}}

Tags: {{tags}}
`,
      });

      assertServiceResult(schema);

      const orchestratorResult = ThreeDomainOrchestrator.create(
        env.fileReader,
        env.fileLister,
      );

      assertServiceResult(orchestratorResult);

      const processingResult = await orchestratorResult.data
        .processThreeDomainPipeline({
          inputPattern: "*.md",
          schema: schema.data,
        });

      assertServiceResult(processingResult);

      const processedDataStr = JSON.stringify(
        processingResult.data.processedData,
      );

      // Verify all data was preserved and rendered
      assertEquals(processedDataStr.includes("Consistent Data Test"), true);
      assertEquals(processedDataStr.includes("Test Author"), true);
      // Date is now parsed as Date object and converted to string when rendered
      // The date "2023-01-01" becomes a Date object and when rendered becomes a localized string
      // Check that the year 2023 is present (part of any date format)
      const hasDate = processedDataStr.includes("2023");
      assertEquals(hasDate, true);
      assertEquals(processedDataStr.includes("custom_value"), true);

      env.reset();
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle multiple files efficiently", async () => {
      const env = new TestEnvironment();
      const timer = new PerformanceTimer();

      // Create many test files
      const markdownFiles: Record<string, string> = {};
      for (let i = 1; i <= 20; i++) {
        markdownFiles[`article${i}.md`] = `---
title: Article ${i}
author: Author ${i}
date: 2023-01-${String(i).padStart(2, "0")}
tags: [test, article${i}]
---

# Article ${i}

Content for article ${i}.
`;
      }

      env.setupCustomMarkdownFiles(markdownFiles);

      const schema = createSchemaWithDirectives({
        "x-template": `{% for article in articles %}## {{article.title}}
{{article.content}}
{% endfor %}`,
        "x-template-items": "articles",
      });

      assertServiceResult(schema);

      const orchestratorResult = ThreeDomainOrchestrator.create(
        env.fileReader,
        env.fileLister,
      );

      assertServiceResult(orchestratorResult);

      // Process all files
      timer.start();

      const processingResult = await orchestratorResult.data
        .processThreeDomainPipeline({
          inputPattern: "*.md",
          schema: schema.data,
        });

      const duration = timer.end();

      assertServiceResult(processingResult);

      // Performance assertion for bulk processing
      assertEquals(
        duration < 500,
        true,
        `Bulk processing took ${duration}ms, expected < 500ms`,
      );

      // Verify all articles were processed
      const processedDataStr = JSON.stringify(
        processingResult.data.processedData,
      );

      // Check that all articles are included
      for (let i = 1; i <= 20; i++) {
        assertEquals(processedDataStr.includes(`Article ${i}`), true);
      }

      env.reset();
    });
  });

  describe("Configuration and Flexibility", () => {
    it("should support different output formats and configurations", async () => {
      const env = new TestEnvironment();

      const markdownFiles = createMultipleMarkdownFiles();
      env.setupCustomMarkdownFiles(markdownFiles);

      // Test different template configurations
      const configurations = [
        {
          name: "JSON format",
          schema: createSchemaWithDirectives({
            "x-template": `{
  "articles": [
    {% for article in articles %}
    {
      "title": "{{article.title}}",
      "author": "{{article.author}}",
      "date": "{{article.date}}"
    }{% if not loop.last %},{% endif %}
    {% endfor %}
  ]
}`,
          }),
          outputPath: "output.json",
          expectedContent: "articles",
        },
        {
          name: "YAML format",
          schema: createSchemaWithDirectives({
            "x-template": `articles:
{% for article in articles %}
  - title: "{{article.title}}"
    author: "{{article.author}}"
    date: "{{article.date}}"
{% endfor %}`,
          }),
          outputPath: "output.yaml",
          expectedContent: "articles:",
        },
      ];

      const orchestratorResult = ThreeDomainOrchestrator.create(
        env.fileReader,
        env.fileLister,
      );

      assertServiceResult(orchestratorResult);

      // Test each configuration
      for (const config of configurations) {
        assertServiceResult(config.schema);

        const processingResult = await orchestratorResult.data
          .processThreeDomainPipeline({
            inputPattern: "*.md",
            schema: config.schema.data,
          });

        assertServiceResult(processingResult);

        const processedDataStr = JSON.stringify(
          processingResult.data.processedData,
        );
        assertEquals(
          processedDataStr.includes(config.expectedContent),
          true,
          `${config.name} output missing expected content`,
        );
      }

      env.reset();
    });
  });
});
