import {
  contextualErr,
  err,
  ok,
  Result,
} from "../../domain/shared/types/result.ts";
import {
  createEnhancedError,
  createError,
  DomainError,
} from "../../domain/shared/types/errors.ts";
import {
  Decision,
  ErrorContextFactory,
  ProcessingProgress,
} from "../../domain/shared/types/error-context.ts";
import { FrontmatterTransformationService } from "../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { SchemaProcessingService } from "../../domain/schema/services/schema-processing-service.ts";
import { OutputRenderingService } from "../../domain/template/services/output-rendering-service.ts";
import { TemplatePathResolver } from "../../domain/template/services/template-path-resolver.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { Template } from "../../domain/template/entities/template.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../../domain/frontmatter/factories/frontmatter-data-factory.ts";
import { SchemaPath } from "../../domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../domain/schema/value-objects/schema-definition.ts";
import { TemplatePath } from "../../domain/template/value-objects/template-path.ts";
import { SchemaCache } from "../../infrastructure/caching/schema-cache.ts";
import { EnhancedDebugLogger } from "../../domain/shared/services/debug-logger.ts";
import { DebugLoggerFactory } from "../../infrastructure/logging/debug-logger-factory.ts";
import { VerbosityMode } from "../../domain/template/value-objects/processing-context.ts";

/**
 * Template configuration using discriminated unions for type safety
 */
export type TemplateConfig =
  | { readonly kind: "explicit"; readonly templatePath: string }
  | { readonly kind: "schema-derived" };

/**
 * Verbosity configuration using discriminated unions
 */
export type VerbosityConfig =
  | { readonly kind: "verbose"; readonly enabled: true }
  | { readonly kind: "quiet"; readonly enabled: false };

/**
 * Configuration for pipeline processing following Totality principles
 */
export interface PipelineConfig {
  readonly inputPattern: string;
  readonly schemaPath: string;
  readonly outputPath: string;
  readonly templateConfig: TemplateConfig;
  readonly verbosityConfig: VerbosityConfig;
}

/**
 * File system interface for pipeline operations
 */
export interface FileSystem {
  read(
    path: string,
  ):
    | Promise<Result<string, DomainError & { message: string }>>
    | Result<string, DomainError & { message: string }>;
  write(
    path: string,
    content: string,
  ):
    | Promise<Result<void, DomainError & { message: string }>>
    | Result<void, DomainError & { message: string }>;
  list(
    pattern: string,
  ):
    | Promise<Result<string[], DomainError & { message: string }>>
    | Result<string[], DomainError & { message: string }>;
}

/**
 * Main pipeline orchestrator that coordinates the entire processing flow.
 * Implements the requirements from docs/requirements.ja.md
 *
 * Processing flow (成果A → 成果Z):
 * 1. List markdown files (成果A)
 * 2. Extract frontmatter (成果B)
 * 3. Parse with TypeScript (成果C)
 * 4. Convert to schema structure (成果D)
 * 5. Apply to template variables (成果E)
 * 6. Generate final output (成果Z)
 */
export class PipelineOrchestrator {
  constructor(
    private readonly frontmatterTransformer: FrontmatterTransformationService,
    private readonly schemaProcessor: SchemaProcessingService,
    private readonly outputRenderingService: OutputRenderingService,
    private readonly templatePathResolver: TemplatePathResolver,
    private readonly fileSystem: FileSystem,
    private readonly schemaCache: SchemaCache,
    private readonly logger?: EnhancedDebugLogger,
  ) {}

  /**
   * Execute the complete pipeline processing
   */
  async execute(
    config: PipelineConfig,
  ): Promise<Result<void, DomainError & { message: string }>> {
    // Performance monitoring initialization
    const _pipelineStartTime = performance.now();
    const initialMemory = Deno.memoryUsage();

    // Step 1: Load and process schema
    // FIXED: Removed false variable to eliminate Totality violation
    // All logging now unconditional through proper infrastructure
    // Replaced hardcoded verbose conditionals with proper logging infrastructure
    this.logger?.debug(
      `Verbosity config: kind="${config.verbosityConfig.kind}", enabled=${config.verbosityConfig.enabled}`,
      { operation: "pipeline-config", timestamp: new Date().toISOString() },
    );
    this.logger?.info("Step 1: Loading schema from " + config.schemaPath, {
      operation: "schema-loading",
      timestamp: new Date().toISOString(),
    });
    this.logger?.debug(
      `Pipeline start - Memory: ${
        Math.round(initialMemory.heapUsed / 1024 / 1024)
      }MB`,
      {
        operation: "performance-monitoring",
        timestamp: new Date().toISOString(),
      },
    );
    const schemaResult = await this.loadSchema(config.schemaPath);
    if (!schemaResult.ok) {
      return schemaResult;
    }
    const schema = schemaResult.data;

    // Step 2: Resolve template paths using TemplatePathResolver

    // Create context for template path resolution
    const templateResolutionContext = ErrorContextFactory.forPipeline(
      "Template Resolution",
      "resolveTemplatePaths",
      106,
    );
    if (!templateResolutionContext.ok) {
      return templateResolutionContext;
    }

    // Extract template configuration using discriminated union pattern
    const explicitTemplatePath = config.templateConfig.kind === "explicit"
      ? config.templateConfig.templatePath
      : undefined;

    const templatePathConfig = {
      schemaPath: config.schemaPath,
      explicitTemplatePath,
    };

    // Enhance context with input parameters and decision logic
    const enhancedContext = templateResolutionContext.data
      .withInput("schemaPath", config.schemaPath)
      .withInput("explicitTemplatePath", explicitTemplatePath)
      .withInput(
        "hasExplicitTemplate",
        config.templateConfig.kind === "explicit",
      );

    // Create decision record for template resolution strategy
    const resolutionStrategy = config.templateConfig.kind;
    const templateDecisionResult = Decision.create(
      "Template path resolution strategy selection",
      ["explicit", "schema-derived", "auto-detect"],
      resolutionStrategy === "explicit"
        ? "Explicit template path provided in configuration"
        : "No explicit template, deriving from schema definition",
    );
    if (!templateDecisionResult.ok) {
      return contextualErr(templateDecisionResult.error, enhancedContext);
    }

    const contextWithDecision = enhancedContext.withDecision(
      templateDecisionResult.data,
    );

    const resolvePathsResult = this.templatePathResolver.resolveTemplatePaths(
      schema,
      templatePathConfig,
    );
    if (!resolvePathsResult.ok) {
      const enhancedError = createEnhancedError(
        resolvePathsResult.error,
        contextWithDecision,
        "Template path resolution failed during pipeline execution",
      );
      return err(enhancedError);
    }

    const templatePath = resolvePathsResult.data.templatePath;
    const itemsTemplatePath = resolvePathsResult.data.itemsTemplatePath;
    const outputFormat = resolvePathsResult.data.outputFormat || "json";

    // Log successful resolution with context

    // Step 4: Process documents (成果A-D)
    const docProcessingStartTime = performance.now();
    const validationRules = schema.getValidationRules();
    // Create logger for transformation service based on verbosity configuration
    const transformationLoggerResult = this.logger
      ? ok(this.logger)
      : DebugLoggerFactory.createForVerbose(false);
    if (!transformationLoggerResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Failed to create transformation logger: ${transformationLoggerResult.error.message}`,
      }));
    }

    const processedDataResult = this.frontmatterTransformer.transformDocuments(
      config.inputPattern,
      validationRules,
      schema,
      transformationLoggerResult.data,
    );
    if (!processedDataResult.ok) {
      return processedDataResult;
    }

    // Performance monitoring for document processing
    const _docProcessingTime = performance.now() - docProcessingStartTime;
    const _currentMemory = Deno.memoryUsage();

    // Step 5: Extract items data if x-frontmatter-part is present

    // Create context for data preparation phase
    const dataPreparationContext = ErrorContextFactory.forPipeline(
      "Data Preparation",
      "prepareDataForRendering",
      193,
    );
    if (!dataPreparationContext.ok) {
      return dataPreparationContext;
    }

    const mainData = processedDataResult.data;
    let itemsData: FrontmatterData[] | undefined;

    // Analyze frontmatter-part requirements and create processing progress
    const frontmatterPartPathResult = schema.findFrontmatterPartPath();
    const hasFrontmatterPart = frontmatterPartPathResult.ok;
    const frontmatterPartPath = hasFrontmatterPart
      ? frontmatterPartPathResult.data
      : null;

    // Create processing progress for data preparation
    const dataSteps = [
      "Schema analysis",
      "Frontmatter-part detection",
      "Template strategy determination",
      "Data extraction",
    ];
    const completedSteps = ["Schema analysis", "Frontmatter-part detection"];
    const dataProgressResult = ProcessingProgress.create(
      "Data Preparation",
      "Template strategy determination",
      completedSteps,
      dataSteps.length,
    );
    if (!dataProgressResult.ok) {
      return contextualErr(
        dataProgressResult.error,
        dataPreparationContext.data,
      );
    }

    // Enhance context with analysis results
    const dataContext = dataPreparationContext.data
      .withInput("hasFrontmatterPart", hasFrontmatterPart)
      .withInput("frontmatterPartPath", frontmatterPartPath)
      .withInput("hasDualTemplate", !!itemsTemplatePath)
      .withInput("mainDataKeys", Object.keys(mainData.getData()))
      .withInput("mainDataSize", JSON.stringify(mainData.getData()).length)
      .withProgress(dataProgressResult.data);

    // Check if we need to extract items data
    // Extract frontmatter-part data ONLY if we have a separate items template
    // For single templates with {@items}, let the template handle the expansion
    // using the full mainData which includes base properties
    if (itemsTemplatePath) {
      // Create decision for dual template data extraction
      const extractionDecisionResult = Decision.create(
        "Data extraction strategy for dual template",
        ["extract-frontmatter-part", "use-main-data", "skip-extraction"],
        "Dual template requires frontmatter-part data extraction for items template",
      );
      if (!extractionDecisionResult.ok) {
        return contextualErr(extractionDecisionResult.error, dataContext);
      }

      const extractionContext = dataContext.withDecision(
        extractionDecisionResult.data,
      );

      const frontmatterPartResult = this.extractFrontmatterPartData(
        mainData,
        schema,
      );
      if (!frontmatterPartResult.ok) {
        const enhancedError = createEnhancedError(
          frontmatterPartResult.error,
          extractionContext,
          "Frontmatter-part data extraction failed in dual template mode",
        );
        return err(enhancedError);
      } else if (frontmatterPartResult.data.length > 0) {
        itemsData = frontmatterPartResult.data;

        // Update progress to completion
        const completionProgressResult = ProcessingProgress.create(
          "Data Preparation",
          "Data extraction completed",
          dataSteps,
          dataSteps.length,
        );
        if (completionProgressResult.ok) {
          const _completionContext = extractionContext
            .withProgress(completionProgressResult.data)
            .withInput("extractedItemCount", itemsData.length)
            .withInput("renderingStrategy", "dual-template");

          // Dead code removed - logging now handled by proper infrastructure
        }
      } else {
        // No frontmatter-part data found in dual template mode
      }
    } else if (schema.findFrontmatterPartPath().ok) {
      // For single template with frontmatter-part, keep itemsData undefined
      // The template renderer will extract the array data from mainData during {@items} expansion
      // Dead code removed - logging now handled by proper infrastructure
    } else {
      // No frontmatter-part processing needed for standard single template
    }

    // Step 6: Use OutputRenderingService to render and write output
    // Convert VerbosityConfig to VerbosityMode
    const verbosityMode: VerbosityMode =
      config.verbosityConfig.kind === "verbose"
        ? { kind: "verbose" }
        : { kind: "normal" };

    const renderResult = this.outputRenderingService.renderOutput(
      templatePath,
      itemsTemplatePath,
      mainData,
      itemsData,
      config.outputPath,
      outputFormat,
      verbosityMode,
    );
    return renderResult;
  }

  /**
   * Load schema from file system
   */
  private async loadSchema(
    schemaPath: string,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    // Performance optimization: Check schema cache first
    const cache = this.schemaCache;

    // Try to get from cache
    const cacheResult = await cache.get(schemaPath);
    if (!cacheResult.ok) {
      // Cache error - continue with normal loading but log the issue
      if (this.logger) {
        this.logger.warn(
          `Cache lookup failed for ${schemaPath}: ${cacheResult.error}`,
          {
            operation: "schema-cache-lookup",
            location: "PipelineOrchestrator.loadSchema",
            schemaPath,
            errorMessage: String(cacheResult.error),
            timestamp: new Date().toISOString(),
          },
        );
      }
    } else if (cacheResult.data) {
      // Cache hit - create Schema entity from cached definition
      const pathResult = SchemaPath.create(schemaPath);
      if (!pathResult.ok) {
        return pathResult;
      }

      const schemaResult = Schema.create(pathResult.data, cacheResult.data);
      if (schemaResult.ok) {
        return schemaResult;
      }
      // If Schema creation fails, continue with fresh load
    }

    // Cache miss or error - load from file system
    const contentResult = await Promise.resolve(
      this.fileSystem.read(schemaPath),
    );
    if (!contentResult.ok) {
      return contentResult;
    }

    try {
      const schemaData = JSON.parse(contentResult.data);

      // Create schema path
      const pathResult = SchemaPath.create(schemaPath);
      if (!pathResult.ok) {
        return pathResult;
      }

      // Create schema definition
      const definitionResult = SchemaDefinition.create(schemaData);
      if (!definitionResult.ok) {
        return definitionResult;
      }

      // Cache the schema definition for future use
      const setCacheResult = await cache.set(schemaPath, definitionResult.data);
      if (!setCacheResult.ok) {
        // Cache set error - continue but log the issue
        if (this.logger) {
          this.logger.warn(
            `Failed to cache schema ${schemaPath}: ${setCacheResult.error}`,
            {
              operation: "schema-cache-set",
              location: "PipelineOrchestrator.loadSchema",
              schemaPath,
              errorMessage: String(setCacheResult.error),
              timestamp: new Date().toISOString(),
            },
          );
        }
      }

      // Create schema entity
      return Schema.create(pathResult.data, definitionResult.data);
    } catch (error) {
      // Create error context for schema loading failure
      const schemaErrorContext = ErrorContextFactory.forSchema(
        "Schema Loading",
        schemaPath,
        "loadSchema",
      );

      if (!schemaErrorContext.ok) {
        return err(createError({
          kind: "InvalidSchema",
          message: `Failed to parse schema: ${error}`,
        }));
      }

      const enhancedContext = schemaErrorContext.data
        .withInput("filePath", schemaPath)
        .withInput("errorType", error instanceof Error ? error.name : "Unknown")
        .withInput("errorMessage", String(error));

      const baseError = createError({
        kind: "InvalidSchema",
        message: `Failed to parse schema: ${error}`,
      });

      return err(createEnhancedError(
        baseError,
        enhancedContext,
        `Schema parsing failed for ${schemaPath}`,
      ));
    }
  }

  /**
   * Load template from file system
   */
  private async loadTemplate(
    templatePath: string,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    // Read template file
    const contentResult = await Promise.resolve(
      this.fileSystem.read(templatePath),
    );
    if (!contentResult.ok) {
      return contentResult;
    }

    // Determine format from extension
    const format = this.getTemplateFormat(templatePath);

    // Create template path
    const pathResult = TemplatePath.create(templatePath);
    if (!pathResult.ok) {
      return pathResult;
    }

    // Parse template content based on format
    let templateData: unknown;
    try {
      if (format === "json") {
        templateData = JSON.parse(contentResult.data);
      } else if (format === "yaml") {
        // For YAML, keep as string for now (would need YAML parser)
        templateData = contentResult.data;
      } else {
        templateData = contentResult.data;
      }
    } catch (error) {
      // Create error context for template loading failure
      const templateErrorContext = ErrorContextFactory.forTemplate(
        "Template Loading",
        templatePath,
        "loadTemplate",
      );

      if (!templateErrorContext.ok) {
        return err(createError({
          kind: "InvalidTemplate",
          message: `Failed to parse template: ${error}`,
        }));
      }

      const enhancedContext = templateErrorContext.data
        .withInput("filePath", templatePath)
        .withInput("templateFormat", format)
        .withInput("errorType", error instanceof Error ? error.name : "Unknown")
        .withInput("errorMessage", String(error));

      const baseError = createError({
        kind: "InvalidTemplate",
        message: `Failed to parse template: ${error}`,
      });

      return err(createEnhancedError(
        baseError,
        enhancedContext,
        `Template parsing failed for ${templatePath}`,
      ));
    }

    // Create template entity
    return Template.create(pathResult.data, templateData);
  }

  /**
   * Determine template format from file extension
   */
  private getTemplateFormat(path: string): "json" | "yaml" | "markdown" {
    if (path.endsWith(".json")) return "json";
    if (path.endsWith(".yml") || path.endsWith(".yaml")) return "yaml";
    return "markdown";
  }

  /**
   * Extract frontmatter-part data as array for {@items} expansion.
   *
   * Key insight: frontmatter-part path in schema indicates where aggregated
   * data will be placed in final output, NOT where it exists in individual files.
   * Individual markdown files contribute directly to the array items.
   */
  private extractFrontmatterPartData(
    data: FrontmatterData,
    schema: Schema,
  ): Result<FrontmatterData[], DomainError & { message: string }> {
    // Create context for frontmatter-part extraction
    const extractionContext = ErrorContextFactory.forPipeline(
      "Frontmatter-Part Extraction",
      "extractFrontmatterPartData",
      453,
    );
    if (!extractionContext.ok) {
      return extractionContext;
    }

    const context = extractionContext.data
      .withInput("inputDataKeys", Object.keys(data.getData()))
      .withInput("inputDataSize", JSON.stringify(data.getData()).length);

    // Check if schema has frontmatter-part definition
    const pathResult = schema.findFrontmatterPartPath();
    if (!pathResult.ok) {
      // No frontmatter-part defined, return data as single item array
      const noPathDecisionResult = Decision.create(
        "Frontmatter-part path handling strategy",
        ["return-single-item", "return-empty", "return-error"],
        "No frontmatter-part path defined in schema, using fallback single-item strategy",
      );
      if (noPathDecisionResult.ok) {
        const fallbackContext = context.withDecision(noPathDecisionResult.data);
        if (this.logger) {
          this.logger.debug(
            "Frontmatter-part extraction context - no path defined",
            {
              operation: "frontmatter-part-extraction",
              location: "PipelineOrchestrator.extractFrontmatterPartData",
              decision: fallbackContext.getDebugInfo(),
              timestamp: new Date().toISOString(),
            },
          );
        }
      }
      return ok([data]);
    }

    const frontmatterPartPath = pathResult.data;
    const pathContext = context.withInput(
      "frontmatterPartPath",
      frontmatterPartPath,
    );

    // Check if this data already contains an array at the frontmatter-part path
    // This handles cases where a single file contains multiple items
    const arrayDataResult = data.get(frontmatterPartPath);
    const hasArrayData = arrayDataResult.ok &&
      Array.isArray(arrayDataResult.data);
    const arrayLength = hasArrayData ? arrayDataResult.data.length : 0;

    const analysisContext = pathContext
      .withInput("pathAccessSuccess", arrayDataResult.ok)
      .withInput("isArrayData", hasArrayData)
      .withInput("arrayLength", arrayLength);

    if (hasArrayData) {
      // File contains array at target path - extract individual items
      const arrayProcessingDecisionResult = Decision.create(
        "Array data processing strategy",
        ["process-each-item", "return-as-is", "skip-processing"],
        `Found array with ${arrayLength} items at frontmatter-part path, processing each item individually`,
      );
      if (!arrayProcessingDecisionResult.ok) {
        return contextualErr(
          arrayProcessingDecisionResult.error,
          analysisContext,
        );
      }

      const processingContext = analysisContext.withDecision(
        arrayProcessingDecisionResult.data,
      );

      // Create processing progress for array items
      const processingProgressResult = ProcessingProgress.create(
        "Array Item Processing",
        "Processing individual array items",
        [],
        arrayLength,
      );
      if (!processingProgressResult.ok) {
        return contextualErr(processingProgressResult.error, processingContext);
      }

      const _progressContext = processingContext.withProgress(
        processingProgressResult.data,
      );
      if (this.logger) {
        this.logger.debug(
          "Array processing context",
          {
            operation: "Pipeline: Frontmatter-Part Extraction",
            location: "PipelineOrchestrator.extractFrontmatterPartData:453",
            inputs:
              "6 parameters: inputDataKeys, inputDataSize, frontmatterPartPath...",
            decisions: [
              "Array data processing strategy (alternatives: process-each-item, return-as-is, skip-processing) - Found array with " +
              arrayLength +
              " items at frontmatter-part path, processing each item individually",
            ],
            progress:
              "Array Item Processing: Processing individual array items (0%)",
            timestamp: new Date().toISOString(),
            contextDepth: 1,
          },
        );
      }

      const result: FrontmatterData[] = [];
      for (let i = 0; i < arrayDataResult.data.length; i++) {
        const item = arrayDataResult.data[i];
        // Skip invalid items gracefully (null, primitives, etc.)
        if (!item || typeof item !== "object") {
          continue;
        }

        const itemDataResult = FrontmatterDataFactory.fromParsedData(item);
        if (!itemDataResult.ok) {
          // Log the failure but continue processing other items gracefully
          if (this.logger) {
            this.logger.debug(
              `Skipping invalid array item ${i}: ${itemDataResult.error.message}`,
              {
                operation: "array-item-processing",
                location: "PipelineOrchestrator.extractFrontmatterPartData",
                itemIndex: i,
                errorType: itemDataResult.error.kind,
                timestamp: new Date().toISOString(),
              },
            );
          }
          continue;
        }
        result.push(itemDataResult.data);
      }

      if (this.logger) {
        this.logger.debug(
          `Successfully extracted ${result.length} items from array`,
          {
            operation: "array-extraction-complete",
            location: "PipelineOrchestrator.extractFrontmatterPartData",
            extractedCount: result.length,
            totalItems: arrayLength,
            timestamp: new Date().toISOString(),
          },
        );
      }
      return ok(result);
    } else {
      // Default case: individual file contributes directly as one item
      // This is the typical scenario for frontmatter-part processing
      // Each markdown file's frontmatter becomes one item in the final array
      const fallbackDecisionResult = Decision.create(
        "Fallback extraction strategy",
        ["single-item-array", "empty-array", "error"],
        "No array found at frontmatter-part path, using fallback single-item strategy",
      );
      if (fallbackDecisionResult.ok) {
        const _fallbackContext = analysisContext.withDecision(
          fallbackDecisionResult.data,
        );
        if (this.logger) {
          this.logger.debug(
            "Fallback extraction context",
            {
              operation: "Pipeline: Frontmatter-Part Extraction",
              location: "PipelineOrchestrator.extractFrontmatterPartData:453",
              inputs:
                "6 parameters: inputDataKeys, inputDataSize, frontmatterPartPath...",
              decisions: [
                "Fallback extraction strategy (alternatives: single-item-array, empty-array, error) - No array found at frontmatter-part path, using fallback single-item strategy",
              ],
              progress: undefined,
              timestamp: new Date().toISOString(),
              contextDepth: 1,
            },
          );
        }
      }
      return ok([data]);
    }
  }
}
