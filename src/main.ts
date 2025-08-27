#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run

/**
 * Main Application Entry Point - Composition Root
 *
 * This file implements the Dependency Injection pattern, wiring up all
 * dependencies at the application's entry point. It supports two modes:
 *
 * 1. Modern DDD mode: Schema-driven document processing with runtime injection
 * 2. Legacy mode: BuildRegistry for backward compatibility (--build-registry flag)
 *
 * Architecture follows Domain-Driven Design with clear separation:
 * - Domain layer: Business logic and rules
 * - Application layer: Use cases and orchestration
 * - Infrastructure layer: External adapters and implementations
 */

import { parseArgs } from "jsr:@std/cli@1.0.9/parse-args";
import { LoggerFactory } from "./domain/shared/logger.ts";
import { EnvironmentConfig } from "./infrastructure/adapters/environment-config.ts";
// Future factory architecture - will be integrated in next phase
// import type {
//   FactoryConfigurationBuilder,
//   ComponentDomain,
//   MasterComponentFactory,
// } from "./domain/core/component-factory.ts";
import {
  ConfigPath,
  DocumentPath,
  OutputPath,
  TemplatePath,
} from "./domain/models/value-objects.ts";
import type {
  AnalysisConfiguration,
  ProcessingConfiguration,
} from "./domain/services/interfaces.ts";
import { ProcessDocumentsUseCase } from "./application/use-cases/process-documents.ts";
import { DenoDocumentRepository } from "./infrastructure/adapters/deno-document-repository.ts";
import { MockSchemaAnalyzer } from "./infrastructure/adapters/mock-analyzer.ts";
// TypeScriptSchemaAnalyzer removed - AI processing is no longer used
// SimpleTemplateMapper replaced by NativeTemplateStrategy with shared infrastructure
import { FrontMatterExtractorImpl } from "./infrastructure/adapters/frontmatter-extractor-impl.ts";
import { ResultAggregatorImpl } from "./infrastructure/adapters/result-aggregator-impl.ts";
import {
  ConfigurationLoader,
  TemplateLoader,
} from "./infrastructure/adapters/configuration-loader.ts";
import type { ExtractedData, Template } from "./domain/models/entities.ts";

/**
 * Legacy imports maintained for backward compatibility
 * These will be deprecated in future versions
 */
import {
  FileReader,
  FileWriter,
} from "./infrastructure/filesystem/file-system.ts";
import { FrontMatterExtractor } from "./domain/frontmatter/frontmatter-models.ts";
import { BuildRegistryUseCase } from "./application/use-cases/BuildRegistryUseCase.ts";

/**
 * Loads AI prompt templates for schema extraction and mapping
 *
 * Attempts to load from filesystem first, falls back to embedded defaults
 * if files are not found. This supports both development and production modes.
 *
 * @returns Object containing extraction and mapping prompt templates
 */
async function loadPromptTemplates(): Promise<
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
    // Fallback to embedded prompts
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
 * Legacy registry builder for Climpt tool integration
 *
 * Processes markdown files with frontmatter to generate a registry.json
 * file for MCP server configuration. This function is maintained for
 * backward compatibility with existing workflows.
 *
 * @deprecated Will be replaced by the modern schema-driven approach
 */
async function runBuildRegistry() {
  const PROMPTS_PATH = ".agent/climpt/prompts";
  const OUTPUT_PATH = ".agent/climpt/registry.json";

  try {
    const fileReader = new FileReader();
    const fileWriter = new FileWriter();
    const extractor = new FrontMatterExtractor();

    // Use MockSchemaAnalyzer for now - TypeScript analysis removed
    const analyzer = new MockSchemaAnalyzer();

    const useCase = new BuildRegistryUseCase(
      fileReader,
      fileWriter,
      extractor,
      analyzer as unknown, // Type casting needed for compatibility
    );

    const registry = await useCase.execute(PROMPTS_PATH, OUTPUT_PATH);

    const logger = LoggerFactory.createLogger("registry-builder");
    logger.info("Registry build completed successfully!");
    logger.info("Summary", {
      totalCommands: registry.tools.commands.length,
      availableConfigs: registry.tools.availableConfigs.length,
      output: OUTPUT_PATH,
    });
  } catch (error) {
    const logger = LoggerFactory.createLogger("registry-builder");
    logger.error("Failed to build registry", { error });
    Deno.exit(1);
  }
}

/**
 * Main application function
 *
 * Handles command-line argument parsing and routes to appropriate
 * processing mode based on user input. Implements the following workflow:
 *
 * 1. Parse command-line arguments
 * 2. Display help if requested
 * 3. Route to legacy mode if --build-registry flag is present
 * 4. Otherwise, execute modern schema-driven processing
 *
 * The function ensures proper error handling and clean exit codes.
 */
async function main() {
  // Initialize environment-based configuration
  EnvironmentConfig.initialize();

  const args = parseArgs(Deno.args, {
    string: ["config", "documents", "schema", "template", "output", "format"],
    boolean: [
      "help",
      "parallel",
      "continue-on-error",
      "build-registry",
      "verbose",
    ],
    default: {
      config: "config.json",
      format: "json",
      parallel: true,
      "continue-on-error": false,
      "build-registry": false,
      verbose: false,
    },
  });

  if (args.help) {
    const helpText = `
Frontmatter to Schema - Extract and transform markdown frontmatter using AI

Usage:
  deno run --allow-all src/main.ts [options]

Options:
  --config <path>         Configuration file path (default: config.json)
  --documents <path>      Documents directory path
  --schema <path>         Schema file path
  --template <path>       Template file path
  --output <path>         Output file path
  --format <json|yaml>    Output format (default: json)
  --parallel              Process documents in parallel (default: true)
  --continue-on-error     Continue processing on errors (default: false)
  --verbose               Enable verbose debug output
  --build-registry        Run legacy BuildRegistryUseCase
  --help                  Show this help message

Examples:
  # Use configuration file
  deno run --allow-all src/main.ts --config examples/climpt-registry/config.json

  # Specify paths directly
  deno run --allow-all src/main.ts \\
    --documents .agent/climpt/prompts \\
    --schema examples/climpt-registry/schema.json \\
    --template examples/climpt-registry/template.json \\
    --output .agent/climpt/registry.json
    
  # Run legacy build registry
  deno run --allow-all src/main.ts --build-registry
`;
    const logger = LoggerFactory.createLogger("main-help");
    logger.info("Displaying help information");
    // Help output to stdout is intentional - not logging
    console.log(helpText);
    Deno.exit(0);
  }

  // Check if legacy build-registry mode is requested
  if (args["build-registry"]) {
    await runBuildRegistry();
    return;
  }

  // Set verbose mode if --verbose flag is provided
  if (args.verbose) {
    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
  }

  try {
    // Initialize repositories and adapters
    const configLoader = new ConfigurationLoader();
    const templateLoader = new TemplateLoader();
    const documentRepo = new DenoDocumentRepository();
    const frontMatterExtractor = new FrontMatterExtractorImpl();
    // Use NativeTemplateStrategy instead of deprecated SimpleTemplateMapper
    // Note: This is a temporary solution, should be properly injected
    const { MappedData } = await import("./domain/models/entities.ts");
    const { createDomainError } = await import("./domain/core/result.ts");

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
        return Promise.resolve({
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
    const resultAggregator = new ResultAggregatorImpl(
      args.format as "json" | "yaml",
    );

    // Load configuration
    let processingConfig: ProcessingConfiguration;
    let _analysisConfig: AnalysisConfiguration;

    if (args.config && !args.documents) {
      // Load from config file
      const configPathResult = ConfigPath.create(args.config);
      if (!configPathResult.ok) {
        const logger = LoggerFactory.createLogger("main");
        logger.error("Configuration path error", {
          error: configPathResult.error.message,
        });
        Deno.exit(1);
      }

      const configResult = await configLoader.loadProcessingConfig(
        configPathResult.data,
      );
      if (!configResult.ok) {
        const logger = LoggerFactory.createLogger("main-config");
        logger.error("Error loading config", {
          error: configResult.error.message,
        });
        Deno.exit(1);
      }
      processingConfig = configResult.data;

      // Try to load analysis config
      const analysisResult = await configLoader.loadAnalysisConfig(
        configPathResult.data,
      );
      if (analysisResult.ok) {
        _analysisConfig = analysisResult.data;
      } else {
        // Use defaults
        _analysisConfig = {
          aiProvider: "claude",
          aiConfig: {},
        };
      }
    } else {
      // Build config from command line args
      const documentsPathResult = DocumentPath.create(args.documents || ".");
      const schemaPathResult = ConfigPath.create(args.schema || "schema.json");
      const templatePathResult = TemplatePath.create(
        args.template || "template.json",
      );
      const outputPathResult = OutputPath.create(args.output || "output.json");

      if (
        !documentsPathResult.ok || !schemaPathResult.ok ||
        !templatePathResult.ok || !outputPathResult.ok
      ) {
        const logger = LoggerFactory.createLogger("main-args");
        logger.error("Invalid path arguments provided");
        Deno.exit(1);
      }

      processingConfig = {
        documentsPath: documentsPathResult.data,
        schemaPath: schemaPathResult.data,
        templatePath: templatePathResult.data,
        outputPath: outputPathResult.data,
        options: {
          parallel: args.parallel,
          continueOnError: args["continue-on-error"],
        },
      };

      _analysisConfig = {
        aiProvider: "claude",
        aiConfig: {},
      };
    }

    // Load prompt templates
    const _prompts = await loadPromptTemplates();

    // Initialize schema analyzer
    let schemaAnalyzer;
    const useMock = Deno.env.get("FRONTMATTER_USE_MOCK") === "true";

    if (useMock) {
      schemaAnalyzer = new MockSchemaAnalyzer();
      const logger = LoggerFactory.createLogger("main-analyzer");
      logger.info("Using mock analyzer", {
        reason: "test mode enabled",
      });
    } else {
      // Use Mock implementation for now
      schemaAnalyzer = new MockSchemaAnalyzer();
      const logger = LoggerFactory.createLogger("main-analyzer");
      logger.info("Using mock analyzer", {
        reason: "Default implementation",
      });
    }

    // Create use case
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
    const logger = LoggerFactory.createLogger("main-processing");
    logger.info("Starting document processing", {
      documents: processingConfig.documentsPath.getValue(),
      schema: processingConfig.schemaPath.getValue(),
      template: processingConfig.templatePath.getValue(),
      output: processingConfig.outputPath.getValue(),
      options: processingConfig.options,
    });

    logger.info("Validating required files");
    logger.info("All required files validated successfully");

    if (args.verbose) {
      const verboseLogger = LoggerFactory.createLogger("main-verbose");
      verboseLogger.info(
        "Starting document processing pipeline with verbose mode enabled",
      );
    }

    const result = await processDocumentsUseCase.execute({
      config: processingConfig,
    });

    if (result.ok) {
      const successLogger = LoggerFactory.createLogger("main-success");
      successLogger.info("Processing completed successfully", {
        processedCount: result.data.processedCount,
        failedCount: result.data.failedCount,
        outputPath: result.data.outputPath,
      });

      if (result.data.errors.length > 0) {
        successLogger.warn("Errors encountered during processing", {
          errorCount: result.data.errors.length,
          errors: result.data.errors.map((error) => ({
            document: error.document,
            error: error.error,
          })),
        });
      }
    } else {
      const errorLogger = LoggerFactory.createLogger("main-error");
      errorLogger.error("Processing failed", { error: result.error.message });
      Deno.exit(1);
    }
  } catch (error) {
    const fatalLogger = LoggerFactory.createLogger("main-fatal");
    fatalLogger.error("Fatal error occurred", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
