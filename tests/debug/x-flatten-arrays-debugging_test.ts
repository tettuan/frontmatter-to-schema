import { assertEquals } from "@std/assert";
import { PipelineOrchestrator } from "../../src/application/services/pipeline-orchestrator.ts";
import { DenoFileSystemAdapter } from "../../src/infrastructure/adapters/deno-file-system-adapter.ts";
import { BreakdownLogger } from "@tettuan/breakdownlogger";

const logger = new BreakdownLogger("x-flatten-arrays-debug");

Deno.test("x-flatten-arrays directive debugging", async () => {
  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  logger.info("Starting x-flatten-arrays test", {
    schema: "examples/3.docs/index_req_schema.json",
    template: "examples/3.docs/index_req_template.json",
    itemsTemplate: "examples/3.docs/traceability_item_template.json",
  });

  const result = await orchestrator.execute({
    schemaPath: "examples/3.docs/index_req_schema.json",
    templatePath: "examples/3.docs/index_req_template.json",
    inputPath: "examples/3.docs/docs/deep-research-api.md",
    outputPath: "/tmp/x-flatten-arrays-debug-output.json",
    outputFormat: "json" as const,
  });

  logger.info("Execution result", {
    isOk: result.isOk(),
    isError: result.isError(),
  });

  if (result.isError()) {
    const error = result.unwrapError();
    logger.error("Execution failed", {
      code: error.code,
      message: error.message,
      context: error.context,
    });
  } else {
    const pipelineResult = result.unwrap();
    logger.info("Pipeline result", {
      processedDocuments: pipelineResult.processedDocuments,
      outputPath: pipelineResult.outputPath,
    });
  }

  assertEquals(result.isOk(), true);
});
