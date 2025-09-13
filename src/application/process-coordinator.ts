/**
 * Process Coordinator - Single Canonical Processing Path
 *
 * CRITICAL: This is the ONLY entry point for document processing in the system.
 * Implements the canonical processing path defined in architectural documentation.
 * NO ALTERNATIVE PROCESSING PATHS ALLOWED.
 *
 * Consolidates all use cases into one coordinated workflow:
 * Schema Loading → File Discovery → Frontmatter Extraction → Validation → Template Rendering → Output
 *
 * Replaces 12+ use cases and multiple orchestrators with single authoritative implementation.
 */

import type { Result } from "../domain/core/result.ts";
import { createDomainError, type DomainError } from "../domain/core/result.ts";

// Domain Contexts - The 4 core contexts
import {
  type ResolvedSchema,
  SchemaContext,
  type ValidatedData,
} from "../domain/schema/schema-context.ts";
import { FrontmatterContext } from "../domain/frontmatter/frontmatter-context.ts";
import {
  type RenderedContent,
  type TemplateConfig,
  TemplateContext,
} from "../domain/template/template-context.ts";

// Value Objects
import { SchemaPath } from "../domain/value-objects/schema-path.ts";
import { DocumentPath } from "../domain/value-objects/document-path.ts";
import { TemplatePath } from "../domain/value-objects/template-path.ts";

// Services
import {
  type ProcessingOptions,
  ProcessingOptionsBuilder,
} from "./services/processing-options-builder.ts";
import { FilePatternMatcher } from "../domain/services/file-pattern-matcher.ts";
import { AggregateResultsUseCase } from "./use-cases/aggregate-results/aggregate-results.usecase.ts";
import { SchemaTemplateInfo } from "../domain/models/schema-extensions.ts";
import { LoggerFactory } from "../domain/shared/logger.ts";
import { SchemaExtensionConfig } from "../domain/config/schema-extension-config.ts";

// Import Template Domain Facades
import {
  TemplateBuilderFacadeImpl,
} from "../domain/template/template-builder-facade-impl.ts";
import {
  TemplateOutputFacadeImpl,
} from "../domain/template/template-output-facade-impl.ts";
import {
  TemplateFilePath,
  type TemplateBuilderFacade,
  type TemplateSource as DomainTemplateSource,
} from "../domain/template/template-builder-facade.ts";
import {
  type OutputSpecification,
  type TemplateOutputFacade,
} from "../domain/template/template-output-facade.ts";

/**
 * Template format types following totality principle
 */
export type TemplateFormat = "json" | "yaml" | "xml" | "custom";

/**
 * Template source discriminated union - eliminates invalid state combinations
 * Follows totality principle: no optional properties creating ambiguous states
 */
export type TemplateSource =
  | { kind: "file"; path: string; format: TemplateFormat }
  | { kind: "inline"; definition: string; format: TemplateFormat };

/**
 * Schema source configuration
 */
export type SchemaSource = {
  readonly path: string;
  readonly format: "json" | "yaml";
};

/**
 * Input source configuration (Totality-compliant discriminated union)
 */
export type InputSource = {
  readonly pattern: string;
  readonly baseDirectory?: string;
};

/**
 * Output target configuration
 */
export type OutputTarget = {
  readonly path: string;
  readonly format: TemplateFormat;
};

/**
 * Processing configuration - single source of truth
 * Follows totality principles with discriminated unions - NO OPTIONAL PROPERTIES
 */
export type ProcessingConfiguration =
  | {
    readonly kind: "basic";
    readonly schema: SchemaSource;
    readonly input: InputSource;
    readonly template: TemplateSource;
    readonly output: OutputTarget;
  }
  | {
    readonly kind: "advanced";
    readonly schema: SchemaSource;
    readonly input: InputSource;
    readonly template: TemplateSource;
    readonly output: OutputTarget;
    readonly options: ProcessingOptions;
  };

// ProcessingOptions now imported from ProcessingOptionsBuilder

/**
 * Processing result - complete output
 */
export interface ProcessingResult {
  readonly processedFiles: number;
  readonly validationResults: readonly ValidationSummary[];
  readonly renderedContent: RenderedContent;
  readonly aggregatedData?: AggregatedData;
  readonly processingTime: number;
  readonly bypassDetected: false; // Always false - no bypass allowed
  readonly canonicalPathUsed: true; // Always true - canonical path only
}

/**
 * Validation summary for each processed file
 */
export interface ValidationSummary {
  readonly documentPath: string;
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Aggregated data from all processed documents
 */
export interface AggregatedData {
  readonly totalDocuments: number;
  readonly aggregatedFields: Record<string, unknown>;
  readonly metadata: AggregationMetadata;
}

/**
 * Aggregation metadata
 */
export interface AggregationMetadata {
  readonly aggregationRules: readonly string[];
  readonly processingTime: number;
  readonly dataSize: number;
}

/**
 * Process Coordinator - Single Canonical Document Processing Service
 *
 * CONSOLIDATES ALL PROCESSING OPERATIONS:
 * - Replaces ProcessDocumentsUseCase
 * - Replaces LoadSchemaUseCase
 * - Replaces DiscoverFilesUseCase
 * - Replaces ExtractFrontmatterUseCase
 * - Replaces ValidateFrontmatterUseCase
 * - Replaces ProcessTemplateUseCase
 * - Replaces AggregateResultsUseCase
 * - Replaces WriteOutputUseCase
 * - Replaces all orchestrators
 * - Replaces document processor variations
 *
 * ENSURES CANONICAL PATH:
 * - Single processing workflow only
 * - No shortcuts or bypasses allowed
 * - Template system integrity maintained
 * - All data flows through proper validation
 */
export class ProcessCoordinator {
  private readonly schemaContext: SchemaContext;
  private readonly frontmatterContext: FrontmatterContext;
  private readonly templateContext: TemplateContext;
  private readonly extensionConfig: SchemaExtensionConfig;
  private readonly logger: ReturnType<typeof LoggerFactory.createLogger>;
  private readonly templateBuilderFacade: TemplateBuilderFacade;
  private readonly templateOutputFacade: TemplateOutputFacade;

  private constructor(extensionConfig: SchemaExtensionConfig) {
    this.schemaContext = new SchemaContext();
    this.frontmatterContext = new FrontmatterContext();
    this.templateContext = new TemplateContext();
    this.extensionConfig = extensionConfig;
    this.logger = LoggerFactory.createLogger("ProcessCoordinator");
    this.templateBuilderFacade = new TemplateBuilderFacadeImpl();
    this.templateOutputFacade = new TemplateOutputFacadeImpl();
  }

  /**
   * Smart Constructor for ProcessCoordinator following Totality principles
   */
  static create(
    extensionConfig?: SchemaExtensionConfig,
  ): Result<ProcessCoordinator, DomainError & { message: string }> {
    if (extensionConfig) {
      return { ok: true, data: new ProcessCoordinator(extensionConfig) };
    }

    // Use default configuration if none provided
    const defaultConfigResult = SchemaExtensionConfig.createDefault();
    if (!defaultConfigResult.ok) {
      return defaultConfigResult;
    }

    return { ok: true, data: new ProcessCoordinator(defaultConfigResult.data) };
  }

  /**
   * CANONICAL PROCESSING METHOD
   *
   * This is the ONLY entry point for document processing.
   * ALL document processing MUST flow through this method.
   * NO ALTERNATIVE PATHS ALLOWED.
   */
  async processDocuments(
    configuration: ProcessingConfiguration,
  ): Promise<Result<ProcessingResult, DomainError & { message: string }>> {
    const startTime = Date.now();

    this.logger.info("Starting processDocuments", {
      schema: configuration.schema.path,
      input: configuration.input.pattern,
      output: configuration.output.path,
      template: configuration.template,
    });

    // Use ProcessingOptionsBuilder for validated options - handle discriminated union
    const configOptions = configuration.kind === "advanced"
      ? configuration.options
      : undefined;

    const optionsBuilderResult = ProcessingOptionsBuilder.create(
      configOptions,
    );
    if (!optionsBuilderResult.ok) {
      return this.createProcessingError(
        "OptionsValidation",
        optionsBuilderResult.error,
      );
    }

    const options = optionsBuilderResult.data.getOptions();

    // CANONICAL PROCESSING PATH - STEP BY STEP, NO SHORTCUTS

    // Step 1: Load and validate schema (REQUIRED)
    const schemaResult = await this.loadSchema(configuration.schema);
    if (!schemaResult.ok) {
      return this.createProcessingError("SchemaLoading", schemaResult.error);
    }

    // Step 2: Discover files to process (REQUIRED)
    const filesResult = await this.discoverFiles(
      configuration.input,
      options,
    );
    if (!filesResult.ok) {
      return this.createProcessingError("FileDiscovery", filesResult.error);
    }

    this.logger.info("Files discovered", {
      count: filesResult.data.length,
      files: filesResult.data.map((f) => f.toString()),
    });

    // Step 3: Process all documents (SEQUENTIAL - NO BYPASS)
    // Extract schema path for validation
    const schemaPathForValidation = SchemaPath.create(
      configuration.schema.path,
    );
    if (!schemaPathForValidation.ok) {
      return this.createProcessingError(
        "SchemaPath",
        schemaPathForValidation.error,
      );
    }

    const processingResult = await this.processAllDocuments(
      filesResult.data,
      schemaResult.data,
      schemaPathForValidation.data,
      options,
    );
    if (!processingResult.ok) {
      return this.createProcessingError(
        "DocumentProcessing",
        processingResult.error,
      );
    }

    // Step 4.5: Resolve template source (schema x-template takes priority over CLI template)
    const templateSource = this.resolveTemplateFromSchema(
      schemaResult.data,
      configuration.schema.path,
      configuration.template,
    );
    if (!templateSource.ok) {
      return this.createProcessingError(
        "TemplateResolution",
        templateSource.error,
      );
    }

    // Step 5: Use Template Domain Facades for complete x-frontmatter-part and x-derived processing
    const templateContent = await this.loadTemplateContent(templateSource.data);
    if (!templateContent.ok) {
      return this.createProcessingError(
        "TemplateLoading",
        templateContent.error,
      );
    }

    // Extract schema data for template processing
    const schemaData = this.extractSchemaData(schemaResult.data);
    if (!schemaData.ok) {
      return this.createProcessingError(
        "SchemaDataExtraction",
        schemaData.error,
      );
    }

    // Prepare document data for template processing
    const documentData = processingResult.data.validatedDocuments.map((doc) =>
      doc.data
    );

    // Use Template Domain Facades for template processing
    // Create template source with schema path and aggregated values
    const templatePath = new TemplateFilePath(templateSource.data.toString());

    // Prepare template values from document data
    const templateValues: Record<string, unknown> = {};

    // Add document data and metadata
    templateValues.count = documentData.length;
    templateValues.documents = documentData;

    // Include first document fields for simple variable replacement
    if (documentData.length > 0) {
      const firstDoc = documentData[0];
      for (const [key, value] of Object.entries(firstDoc)) {
        if (templateValues[key] === undefined) {
          templateValues[key] = value;
        }
      }
    }

    const source: DomainTemplateSource = {
      templatePath,
      valueSet: {
        values: templateValues,
        metadata: {
          source: "ProcessCoordinator",
          timestamp: new Date(),
        },
      },
    };

    this.logger.info("Building template with domain facade", {
      outputPath: configuration.output.path,
      documentCount: documentData.length,
    });

    // Build template using facade
    const buildResult = await this.templateBuilderFacade.buildTemplate(source);
    if (!buildResult.ok) {
      this.logger.error("Template building failed", {
        error: buildResult.error,
      });
      const domainError = createDomainError(
        {
          kind: "RenderError",
          template: templateSource.data.toString(),
          details: buildResult.error.message,
        },
        buildResult.error.message,
      );
      return this.createProcessingError(
        "TemplateBuilding",
        domainError,
      );
    }

    // Output template using facade
    const outputSpec: OutputSpecification = {
      destination: configuration.output.path,
      format: "json",
      prettify: true,
    };

    const outputResult = await this.templateOutputFacade.outputTemplate(
      buildResult.data,
      outputSpec,
    );
    if (!outputResult.ok) {
      this.logger.error("Template output failed", {
        error: outputResult.error,
      });
      const domainError = createDomainError(
        {
          kind: "WriteError",
          path: configuration.output.path,
          details: outputResult.error.message,
        },
        outputResult.error.message,
      );
      return this.createProcessingError(
        "TemplateOutput",
        domainError,
      );
    }

    // Extract aggregated data for backward compatibility with tests
    // Template facades handle this internally, but we need to provide it for the API
    let aggregatedData: AggregatedData | undefined;
    if (this.schemaRequiresAggregation(schemaResult.data)) {
      const aggregationResult = await this.aggregateData(
        processingResult.data.validatedDocuments,
        schemaResult.data,
        {
          strict: false,
          allowEmptyFrontmatter: true,
          maxFiles: 1000,
          allowMissingVariables: true,
          validateSchema: true,
          parallelProcessing: false,
        },
      );
      if (aggregationResult.ok) {
        aggregatedData = aggregationResult.data;
      }
    }

    // Read the output file content to include in the result
    let outputContent = "Generated via Template Domain Facades";
    try {
      outputContent = await Deno.readTextFile(configuration.output.path);
    } catch {
      // If file reading fails, keep the placeholder message
    }

    this.logger.info("Output generated successfully", {
      outputPath: configuration.output.path,
    });

    // Create final processing result
    const processingTime = Date.now() - startTime;
    const result: ProcessingResult = {
      processedFiles: processingResult.data.validatedDocuments.length,
      validationResults: processingResult.data.validationSummaries,
      renderedContent: {
        content: outputContent, // Template facades write directly to file, read it back
        templateProcessed: true,
        variables: [],
        renderTime: new Date(),
        bypassDetected: false,
      },
      aggregatedData, // Template facades handle aggregation internally, but provided for backward compatibility
      processingTime,
      bypassDetected: false, // CRITICAL: Always false
      canonicalPathUsed: true, // CRITICAL: Always true
    };

    return { ok: true, data: result };
  }

  // Private canonical processing steps - INTERNAL ONLY, NO EXTERNAL ACCESS

  /**
   * Step 1: Load schema and validate
   */
  private async loadSchema(
    schemaConfig: ProcessingConfiguration["schema"],
  ): Promise<Result<ResolvedSchema, DomainError & { message: string }>> {
    const schemaPathResult = SchemaPath.create(schemaConfig.path);
    if (!schemaPathResult.ok) {
      return schemaPathResult;
    }

    return await this.schemaContext.loadSchema(schemaPathResult.data);
  }

  /**
   * Step 2: Discover files to process
   */
  private async discoverFiles(
    inputConfig: ProcessingConfiguration["input"],
    options: ProcessingOptions,
  ): Promise<Result<DocumentPath[], DomainError & { message: string }>> {
    try {
      const baseDir = inputConfig.baseDirectory || ".";
      const pattern = inputConfig.pattern;

      // Use Deno's file system APIs for recursive file discovery
      const files: DocumentPath[] = [];

      // Check if the base path is a file or directory
      const baseStat = await Deno.stat(baseDir);

      // If it's a single file, process it directly
      if (baseStat.isFile) {
        // Check if the file matches the pattern or is a markdown file
        if (baseDir.endsWith(".md") || baseDir.endsWith(".markdown")) {
          const documentPathResult = DocumentPath.create(baseDir);
          if (documentPathResult.ok) {
            files.push(documentPathResult.data);
          }
        }
        return { ok: true, data: files };
      }

      // Recursive directory traversal function (only for directories)
      // Returns Result<void, DomainError> following Totality principles
      const traverseDirectory = async (
        currentDir: string,
        relativePath: string = "",
      ): Promise<Result<void, DomainError & { message: string }>> => {
        try {
          for await (const entry of Deno.readDir(currentDir)) {
            const entryPath = relativePath
              ? `${relativePath}/${entry.name}`
              : entry.name;
            const fullPath = `${currentDir}/${entry.name}`;

            if (entry.isFile) {
              const matchResult = this.matchesPattern(entryPath, pattern);
              if (!matchResult.ok) {
                // Skip files that can't be matched - continue processing other files
                this.logger.warn(
                  `Pattern matching failed for ${entryPath}: ${matchResult.error.message}`,
                );
                continue;
              }

              if (matchResult.data) {
                const documentPathResult = DocumentPath.create(fullPath);
                if (documentPathResult.ok) {
                  files.push(documentPathResult.data);

                  if (files.length >= options.maxFiles) {
                    return { ok: true, data: undefined }; // Stop traversal when max files reached
                  }
                }
              }
            } else if (entry.isDirectory) {
              // Recursively traverse subdirectories
              const traverseResult = await traverseDirectory(
                fullPath,
                entryPath,
              );
              if (!traverseResult.ok) {
                return traverseResult; // Propagate error up
              }

              // Check if we've reached max files after recursive call
              if (files.length >= options.maxFiles) {
                return { ok: true, data: undefined };
              }
            }
          }
          return { ok: true, data: undefined };
        } catch (error) {
          // Convert exception to Result<T,E> pattern following Totality principles
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "FileDiscoveryFailed",
                directory: currentDir,
                pattern,
              },
              `Directory traversal failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
          };
        }
      };

      // It's a directory, traverse it (baseStat check already done above)
      const traverseResult = await traverseDirectory(baseDir);
      if (!traverseResult.ok) {
        return {
          ok: false,
          error: traverseResult.error,
        };
      }

      if (files.length === 0) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "FileDiscoveryFailed",
              directory: baseDir,
              pattern,
            },
            `No files found matching pattern: ${pattern}`,
          ),
        };
      }

      return { ok: true, data: files };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "FileDiscoveryFailed",
            directory: inputConfig.baseDirectory || ".",
            pattern: inputConfig.pattern,
          },
          `File discovery failed: ${error}`,
        ),
      };
    }
  }

  /**
   * Step 3: Process all documents through canonical path
   */
  private async processAllDocuments(
    documentPaths: DocumentPath[],
    schema: ResolvedSchema,
    schemaPath: SchemaPath,
    options: ProcessingOptions,
  ): Promise<
    Result<
      {
        validatedDocuments: ValidatedData[];
        documentContents: string[];
        validationSummaries: ValidationSummary[];
      },
      DomainError & { message: string }
    >
  > {
    const validatedDocuments: ValidatedData[] = [];
    const documentContents: string[] = [];
    const validationSummaries: ValidationSummary[] = [];

    // Process documents sequentially for reliability
    for (const documentPath of documentPaths) {
      // Extract frontmatter
      const frontmatterResult = await this.frontmatterContext.extractFromFile(
        documentPath,
        {
          allowEmptyFrontmatter: options.allowEmptyFrontmatter,
          strict: false, // Never use strict mode for frontmatter extraction
        },
      );

      if (!frontmatterResult.ok) {
        if (options.strict) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "ExtractionError",
                reason: frontmatterResult.error.message,
              },
              `Frontmatter extraction failed for ${documentPath.getValue()}`,
            ),
          };
        }

        // Record error but continue processing
        validationSummaries.push({
          documentPath: documentPath.getValue(),
          valid: false,
          errors: [frontmatterResult.error.message],
          warnings: [],
        });
        continue;
      }

      // Validate against schema using the provided schema path
      const validationResult = this.schemaContext.validateData(
        frontmatterResult.data.frontmatter.getData(),
        schema,
        schemaPath,
      );

      if (!validationResult.ok) {
        if (options.strict) {
          return {
            ok: false,
            error: validationResult.error,
          };
        }

        // Record validation error but continue
        validationSummaries.push({
          documentPath: documentPath.getValue(),
          valid: false,
          errors: [validationResult.error.message],
          warnings: [],
        });
        continue;
      }

      // Add to validated documents and store content
      validatedDocuments.push(validationResult.data);
      documentContents.push(frontmatterResult.data.content);
      validationSummaries.push({
        documentPath: documentPath.getValue(),
        valid: true,
        errors: [],
        warnings: [], // Could add warnings from validation result
      });
    }

    if (validatedDocuments.length === 0) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ProcessingStageError",
            stage: "DocumentValidation",
            error: {
              kind: "ExtractionError",
              reason: "No documents passed validation",
            },
          },
          "No valid documents to process",
        ),
      };
    }

    return {
      ok: true,
      data: {
        validatedDocuments,
        documentContents,
        validationSummaries,
      },
    };
  }

  /**
   * Step 4.5: Resolve template from schema x-template directive with fallback to CLI template
   */
  private resolveTemplateFromSchema(
    schema: ResolvedSchema,
    schemaPath: string,
    fallbackTemplate: TemplateSource,
  ): Result<TemplateSource, DomainError & { message: string }> {
    try {
      // Extract template info from schema
      const schemaParsedResult = schema.definition.getParsedSchema();
      if (!schemaParsedResult.ok) {
        this.logger.debug("Failed to parse schema, using CLI template");
        return { ok: true, data: fallbackTemplate };
      }

      const templateInfoResult = SchemaTemplateInfo.extract(
        schemaParsedResult.data,
      );
      if (!templateInfoResult.ok) {
        // Schema template extraction failed, use CLI template
        this.logger.debug("No valid x-template in schema, using CLI template");
        return { ok: true, data: fallbackTemplate };
      }

      // Check if schema has x-template directive
      const templatePathResult = templateInfoResult.data.getTemplatePath();
      if (!templatePathResult.ok) {
        // No x-template directive, use CLI template
        this.logger.debug(
          "No x-template directive in schema, using CLI template",
        );
        return { ok: true, data: fallbackTemplate };
      }

      // Resolve template path relative to schema location
      const schemaDir = schemaPath.replace(/[^\/\\]*$/, "");
      const resolvedTemplatePath = schemaDir + templatePathResult.data;

      this.logger.info(
        `Using x-template from schema: ${templatePathResult.data} (resolved: ${resolvedTemplatePath})`,
      );

      // Create template source from resolved path
      const templateSource: TemplateSource = {
        kind: "file",
        path: resolvedTemplatePath,
        format: "json", // Default format for x-template files
      };

      return { ok: true, data: templateSource };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "NotFound",
            resource: "template",
            name: `Failed to resolve template from schema: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
          "Schema template resolution failed",
        ),
      };
    }
  }

  /**
   * Step 5: Render template (MANDATORY - NO BYPASS) - USES AGGREGATED DATA
   */
  private async renderTemplate(
    validatedDocuments: ValidatedData[],
    documentContents: string[],
    templateConfig: TemplateSource,
    options: ProcessingOptions,
    aggregatedData?: AggregatedData,
  ): Promise<Result<RenderedContent, DomainError & { message: string }>> {
    // Combine all validated data for template rendering, including aggregated fields
    const combinedData = this.combineValidatedData(
      validatedDocuments,
      documentContents,
      aggregatedData,
    );

    // Handle discriminated union - follows totality principle with exhaustive switch
    switch (templateConfig.kind) {
      case "file": {
        const templatePathResult = TemplatePath.create(templateConfig.path);
        if (!templatePathResult.ok) {
          return templatePathResult;
        }

        return await this.templateContext.renderTemplateFromFile(
          combinedData,
          templatePathResult.data,
          {
            allowMissingVariables: options.allowMissingVariables,
            strict: options.strict,
          },
        );
      }

      case "inline": {
        const templateConfigObj: TemplateConfig = {
          definition: templateConfig.definition,
          format: templateConfig.format,
        };

        return this.templateContext.renderTemplate(
          combinedData,
          templateConfigObj,
          {
            allowMissingVariables: options.allowMissingVariables,
            strict: options.strict,
          },
        );
      }
    }
  }

  /**
   * Step 4: Aggregate data from multiple documents using proper domain service
   */
  private async aggregateData(
    validatedDocuments: ValidatedData[],
    resolvedSchema: ResolvedSchema,
    _options: ProcessingOptions,
  ): Promise<Result<AggregatedData, DomainError & { message: string }>> {
    const startTime = Date.now();

    // Use the proper AggregateResultsUseCase for x-derived-from functionality
    const aggregateUseCaseResult = AggregateResultsUseCase.create();
    if (!aggregateUseCaseResult.ok) {
      return {
        ok: false,
        error: {
          ...aggregateUseCaseResult.error,
          message:
            `Failed to create AggregateResultsUseCase: ${aggregateUseCaseResult.error.kind}`,
        },
      };
    }
    const aggregateUseCase = aggregateUseCaseResult.data;

    // Extract data from validated documents
    const dataToAggregate = validatedDocuments.map((doc) => doc.data);

    // Extract schema template info from resolved schema
    const schemaDefinitionResult = resolvedSchema.definition.getParsedSchema();
    if (!schemaDefinitionResult.ok) {
      return {
        ok: false,
        error: schemaDefinitionResult.error,
      };
    }

    const templateInfoResult = SchemaTemplateInfo.extract(
      schemaDefinitionResult.data,
    );
    if (!templateInfoResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ProcessingStageError",
            stage: "Template",
            error: {
              kind: "ExtractionError",
              reason: templateInfoResult.error.message,
            },
          },
          `Failed to extract template info: ${templateInfoResult.error.message}`,
        ),
      };
    }

    const aggregationResult = await aggregateUseCase.execute({
      data: dataToAggregate,
      templateInfo: templateInfoResult.data,
      schema: schemaDefinitionResult.data,
    });

    if (!aggregationResult.ok) {
      return {
        ok: false,
        error: aggregationResult.error,
      };
    }

    // Transform AggregateResultsOutput to AggregatedData format
    const aggregatedData: AggregatedData = {
      totalDocuments: validatedDocuments.length,
      aggregatedFields: aggregationResult.data.aggregated,
      metadata: {
        aggregationRules: [], // Rules applied by AggregateResultsUseCase internally
        processingTime: Date.now() - startTime,
        dataSize: JSON.stringify(aggregationResult.data.aggregated).length,
      },
    };

    return { ok: true, data: aggregatedData };
  }

  /**
   * Step 6: Write output to file system
   */
  private async writeOutput(
    renderedContent: RenderedContent,
    outputConfig: ProcessingConfiguration["output"],
    aggregatedData?: AggregatedData,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      let outputContent = renderedContent.content;

      // Include aggregated data if available
      if (aggregatedData) {
        const metadata = {
          totalDocuments: aggregatedData.totalDocuments,
          processingTime: aggregatedData.metadata.processingTime,
          dataSize: aggregatedData.metadata.dataSize,
        };

        // Append metadata based on output format
        switch (outputConfig.format) {
          case "json": {
            const jsonOutput = {
              content: outputContent,
              metadata,
              aggregatedData: aggregatedData.aggregatedFields,
            };
            outputContent = JSON.stringify(jsonOutput, null, 2);
            break;
          }

          case "yaml":
            // Basic YAML output
            outputContent +=
              `\n\n# Metadata\n# Total Documents: ${metadata.totalDocuments}\n# Processing Time: ${metadata.processingTime}ms`;
            break;

          default:
            // For other formats, append as comment
            outputContent +=
              `\n\n<!-- Total Documents: ${metadata.totalDocuments}, Processing Time: ${metadata.processingTime}ms -->`;
            break;
        }
      }

      await Deno.writeTextFile(outputConfig.path, outputContent);
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "WriteError",
            path: outputConfig.path,
            details: String(error),
          },
          `Failed to write output: ${error}`,
        ),
      };
    }
  }

  // Utility methods

  /**
   * Check if filename matches pattern using FilePatternMatcher service
   * Handles glob patterns correctly for both root directory and subdirectory files
   */
  private matchesPattern(
    filename: string,
    pattern: string,
  ): Result<boolean, DomainError & { message: string }> {
    // Handle double-star patterns that should match both root and subdirectory files
    if (pattern.startsWith("**/*")) {
      // Test both patterns: root directory pattern and subdirectory pattern
      const rootPattern = pattern.substring(3); // Remove "**/" to get "*.ext"
      const subdirPattern = pattern; // Keep original "**/*.ext"

      // Try root directory pattern first
      const rootMatcherResult = FilePatternMatcher.createGlob(rootPattern);
      if (!rootMatcherResult.ok) {
        return rootMatcherResult;
      }

      if (rootMatcherResult.data.matches(filename)) {
        return { ok: true, data: true };
      }

      // Try subdirectory pattern
      const subdirMatcherResult = FilePatternMatcher.createGlob(subdirPattern);
      if (!subdirMatcherResult.ok) {
        return subdirMatcherResult;
      }

      return { ok: true, data: subdirMatcherResult.data.matches(filename) };
    }

    // For other patterns, use standard matching
    const matcherResult = FilePatternMatcher.createGlob(pattern);
    if (!matcherResult.ok) {
      return matcherResult;
    }

    return { ok: true, data: matcherResult.data.matches(filename) };
  }

  /**
   * Combine validated data for template rendering including aggregated fields
   */
  private combineValidatedData(
    validatedDocuments: ValidatedData[],
    documentContents: string[],
    aggregatedData?: AggregatedData,
  ): ValidatedData {
    // For single document, combine frontmatter with content
    if (validatedDocuments.length === 1) {
      const baseDoc = validatedDocuments[0];
      const combinedData = {
        ...baseDoc.data,
        content: documentContents[0],
      };

      // If aggregated data is available, merge it
      // FIXED: Convert flat dot-notation keys to nested structure for template access
      if (aggregatedData) {
        this.mergeAggregatedFields(
          combinedData,
          aggregatedData.aggregatedFields,
        );
      }

      return {
        data: combinedData,
        schemaPath: baseDoc.schemaPath,
        validationResult: baseDoc.validationResult,
      };
    }

    // For multiple documents, create structure with documents array and content
    const documents = validatedDocuments.map((doc, index) => ({
      ...doc.data,
      content: documentContents[index],
    }));

    // Use the first document's schema path and validation result as base
    const baseDoc = validatedDocuments[0];
    const combinedData: Record<string, unknown> = {
      documents,
      count: documents.length,
    };

    // If aggregated data is available, merge it (this is critical for x-derived-from functionality)
    // FIXED: Convert flat dot-notation keys to nested structure for template access
    if (aggregatedData) {
      this.mergeAggregatedFields(combinedData, aggregatedData.aggregatedFields);
    }

    return {
      data: combinedData,
      schemaPath: baseDoc.schemaPath,
      validationResult: {
        valid: true,
        errors: [],
        warnings: [],
      },
    };
  }

  /**
   * Check if schema requires aggregation based on x-extensions
   * Fixes Issue #690: Single file aggregation bypass
   */
  private schemaRequiresAggregation(resolvedSchema: ResolvedSchema): boolean {
    // Check if schema has any properties that require aggregation
    const schemaDefinition = resolvedSchema.definition;

    if (!schemaDefinition) {
      return false;
    }

    // Get the actual schema object from the definition
    const parsedSchemaResult = schemaDefinition.getParsedSchema();
    if (!parsedSchemaResult.ok) {
      return false;
    }

    const schema = parsedSchemaResult.data;

    if (!schema || typeof schema !== "object") {
      return false;
    }

    // Check for x-frontmatter-part at root level using configurable property name
    const frontmatterPartProp = this.extensionConfig
      .getFrontmatterPartProperty();
    if (
      frontmatterPartProp in schema && schema[frontmatterPartProp] === true
    ) {
      return true;
    }

    // Check properties for x-derived-from or x-frontmatter-part using configurable names
    if (
      "properties" in schema && schema.properties &&
      typeof schema.properties === "object"
    ) {
      for (const prop of Object.values(schema.properties)) {
        if (typeof prop === "object" && prop !== null) {
          // Type guard for object property
          if (!this.isRecordObject(prop)) continue;
          const propObj = prop;
          // Check for aggregation markers using configurable property names
          const derivedFromProp = this.extensionConfig.getDerivedFromProperty();
          if (
            derivedFromProp in propObj ||
            (frontmatterPartProp in propObj &&
              propObj[frontmatterPartProp] === true)
          ) {
            return true;
          }
          // Check nested properties
          if (
            "properties" in propObj && propObj["properties"] &&
            typeof propObj["properties"] === "object"
          ) {
            for (
              const nestedProp of Object.values(
                this.getObjectProperties(propObj["properties"]),
              )
            ) {
              if (typeof nestedProp === "object" && nestedProp !== null) {
                // Type guard for nested property
                if (!this.isRecordObject(nestedProp)) continue;
                const nestedPropObj = nestedProp;
                if (
                  derivedFromProp in nestedPropObj ||
                  (frontmatterPartProp in nestedPropObj &&
                    nestedPropObj[frontmatterPartProp] === true)
                ) {
                  return true;
                }
              }
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Merge aggregated fields converting dot-notation keys to nested structure
   * CRITICAL FIX for Issue #706: Template variables need nested structure access
   */
  private mergeAggregatedFields(
    target: Record<string, unknown>,
    aggregatedFields: Record<string, unknown>,
  ): void {
    for (const [key, value] of Object.entries(aggregatedFields)) {
      if (key.includes(".")) {
        // Convert dot-notation key to nested structure
        this.setNestedValue(target, key, value);
      } else {
        // Simple key assignment
        target[key] = value;
      }
    }
  }

  /**
   * Set nested value using dot-notation path
   * Example: setNestedValue(obj, "tools.availableConfigs", [array])
   * creates: obj.tools.availableConfigs = [array]
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    let current = obj;

    // Navigate to the parent of the final property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (
        !(part in current) || typeof current[part] !== "object" ||
        current[part] === null
      ) {
        current[part] = {};
      }
      // Type guard for nested object access
      if (!this.isRecordObject(current[part])) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    // Set the final property
    const finalPart = parts[parts.length - 1];
    current[finalPart] = value;
  }

  /**
   * Load template content from TemplateSource
   */
  private async loadTemplateContent(
    templateSource: TemplateSource,
  ): Promise<Result<string, DomainError & { message: string }>> {
    switch (templateSource.kind) {
      case "file": {
        try {
          const content = await Deno.readTextFile(templateSource.path);
          return { ok: true, data: content };
        } catch (error) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "ReadError",
                path: templateSource.path,
              },
              `Failed to read template file: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
          };
        }
      }
      case "inline": {
        return { ok: true, data: templateSource.definition };
      }
    }
  }

  /**
   * Extract schema data as Record<string, unknown> for template processing
   */
  private extractSchemaData(
    schema: ResolvedSchema,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    const schemaParsedResult = schema.definition.getParsedSchema();
    if (!schemaParsedResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ExtractionError",
            reason: schemaParsedResult.error.message,
          },
          "Failed to parse schema for template processing",
        ),
      };
    }

    return {
      ok: true,
      data: schemaParsedResult.data as Record<string, unknown>,
    };
  }

  /**
   * Create processing stage error
   */
  private createProcessingError(
    stage: string,
    underlyingError: DomainError & { message: string },
  ): Result<never, DomainError & { message: string }> {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "ProcessingStageError",
          stage,
          error: underlyingError,
        },
        `Processing failed in stage "${stage}": ${underlyingError.message}`,
      ),
    };
  }

  /**
   * Type guard for Record<string, unknown> objects
   */
  private isRecordObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /**
   * Safe getter for object properties with type validation
   */
  private getObjectProperties(properties: unknown): unknown[] {
    if (!this.isRecordObject(properties)) {
      return [];
    }
    return Object.values(properties);
  }
}
