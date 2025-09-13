/**
 * Diagnostic test for production climpt-registry schema processing
 */

import {
  IntegrationTestEnvironment,
  TestMarkdownFiles,
} from "../helpers/integration-test-helper.ts";

Deno.test({
  name: "DIAGNOSTIC - Production Schema Processing",
  fn: async () => {
    const testEnv = new IntegrationTestEnvironment("production-diagnostic");

    try {
      const paths = await testEnv.setupTestFiles([
        {
          name: "test-command.md",
          type: "markdown",
          content: TestMarkdownFiles.climptCommand,
        },
        {
          name: "output.json",
          type: "output",
          content: "",
        },
      ]);

      console.log("\n=== PRODUCTION SCHEMA DIAGNOSTIC ===");
      console.log("Using schema: ./examples/climpt-registry/schema.json");

      const result = await testEnv.executeProcessing(
        "./examples/climpt-registry/schema.json",
        paths.output!,
        `${paths.output!.replace("/output.json", "")}/**/*.md`,
      );

      if (result.success) {
        console.log("Raw output:", result.rawOutput);
        console.log("Parsed output:", JSON.stringify(result.output, null, 2));

        const output = result.output as Record<string, unknown>;
        console.log("\n=== OUTPUT ANALYSIS ===");

        if (output.tools && typeof output.tools === "object") {
          const tools = output.tools as Record<string, unknown>;
          console.log(
            "tools.availableConfigs type:",
            typeof tools.availableConfigs,
          );
          console.log("tools.availableConfigs value:", tools.availableConfigs);
          console.log("tools.commands type:", typeof tools.commands);
          console.log("tools.commands value:", tools.commands);
        }
      } else {
        console.log("Error:", result.error);
      }
    } finally {
      await testEnv.cleanup();
    }
  },
});
