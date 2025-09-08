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
import { basename, join } from "jsr:@std/path@1.1.2";
import { type Logger, LoggerFactory } from "./src/domain/shared/logger.ts";
import { getEnvironmentConfig } from "./src/domain/config/environment-config.ts";
import { ProcessDocumentsUseCase } from "./src/application/process-documents-usecase.ts";
// import { DenoDocumentRepository } from "./src/infrastructure/adapters/deno-document-repository.ts";
// import { createTypeScriptAnalyzer } from "./src/domain/analyzers/typescript-analyzer.ts";
import {
  DenoEnvironmentRepository,
  DenoFileSystemRepository,
} from "./src/infrastructure/adapters/deno-file-system-repository.ts";
// SimpleTemplateMapper replaced by NativeTemplateStrategy with shared infrastructure
// import { FrontMatterExtractorImpl } from "./src/infrastructure/adapters/frontmatter-extractor-impl.ts";
// import { ResultAggregatorImpl } from "./src/infrastructure/adapters/result-aggregator-impl.ts";
// import {
//   ConfigurationLoader,
//   TemplateLoader,
// } from "./src/infrastructure/adapters/configuration-loader.ts";
import {
  ConfigPath,
  DocumentPath,
  OutputPath,
  TemplatePath,
} from "./src/domain/models/value-objects.ts";
// import type { ExtractedData, Template } from "./src/domain/models/entities.ts";

// Create global CLI logger
const cliLogger: Logger = LoggerFactory.createLogger("CLI");

export function printUsage() {
  cliLogger.info(`
frontmatter-to-schema - Extract and transform markdown frontmatter using AI

Usage:
  frontmatter-to-schema <schema-file> <output-file> <input-pattern> [options]

Arguments:
  schema-file      Path to schema file (JSON or YAML)
  output-file      Path to output file
  input-pattern    Path to markdown files directory or pattern

Options:
  --destination=<dir>       Output directory (optional, defaults to current directory)
  --verbose                 Enable detailed progress output
  --help                    Show this help message

Examples:
  frontmatter-to-schema schema.json registry.json "./docs/*.md"
  frontmatter-to-schema config/schema.yml books.yml "./prompts/**/*.md" --destination=./output
`);
}

export async function loadPromptTemplates(): Promise<
  { extraction: string; mapping: string }
> {
  try {
    const extraction = await Deno.readTextFile(
      "src/domain/prompts/extract-frontmatter.md",
    );
    const mapping = await Deno.readTextFile(
      "src/domain/prompts/map-to-template.md",
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

export async function main() {
  // Pre-process args to handle --key=value format
  let processedArgs: string[];
  try {
    processedArgs = Deno.args.map((arg) => {
      if (arg.startsWith("--") && arg.includes("=")) {
        const [key, value] = arg.split("=", 2);
        return [key, value];
      }
      return arg;
    }).flat();
  } catch (error) {
    cliLogger.error(
      "Fatal error accessing command line arguments: " + String(error),
    );
    Deno.exit(1);
  }

  // Debug logging if needed
  const envRepo = new DenoEnvironmentRepository();
  const envConfig = getEnvironmentConfig(envRepo);
  const debugMode = envConfig.getDebugMode();
  const logger = LoggerFactory.createLogger("cli");
  if (debugMode) {
    try {
      logger.debug("Raw args", { args: Deno.args });
    } catch (error) {
      logger.debug("Raw args", {
        error: "Could not access Deno.args: " + String(error),
      });
    }
    logger.debug("Processed args", { args: processedArgs });
  }

  const args = parseArgs(processedArgs, {
    string: [
      "destination",
      "mode",
      "command-schema",
      "command-template",
      "registry-schema",
      "registry-template",
    ],
    boolean: ["help", "verbose"],
    stopEarly: false,
  });

  if (args.help || args._.length < 3) {
    printUsage();
    Deno.exit(args.help ? 0 : 1);
  }

  // Parse positional arguments: <schema-file> <output-file> <input-pattern>
  const schemaPath = args._[0] as string;
  const outputPath = args._[1] as string;
  const inputPattern = args._[2] as string;
  const destinationDir = args.destination || ".";
  const verboseMode = args.verbose || false;
  
  // Validate required arguments
  if (!schemaPath || !outputPath || !inputPattern) {
    cliLogger.error(
      "Error: <schema-file>, <output-file>, and <input-pattern> arguments are required",
    );
    printUsage();
    Deno.exit(1);
  }

  try {
    cliLogger.info("🚀 Starting frontmatter-to-schema CLI...");
    cliLogger.info(`📋 Schema: ${schemaPath}`);
    cliLogger.info(`📄 Output: ${outputPath}`);
    cliLogger.info(`📁 Input pattern: ${inputPattern}`);
    cliLogger.info(`💾 Destination: ${destinationDir}`);

    // Verbose: Check file existence before processing
    if (verboseMode) {
      logger.debug("Validating input files");
      try {
        const schemaStats = await Deno.stat(schemaPath);
        logger.debug("Schema file exists", {
          path: schemaPath,
          sizeKB: (schemaStats.size / 1024).toFixed(1),
        });
      } catch (error) {
        logger.debug("Schema file check failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        const outputStats = await Deno.stat(outputPath);
        logger.debug("Output file exists", {
          path: outputPath,
          sizeKB: (outputStats.size / 1024).toFixed(1),
        });
      } catch (error) {
        logger.debug("Output file check (will be created)", {
          path: outputPath,
          note: "File will be created if it doesn't exist",
        });
      }

      logger.debug("Input pattern check", {
        pattern: inputPattern,
        note: "Pattern will be processed for markdown files",
      });

      logger.debug("Creating value objects");
    }

    // Create value objects
    // DocumentPath expects markdown files, but CLI accepts directories
    // So we need to handle this differently
    const documentsPathResult = DocumentPath.create(
      inputPattern.endsWith(".md") || inputPattern.endsWith(".markdown")
        ? inputPattern
        : `${inputPattern}/*.md`,
    );
    // Create schema path
    const schemaPathResult = ConfigPath.create(schemaPath);
    // Create output path directly from positional argument
    const outputPathResult = OutputPath.create(outputPath);

    if (
      !documentsPathResult.ok || !outputPathResult.ok ||
      !schemaPathResult.ok
    ) {
      cliLogger.error("Error: Invalid paths provided");
      if (!documentsPathResult.ok) {
        cliLogger.error(`  Documents: ${documentsPathResult.error.message}`);
      }
      if (!schemaPathResult.ok) {
        cliLogger.error(`  Schema: ${schemaPathResult.error.message}`);
      }
      if (!outputPathResult.ok) {
        cliLogger.error(`  Output: ${outputPathResult.error.message}`);
      }
      Deno.exit(1);
    }

    // Initialize services
    if (verboseMode) {
      logger.debug("Initializing services");
    }

    // Create file system repository
    const fileSystemRepo = new DenoFileSystemRepository();
    //     const configLoader = new ConfigurationLoader(fileSystemRepo);
    //     const templateLoader = new TemplateLoader();
    //     const documentRepo = new DenoDocumentRepository();
    //     const frontMatterExtractor = new FrontMatterExtractorImpl();
    // Use NativeTemplateStrategy instead of deprecated SimpleTemplateMapper
    // Note: This is a temporary solution, should be properly injected
    //     const { MappedData } = await import("./src/domain/models/entities.ts");
    //     const { createDomainError } = await import("./src/domain/core/result.ts");

    //     const templateMapper = {
    //       map: (data: ExtractedData, template: Template) => {
    //         try {
    //           // Simplified fallback - in production should use proper DI
    //           const mappedResult = template.applyRules(data.getData(), {
    //             kind: "SimpleMapping",
    //           });
    //           const mappedData = MappedData.create(mappedResult);
    //           return { ok: true as const, data: mappedData };
    //         } catch (error) {
    //           return {
    //             ok: false as const,
    //             error: createDomainError(
    //               {
    //                 kind: "ProcessingStageError",
    //                 stage: "template mapping",
    //                 error: {
    //                   kind: "InvalidResponse",
    //                   service: "template",
    //                   response: error instanceof Error
    //                     ? error.message
    //                     : "Template mapping failed",
    //                 },
    //               },
    //               error instanceof Error
    //                 ? error.message
    //                 : "Template mapping failed",
    //             ),
    //           };
    //         }
    //       },
    //       async mapWithOrchestrator(
    //         _frontMatter: unknown,
    //         _schema: unknown,
    //         _template: unknown,
    //       ) {
    //         // Fallback to legacy behavior - orchestrator not configured
    //         return await Promise.resolve({
    //           ok: false as const,
    //           error: createDomainError(
    //             {
    //               kind: "ReadError",
    //               path: "orchestrator",
    //               details: "TypeScriptAnalysisOrchestrator not configured",
    //             },
    //             "TypeScriptAnalysisOrchestrator not configured",
    //           ),
    //         });
    //       },
    // //     };
    //     const resultAggregator = new ResultAggregatorImpl("json");
    if (verboseMode) {
      logger.debug("Document repository initialized");
      logger.debug("Template mapper initialized");
      logger.debug("Result aggregator initialized");
    }

    // Load prompts and create analyzer
    if (verboseMode) {
      logger.debug("Loading prompt templates");
    }
    const _prompts = await loadPromptTemplates();
    if (verboseMode) {
      logger.debug("Prompt templates loaded successfully");
    }
    // Set verbose mode for components
    if (verboseMode) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
    }

    // TypeScript analyzer is created internally by ProcessDocumentsUseCase
    // const schemaAnalyzer = createTypeScriptAnalyzer(
    //   fileSystemRepo,
    //   "1.0.0",
    //   "Climpt Command Registry",
    // );

    // Create use case
    if (debugMode) {
      cliLogger.debug("🎯 Creating ProcessDocumentsUseCase...");
    }
    const processDocumentsUseCase = new ProcessDocumentsUseCase(
      fileSystemRepo,
      { dryRun: false },
    );

    // Execute processing
    if (debugMode) {
      cliLogger.debug("🚀 Starting document processing...");
      cliLogger.debug(`📊 Processing config: ${
        JSON.stringify(
          {
            documentsPath: documentsPathResult.ok
              ? documentsPathResult.data.getValue()
              : "invalid",
            schemaPath: schemaPathResult && schemaPathResult.ok
              ? schemaPathResult.data.getValue()
              : "invalid",
            outputPath: outputPathResult.ok
              ? outputPathResult.data.getValue()
              : "invalid",
          },
          null,
          2,
        )
      }`);
    }

    const _startTime = Date.now();
    // At this point, validation has passed, so we can safely assert these exist
    if (!schemaPathResult?.ok) {
      throw new Error("Schema path validation failed unexpectedly");
    }

    //     const processingConfig = {
    //       documentsPath: documentsPathResult.data,
    //       schemaPath: schemaPathResult.data,
    //       templatePath: templatePathResult.data,
    //       outputPath: outputPathResult.data,
    //       options: {
    //         parallel: true,
    //         continueOnError: false,
    //       },
    //     };

    cliLogger.info("⚡ Processing documents...");
    cliLogger.info(
      "📝 This may take a moment depending on the number of files and AI processing...",
    );

    // Process documents
    const result = await processDocumentsUseCase.execute({
      schemaPath: schemaPathResult.data.getValue(),
      outputPath: outputPathResult.data.getValue(),
      inputPattern: documentsPathResult.data.getValue(),
      outputFormat:
        outputPath.endsWith(".yaml") || outputPath.endsWith(".yml")
          ? "yaml"
          : "json",
    });

    if (result.ok) {
      cliLogger.info("\n✅ Processing completed successfully!");
      cliLogger.info(`📊 Processed: ${result.data.processedCount} documents`);
      // failedCount is not available in ProcessDocumentsOutput
      cliLogger.info(`💾 Output saved to: ${result.data.outputPath}`);
    } else {
      cliLogger.error("\n❌ Processing failed: " + result.error.message);

      // Show more details for errors
      if (result.error.kind === "ConfigurationMissing") {
        cliLogger.error("\nConfiguration errors:");
        if (
          "requiredConfig" in result.error &&
          Array.isArray(result.error.requiredConfig)
        ) {
          for (const config of result.error.requiredConfig as string[]) {
            cliLogger.error(`  - Missing: ${config}`);
          }
        }
      }

      // Show debug info if debug mode is enabled
      if (debugMode) {
        cliLogger.debug("\nDebug info:");
        cliLogger.debug(JSON.stringify(result.error, null, 2));
      }

      Deno.exit(1);
    }
  } catch (error) {
    cliLogger.error("Fatal error: " + String(error));
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
