/**
 * Diagnostic Test for Integration Test Debugging
 * Following robust test design to understand the actual output
 */

import {
  IntegrationTestEnvironment,
  TestMarkdownFiles,
  TestSchemas,
  TestTemplates,
} from "../helpers/integration-test-helper.ts";

// Diagnostic test to understand what the ProcessCoordinator is actually outputting
Deno.test({
  name: "DIAGNOSTIC - ProcessCoordinator output analysis",
  fn: async () => {
    const testEnv = new IntegrationTestEnvironment("diagnostic");

    try {
      // Setup simple test case
      const paths = await testEnv.setupTestFiles([
        {
          name: "schema.json",
          type: "schema",
          content: JSON.stringify(TestSchemas.withBaseProperties, null, 2),
        },
        {
          name: "test-template.json",
          type: "template",
          content: JSON.stringify(TestTemplates.withBaseProperties, null, 2),
        },
        {
          name: "test-command.md",
          type: "markdown",
          content: TestMarkdownFiles.basicCommand,
        },
        {
          name: "output.json",
          type: "output",
          content: "",
        },
      ]);

      console.log("=== DIAGNOSTIC TEST OUTPUT ===");
      console.log("Schema path:", paths.schema);
      console.log("Template path:", paths.template);
      console.log("Markdown files:", paths.markdownFiles);
      console.log("Output path:", paths.output);

      const result = await testEnv.executeProcessing(
        paths.schema!,
        paths.output!,
        `${paths.schema!.replace("/schema.json", "")}/**/*.md`,
      );

      console.log("\n=== PROCESSING RESULT ===");
      console.log("Success:", result.success);

      if (result.success) {
        console.log("Raw output:", result.rawOutput);
        console.log("Parsed output:", JSON.stringify(result.output, null, 2));

        const output = result.output as Record<string, unknown>;
        console.log("\n=== OUTPUT ANALYSIS ===");
        console.log(
          "version type:",
          typeof output.version,
          "value:",
          output.version,
        );
        console.log(
          "description type:",
          typeof output.description,
          "value:",
          output.description,
        );
        console.log(
          "commands type:",
          typeof output.commands,
          "value:",
          output.commands,
        );
        console.log(
          "totalCommands type:",
          typeof output.totalCommands,
          "value:",
          output.totalCommands,
        );
      } else {
        console.log("Error:", result.error);
      }
    } finally {
      await testEnv.cleanup();
    }
  },
});
