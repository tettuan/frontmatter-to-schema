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
  ) {}

  /**
   * Execute the complete pipeline processing
   */
  async execute(
    config: PipelineConfig,
  ): Promise<Result<void, DomainError & { message: string }>> {
    // Step 1: Load and process schema
    const isVerbose = config.verbosityConfig.kind === "verbose";
    if (isVerbose) {
      console.log("[VERBOSE] Step 1: Loading schema from " + config.schemaPath);
    }
    const schemaResult = await this.loadSchema(config.schemaPath);
    if (!schemaResult.ok) {
      return schemaResult;
    }
    const schema = schemaResult.data;
    if (isVerbose) {
      console.log("[VERBOSE] Schema loaded successfully");
    }

    // Step 2: Resolve template paths using TemplatePathResolver
    if (isVerbose) {
      console.log("[VERBOSE] Step 2: Resolving template paths");
    }

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

    if (isVerbose) {
      console.log(
        "[DEBUG] Template resolution context:",
        contextWithDecision.getDebugInfo(),
      );
    }

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
    if (isVerbose) {
      const resultContext = contextWithDecision
        .withInput("resolvedTemplatePath", templatePath)
        .withInput("resolvedItemsTemplatePath", itemsTemplatePath)
        .withInput("resolvedOutputFormat", outputFormat)
        .withInput("isDualTemplate", !!itemsTemplatePath);

      console.log(
        "[DEBUG] Template resolution completed:",
        resultContext.getDebugInfo(),
      );
      console.log("[VERBOSE] Template path resolved: " + templatePath);
      if (itemsTemplatePath) {
        console.log(
          "[VERBOSE] Items template path resolved: " + itemsTemplatePath,
        );
      }
      console.log("[VERBOSE] Output format: " + outputFormat);
    }

    // Step 4: Process documents (成果A-D)
    if (isVerbose) {
      console.log(
        "[VERBOSE] Step 4: Processing documents with pattern: " +
          config.inputPattern,
      );
    }
    const validationRules = schema.getValidationRules();
    const processedDataResult = this.frontmatterTransformer.transformDocuments(
      config.inputPattern,
      validationRules,
      schema,
      isVerbose,
    );
    if (!processedDataResult.ok) {
      return processedDataResult;
    }
    if (isVerbose) {
      console.log("[VERBOSE] Documents processed successfully");
    }

    // Step 5: Extract items data if x-frontmatter-part is present
    if (isVerbose) {
      console.log("[VERBOSE] Step 5: Preparing data for rendering");
    }

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

    if (isVerbose) {
      console.log(
        "[DEBUG] Data preparation context:",
        dataContext.getDebugInfo(),
      );
    }

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

      if (isVerbose) {
        console.log(
          "[DEBUG] Dual template path - extracting frontmatter-part data",
        );
      }

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
          const completionContext = extractionContext
            .withProgress(completionProgressResult.data)
            .withInput("extractedItemCount", itemsData.length)
            .withInput("renderingStrategy", "dual-template");

          if (isVerbose) {
            console.log(
              "[DEBUG] Data extraction completed:",
              completionContext.getDebugInfo(),
            );
            console.log(
              "[VERBOSE] Extracted " + itemsData.length +
                " items for dual-template rendering",
            );
          }
        }
      } else {
        if (isVerbose) {
          console.log(
            "[DEBUG] No frontmatter-part data found in dual template mode",
          );
        }
      }
    } else if (schema.findFrontmatterPartPath().ok) {
      // For single template with frontmatter-part, keep itemsData undefined
      // The template renderer will extract the array data from mainData during {@items} expansion
      if (isVerbose) {
        console.log("[DEBUG] Single template with frontmatter-part:", {
          renderingStrategy: "single-template-with-items-expansion",
          frontmatterPartPath: frontmatterPartPathResult.ok
            ? frontmatterPartPathResult.data
            : "unknown",
        });
        console.log(
          "[VERBOSE] Single template with frontmatter-part detected - will use mainData for {@items} expansion",
        );
      }
    } else {
      if (isVerbose) {
        console.log(
          "[DEBUG] Standard single template rendering - no frontmatter-part processing",
        );
      }
    }

    // Step 6: Use OutputRenderingService to render and write output
    if (isVerbose) {
      console.log("[VERBOSE] Step 6: Rendering and writing output");
    }
    const renderResult = this.outputRenderingService.renderOutput(
      templatePath,
      itemsTemplatePath,
      mainData,
      itemsData,
      config.outputPath,
      outputFormat,
    );
    if (isVerbose && renderResult.ok) {
      console.log(
        "[VERBOSE] Output written successfully to " + config.outputPath,
      );
    }
    return renderResult;
  }

  /**
   * Load schema from file system
   */
  private async loadSchema(
    schemaPath: string,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    // Read schema file
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

      // Create schema entity
      return Schema.create(pathResult.data, definitionResult.data);
    } catch (error) {
      return err(createError({
        kind: "InvalidSchema",
        message: `Failed to parse schema: ${error}`,
      }));
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
      return err(createError({
        kind: "InvalidTemplate",
        message: `Failed to parse template: ${error}`,
      }));
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
        console.log(
          "[DEBUG] Frontmatter-part extraction context:",
          fallbackContext.getDebugInfo(),
        );
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

      const progressContext = processingContext.withProgress(
        processingProgressResult.data,
      );
      console.log(
        "[DEBUG] Array processing context:",
        progressContext.getDebugInfo(),
      );

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
          console.log(
            `[DEBUG] Skipping invalid array item ${i}:`,
            itemDataResult.error.message,
          );
          continue;
        }
        result.push(itemDataResult.data);
      }

      console.log(
        "[DEBUG] Successfully extracted",
        result.length,
        "items from array",
      );
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
        const fallbackContext = analysisContext.withDecision(
          fallbackDecisionResult.data,
        );
        console.log(
          "[DEBUG] Fallback extraction context:",
          fallbackContext.getDebugInfo(),
        );
      }
      return ok([data]);
    }
  }
}
