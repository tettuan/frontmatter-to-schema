import { BreakdownLogger } from "@tettuan/breakdownlogger";
import { assertEquals } from "@std/assert";
import { PipelineOrchestrator } from "../../src/application/services/pipeline-orchestrator.ts";
import { DenoFileSystemAdapter } from "../../src/infrastructure/adapters/deno-file-system-adapter.ts";

const logger = new BreakdownLogger("items-expansion-debug");

Deno.test("items expansion debug - examples/1.articles", async () => {
  logger.info("Starting items expansion debug test");

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const schemaPath = "examples/1.articles/articles_schema.json";
  const templatePath = "examples/1.articles/articles_template.json";
  const inputPath = "examples/1.articles/docs";
  const outputPath = "/tmp/test-items-debug-output.yml";

  logger.debug("Test configuration", {
    schemaPath,
    templatePath,
    inputPath,
    outputPath,
  });

  const result = await orchestrator.execute({
    schemaPath,
    templatePath,
    inputPath,
    outputPath,
    outputFormat: "yaml",
  });

  logger.debug("Execution result", {
    isOk: result.isOk(),
    isError: result.isError(),
  });

  if (result.isError()) {
    const error = result.unwrapError();
    logger.error("Execution failed", {
      message: error.message,
      code: error.code,
      context: error.context,
    });
  }

  assertEquals(result.isOk(), true, "Should execute successfully");

  // Read the output file
  const output = await Deno.readTextFile(outputPath);
  logger.debug("Output content", { output });

  // Parse YAML to check structure
  const lines = output.split("\n");
  const articlesLine = lines.find((line) => line.startsWith("articles:"));
  const topicsLine = lines.find((line) => line.startsWith("topics:"));
  const typesLine = lines.find((line) => line.startsWith("types:"));

  logger.info("Output arrays", {
    articlesLine,
    topicsLine,
    typesLine,
    allLines: lines,
  });

  // Check if arrays are not empty
  const hasArticles = !articlesLine?.includes("[]");
  const hasTopics = !topicsLine?.includes("[]");
  const hasTypes = !typesLine?.includes("[]");

  logger.info("Array status", {
    hasArticles,
    hasTopics,
    hasTypes,
  });

  assertEquals(hasArticles, true, "articles array should not be empty");
});
