/**
 * Diagnostic test for array access in template variables
 */

import {
  IntegrationTestEnvironment,
  TestMarkdownFiles,
  TestSchemas,
} from "../helpers/integration-test-helper.ts";

Deno.test({
  name: "DIAGNOSTIC - Array Access Template Variables",
  fn: async () => {
    const testEnv = new IntegrationTestEnvironment("array-access-diagnostic");

    try {
      // Custom template with array access
      const templateWithArrayAccess = {
        "simpleVar": "{commands}",
        "arrayLength": "{commands.length}",
        "firstItem": "{commands[0]}",
        "firstItemName": "{commands[0].name}",
      };

      const paths = await testEnv.setupTestFiles([
        {
          name: "schema.json",
          type: "schema",
          content: JSON.stringify(TestSchemas.simple, null, 2),
        },
        {
          name: "simple-template.json",
          type: "template",
          content: JSON.stringify(templateWithArrayAccess, null, 2),
        },
        {
          name: "test.md",
          type: "markdown",
          content: TestMarkdownFiles.basicCommand,
        },
        {
          name: "output.json",
          type: "output",
          content: "",
        },
      ]);

      const result = await testEnv.executeProcessing(
        paths.schema!,
        paths.output!,
        `${paths.schema!.replace("/schema.json", "")}/**/*.md`,
      );

      console.log("=== ARRAY ACCESS DIAGNOSTIC ===");
      if (result.success) {
        const output = result.output as Record<string, unknown>;
        console.log("simpleVar:", output.simpleVar);
        console.log("arrayLength:", output.arrayLength);
        console.log("firstItem:", output.firstItem);
        console.log("firstItemName:", output.firstItemName);

        console.log("\\n=== ANALYSIS ===");
        console.log(
          "firstItemName resolved?",
          output.firstItemName !== "{commands[0].name}",
        );
      } else {
        console.log("Error:", result.error);
      }
    } finally {
      await testEnv.cleanup();
    }
  },
});
