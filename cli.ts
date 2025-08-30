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
import { TwoStageProcessingUseCase } from "./src/application/use-cases/two-stage-processing-use-case.ts";
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
  --schema=<file>           Path to schema file (JSON or YAML)
  --template=<file>         Path to template file (any format)
  --destination=<dir>       Output directory (optional, defaults to markdown directory)
  --mode=<mode>             Processing mode: 'single-stage' (default) or 'two-stage'
  --command-schema=<file>   Path to command schema file (required for two-stage mode)
  --command-template=<file> Path to command template file (required for two-stage mode)
  --registry-schema=<file>  Path to registry schema file (defaults to --schema for two-stage mode)
  --registry-template=<file> Path to registry template file (defaults to --template for two-stage mode)
  --verbose                 Enable detailed progress output
  --help                    Show this help message

Examples:
  # Single-stage processing (default)
  frontmatter-to-schema ./docs --schema=schema.json --template=template.md
  frontmatter-to-schema ./prompts/* --schema=config/schema.yml --template=config/template.txt --destination=./output
  
  # Two-stage processing
  frontmatter-to-schema ./prompts --mode=two-stage \
    --command-schema=command_schema.json --command-template=command_template.json \
    --registry-schema=registry_schema.json --registry-template=registry_template.json \
    --destination=./output
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

/**
 * Execute two-stage processing pipeline
 */
async function executeTwoStageProcessing(
  // deno-lint-ignore no-explicit-any
  args: Record<string, any>,
  documentsPath: DocumentPath,
  outputPath: OutputPath,
  // deno-lint-ignore no-explicit-any
  documentRepo: any,
  // deno-lint-ignore no-explicit-any
  configLoader: any,
  // deno-lint-ignore no-explicit-any
  templateLoader: any,
  logger?: Logger,
  // deno-lint-ignore no-explicit-any
): Promise<{ ok: boolean; data?: any; error?: any }> {
  try {
    const commandSchemaPath = args["command-schema"];
    const commandTemplatePath = args["command-template"];
    const registrySchemaPath = args["registry-schema"] || args.schema;
    const registryTemplatePath = args["registry-template"] || args.template;

    logger?.info("[TwoStage] Loading schemas and templates...");

    // Load command schema and template (Stage 1)
    const commandSchemaResult = ConfigPath.create(commandSchemaPath);
    if (!commandSchemaResult.ok) {
      return { ok: false, error: commandSchemaResult.error };
    }

    const commandTemplateResult = TemplatePath.create(commandTemplatePath);
    if (!commandTemplateResult.ok) {
      return { ok: false, error: commandTemplateResult.error };
    }

    const commandSchema = await configLoader.loadSchema(
      commandSchemaResult.data,
    );
    if (!commandSchema.ok) {
      return { ok: false, error: commandSchema.error };
    }

    const commandTemplate = await templateLoader.loadTemplate(
      commandTemplateResult.data,
    );
    if (!commandTemplate.ok) {
      return { ok: false, error: commandTemplate.error };
    }

    // Load registry schema and template (Stage 2)
    const registrySchemaResult = ConfigPath.create(registrySchemaPath);
    if (!registrySchemaResult.ok) {
      return { ok: false, error: registrySchemaResult.error };
    }

    const registryTemplateResult = TemplatePath.create(registryTemplatePath);
    if (!registryTemplateResult.ok) {
      return { ok: false, error: registryTemplateResult.error };
    }

    const registrySchema = await configLoader.loadSchema(
      registrySchemaResult.data,
    );
    if (!registrySchema.ok) {
      return { ok: false, error: registrySchema.error };
    }

    const registryTemplate = await templateLoader.loadTemplate(
      registryTemplateResult.data,
    );
    if (!registryTemplate.ok) {
      return { ok: false, error: registryTemplate.error };
    }

    logger?.info("[TwoStage] Loading documents...");

    // Load documents
    const documents = await documentRepo.findAll(documentsPath);
    if (!documents.ok) {
      return { ok: false, error: documents.error };
    }

    logger?.info(
      `[TwoStage] Found ${documents.data.length} documents to process`,
    );

    // Create two-stage use case
    const twoStageUseCase = new TwoStageProcessingUseCase(logger);

    // Execute two-stage processing
    const config = {
      commandSchema: commandSchema.data,
      commandTemplate: commandTemplate.data,
      registrySchema: registrySchema.data,
      registryTemplate: registryTemplate.data,
      version: "1.0.0",
      description: "Climpt Command Registry",
      strictMode: false,
      logger,
    };

    const twoStageResult = await twoStageUseCase.execute(
      documents.data,
      config,
    );
    if (!twoStageResult.ok) {
      return { ok: false, error: twoStageResult.error };
    }

    // Save the final registry
    const outputFilePath = join(outputPath.getValue(), "registry.json");
    const registryContent = JSON.stringify(
      twoStageResult.data.stage2Result.registry,
      null,
      2,
    );

    await Deno.writeTextFile(outputFilePath, registryContent);

    logger?.info(`[TwoStage] Registry saved to: ${outputFilePath}`);

    // Return result in compatible format
    return {
      ok: true,
      data: {
        processedCount: twoStageResult.data.stage1Result.successfulDocuments,
        failedCount: twoStageResult.data.stage1Result.failedDocuments,
        outputPath: outputFilePath,
        stage1Result: twoStageResult.data.stage1Result,
        stage2Result: twoStageResult.data.stage2Result,
        processingTimeMs: twoStageResult.data.processingTimeMs,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "ProcessingError",
        message: error instanceof Error
          ? error.message
          : "Two-stage processing failed",
      },
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
    string: [
      "schema",
      "template",
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

  if (args.help || args._.length === 0) {
    printUsage();
    Deno.exit(args.help ? 0 : 1);
  }

  const markdownDir = args._[0] as string;
  const schemaPath = args.schema;
  const templatePath = args.template;
  const destinationDir = args.destination || markdownDir;
  const verboseMode = args.verbose || false;
  const processingMode = (args.mode || "single-stage") as
    | "single-stage"
    | "two-stage";

  // Validate processing mode
  if (processingMode !== "single-stage" && processingMode !== "two-stage") {
    cliLogger.error(
      "Error: --mode must be either 'single-stage' or 'two-stage'",
    );
    printUsage();
    Deno.exit(1);
  }

  // Validate required arguments based on mode
  if (processingMode === "single-stage") {
    if (!schemaPath || !templatePath) {
      cliLogger.error(
        "Error: --schema and --template options are required for single-stage mode",
      );
      printUsage();
      Deno.exit(1);
    }
  } else if (processingMode === "two-stage") {
    const commandSchemaPath = args["command-schema"];
    const commandTemplatePath = args["command-template"];

    if (!commandSchemaPath || !commandTemplatePath) {
      cliLogger.error(
        "Error: --command-schema and --command-template are required for two-stage mode",
      );
      printUsage();
      Deno.exit(1);
    }

    // Registry schema/template default to main schema/template if not provided
    const registrySchemaPath = args["registry-schema"] || schemaPath;
    const registryTemplatePath = args["registry-template"] || templatePath;

    if (!registrySchemaPath || !registryTemplatePath) {
      cliLogger.error(
        "Error: registry schema and template must be provided either via --registry-* options or --schema/--template fallbacks",
      );
      printUsage();
      Deno.exit(1);
    }
  }

  try {
    cliLogger.info("🚀 Starting frontmatter-to-schema CLI...");
    cliLogger.info(`📁 Markdown directory: ${markdownDir}`);
    cliLogger.info(`⚙️  Processing mode: ${processingMode}`);

    if (processingMode === "single-stage") {
      cliLogger.info(`📋 Schema: ${schemaPath}`);
      cliLogger.info(`📝 Template: ${templatePath}`);
    } else {
      const commandSchemaPath = args["command-schema"];
      const commandTemplatePath = args["command-template"];
      const registrySchemaPath = args["registry-schema"] || schemaPath;
      const registryTemplatePath = args["registry-template"] || templatePath;

      cliLogger.info(`📋 Command Schema: ${commandSchemaPath}`);
      cliLogger.info(`📝 Command Template: ${commandTemplatePath}`);
      cliLogger.info(`📊 Registry Schema: ${registrySchemaPath}`);
      cliLogger.info(`📄 Registry Template: ${registryTemplatePath}`);
    }

    cliLogger.info(`💾 Destination: ${destinationDir}`);

    // Verbose: Check file existence before processing
    if (verboseMode && schemaPath) {
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

      if (templatePath) {
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
    // Create schema and template paths only for single-stage mode
    let schemaPathResult, templatePathResult;
    if (processingMode === "single-stage" && schemaPath && templatePath) {
      schemaPathResult = ConfigPath.create(schemaPath);
      templatePathResult = TemplatePath.create(templatePath);
    }

    // Determine output path - if destination already has an extension, use it as-is
    // Otherwise, append the appropriate extension based on template
    let outputPath: string;
    if (
      destinationDir.endsWith(".json") || destinationDir.endsWith(".yaml") ||
      destinationDir.endsWith(".yml") || destinationDir.endsWith(".toml")
    ) {
      outputPath = destinationDir;
    } else {
      const templateExt = templatePath &&
          (templatePath.endsWith(".yaml") || templatePath.endsWith(".yml"))
        ? "yaml"
        : "json";
      const outputFileName = `registry.${templateExt}`;
      outputPath = join(destinationDir, outputFileName);
    }
    const outputPathResult = OutputPath.create(outputPath);

    if (
      !documentsPathResult.ok || !outputPathResult.ok ||
      (processingMode === "single-stage" && schemaPathResult &&
        !schemaPathResult.ok) ||
      (processingMode === "single-stage" && templatePathResult &&
        !templatePathResult.ok)
    ) {
      cliLogger.error("Error: Invalid paths provided");
      if (!documentsPathResult.ok) {
        cliLogger.error(`  Documents: ${documentsPathResult.error.message}`);
      }
      if (schemaPathResult && !schemaPathResult.ok) {
        cliLogger.error(`  Schema: ${schemaPathResult.error.message}`);
      }
      if (templatePathResult && !templatePathResult.ok) {
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
            documentsPath: documentsPathResult.ok
              ? documentsPathResult.data.getValue()
              : "invalid",
            schemaPath: schemaPathResult && schemaPathResult.ok
              ? schemaPathResult.data.getValue()
              : "invalid",
            templatePath: templatePathResult && templatePathResult.ok
              ? templatePathResult.data.getValue()
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
    if (!schemaPathResult?.ok || !templatePathResult?.ok) {
      throw new Error("Schema or template path validation failed unexpectedly");
    }

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

    // deno-lint-ignore no-explicit-any
    let result: any;

    if (processingMode === "two-stage") {
      // Two-stage processing
      result = await executeTwoStageProcessing(
        args,
        documentsPathResult.data,
        outputPathResult.data,
        documentRepo,
        configLoader,
        templateLoader,
        verboseMode ? logger : undefined,
      );
    } else {
      // Single-stage processing (current implementation)
      result = await processDocumentsUseCase.execute({
        config: processingConfig,
      });
    }

    if (result.ok) {
      cliLogger.info("\n✅ Processing completed successfully!");
      cliLogger.info(`📊 Processed: ${result.data.processedCount} documents`);
      cliLogger.info(`❌ Failed: ${result.data.failedCount} documents`);
      cliLogger.info(`💾 Output saved to: ${result.data.outputPath}`);

      if (processingMode === "two-stage" && result.data.stage2Result) {
        cliLogger.info(
          `🔧 Available configs: ${
            result.data.stage2Result.availableConfigs.join(", ")
          }`,
        );
        cliLogger.info(
          `⚡ Total commands: ${result.data.stage2Result.totalCommands}`,
        );
        cliLogger.info(
          `⏱️  Processing time: ${result.data.processingTimeMs}ms`,
        );
      }
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
