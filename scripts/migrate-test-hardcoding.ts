#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Robust test migration script to replace hardcoded extension strings with TEST_EXTENSIONS
 * Follows DDD and Totality principles for safe, idempotent migrations
 */

import { walk } from "jsr:@std/fs/walk";

// Extension mappings - single source of truth (deprecated directives removed)
const EXTENSION_MAPPINGS = {
  '"x-frontmatter-part"': "TEST_EXTENSIONS.FRONTMATTER_PART",
  '"x-template"': "TEST_EXTENSIONS.TEMPLATE",
  '"x-template-items"': "TEST_EXTENSIONS.TEMPLATE_ITEMS",
  '"x-derived-from"': "TEST_EXTENSIONS.DERIVED_FROM",
  '"x-derived-unique"': "TEST_EXTENSIONS.DERIVED_UNIQUE",
  '"x-jmespath-filter"': "TEST_EXTENSIONS.JMESPATH_FILTER",
  '"x-template-format"': "TEST_EXTENSIONS.TEMPLATE_FORMAT",
  "'x-frontmatter-part'": "TEST_EXTENSIONS.FRONTMATTER_PART",
  "'x-template'": "TEST_EXTENSIONS.TEMPLATE",
  "'x-template-items'": "TEST_EXTENSIONS.TEMPLATE_ITEMS",
  "'x-derived-from'": "TEST_EXTENSIONS.DERIVED_FROM",
  "'x-derived-unique'": "TEST_EXTENSIONS.DERIVED_UNIQUE",
  "'x-jmespath-filter'": "TEST_EXTENSIONS.JMESPATH_FILTER",
  "'x-template-format'": "TEST_EXTENSIONS.TEMPLATE_FORMAT",
} as const;

interface MigrationResult {
  file: string;
  replacements: number;
  success: boolean;
  error?: string;
}

/**
 * Check if file already has TEST_EXTENSIONS import
 */
function hasTestExtensionsImport(content: string): boolean {
  return content.includes("import { TEST_EXTENSIONS }") ||
    content.includes("import { createExtensions, TEST_EXTENSIONS }") ||
    content.includes('from "../../helpers/test-extensions.ts"') ||
    content.includes('from "../../../helpers/test-extensions.ts"') ||
    content.includes('from "../../../../helpers/test-extensions.ts"');
}

/**
 * Add TEST_EXTENSIONS import to file if not present
 */
function addTestExtensionsImport(content: string, filePath: string): string {
  if (hasTestExtensionsImport(content)) {
    return content;
  }

  // Calculate relative path to test-extensions.ts
  const pathParts = filePath.split("/");
  const testsIndex = pathParts.indexOf("tests");

  if (testsIndex === -1) {
    return content; // Not a test file
  }

  const depth = pathParts.length - testsIndex - 2; // -2 for 'tests' and the filename
  const relativePath = "../".repeat(depth) + "helpers/test-extensions.ts";

  // Find the last import line
  const lines = content.split("\n");
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) {
      lastImportIndex = i;
    }
  }

  // Add import after last import
  if (lastImportIndex >= 0) {
    lines.splice(
      lastImportIndex + 1,
      0,
      `import { TEST_EXTENSIONS } from "${relativePath}";`,
    );
  } else {
    // Add at the beginning if no imports found
    lines.unshift(
      `import { TEST_EXTENSIONS } from "${relativePath}";`,
      "",
    );
  }

  return lines.join("\n");
}

/**
 * Replace hardcoded strings with TEST_EXTENSIONS in object properties
 */
function replaceHardcodedStrings(
  content: string,
): { content: string; count: number } {
  let newContent = content;
  let replacementCount = 0;

  // Replace in object property format: { "x-extension": value }
  for (const [hardcoded, replacement] of Object.entries(EXTENSION_MAPPINGS)) {
    const regex = new RegExp(
      `(\\s*)${hardcoded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s*:\\s*)`,
      "g",
    );
    const matches = newContent.match(regex);

    if (matches) {
      replacementCount += matches.length;
      newContent = newContent.replace(regex, `$1[${replacement}]$2`);
    }
  }

  return { content: newContent, count: replacementCount };
}

/**
 * Process a single test file
 */
async function processFile(filePath: string): Promise<MigrationResult> {
  try {
    const content = await Deno.readTextFile(filePath);

    // Skip files that are test helpers themselves
    if (
      filePath.includes("test-schema-builder") ||
      filePath.includes("test-extensions") ||
      filePath.includes("hardcoding-detection")
    ) {
      return { file: filePath, replacements: 0, success: true };
    }

    // Check if file has hardcoded strings
    const hasHardcodedStrings = Object.keys(EXTENSION_MAPPINGS).some(
      (key) => content.includes(key),
    );

    if (!hasHardcodedStrings) {
      return { file: filePath, replacements: 0, success: true };
    }

    // Add import if needed
    const newContent = addTestExtensionsImport(content, filePath);

    // Replace hardcoded strings
    const { content: migratedContent, count } = replaceHardcodedStrings(
      newContent,
    );

    // Write back only if changes were made
    if (count > 0) {
      await Deno.writeTextFile(filePath, migratedContent);
    }

    return { file: filePath, replacements: count, success: true };
  } catch (error) {
    return {
      file: filePath,
      replacements: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log("🔄 Starting robust test migration...\n");

  const testFiles: string[] = [];

  // Collect all test files
  for await (
    const entry of walk("tests", {
      exts: [".ts"],
      match: [/.*_test\.ts$/],
    })
  ) {
    testFiles.push(entry.path);
  }

  console.log(`📁 Found ${testFiles.length} test files\n`);

  const results: MigrationResult[] = [];

  // Process files
  for (const file of testFiles) {
    const result = await processFile(file);
    results.push(result);

    if (result.replacements > 0) {
      console.log(`✅ ${file}: ${result.replacements} replacements`);
    } else if (!result.success) {
      console.log(`❌ ${file}: ${result.error}`);
    }
  }

  // Summary
  console.log("\n📊 Migration Summary:");
  console.log("─".repeat(50));

  const successfulMigrations = results.filter((r) =>
    r.success && r.replacements > 0
  );
  const failedMigrations = results.filter((r) => !r.success);
  const totalReplacements = results.reduce((sum, r) => sum + r.replacements, 0);

  console.log(`✅ Files migrated: ${successfulMigrations.length}`);
  console.log(`🔄 Total replacements: ${totalReplacements}`);
  console.log(`❌ Failed: ${failedMigrations.length}`);

  if (failedMigrations.length > 0) {
    console.log("\n⚠️ Failed files:");
    for (const failed of failedMigrations) {
      console.log(`  - ${failed.file}: ${failed.error}`);
    }
    Deno.exit(1);
  }

  console.log("\n✨ Migration completed successfully!");
}

// Run if executed directly
if (import.meta.main) {
  await main();
}
