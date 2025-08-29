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
import { type Logger, LoggerFactory } from "./src/domain/shared/logger.ts";
import { ProcessDocumentsUseCase } from "./src/application/use-cases/process-documents.ts";
import { DenoDocumentRepository } from "./src/infrastructure/adapters/deno-document-repository.ts";
import { createTypeScriptAnalyzer } from "./src/domain/analyzers/typescript-analyzer.ts";
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
  TemplatePath,
} from "./src/domain/models/value-objects.ts";
import type { ExtractedData, Template } from "./src/domain/models/entities.ts";

// Create global CLI logger
const cliLogger: Logger = LoggerFactory.createLogger("CLI");

export function printUsage() {
  cliLogger.info(`
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
  const debugMode = Deno.env.get("FRONTMATTER_TO_SCHEMA_DEBUG") === "true" ||
    Deno.env.get("FRONTMATTER_DEBUG") === "true"; // backward compatibility
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
    cliLogger.error("Error: --schema and --template options are required");
    printUsage();
    Deno.exit(1);
  }

  try {
    cliLogger.info("🚀 Starting frontmatter-to-schema CLI...");
    cliLogger.info(`📁 Markdown directory: ${markdownDir}`);
    cliLogger.info(`📋 Schema: ${schemaPath}`);
    cliLogger.info(`📝 Template: ${templatePath}`);
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
        const templateStats = await Deno.stat(templatePath);
        logger.debug("Template file exists", {
          path: templatePath,
          sizeKB: (templateStats.size / 1024).toFixed(1),
        });
      } catch (error) {
        logger.debug("Template file check failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        const dirStats = await Deno.stat(markdownDir);
        cliLogger.debug("Directory exists", {
          path: markdownDir,
          isDirectory: dirStats.isDirectory,
        });
      } catch (error) {
        cliLogger.debug("Directory check failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      logger.debug("Creating value objects");
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
    // Template can be any format, not restricted to config file extensions
    const templatePathResult = TemplatePath.create(templatePath);

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
      cliLogger.error("Error: Invalid paths provided");
      if (!documentsPathResult.ok) {
        cliLogger.error(`  Documents: ${documentsPathResult.error.message}`);
      }
      if (!schemaPathResult.ok) {
        cliLogger.error(`  Schema: ${schemaPathResult.error.message}`);
      }
      if (!templatePathResult.ok) {
        cliLogger.error(`  Template: ${templatePathResult.error.message}`);
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
    const configLoader = new ConfigurationLoader();
    const templateLoader = new TemplateLoader();
    const documentRepo = new DenoDocumentRepository();
    const frontMatterExtractor = new FrontMatterExtractorImpl();
    // Use NativeTemplateStrategy instead of deprecated SimpleTemplateMapper
    // Note: This is a temporary solution, should be properly injected
    const { MappedData } = await import("./src/domain/models/entities.ts");
    const { createDomainError } = await import("./src/domain/core/result.ts");

    const templateMapper = {
      map: (data: ExtractedData, template: Template) => {
        try {
          // Simplified fallback - in production should use proper DI
          const mappedResult = template.applyRules(data.getData(), {
            kind: "SimpleMapping",
          });
          const mappedData = MappedData.create(mappedResult);
          return { ok: true as const, data: mappedData };
        } catch (error) {
          return {
            ok: false as const,
            error: createDomainError(
              {
                kind: "ProcessingStageError",
                stage: "template mapping",
                error: {
                  kind: "InvalidResponse",
                  service: "template",
                  response: error instanceof Error
                    ? error.message
                    : "Template mapping failed",
                },
              },
              error instanceof Error
                ? error.message
                : "Template mapping failed",
            ),
          };
        }
      },
      async mapWithOrchestrator(
        _frontMatter: unknown,
        _schema: unknown,
        _template: unknown,
      ) {
        // Fallback to legacy behavior - orchestrator not configured
        return await Promise.resolve({
          ok: false as const,
          error: createDomainError(
            {
              kind: "ReadError",
              path: "orchestrator",
              details: "TypeScriptAnalysisOrchestrator not configured",
            },
            "TypeScriptAnalysisOrchestrator not configured",
          ),
        });
      },
    };
    const resultAggregator = new ResultAggregatorImpl("json");
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

    const schemaAnalyzer = createTypeScriptAnalyzer(
      "1.0.0",
      "Climpt Command Registry",
    );

    // Create use case
    if (debugMode) {
      cliLogger.debug("🎯 Creating ProcessDocumentsUseCase...");
    }
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
    if (debugMode) {
      cliLogger.debug("🚀 Starting document processing...");
      cliLogger.debug(`📊 Processing config: ${
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
    }

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

    cliLogger.info("⚡ Processing documents...");
    cliLogger.info(
      "📝 This may take a moment depending on the number of files and AI processing...",
    );

    const result = await processDocumentsUseCase.execute({
      config: processingConfig,
    });

    if (result.ok) {
      cliLogger.info("\n✅ Processing completed successfully!");
      cliLogger.info(`📊 Processed: ${result.data.processedCount} documents`);
      cliLogger.info(`❌ Failed: ${result.data.failedCount} documents`);
      cliLogger.info(`💾 Output saved to: ${result.data.outputPath}`);
    } else {
      cliLogger.error("\n❌ Processing failed: " + result.error.message);

      // Show more details for ConfigurationInvalid errors
      if (
        result.error.kind === "ConfigurationMissing" &&
        "requiredConfig" in result.error
      ) {
        cliLogger.error("\nConfiguration errors:");
        for (const config of result.error.requiredConfig) {
          cliLogger.error(`  - Missing: ${config}`);
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
