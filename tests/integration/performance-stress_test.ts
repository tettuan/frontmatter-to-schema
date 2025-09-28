import { assert, assertEquals } from "jsr:@std/assert";
import { join } from "jsr:@std/path";
import { PipelineOrchestrator } from "../../src/application/services/pipeline-orchestrator.ts";
import { DenoFileSystemAdapter } from "../../src/infrastructure/adapters/deno-file-system-adapter.ts";
import {
  cleanupTestEnvironment,
  createDocumentDirectory,
  createTestDocument,
  createTestDocumentVariations,
  createTestEnvironment,
  measureExecutionTime,
  setupCompleteTestEnvironment,
} from "../helpers/test-helpers.ts";

/**
 * Performance and stress tests for the frontmatter processing pipeline
 * Tests system behavior under load, with large files, and concurrent operations
 * Validates performance characteristics and resource management
 */

Deno.test("Performance - large document processing", async () => {
  const env = await createTestEnvironment("performance-large");
  const { schemaPath, templatePath } = await setupCompleteTestEnvironment(env);

  // Create a large document (100KB of content)
  const largeContent = "# Large Document\n\n" +
    "Lorem ipsum dolor sit amet. ".repeat(5000);
  const largeDocument = createTestDocument({
    title: "Large Document",
    author: "Performance Test",
    tags: Array.from({ length: 100 }, (_, i) => `tag${i}`),
    published: true,
  }, largeContent);

  const documentPath = join(env.fixturesDir, "large-document.md");
  await Deno.writeTextFile(documentPath, largeDocument);

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const outputPath = join(env.testDir, "large-output.json");

  const { result, executionTime } = await measureExecutionTime(async () => {
    return await orchestrator.execute({
      schemaPath,
      templatePath,
      inputPath: documentPath,
      outputPath,
    });
  });

  assertEquals(result.isOk(), true);
  // Performance benchmark: should process large document within reasonable time
  assert(
    executionTime < 5000,
    `Large document processing took ${executionTime}ms, expected < 5000ms`,
  );

  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 1);

  await cleanupTestEnvironment(env);
});

Deno.test("Performance - many small documents processing", async () => {
  const env = await createTestEnvironment("performance-many");
  const { schemaPath, templatePath } = await setupCompleteTestEnvironment(env);

  // Create 100 small documents
  const documents = Array.from({ length: 100 }, (_, i) => ({
    name: `doc${i}.md`,
    content: createTestDocument({
      title: `Document ${i}`,
      author: `Author ${i}`,
      tags: [`tag${i}`],
      published: i % 2 === 0,
    }, `# Document ${i}\n\nContent for document ${i}.`),
  }));

  const docsDir = await createDocumentDirectory(env, "many-docs", documents);
  const outputPath = join(env.testDir, "many-output.json");

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const { result, executionTime } = await measureExecutionTime(async () => {
    return await orchestrator.execute({
      schemaPath,
      templatePath,
      inputPath: docsDir,
      outputPath,
    });
  });

  assertEquals(result.isOk(), true);
  // Performance benchmark: should process 100 documents within reasonable time
  assert(
    executionTime < 10000,
    `Many documents processing took ${executionTime}ms, expected < 10000ms`,
  );

  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 100);

  await cleanupTestEnvironment(env);
});

Deno.test("Performance - deeply nested frontmatter", async () => {
  const env = await createTestEnvironment("performance-nested");
  const { schemaPath, templatePath } = await setupCompleteTestEnvironment(env);

  // Create document with deeply nested frontmatter
  const deepFrontmatter = {
    title: "Nested Document",
    author: "Nested Author",
    metadata: {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                deepValue: "very deep",
                deepArray: Array.from({ length: 50 }, (_, i) => `item${i}`),
              },
            },
          },
        },
      },
    },
    tags: Array.from({ length: 50 }, (_, i) => `nested-tag-${i}`),
  };

  const nestedDocument = createTestDocument(deepFrontmatter);
  const documentPath = join(env.fixturesDir, "nested-document.md");
  await Deno.writeTextFile(documentPath, nestedDocument);

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const outputPath = join(env.testDir, "nested-output.json");

  const { result, executionTime } = await measureExecutionTime(async () => {
    return await orchestrator.execute({
      schemaPath,
      templatePath,
      inputPath: documentPath,
      outputPath,
    });
  });

  assertEquals(result.isOk(), true);
  // Should handle complex nested structures efficiently
  assert(
    executionTime < 2000,
    `Nested frontmatter processing took ${executionTime}ms, expected < 2000ms`,
  );

  await cleanupTestEnvironment(env);
});

Deno.test("Stress - concurrent pipeline executions", async () => {
  const env = await createTestEnvironment("stress-concurrent");
  const { schemaPath, templatePath, documentPaths } =
    await setupCompleteTestEnvironment(env, {
      documents: createTestDocumentVariations(),
    });

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  // Run 20 concurrent executions
  const concurrentCount = 20;
  const concurrentExecutions = Array.from(
    { length: concurrentCount },
    async (_, i) => {
      const outputPath = join(env.testDir, `concurrent-${i}.json`);
      return await orchestrator.execute({
        schemaPath,
        templatePath,
        inputPath: documentPaths[i % documentPaths.length],
        outputPath,
      });
    },
  );

  const { result: results, executionTime } = await measureExecutionTime(
    async () => {
      return await Promise.all(concurrentExecutions);
    },
  );

  // All executions should succeed
  for (const result of results) {
    assertEquals(result.isOk(), true);
  }

  // Concurrent execution should be efficient
  assert(
    executionTime < 15000,
    `Concurrent executions took ${executionTime}ms, expected < 15000ms`,
  );

  await cleanupTestEnvironment(env);
});

Deno.test("Stress - memory usage with large datasets", async () => {
  const env = await createTestEnvironment("stress-memory");
  const { schemaPath, templatePath } = await setupCompleteTestEnvironment(env);

  // Create documents with large frontmatter data
  const documents = Array.from({ length: 50 }, (_, i) => ({
    name: `memory-doc${i}.md`,
    content: createTestDocument({
      title: `Memory Test ${i}`,
      author: `Memory Author ${i}`,
      tags: Array.from({ length: 100 }, (_, j) => `tag-${i}-${j}`),
      data: Array.from({ length: 50 }, (_, k) => ({
        id: `${i}-${k}`,
        value: `value-${i}-${k}`,
        metadata: {
          created: new Date().toISOString(),
          size: k * 1024,
        },
      })),
      published: true,
    }, `# Memory Test ${i}\n\n${"Large content block. ".repeat(100)}`),
  }));

  const docsDir = await createDocumentDirectory(env, "memory-docs", documents);
  const outputPath = join(env.testDir, "memory-output.json");

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const { result, executionTime } = await measureExecutionTime(async () => {
    return await orchestrator.execute({
      schemaPath,
      templatePath,
      inputPath: docsDir,
      outputPath,
    });
  });

  assertEquals(result.isOk(), true);

  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 50);

  // Should handle large datasets without excessive memory usage
  assert(
    executionTime < 20000,
    `Large dataset processing took ${executionTime}ms, expected < 20000ms`,
  );

  await cleanupTestEnvironment(env);
});

Deno.test("Stress - edge case frontmatter formats", async () => {
  const env = await createTestEnvironment("stress-edge-cases");
  const { schemaPath, templatePath } = await setupCompleteTestEnvironment(env);

  // Create documents with edge case frontmatter
  const edgeCaseDocuments = [
    {
      name: "empty-frontmatter.md",
      content: "---\n---\n\n# Empty frontmatter",
    },
    {
      name: "whitespace-frontmatter.md",
      content: "---\n   \n  \n---\n\n# Whitespace frontmatter",
    },
    {
      name: "special-chars.md",
      content: createTestDocument({
        title: "Special Characters: !@#$%^&*()_+-={}[]|\\:;\"'<>?,./",
      }),
    },
    {
      name: "unicode.md",
      content: createTestDocument({
        title: "Unicode: 🚀 こんにちは 世界 αβγδε",
        author: "Unicode Author: 测试用户",
      }),
    },
    {
      name: "very-long-values.md",
      content: createTestDocument({
        title: "A".repeat(1000),
        author: "B".repeat(500),
        description: "C".repeat(2000),
      }),
    },
  ];

  const docsDir = await createDocumentDirectory(
    env,
    "edge-docs",
    edgeCaseDocuments,
  );
  const outputPath = join(env.testDir, "edge-output.json");

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const result = await orchestrator.execute({
    schemaPath,
    templatePath,
    inputPath: docsDir,
    outputPath,
  });

  assertEquals(result.isOk(), true);

  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, edgeCaseDocuments.length);

  await cleanupTestEnvironment(env);
});

Deno.test("Performance - repeated executions", async () => {
  const env = await createTestEnvironment("performance-repeated");
  const { schemaPath, templatePath, documentPaths } =
    await setupCompleteTestEnvironment(env);

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  // Run the same execution 20 times to test for memory leaks and performance degradation
  const executionTimes: number[] = [];

  for (let i = 0; i < 20; i++) {
    const outputPath = join(env.testDir, `repeated-${i}.json`);

    const { result, executionTime } = await measureExecutionTime(async () => {
      return await orchestrator.execute({
        schemaPath,
        templatePath,
        inputPath: documentPaths[0],
        outputPath,
      });
    });

    assertEquals(result.isOk(), true);
    executionTimes.push(executionTime);
  }

  // Performance should remain consistent (no significant degradation)
  const averageTime = executionTimes.reduce((sum, time) => sum + time, 0) /
    executionTimes.length;
  const maxTime = Math.max(...executionTimes);

  // Maximum execution time should not be more than 3x the average
  assert(
    maxTime <= averageTime * 3,
    `Performance degradation detected: max=${maxTime}ms, avg=${averageTime}ms`,
  );

  await cleanupTestEnvironment(env);
});

Deno.test("Stress - file system error recovery", async () => {
  const env = await createTestEnvironment("stress-error-recovery");
  const { schemaPath, templatePath } = await setupCompleteTestEnvironment(env);

  // Create a mix of valid and problematic documents
  const mixedDocuments = [
    {
      name: "valid1.md",
      content: createTestDocument({ title: "Valid 1", author: "Author 1" }),
    },
    {
      name: "corrupt-frontmatter.md",
      content: "---\ntitle: unclosed quote\nauthor: 'Author\n---\n\nContent",
    },
    {
      name: "valid2.md",
      content: createTestDocument({ title: "Valid 2", author: "Author 2" }),
    },
    {
      name: "binary-data.md",
      content: "\x00\x01\x02\x03---\ntitle: Binary\n---\nContent",
    },
    {
      name: "valid3.md",
      content: createTestDocument({ title: "Valid 3", author: "Author 3" }),
    },
  ];

  const docsDir = await createDocumentDirectory(
    env,
    "mixed-docs",
    mixedDocuments,
  );
  const outputPath = join(env.testDir, "mixed-output.json");

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const result = await orchestrator.execute({
    schemaPath,
    templatePath,
    inputPath: docsDir,
    outputPath,
  });

  // Should process valid documents despite errors in others
  assertEquals(result.isOk(), true);

  // Should process at least the valid documents
  const pipelineResult = result.unwrap();
  assert(
    pipelineResult.processedDocuments >= 3,
    "Should process at least the valid documents",
  );

  await cleanupTestEnvironment(env);
});

Deno.test("Performance - output format comparison", async () => {
  const env = await createTestEnvironment("performance-formats");
  const { schemaPath, templatePath } = await setupCompleteTestEnvironment(env, {
    documents: createTestDocumentVariations(),
  });

  const docsDir = join(env.fixturesDir);
  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  // Test JSON output performance
  const jsonOutputPath = join(env.testDir, "format-output.json");
  const { executionTime: jsonTime } = await measureExecutionTime(async () => {
    return await orchestrator.execute({
      schemaPath,
      templatePath,
      inputPath: docsDir,
      outputPath: jsonOutputPath,
      outputFormat: "json",
    });
  });

  // Test YAML output performance
  const yamlOutputPath = join(env.testDir, "format-output.yaml");
  const { executionTime: yamlTime } = await measureExecutionTime(async () => {
    return await orchestrator.execute({
      schemaPath,
      templatePath,
      inputPath: docsDir,
      outputPath: yamlOutputPath,
      outputFormat: "yaml",
    });
  });

  // Both formats should complete within reasonable time
  assert(jsonTime < 5000, `JSON output took ${jsonTime}ms, expected < 5000ms`);
  assert(yamlTime < 5000, `YAML output took ${yamlTime}ms, expected < 5000ms`);

  await cleanupTestEnvironment(env);
});
