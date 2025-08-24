#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Script to replace console.log statements with logger calls
 * Preserves test files and updates import statements
 */

import { walk } from "jsr:@std/fs@1.0.8/walk";

const RELATIVE_LOGGER_IMPORTS: Record<string, string> = {
  "src/": "../domain/services/logger.ts",
  "src/application/": "../../domain/services/logger.ts",
  "src/infrastructure/": "../../domain/services/logger.ts",
  "src/domain/": "../services/logger.ts",
};

async function replaceConsoleInFile(filePath: string): Promise<boolean> {
  const content = await Deno.readTextFile(filePath);

  // Skip if no console statements
  if (!content.includes("console.")) {
    return false;
  }

  let modified = content;
  let hasChanges = false;

  // Replace console.log with logger.info
  if (modified.includes("console.log")) {
    modified = modified.replace(/console\.log\(/g, "logger.info(");
    hasChanges = true;
  }

  // Replace console.error with logger.error
  if (modified.includes("console.error")) {
    modified = modified.replace(/console\.error\(/g, "logger.error(");
    hasChanges = true;
  }

  // Replace console.warn with logger.warn
  if (modified.includes("console.warn")) {
    modified = modified.replace(/console\.warn\(/g, "logger.warn(");
    hasChanges = true;
  }

  // Replace console.debug with logger.debug
  if (modified.includes("console.debug")) {
    modified = modified.replace(/console\.debug\(/g, "logger.debug(");
    hasChanges = true;
  }

  if (hasChanges) {
    // Add logger import
    const relativeImport = getRelativeImport(filePath);
    const loggerImport =
      `import { LoggerFactory } from "${relativeImport}";\nconst logger = LoggerFactory.create();\n`;

    // Insert after existing imports
    const importMatch = modified.match(
      /^(import[\s\S]*?from\s+["'][^"']+["'];?\s*\n)+/m,
    );
    if (importMatch) {
      const lastImportEnd = importMatch.index! + importMatch[0].length;
      modified = modified.slice(0, lastImportEnd) + "\n" + loggerImport +
        modified.slice(lastImportEnd);
    } else {
      // No imports found, add at beginning
      modified = loggerImport + "\n" + modified;
    }

    await Deno.writeTextFile(filePath, modified);
    return true;
  }

  return false;
}

function getRelativeImport(filePath: string): string {
  for (const [prefix, importPath] of Object.entries(RELATIVE_LOGGER_IMPORTS)) {
    if (filePath.startsWith(prefix)) {
      return importPath;
    }
  }
  return "./domain/services/logger.ts";
}

async function main() {
  console.log("🔍 Searching for files with console statements...");

  const filesToUpdate: string[] = [];

  for await (
    const entry of walk("src", {
      includeDirs: false,
      exts: [".ts"],
      skip: [/test\.ts$/, /\.test\.ts$/],
    })
  ) {
    const content = await Deno.readTextFile(entry.path);
    if (content.includes("console.")) {
      filesToUpdate.push(entry.path);
    }
  }

  // Also check CLI files
  for (const cliFile of ["cli.ts"]) {
    if (await Deno.stat(cliFile).catch(() => false)) {
      const content = await Deno.readTextFile(cliFile);
      if (content.includes("console.")) {
        filesToUpdate.push(cliFile);
      }
    }
  }

  console.log(`📝 Found ${filesToUpdate.length} files to update`);

  let updatedCount = 0;
  for (const file of filesToUpdate) {
    console.log(`  Processing: ${file}`);
    if (await replaceConsoleInFile(file)) {
      updatedCount++;
      console.log(`  ✅ Updated: ${file}`);
    }
  }

  console.log(`\n✨ Replacement complete! Updated ${updatedCount} files`);
  console.log("\n📋 Next steps:");
  console.log("1. Review the changes");
  console.log("2. Run: deno task test");
  console.log("3. Run: deno task ci");
}

if (import.meta.main) {
  main();
}
