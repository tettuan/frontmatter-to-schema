#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run

/**
 * CLI Entry Point for frontmatter-to-schema
 *
 * Usage:
 * frontmatter-to-schema <markdownfile_root_dir> --schema=<schema_json_file> --template=<template_file> [--destination=<saving_to_this_dir>]
 *
 * Options:
 * - markdownfile_root_dir: Path to markdown files directory
 * - --schema: Path to schema file (JSON or YAML)
 * - --template: Path to template file (any format)
 * - --destination: Output directory (optional, defaults to markdownfile_root_dir)
 */

import { parseArgs } from "jsr:@std/cli@1.0.9/parse-args";
import { join } from "jsr:@std/path@1.1.2";
import { ProcessDocumentsUseCase } from "./src/application/use-cases/process-documents.ts";
import { DenoDocumentRepository } from "./src/infrastructure/adapters/deno-document-repository.ts";
import { ClaudeSchemaAnalyzer } from "./src/infrastructure/adapters/claude-schema-analyzer.ts";
import { MockSchemaAnalyzer } from "./src/infrastructure/adapters/mock-schema-analyzer.ts";
// SimpleTemplateMapper replaced by NativeTemplateStrategy with shared infrastructure
import { FrontMatterExtractorImpl } from "./src/infrastructure/adapters/frontmatter-extractor-impl.ts";
import { ResultAggregatorImpl } from "./src/infrastructure/adapters/result-aggregator-impl.ts";
import {
  ConfigurationLoader,
  TemplateLoader,
} from "./src/infrastructure/adapters/configuration-loader.ts";
import {
  ConfigPath,
  DocumentPath,
  OutputPath,
} from "./src/domain/models/value-objects.ts";
import type { ExtractedData, Template } from "./src/domain/models/entities.ts";

function printUsage() {
  console.log(`
frontmatter-to-schema - Extract and transform markdown frontmatter using AI

Usage:
  frontmatter-to-schema <markdownfile_root_dir> --schema=<schema_file> --template=<template_file> [options]

Arguments:
  markdownfile_root_dir    Path to markdown files directory or pattern

Options:
  --schema=<file>         Path to schema file (JSON or YAML)
  --template=<file>       Path to template file (any format)
  --destination=<dir>     Output directory (optional, defaults to markdown directory)
  --verbose               Enable detailed progress output
  --help                  Show this help message

Examples:
  frontmatter-to-schema ./docs --schema=schema.json --template=template.md
  frontmatter-to-schema ./prompts/* --schema=config/schema.yml --template=config/template.txt --destination=./output
  frontmatter-to-schema ./docs --schema=schema.json --template=template.md --verbose
`);
}

async function loadPromptTemplates(): Promise<
  { extraction: string; mapping: string }
> {
  try {
    const extraction = await Deno.readTextFile(
      "src/infrastructure/prompts/extract-information.md",
    );
    const mapping = await Deno.readTextFile(
      "src/infrastructure/prompts/map-to-template.md",
    );
    return { extraction, mapping };
  } catch {
    return {
      extraction:
        `Extract information from the following frontmatter according to the schema.
FrontMatter: {{FRONTMATTER}}
Schema: {{SCHEMA}}
Return ONLY a JSON object with the extracted data.`,
      mapping: `Map the extracted data to the template structure.
Data: {{EXTRACTED_DATA}}
Schema: {{SCHEMA}}
Return ONLY a JSON object with the mapped data.`,
    };
  }
}

async function main() {
  // Pre-process args to handle --key=value format
  const processedArgs = Deno.args.map((arg) => {
    if (arg.startsWith("--") && arg.includes("=")) {
      const [key, value] = arg.split("=", 2);
      return [key, value];
    }
    return arg;
  }).flat();

  // Debug logging if needed
  const debugMode = Deno.env.get("FRONTMATTER_TO_SCHEMA_DEBUG") === "true" ||
    Deno.env.get("FRONTMATTER_DEBUG") === "true"; // backward compatibility
  if (debugMode) {
    console.log("Raw args:", Deno.args);
    console.log("Processed args:", processedArgs);
  }

  const args = parseArgs(processedArgs, {
    string: ["schema", "template", "destination"],
    boolean: ["help", "verbose"],
    stopEarly: false,
  });

  if (args.help || args._.length === 0) {
    printUsage();
    Deno.exit(args.help ? 0 : 1);
  }

  const markdownDir = args._[0] as string;
  const schemaPath = args.schema;
  const templatePath = args.template;
  const destinationDir = args.destination || markdownDir;
  const verboseMode = args.verbose || false;

  if (!schemaPath || !templatePath) {
    console.error("Error: --schema and --template options are required");
    printUsage();
    Deno.exit(1);
  }

  try {
    console.log("🚀 Starting frontmatter-to-schema CLI...");
    console.log(`📁 Markdown directory: ${markdownDir}`);
    console.log(`📋 Schema: ${schemaPath}`);
    console.log(`📝 Template: ${templatePath}`);
    console.log(`💾 Destination: ${destinationDir}`);

    // Verbose: Check file existence before processing
    if (verboseMode) {
      console.log("🔍 [VERBOSE] Validating input files...");
      try {
        const schemaStats = await Deno.stat(schemaPath);
        console.log(
          `✅ [VERBOSE] Schema file exists: ${schemaPath} (size: ${
            (schemaStats.size / 1024).toFixed(1)
          }KB)`,
        );
      } catch (error) {
        console.log(
          `❌ [VERBOSE] Schema file check failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        const templateStats = await Deno.stat(templatePath);
        console.log(
          `✅ [VERBOSE] Template file exists: ${templatePath} (size: ${
            (templateStats.size / 1024).toFixed(1)
          }KB)`,
        );
      } catch (error) {
        console.log(
          `❌ [VERBOSE] Template file check failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        const dirStats = await Deno.stat(markdownDir);
        console.log(
          `✅ [VERBOSE] Directory exists: ${markdownDir} (isDirectory: ${dirStats.isDirectory})`,
        );
      } catch (error) {
        console.log(
          `❌ [VERBOSE] Directory check failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      console.log("🔧 [VERBOSE] Creating value objects...");
    }

    // Create value objects
    // DocumentPath expects markdown files, but CLI accepts directories
    // So we need to handle this differently
    const documentsPathResult = DocumentPath.create(
      markdownDir.endsWith(".md") || markdownDir.endsWith(".markdown")
        ? markdownDir
        : `${markdownDir}/*.md`,
    );
    const schemaPathResult = ConfigPath.create(schemaPath);
    const templatePathResult = ConfigPath.create(templatePath);

    // Determine output path - if destination already has an extension, use it as-is
    // Otherwise, append the appropriate extension based on template
    let outputPath: string;
    if (
      destinationDir.endsWith(".json") || destinationDir.endsWith(".yaml") ||
      destinationDir.endsWith(".yml") || destinationDir.endsWith(".toml")
    ) {
      outputPath = destinationDir;
    } else {
      const templateExt =
        templatePath.endsWith(".yaml") || templatePath.endsWith(".yml")
          ? "yaml"
          : "json";
      const outputFileName = `registry.${templateExt}`;
      outputPath = join(destinationDir, outputFileName);
    }
    const outputPathResult = OutputPath.create(outputPath);

    if (
      !documentsPathResult.ok || !schemaPathResult.ok ||
      !templatePathResult.ok || !outputPathResult.ok
    ) {
      console.error("Error: Invalid paths provided");
      if (!documentsPathResult.ok) {
        console.error(`  Documents: ${documentsPathResult.error.message}`);
      }
      if (!schemaPathResult.ok) {
        console.error(`  Schema: ${schemaPathResult.error.message}`);
      }
      if (!templatePathResult.ok) {
        console.error(`  Template: ${templatePathResult.error.message}`);
      }
      if (!outputPathResult.ok) {
        console.error(`  Output: ${outputPathResult.error.message}`);
      }
      Deno.exit(1);
    }

    // Initialize services
    if (verboseMode) {
      console.log("🏗️ [VERBOSE] Initializing services...");
    }
    const configLoader = new ConfigurationLoader();
    const templateLoader = new TemplateLoader();
    const documentRepo = new DenoDocumentRepository();
    const frontMatterExtractor = new FrontMatterExtractorImpl();
    // Use NativeTemplateStrategy instead of deprecated SimpleTemplateMapper
    // Note: This is a temporary solution, should be properly injected
    const { MappedData } = await import("./src/domain/models/entities.ts");
    const { createError } = await import("./src/domain/shared/types.ts");

    const templateMapper = {
      map: (data: ExtractedData, template: Template) => {
        try {
          // Simplified fallback - in production should use proper DI
          const mappedResult = template.applyRules(data.getData());
          const mappedData = MappedData.create(mappedResult);
          return { ok: true as const, data: mappedData };
        } catch (error) {
          return {
            ok: false as const,
            error: createError({
              kind: "MappingFailed" as const,
              document: "unknown",
              reason: error instanceof Error
                ? error.message
                : "Template mapping failed",
            }),
          };
        }
      },
    };
    const resultAggregator = new ResultAggregatorImpl("json");
    if (verboseMode) {
      console.log("✅ [VERBOSE] Document repository initialized");
      console.log("✅ [VERBOSE] Template mapper initialized");
      console.log("✅ [VERBOSE] Result aggregator initialized");
    }

    // Load prompts and create analyzer
    if (verboseMode) {
      console.log("📝 [VERBOSE] Loading prompt templates...");
    }
    const prompts = await loadPromptTemplates();
    if (verboseMode) {
      console.log("✅ [VERBOSE] Prompt templates loaded successfully");
    }
    // Set verbose mode for components
    if (verboseMode) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
    }

    const useMock =
      Deno.env.get("FRONTMATTER_TO_SCHEMA_TEST_MODE") === "true" ||
      Deno.env.get("FRONTMATTER_TEST_MODE") === "true"; // backward compatibility
    const schemaAnalyzer = useMock
      ? new MockSchemaAnalyzer(
        { aiProvider: "mock", aiConfig: {} },
        prompts.extraction,
        prompts.mapping,
      )
      : new ClaudeSchemaAnalyzer(
        { aiProvider: "claude", aiConfig: {} },
        prompts.extraction,
        prompts.mapping,
      );

    // Create use case
    console.log("🎯 [DEBUG] Creating ProcessDocumentsUseCase...");
    const processDocumentsUseCase = new ProcessDocumentsUseCase(
      documentRepo,
      configLoader,
      templateLoader,
      configLoader,
      frontMatterExtractor,
      schemaAnalyzer,
      templateMapper,
      resultAggregator,
    );

    // Execute processing
    console.log("🚀 [DEBUG] Starting document processing...");
    console.log(`📊 [DEBUG] Processing config: ${
      JSON.stringify(
        {
          documentsPath: documentsPathResult.data.getValue(),
          schemaPath: schemaPathResult.data.getValue(),
          templatePath: templatePathResult.data.getValue(),
          outputPath: outputPathResult.data.getValue(),
        },
        null,
        2,
      )
    }`);

    const _startTime = Date.now();
    const processingConfig = {
      documentsPath: documentsPathResult.data,
      schemaPath: schemaPathResult.data,
      templatePath: templatePathResult.data,
      outputPath: outputPathResult.data,
      options: {
        parallel: true,
        continueOnError: false,
      },
    };

    console.log("⚡ Processing documents...");
    console.log(
      "📝 This may take a moment depending on the number of files and AI processing...",
    );

    const result = await processDocumentsUseCase.execute({
      config: processingConfig,
    });

    if (result.ok) {
      console.log("\n✅ Processing completed successfully!");
      console.log(`📊 Processed: ${result.data.processedCount} documents`);
      console.log(`❌ Failed: ${result.data.failedCount} documents`);
      console.log(`💾 Output saved to: ${result.data.outputPath}`);
    } else {
      console.error("\n❌ Processing failed:", result.error.message);

      // Show more details for ConfigurationInvalid errors
      if (
        result.error.kind === "ConfigurationInvalid" && "errors" in result.error
      ) {
        console.error("\nConfiguration errors:");
        for (const err of result.error.errors) {
          if ("path" in err && "reason" in err) {
            console.error(`  - ${err.path}: ${err.reason}`);
          } else {
            console.error(`  - ${JSON.stringify(err)}`);
          }
        }
      }

      // Show debug info if debug mode is enabled
      if (debugMode) {
        console.error("\nDebug info:");
        console.error(JSON.stringify(result.error, null, 2));
      }

      Deno.exit(1);
    }
  } catch (error) {
    console.error("Fatal error:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
