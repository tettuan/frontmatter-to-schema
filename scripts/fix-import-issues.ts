#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Fix import statement issues from migration
 */

const files = [
  "tests/unit/application/services/pipeline-orchestrator_test.ts",
  "tests/e2e/cli_validation_test.ts",
  "tests/e2e/cli_error_handling_test.ts",
  "tests/specifications/24-patterns_test.ts",
  "tests/integration/pipeline/pipeline-orchestrator_test.ts",
];

for (const file of files) {
  let content = await Deno.readTextFile(file);

  // Fix broken import statements - remove duplicate/misplaced TEST_EXTENSIONS imports
  content = content.replace(
    /import \{\nimport \{ TEST_EXTENSIONS \}.*?\n/g,
    "import {\n",
  );

  // Find and fix the proper location for TEST_EXTENSIONS import
  if (
    !content.includes("import { TEST_EXTENSIONS }") &&
    content.includes("[TEST_EXTENSIONS.")
  ) {
    // Calculate relative path
    const pathParts = file.split("/");
    const testsIndex = pathParts.indexOf("tests");
    const depth = pathParts.length - testsIndex - 2;
    const relativePath = "../".repeat(depth) + "helpers/test-extensions.ts";

    // Find last import and add after it
    const lines = content.split("\n");
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i].startsWith("import ") && !lines[i].includes("TEST_EXTENSIONS")
      ) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      lines.splice(
        lastImportIndex + 1,
        0,
        `import { TEST_EXTENSIONS } from "${relativePath}";`,
      );
      content = lines.join("\n");
    }
  }

  await Deno.writeTextFile(file, content);
  console.log(`✅ Fixed ${file}`);
}

console.log("✨ Import fixes complete!");
