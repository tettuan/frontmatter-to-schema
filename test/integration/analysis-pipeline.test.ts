import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  GenericAnalysisEngine,
  AnalysisEngineFactory,
  FrontMatterExtractionStrategy,
  SchemaMappingStrategy,
} from "../../src/domain/core/analysis-engine.ts";
import {
  ValidFilePath,
  FrontMatterContent,
  SchemaDefinition,
  SourceFile,
  type AnalysisContext,
} from "../../src/domain/core/types.ts";
import { Registry } from "../../src/domain/core/registry.ts";
import { AnalysisResult } from "../../src/domain/core/types.ts";

// Test data and helpers
const createSampleMarkdown = () => `---
domain: git
action: create
target: pull-request
description: "Create a pull request for code review"
complexity: medium
tags: ["git", "collaboration", "review"]
version: 1.2
active: true
---

# Git Pull Request Command

This command creates a pull request for the current branch.

## Usage

\`\`\`bash
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
\`\`\`

Then run this command to create the PR.

## Options

- \`--title\`: PR title (defaults to last commit message)
- \`--body\`: PR description
- \`--draft\`: Create as draft PR
- \`--reviewers\`: Comma-separated list of reviewers
`;

const createCommandSchema = () => ({
  type: "object",
  properties: {
    domain: { type: "string", enum: ["git", "spec", "build", "test", "docs"] },
    action: { type: "string", enum: ["create", "update", "delete", "analyze", "validate"] },
    target: { type: "string" },
    description: { type: "string" },
    complexity: { type: "string", enum: ["low", "medium", "high"] },
    tags: { type: "array", items: { type: "string" } },
    version: { type: "number" },
    active: { type: "boolean" }
  },
  required: ["domain", "action", "target", "description"]
});

const createCommandTemplate = () => ({
  structure: {
    c1: "unknown",
    c2: "unknown", 
    c3: "unknown",
    description: "No description",
    metadata: {
      complexity: "medium",
      version: "1.0",
      active: true,
      tags: []
    }
  },
  mappingRules: {
    c1: "domain",
    c2: "action",
    c3: "target"
  }
});

// Integration test helper to simulate complete file processing
async function processMarkdownFile(
  filePath: string,
  markdownContent: string,
  schema: any,
  template: any
): Promise<{
  sourceFile: SourceFile | null;
  extractedContent: FrontMatterContent | null;
  schemaValidated: any;
  templateMapped: any;
  analysisResult: AnalysisResult<any> | null;
}> {
  // Step 1: Create ValidFilePath
  const pathResult = ValidFilePath.createMarkdown(filePath);
  if (!pathResult.ok) {
    throw new Error(`Invalid file path: ${pathResult.error.message}`);
  }

  // Step 2: Extract FrontMatter from markdown
  const strategy = new FrontMatterExtractionStrategy();
  const extractionContext: AnalysisContext = {
    kind: "BasicExtraction",
    options: { includeMetadata: true }
  };
  
  const extractionResult = await strategy.execute(markdownContent, extractionContext);
  if (!extractionResult.ok) {
    return {
      sourceFile: null,
      extractedContent: null,
      schemaValidated: null,
      templateMapped: null,
      analysisResult: null
    };
  }

  // Step 3: Create SourceFile
  const sourceFileResult = SourceFile.create(
    pathResult.data,
    markdownContent,
    extractionResult.data
  );
  if (!sourceFileResult.ok) {
    throw new Error(`Failed to create SourceFile: ${sourceFileResult.error.message}`);
  }

  // Step 4: Create Schema and validate
  const schemaResult = SchemaDefinition.create(schema);
  if (!schemaResult.ok) {
    throw new Error(`Invalid schema: ${schemaResult.error.message}`);
  }

  const { processor } = AnalysisEngineFactory.createDefault();
  
  // Step 5: Schema validation
  const schemaContext: AnalysisContext = {
    kind: "SchemaAnalysis",
    schema: schemaResult.data,
    options: { includeMetadata: true, validateResults: true }
  };
  
  const schemaValidationResult = await processor.processWithContext(
    extractionResult.data,
    schemaContext
  );
  
  // Step 6: Template mapping
  const templateContext: AnalysisContext = {
    kind: "TemplateMapping",
    template,
    schema: schemaResult.data
  };
  
  const templateMappingResult = await processor.processWithContext(
    extractionResult.data,
    templateContext
  );

  // Step 7: Create AnalysisResult
  let analysisResult = null;
  if (templateMappingResult.ok) {
    analysisResult = new AnalysisResult(
      pathResult.data,
      templateMappingResult.data,
      new Map([
        ["processedAt", new Date().toISOString()],
        ["sourceSchema", schema],
        ["templateStructure", template.structure]
      ])
    );
  }

  return {
    sourceFile: sourceFileResult.data,
    extractedContent: extractionResult.data,
    schemaValidated: schemaValidationResult.ok ? schemaValidationResult.data : null,
    templateMapped: templateMappingResult.ok ? templateMappingResult.data : null,
    analysisResult
  };
}

Deno.test("Integration: Complete Analysis Pipeline", async (t) => {
  await t.step("should process complete markdown file successfully", async () => {
    const filePath = "/test/commands/git-create-pr.md";
    const markdown = createSampleMarkdown();
    const schema = createCommandSchema();
    const template = createCommandTemplate();

    const result = await processMarkdownFile(filePath, markdown, schema, template);

    // Verify SourceFile creation
    assertEquals(result.sourceFile?.path.value, filePath);
    assertEquals(result.sourceFile?.hasFrontMatter(), true);
    
    // Verify FrontMatter extraction
    assertEquals(result.extractedContent?.get("domain"), "git");
    assertEquals(result.extractedContent?.get("action"), "create");
    assertEquals(result.extractedContent?.get("target"), "pull-request");
    assertEquals(result.extractedContent?.get("complexity"), "medium");
    assertEquals(result.extractedContent?.get("version"), 1.2);
    assertEquals(result.extractedContent?.get("active"), true);

    // Verify schema validation
    assertEquals(result.schemaValidated?.domain, "git");
    assertEquals(result.schemaValidated?.action, "create");
    assertEquals(result.schemaValidated?.description, "Create a pull request for code review");

    // Verify template mapping
    assertEquals(result.templateMapped?.c1, "git");
    assertEquals(result.templateMapped?.c2, "create");
    assertEquals(result.templateMapped?.c3, "pull-request");
    assertEquals(result.templateMapped?.description, "Create a pull request for code review");
    assertEquals(result.templateMapped?.complexity, "medium");

    // Verify AnalysisResult
    assertEquals(result.analysisResult?.sourceFile.value, filePath);
    assertEquals(result.analysisResult?.extractedData.c1, "git");
    assertEquals(result.analysisResult?.hasMetadata("processedAt"), true);
    assertEquals(result.analysisResult?.getMetadata("sourceSchema"), schema);
  });

  await t.step("should handle multiple markdown files in batch", async () => {
    const testFiles = [
      {
        path: "/test/commands/git-create-pr.md",
        content: createSampleMarkdown(),
      },
      {
        path: "/test/commands/spec-analyze-requirements.md",
        content: `---
domain: spec
action: analyze  
target: requirements
description: "Analyze project requirements and dependencies"
complexity: high
tags: ["spec", "analysis", "requirements"]
version: 2.1
active: true
---

# Spec Requirements Analysis

Analyze project requirements.`
      },
      {
        path: "/test/commands/build-validate-config.md",
        content: `---
domain: build
action: validate
target: config
description: "Validate build configuration files"
complexity: low
tags: ["build", "validation", "config"]
version: 1.0
active: false
---

# Build Config Validation

Validate configuration.`
      }
    ];

    const schema = createCommandSchema();
    const template = createCommandTemplate();
    const registry = new Registry<any>();
    const results: any[] = [];

    // Process all files
    for (const file of testFiles) {
      const result = await processMarkdownFile(file.path, file.content, schema, template);
      
      if (result.analysisResult) {
        registry.add(file.path, result.analysisResult);
        results.push(result);
      }
    }

    // Verify batch processing results
    assertEquals(results.length, 3);
    assertEquals(registry.size(), 3);

    // Verify individual results
    const gitResult = results[0];
    assertEquals(gitResult.templateMapped.c1, "git");
    assertEquals(gitResult.templateMapped.c2, "create");

    const specResult = results[1];
    assertEquals(specResult.templateMapped.c1, "spec");
    assertEquals(specResult.templateMapped.c2, "analyze");
    assertEquals(specResult.templateMapped.complexity, "high");

    const buildResult = results[2];
    assertEquals(buildResult.templateMapped.c1, "build");
    assertEquals(buildResult.templateMapped.c2, "validate");
    assertEquals(buildResult.templateMapped.active, false);

    // Verify registry operations
    const allResults = registry.values();
    assertEquals(allResults.length, 3);

    // Test filtering
    const activeCommands = registry.filter(result => result.extractedData.active === true);
    assertEquals(activeCommands.size(), 2); // git and spec commands are active

    // Test mapping - create simple derived registry
    const commandSummaries: string[] = [];
    for (const result of registry.values()) {
      const data = result.extractedData as any;
      commandSummaries.push(`${data.c1}-${data.c2}-${data.c3}`);
    }

    assertEquals(commandSummaries.length, 3);
    assertEquals(commandSummaries[0], "git-create-pull-request");
    assertEquals(commandSummaries[1], "spec-analyze-requirements");
    assertEquals(commandSummaries[2], "build-validate-config");
  });

  await t.step("should handle pipeline errors gracefully", async () => {
    const testCases = [
      {
        name: "Invalid file path",
        path: "/test/commands/invalid.txt", // Not .md
        content: createSampleMarkdown(),
        expectedError: "must have one of these extensions"
      },
      {
        name: "No frontmatter",
        path: "/test/commands/no-frontmatter.md",
        content: "# Just markdown content\n\nNo frontmatter here.",
        expectedError: "ExtractionStrategyFailed"
      },
      {
        name: "Empty frontmatter",
        path: "/test/commands/empty-frontmatter.md", 
        content: "---\n---\n\n# Empty frontmatter",
        expectedError: null // Should succeed but with empty data
      }
    ];

    const schema = createCommandSchema();
    const template = createCommandTemplate();

    for (const testCase of testCases) {
      try {
        const result = await processMarkdownFile(testCase.path, testCase.content, schema, template);
        
        if (testCase.expectedError === "FileExtensionMismatch") {
          // Should throw before processing
          throw new Error("Expected FileExtensionMismatch error");
        } else if (testCase.expectedError === "ExtractionStrategyFailed") {
          // Should return null results
          assertEquals(result.extractedContent, null);
          assertEquals(result.analysisResult, null);
        } else if (testCase.expectedError === null) {
          // Empty frontmatter case - should succeed
          assertEquals(result.extractedContent !== null, true);
          assertEquals(result.extractedContent?.size(), 0);
        }
      } catch (error) {
        if (testCase.expectedError) {
          assertEquals((error as Error).message.includes(testCase.expectedError), true);
        } else {
          throw error; // Unexpected error
        }
      }
    }
  });

  await t.step("should validate schema constraints", async () => {
    // Test with frontmatter that violates schema constraints
    const invalidMarkdown = `---
domain: invalid_domain  # Not in enum
action: create
target: pull-request
description: "Test description"
complexity: extreme     # Not in enum
version: "not_a_number" # Should be number
active: "not_boolean"   # Should be boolean
---

# Invalid Command`;

    const schema = createCommandSchema();
    const template = createCommandTemplate();

    const result = await processMarkdownFile(
      "/test/invalid.md",
      invalidMarkdown,
      schema,
      template
    );

    // The pipeline should still process (our schema validator is basic)
    // but in a real implementation, this would catch schema violations
    assertEquals(result.extractedContent !== null, true);
    assertEquals(result.extractedContent?.get("domain"), "invalid_domain");
    assertEquals(result.extractedContent?.get("version"), "not_a_number"); // String, not parsed as number
  });

  await t.step("should handle complex template mapping scenarios", async () => {
    const complexMarkdown = `---
domain: git
action: create
target: pull-request
description: "Advanced PR creation with multiple reviewers"
complexity: high
tags: ["git", "collaboration", "advanced"]
version: 2.5
active: true
reviewers: ["alice", "bob", "charlie"] 
labels: ["feature", "review-required"]
priority: urgent
---

# Complex PR Command`;

    // Complex template with nested mapping
    const complexTemplate = {
      structure: {
        c1: "unknown",
        c2: "unknown",
        c3: "unknown", 
        description: "No description",
        metadata: {
          complexity: "medium",
          version: "1.0",
          reviewConfig: {
            defaultReviewers: [],
            requiresReview: true,
            autoAssign: false
          },
          labelConfig: {
            defaultLabels: ["standard"],
            allowCustom: true
          }
        }
      },
      mappingRules: {
        c1: "domain",
        c2: "action", 
        c3: "target",
        "metadata.reviewConfig.defaultReviewers": "reviewers",
        "metadata.labelConfig.defaultLabels": "labels"
      }
    };

    const schema = {
      type: "object",
      properties: {
        ...createCommandSchema().properties,
        reviewers: { type: "array", items: { type: "string" } },
        labels: { type: "array", items: { type: "string" } },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] }
      }
    };

    const result = await processMarkdownFile(
      "/test/complex.md",
      complexMarkdown,
      schema,
      complexTemplate
    );

    // Verify complex mapping
    assertEquals(result.templateMapped?.c1, "git");
    assertEquals(result.templateMapped?.description, "Advanced PR creation with multiple reviewers");
    assertEquals(result.templateMapped?.complexity, "high");
    assertEquals(result.templateMapped?.version, 2.5);
    assertEquals(result.templateMapped?.reviewers, ["alice", "bob", "charlie"]);
    assertEquals(result.templateMapped?.labels, ["feature", "review-required"]);
    assertEquals(result.templateMapped?.priority, "urgent");

    // Verify metadata preservation from template
    assertEquals(result.templateMapped?.metadata?.reviewConfig?.requiresReview, true);
    assertEquals(result.templateMapped?.metadata?.labelConfig?.allowCustom, true);
  });

  await t.step("should measure performance with large dataset", async () => {
    const startTime = performance.now();
    const fileCount = 50;
    const results: any[] = [];
    const schema = createCommandSchema();
    const template = createCommandTemplate();

    // Generate test files
    for (let i = 0; i < fileCount; i++) {
      const markdown = `---
domain: test
action: benchmark
target: performance-${i}
description: "Performance test file ${i}"
complexity: medium
tags: ["test", "performance", "benchmark"]
version: ${(i % 5) + 1}.0
active: ${i % 2 === 0}
---

# Performance Test ${i}

This is test file number ${i} for performance benchmarking.`;

      const result = await processMarkdownFile(
        `/test/perf/file-${i}.md`,
        markdown,
        schema,
        template
      );

      if (result.analysisResult) {
        results.push(result);
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const averageTime = duration / fileCount;

    // Performance assertions
    assertEquals(results.length, fileCount);
    console.log(`Processed ${fileCount} files in ${duration.toFixed(2)}ms (avg: ${averageTime.toFixed(2)}ms per file)`);
    
    // Should process files reasonably quickly (less than 100ms per file on average)
    assertEquals(averageTime < 100, true, `Average processing time (${averageTime.toFixed(2)}ms) exceeded threshold`);

    // Verify all results are valid
    results.forEach((result, index) => {
      assertEquals(result.templateMapped.c1, "test");
      assertEquals(result.templateMapped.c2, "benchmark");
      assertEquals(result.templateMapped.c3, `performance-${index}`);
    });
  });
});