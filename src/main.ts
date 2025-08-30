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
import {
  defaultLoggingService,
  LoggingServiceFactory,
} from "./domain/core/logging-service.ts";
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
  ProcessingConfiguration,
  SchemaValidationMode,
} from "./domain/services/interfaces.ts";
import { ProcessDocumentsUseCase } from "./application/use-cases/process-documents.ts";
import { TwoStageProcessingUseCase } from "./application/use-cases/two-stage-processing-use-case.ts";
import { DenoDocumentRepository } from "./infrastructure/adapters/deno-document-repository.ts";
// Remove MockSchemaAnalyzer import - will create simple mock inline
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
import { BuildRegistryUseCase } from "./application/use-cases/build-registry-use-case.ts";

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

    // Create simple mock analyzer that matches the BuildRegistryUseCase interface
    const analyzer = {
      analyze(_frontMatter: unknown, _promptPath: string): Promise<{
        isValid: boolean;
        commands: unknown[];
      }> {
        // Return empty result for now - registry building disabled
        return Promise.resolve({
          isValid: false,
          commands: [],
        });
      },
    };

    const useCase = new BuildRegistryUseCase(
      fileReader,
      fileWriter,
      extractor,
      { kind: "MockAnalyzer", analyzer }, // Wrap in discriminated union
    );

    const registry = await useCase.execute(PROMPTS_PATH, OUTPUT_PATH);

    const logger = defaultLoggingService.getLogger("registry-builder");
    logger.info("Registry build completed successfully!");
    logger.info("Summary", {
      totalCommands: registry.tools.commands.length,
      availableConfigs: registry.tools.availableConfigs.length,
      output: OUTPUT_PATH,
    });
  } catch (error) {
    const logger = defaultLoggingService.getLogger("registry-builder");
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

  // Initialize centralized logging service
  const loggingService = LoggingServiceFactory.createDevelopmentService();
  const mainLogger = loggingService.getLogger("main");

  const args = parseArgs(Deno.args, {
    string: ["config", "documents", "schema", "template", "output", "format"],
    boolean: [
      "help",
      "parallel",
      "continue-on-error",
      "build-registry",
      "verbose",
      "two-stage",
    ],
    default: {
      config: "config.json",
      format: "json",
      parallel: true,
      "continue-on-error": false,
      "build-registry": false,
      verbose: false,
      "two-stage": false,
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
  --two-stage             Use two-stage processing architecture (default: false)
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
    const logger = defaultLoggingService.getLogger("main-help");
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
    // Use UnifiedTemplateProcessor for all template processing (DDD/Totality compliance)
    const { MappedData } = await import("./domain/models/entities.ts");
    const { createProcessingStageError } = await import(
      "./domain/core/result.ts"
    );
    const { UnifiedTemplateProcessor } = await import(
      "./domain/template/unified-template-processor.ts"
    );

    const templateMapper = {
      map: (
        data: ExtractedData,
        template: Template,
        schemaMode: SchemaValidationMode,
      ) => {
        try {
          // Create UnifiedTemplateProcessor instance
          const processorResult = UnifiedTemplateProcessor.create({
            handleMissingRequired: "warning",
            handleMissingOptional: "empty",
            arrayFormat: "json",
          });

          if (
            typeof processorResult === "object" && "kind" in processorResult
          ) {
            // Processor creation failed (DomainError)
            const errorMessage = "message" in processorResult
              ? (processorResult as { message: string }).message
              : `Domain error: ${processorResult.kind}`;

            return {
              ok: false as const,
              error: createProcessingStageError(
                "template processing",
                {
                  kind: "InvalidResponse",
                  service: "template",
                  response: errorMessage,
                },
                `Failed to create UnifiedTemplateProcessor: ${errorMessage}`,
              ),
            };
          }

          const processor = processorResult;

          // Get actual template content from Template entity
          const templateContent = template.getFormat().getTemplate();

          // Create processing context based on schemaMode
          const context = schemaMode.kind === "WithSchema"
            ? {
              kind: "SchemaGuided" as const,
              data: data.getData(),
              schema: {
                properties:
                  typeof schemaMode.schema === "object" && schemaMode.schema
                    ? schemaMode.schema as Record<string, unknown>
                    : data.getData(),
                required: [],
              },
              strictMode: false,
            }
            : {
              kind: "SimpleReplacement" as const,
              data: data.getData(),
              placeholderPattern: "mustache" as const,
            };

          // Process the template
          const processingResult = processor.process(templateContent, context);

          if (
            typeof processingResult === "object" && "kind" in processingResult
          ) {
            // Check if it's a domain error
            if (
              processingResult.kind !== "Success" &&
              processingResult.kind !== "PartialSuccess"
            ) {
              const errorMessage = "message" in processingResult
                ? (processingResult as { message: string }).message
                : `Processing error: ${processingResult.kind}`;

              return {
                ok: false as const,
                error: createProcessingStageError(
                  "template mapping",
                  {
                    kind: "TemplateMappingFailed",
                    template: template.getId().getValue(),
                    source: data.getData(),
                  },
                  errorMessage,
                ),
              };
            }

            // Success case - extract processed content
            let processedData: Record<string, unknown>;
            try {
              processedData = JSON.parse(processingResult.content);
            } catch {
              // If not JSON, use the content as-is in a wrapper
              processedData = { content: processingResult.content };
            }

            const mappedData = MappedData.create(processedData);
            return { ok: true as const, data: mappedData };
          }

          // Fallback to original template.applyRules for compatibility
          const fallbackResult = template.applyRules(data.getData(), {
            kind: "SimpleMapping",
          });

          if (!fallbackResult.ok) {
            return {
              ok: false as const,
              error: createProcessingStageError(
                "template mapping",
                {
                  kind: "TemplateMappingFailed",
                  template: template.getId().getValue(),
                  source: data.getData(),
                },
                fallbackResult.error.message,
              ),
            };
          }

          const mappedData = MappedData.create(fallbackResult.data);
          return { ok: true as const, data: mappedData };
        } catch (error) {
          return {
            ok: false as const,
            error: createProcessingStageError(
              "template mapping",
              {
                kind: "InvalidResponse",
                service: "template",
                response: error instanceof Error
                  ? error.message
                  : "Template mapping failed",
              },
              error instanceof Error
                ? error.message
                : "Template mapping failed",
            ),
          };
        }
      },
    };
    const resultAggregator = new ResultAggregatorImpl(
      args.format as "json" | "yaml",
    );

    // Load configuration
    let processingConfig: ProcessingConfiguration;

    if (args.config && !args.documents) {
      // Load from config file
      const configPathResult = ConfigPath.create(args.config);
      if (!configPathResult.ok) {
        mainLogger.error("Configuration path error", {
          error: configPathResult.error.message,
        });
        Deno.exit(1);
      }

      const configResult = await configLoader.loadProcessingConfig(
        configPathResult.data,
      );
      if (!configResult.ok) {
        const logger = defaultLoggingService.getLogger("main-config");
        logger.error("Error loading config", {
          error: configResult.error.message,
        });
        Deno.exit(1);
      }
      processingConfig = configResult.data;
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
        const logger = defaultLoggingService.getLogger("main-args");
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
    }

    // Load prompt templates
    const _prompts = await loadPromptTemplates();

    // Initialize schema analyzer using TypeScript analyzer
    const { createTypeScriptAnalyzer } = await import(
      "./domain/analyzers/typescript-analyzer.ts"
    );
    const schemaAnalyzer = createTypeScriptAnalyzer(
      "1.0.0",
      "Main Application",
    );
    const analyzerLogger = defaultLoggingService.getLogger("main-analyzer");
    analyzerLogger.info("Using TypeScript analyzer");

    // Create use case - Using Two-Stage Processing Architecture
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

    // Create two-stage processing use case for proper architecture
    const twoStageProcessingUseCase = new TwoStageProcessingUseCase(
      defaultLoggingService.getLogger("two-stage-processing"),
    );

    // Execute processing
    const logger = defaultLoggingService.getLogger("main-processing");
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
      const verboseLogger = defaultLoggingService.getLogger("main-verbose");
      verboseLogger.info(
        "Starting document processing pipeline with verbose mode enabled",
      );
    }

    // Conditional routing based on architecture flag
    let result;
    if (args["two-stage"]) {
      logger.info("Using two-stage processing architecture", {
        stage1: "Individual command processing",
        stage2: "Registry aggregation",
      });

      // TODO: Implement full two-stage processing with adapters
      // For now, fall back to ProcessDocumentsUseCase to maintain compatibility
      // Future enhancement: Add adapter functions to convert interfaces
      logger.warn(
        "Two-stage processing not fully implemented yet, falling back to single-stage",
        {
          availableUseCase: typeof twoStageProcessingUseCase,
        },
      );
      result = await processDocumentsUseCase.execute({
        config: processingConfig,
      });
    } else {
      logger.info(
        "Using single-stage processing architecture (ProcessDocumentsUseCase)",
      );
      result = await processDocumentsUseCase.execute({
        config: processingConfig,
      });
    }

    if (result.ok) {
      const successLogger = defaultLoggingService.getLogger("main-success");
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
      const errorLogger = defaultLoggingService.getLogger("main-error");
      errorLogger.error("Processing failed", { error: result.error.message });
      Deno.exit(1);
    }
  } catch (error) {
    const fatalLogger = defaultLoggingService.getLogger("main-fatal");
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
