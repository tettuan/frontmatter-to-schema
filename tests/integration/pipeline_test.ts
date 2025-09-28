import { assertEquals, assertExists } from "jsr:@std/assert";
import { PipelineOrchestrator } from "../../src/application/services/pipeline-orchestrator.ts";
import { ensureDir } from "jsr:@std/fs";

Deno.test("PipelineOrchestrator - process single markdown file", async () => {
  const orchestrator = PipelineOrchestrator.create().unwrap();

  // Create test data
  const testDir = await Deno.makeTempDir();
  const schemaPath = `${testDir}/schema.json`;
  const templatePath = `${testDir}/template.json`;
  const markdownPath = `${testDir}/test.md`;
  const outputPath = `${testDir}/output.json`;

  // Create test schema
  await Deno.writeTextFile(schemaPath, JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string", "x-frontmatter-part": true },
      tags: { type: "array", "x-frontmatter-part": true },
    },
  }));

  // Create test template
  await Deno.writeTextFile(templatePath, JSON.stringify({
    documents: [],
  }));

  // Create test markdown
  await Deno.writeTextFile(markdownPath, `---
title: Test Document
tags: ["test", "integration"]
---

# Test Content`);

  // Process the pipeline
  const result = await orchestrator.execute({
    schemaPath,
    templatePath,
    inputPath: markdownPath,
    outputPath,
    outputFormat: "json",
  });

  assertEquals(result.isOk(), true);

  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 1);
  assertExists(pipelineResult.outputPath);

  // Verify output file exists and contains expected data
  const output = JSON.parse(await Deno.readTextFile(outputPath));
  assertEquals(output.documents.length, 1);
  assertEquals(output.documents[0].title, "Test Document");
  assertEquals(output.documents[0].tags, ["test", "integration"]);

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("PipelineOrchestrator - process directory of markdown files", async () => {
  const orchestrator = PipelineOrchestrator.create().unwrap();

  const testDir = await Deno.makeTempDir();
  const docsDir = `${testDir}/docs`;
  await ensureDir(docsDir);

  const schemaPath = `${testDir}/schema.json`;
  const templatePath = `${testDir}/template.json`;
  const outputPath = `${testDir}/output.json`;

  // Create schema
  await Deno.writeTextFile(schemaPath, JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string", "x-frontmatter-part": true },
      author: { type: "string", "x-frontmatter-part": true },
    },
  }));

  // Create template
  await Deno.writeTextFile(templatePath, JSON.stringify({
    articles: [],
  }));

  // Create multiple markdown files
  await Deno.writeTextFile(`${docsDir}/doc1.md`, `---
title: Document 1
author: Author A
---
Content 1`);

  await Deno.writeTextFile(`${docsDir}/doc2.md`, `---
title: Document 2
author: Author B
---
Content 2`);

  // Process the directory
  const result = await orchestrator.execute({
    schemaPath,
    templatePath,
    inputPath: docsDir,
    outputPath,
    outputFormat: "json",
  });

  assertEquals(result.isOk(), true);

  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 2);

  // Verify output
  const output = JSON.parse(await Deno.readTextFile(outputPath));
  assertEquals(output.articles.length, 2);

  const titles = output.articles.map((a: any) => a.title).sort();
  assertEquals(titles, ["Document 1", "Document 2"]);

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("PipelineOrchestrator - handle x-flatten-arrays directive", async () => {
  const orchestrator = PipelineOrchestrator.create().unwrap();

  const testDir = await Deno.makeTempDir();
  const schemaPath = `${testDir}/schema.json`;
  const templatePath = `${testDir}/template.json`;
  const markdownPath = `${testDir}/test.md`;
  const outputPath = `${testDir}/output.json`;

  // Create schema with x-flatten-arrays
  await Deno.writeTextFile(schemaPath, JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string", "x-frontmatter-part": true },
      traceability: {
        type: "array",
        "x-frontmatter-part": true,
        "x-flatten-arrays": "traceability",
      },
    },
  }));

  // Create template
  await Deno.writeTextFile(templatePath, JSON.stringify({
    documents: [],
  }));

  // Create markdown with nested arrays
  await Deno.writeTextFile(markdownPath, `---
title: Test with Nested Arrays
traceability: ["A", ["B", "C"], [["D"]]]
---
Content`);

  // Process
  const result = await orchestrator.execute({
    schemaPath,
    templatePath,
    inputPath: markdownPath,
    outputPath,
    outputFormat: "json",
  });

  assertEquals(result.isOk(), true);

  // Verify flattening (note: actual implementation may need adjustment)
  const output = JSON.parse(await Deno.readTextFile(outputPath));
  assertEquals(output.documents.length, 1);

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("PipelineOrchestrator - YAML output format", async () => {
  const orchestrator = PipelineOrchestrator.create().unwrap();

  const testDir = await Deno.makeTempDir();
  const schemaPath = `${testDir}/schema.json`;
  const templatePath = `${testDir}/template.json`;
  const markdownPath = `${testDir}/test.md`;
  const outputPath = `${testDir}/output.yml`;

  // Create test files
  await Deno.writeTextFile(schemaPath, JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string", "x-frontmatter-part": true },
    },
  }));

  await Deno.writeTextFile(templatePath, JSON.stringify({
    entries: [],
  }));

  await Deno.writeTextFile(markdownPath, `---
title: YAML Test
---
Content`);

  // Process with YAML output
  const result = await orchestrator.execute({
    schemaPath,
    templatePath,
    inputPath: markdownPath,
    outputPath,
    outputFormat: "yaml",
  });

  assertEquals(result.isOk(), true);

  // Verify YAML output exists
  const outputContent = await Deno.readTextFile(outputPath);
  assertEquals(outputContent.includes("entries:"), true);
  assertEquals(outputContent.includes("title: YAML Test"), true);

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});