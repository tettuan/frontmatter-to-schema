#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Migration script to update hardcoded file extensions to use new value objects
 * This script helps migrate from hardcoded extensions to FileExtension and SupportedFormats
 */

import { walk } from "jsr:@std/fs@1.0.8";

interface MigrationConfig {
  dryRun: boolean;
  verbose: boolean;
  includeTests: boolean;
  targetDirs: string[];
}

class ExtensionMigrator {
  private filesModified = 0;
  private totalReplacements = 0;

  constructor(private config: MigrationConfig) {}

  async migrate() {
    console.log("🔄 Starting extension migration...");
    console.log(`Mode: ${this.config.dryRun ? "DRY RUN" : "LIVE"}`);

    for (const dir of this.config.targetDirs) {
      await this.processDirectory(dir);
    }

    console.log("\n✅ Migration complete!");
    console.log(`Files modified: ${this.filesModified}`);
    console.log(`Total replacements: ${this.totalReplacements}`);
  }

  private async processDirectory(dir: string) {
    console.log(`\n📁 Processing directory: ${dir}`);

    for await (
      const entry of walk(dir, {
        includeDirs: false,
        exts: [".ts", ".tsx"],
        skip: this.config.includeTests ? [] : [/test/],
      })
    ) {
      await this.processFile(entry.path);
    }
  }

  private async processFile(filePath: string) {
    const content = await Deno.readTextFile(filePath);
    let modified = content;
    let replacementCount = 0;

    // Pattern replacements
    const replacements: Array<[RegExp, string]> = [
      // Replace hardcoded .json extensions
      [
        /\.endsWith\(['"]\.json['"]\)/g,
        '.endsWith(FileExtension.create(".json").data.getValue())',
      ],
      [
        /extension === ['"]\.json['"]/g,
        'FileExtension.create(extension).data.equals(FileExtension.create(".json").data)',
      ],

      // Replace hardcoded .yaml extensions
      [
        /\.endsWith\(['"]\.yaml['"]\)/g,
        '.endsWith(FileExtension.create(".yaml").data.getValue())',
      ],
      [
        /extension === ['"]\.yaml['"]/g,
        'FileExtension.create(extension).data.equals(FileExtension.create(".yaml").data)',
      ],

      // Replace hardcoded .yml extensions
      [
        /\.endsWith\(['"]\.yml['"]\)/g,
        '.endsWith(FileExtension.create(".yml").data.getValue())',
      ],
      [
        /extension === ['"]\.yml['"]/g,
        'FileExtension.create(extension).data.equals(FileExtension.create(".yml").data)',
      ],

      // Replace hardcoded .md extensions
      [
        /\.endsWith\(['"]\.md['"]\)/g,
        '.endsWith(FileExtension.create(".md").data.getValue())',
      ],
      [
        /extension === ['"]\.md['"]/g,
        'FileExtension.create(extension).data.equals(FileExtension.create(".md").data)',
      ],

      // Replace extension arrays
      [
        /\[['"]\.json['"],\s*['"]\.yaml['"],\s*['"]\.yml['"]\]/g,
        'SupportedFormats.getExtensions("schema").data.map(e => e.getValue())',
      ],
      [
        /\[['"]\.md['"],\s*['"]\.mdx['"]\]/g,
        'SupportedFormats.getExtensions("markdown").data.map(e => e.getValue())',
      ],
    ];

    for (const [pattern, replacement] of replacements) {
      const matches = modified.match(pattern);
      if (matches) {
        replacementCount += matches.length;
        modified = modified.replace(pattern, replacement);
      }
    }

    // Add imports if modifications were made
    if (replacementCount > 0) {
      modified = this.addImports(modified, filePath);

      if (this.config.verbose) {
        console.log(`  📝 ${filePath}: ${replacementCount} replacements`);
      }

      if (!this.config.dryRun) {
        await Deno.writeTextFile(filePath, modified);
      }

      this.filesModified++;
      this.totalReplacements += replacementCount;
    }
  }

  private addImports(content: string, filePath: string): string {
    const hasFileExtensionImport = content.includes("FileExtension");
    const hasSupportedFormatsImport = content.includes("SupportedFormats");

    if (!hasFileExtensionImport || !hasSupportedFormatsImport) {
      // Calculate relative import path
      const depth = filePath.split("/").length - 2; // Adjust for src/
      const importPath = "../".repeat(depth) + "domain/shared/value-objects/";

      const imports: string[] = [];
      if (!hasFileExtensionImport && content.includes("FileExtension")) {
        imports.push(
          `import { FileExtension } from "${importPath}file-extension.ts";`,
        );
      }
      if (!hasSupportedFormatsImport && content.includes("SupportedFormats")) {
        imports.push(
          `import { SupportedFormats } from "${importPath}supported-formats.ts";`,
        );
      }

      if (imports.length > 0) {
        // Add after the last import
        const lastImportIndex = content.lastIndexOf("import ");
        const lineEnd = content.indexOf("\n", lastImportIndex);
        content = content.slice(0, lineEnd + 1) + imports.join("\n") + "\n" +
          content.slice(lineEnd + 1);
      }
    }

    return content;
  }
}

// CLI interface
async function main() {
  const args = Deno.args;

  const config: MigrationConfig = {
    dryRun: args.includes("--dry-run"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    includeTests: args.includes("--include-tests"),
    targetDirs: ["src/"],
  };

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Extension Migration Script

Usage: deno run --allow-read --allow-write scripts/migrate-extensions.ts [options]

Options:
  --dry-run        Preview changes without modifying files
  --verbose, -v    Show detailed output
  --include-tests  Also migrate test files
  --help, -h       Show this help message

Examples:
  # Dry run to preview changes
  ./scripts/migrate-extensions.ts --dry-run --verbose

  # Migrate src/ files only
  ./scripts/migrate-extensions.ts

  # Migrate everything including tests
  ./scripts/migrate-extensions.ts --include-tests
    `);
    Deno.exit(0);
  }

  const migrator = new ExtensionMigrator(config);
  await migrator.migrate();
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("❌ Migration failed:", error);
    Deno.exit(1);
  });
}
