import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import {
  ProcessingBounds,
  ProcessingBoundsFactory,
  ProcessingBoundsMonitor,
} from "../../shared/types/processing-bounds.ts";
import { ValidationHelpers } from "../../shared/utils/validation-helpers.ts";
import { ErrorHandlingUtils } from "../../shared/utils/error-handling-utils.ts";
import { FilePath } from "../value-objects/file-path.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { DerivationRule } from "../../aggregation/index.ts";
import { SchemaPathResolver } from "../../schema/services/schema-path-resolver.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../shared/services/debug-logger.ts";
import { defaultSchemaExtensionRegistry } from "../../schema/value-objects/schema-extension-registry.ts";
import {
  FrontmatterDataCreationService,
} from "./frontmatter-data-creation-service.ts";
import type {
  DomainFileLister,
  DomainFileReader,
} from "../../shared/interfaces/file-operations.ts";
import {
  ProcessingOptionsState,
} from "../configuration/processing-options-factory.ts";
import { MergeOperations } from "../utilities/merge-operations.ts";
import { FrontmatterProcessor } from "../processors/frontmatter-processor.ts";
import { PerformanceSettings } from "../../configuration/value-objects/performance-settings.ts";
import { SchemaValidationService } from "../../schema/services/schema-validation-service.ts";
import { Aggregator } from "../../aggregation/aggregators/aggregator.ts";
import { BasePropertyPopulator } from "../../schema/services/base-property-populator.ts";

/**
 * Configuration interface for the document transformation pipeline
 * Following dependency injection pattern for Totality compliance
 */
export interface FrontmatterDocumentTransformationPipelineConfig {
  readonly processor: FrontmatterProcessor;
  readonly fileSystem: {
    readonly reader: DomainFileReader;
    readonly lister: DomainFileLister;
  };
  readonly services: {
    readonly schemaValidation: SchemaValidationService;
    readonly aggregator: Aggregator;
    readonly basePropertyPopulator: BasePropertyPopulator;
  };
  readonly frontmatterDataCreationService: FrontmatterDataCreationService;
  readonly performanceSettings: PerformanceSettings;
  readonly mergeOperations: MergeOperations;
}

/**
 * Document transformation pipeline service that handles the 5-stage processing.
 * Extracted from FrontmatterTransformationService to reduce complexity and improve maintainability.
 *
 * Processing Stages:
 * 1. Validation rules adjustment based on schema
 * 2. File listing and bounds monitoring setup
 * 3. Document processing (parallel or sequential)
 * 4. Frontmatter-part processing
 * 5. Data aggregation and base property population
 */
export class FrontmatterDocumentTransformationPipeline {
  private constructor(
    private readonly config: FrontmatterDocumentTransformationPipelineConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   */
  static create(
    config: FrontmatterDocumentTransformationPipelineConfig,
  ): Result<
    FrontmatterDocumentTransformationPipeline,
    DomainError & { message: string }
  > {
    // Validate required dependencies
    if (!config.processor) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "FrontmatterProcessor is required",
        }),
      };
    }

    if (!config.fileSystem?.reader || !config.fileSystem?.lister) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "File system services (reader and lister) are required",
        }),
      };
    }

    if (
      !config.services?.schemaValidation || !config.services?.aggregator ||
      !config.services?.basePropertyPopulator
    ) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "All domain services (schemaValidation, aggregator, basePropertyPopulator) are required",
        }),
      };
    }

    return ok(new FrontmatterDocumentTransformationPipeline(config));
  }

  /**
   * Transform documents through the 5-stage pipeline
   */
  async transform(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    processingBounds?: ProcessingBounds,
    legacyOptions?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
    processingOptionsState?: ProcessingOptionsState,
    logger?: DebugLogger,
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    // Stage 1: Validation rules adjustment
    const adjustedRulesResult = await this.adjustValidationRules(
      validationRules,
      schema,
      logger,
    );
    if (!adjustedRulesResult.ok) {
      return adjustedRulesResult;
    }
    const effectiveValidationRules = adjustedRulesResult.data;

    // Stage 2: File listing and bounds setup
    const listingResult = await this.listFilesAndSetupBounds(
      inputPattern,
      processingBounds,
      logger,
    );
    if (!listingResult.ok) {
      return listingResult;
    }
    const { files, boundsMonitor } = listingResult.data;

    // Stage 3: Document processing
    const processingResult = await this.processDocuments(
      files,
      effectiveValidationRules,
      boundsMonitor,
      legacyOptions,
      processingOptionsState,
      logger,
    );
    if (!processingResult.ok) {
      return processingResult;
    }
    const { processedData } = processingResult.data;

    // Stage 4: Frontmatter-part processing
    const frontmatterPartResult = this.processFrontmatterParts(
      processedData,
      schema,
      logger,
    );
    const finalData = frontmatterPartResult;

    // Stage 5: Aggregation and base property population
    return await this.aggregateAndPopulateBaseProperties(
      finalData,
      schema,
      logger,
    );
  }

  /**
   * Stage 1: Adjust validation rules based on schema configuration
   */
  private adjustValidationRules(
    validationRules: ValidationRules,
    schema: Schema,
    logger?: DebugLogger,
  ): Result<ValidationRules, DomainError & { message: string }> {
    // Use schema validation service to get proper validation rules for frontmatter part
    const validationRulesResult = this.config.services.schemaValidation
      .getValidationRulesForFrontmatterPart(schema);

    if (validationRulesResult.ok) {
      logger?.info(
        `Generated validation rules from resolved schema`,
        {
          operation: "validation-adjustment",
          totalRules: validationRulesResult.data.getRules().length,
          usingResolvedSchema: true,
          timestamp: new Date().toISOString(),
        },
      );
      return ok(validationRulesResult.data);
    } else {
      logger?.warn(
        "Failed to get validation rules from schema service, using default rules",
        {
          error: validationRulesResult.error.message,
          operation: "validation-adjustment",
          timestamp: new Date().toISOString(),
        },
      );
      return ok(validationRules); // Fallback to original rules
    }
  }

  /**
   * Stage 2: List files and setup processing bounds monitoring
   */
  private listFilesAndSetupBounds(
    inputPattern: string,
    processingBounds?: ProcessingBounds,
    logger?: DebugLogger,
  ): Result<
    { files: string[]; boundsMonitor: ProcessingBoundsMonitor },
    DomainError & { message: string }
  > {
    logger?.info(
      `Starting document processing with pattern: ${inputPattern}`,
      {
        operation: "document-processing",
        pattern: inputPattern,
        timestamp: new Date().toISOString(),
      },
    );

    // List matching files
    const filesResult = this.config.fileSystem.lister.list(inputPattern);
    if (!filesResult.ok) {
      logger?.error(
        `Failed to list files with pattern: ${inputPattern}`,
        {
          operation: "file-listing",
          pattern: inputPattern,
          error: filesResult.error,
          timestamp: new Date().toISOString(),
        },
      );
      return filesResult;
    }

    logger?.info(
      `Found ${filesResult.data.length} files to process`,
      {
        operation: "file-listing",
        count: filesResult.data.length,
        files: filesResult.data,
        timestamp: new Date().toISOString(),
      },
    );

    // Initialize memory bounds monitoring
    let actualBounds: ProcessingBounds;
    if (processingBounds) {
      actualBounds = processingBounds;
    } else {
      const defaultBoundsResult = ProcessingBoundsFactory.createDefault(
        filesResult.data.length,
      );
      if (!defaultBoundsResult.ok) {
        return defaultBoundsResult;
      }
      actualBounds = defaultBoundsResult.data;
    }

    const boundsMonitor = ProcessingBoundsMonitor.create(actualBounds);

    logger?.debug(
      "Initialized processing bounds",
      {
        operation: "memory-monitoring",
        boundsType: actualBounds.kind,
        fileCount: filesResult.data.length,
        timestamp: new Date().toISOString(),
      },
    );

    return ok({ files: filesResult.data, boundsMonitor });
  }

  /**
   * Stage 3: Process documents (parallel or sequential)
   */
  private async processDocuments(
    files: string[],
    validationRules: ValidationRules,
    boundsMonitor: ProcessingBoundsMonitor,
    legacyOptions?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
    processingOptionsState?: ProcessingOptionsState,
    logger?: DebugLogger,
  ): Promise<
    Result<
      { processedData: FrontmatterData[]; documents: MarkdownDocument[] },
      DomainError & { message: string }
    >
  > {
    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];

    // Determine processing strategy
    const minFilesForParallel = this.config.performanceSettings
      .getMinFilesForParallel();
    const defaultMaxWorkers = this.config.performanceSettings
      .getDefaultMaxWorkers();

    let useParallel = legacyOptions?.parallel === true &&
      files.length >= minFilesForParallel;
    let maxWorkers = legacyOptions?.maxWorkers || defaultMaxWorkers;

    // Handle adaptive strategy if provided
    if (processingOptionsState?.kind === "adaptive") {
      const fileCount = files.length;
      useParallel = fileCount > processingOptionsState.maxFileThreshold;
      maxWorkers = processingOptionsState.baseWorkers;
    }

    if (useParallel) {
      logger?.info(
        `Using parallel processing with ${maxWorkers} workers for ${files.length} files`,
        {
          operation: "parallel-processing",
          workerCount: maxWorkers,
          fileCount: files.length,
          timestamp: new Date().toISOString(),
        },
      );

      const results = await this.processFilesInParallel(
        files,
        validationRules,
        maxWorkers,
        boundsMonitor,
        logger,
      );

      if (!results.ok) {
        return results;
      }

      // Collect results from parallel processing
      for (const result of results.data) {
        processedData.push(result.frontmatterData);
        documents.push(result.document);
      }
    } else {
      // Sequential processing
      for (const filePath of files) {
        // Memory bounds monitoring
        const state = boundsMonitor.checkState(processedData.length);
        if (state.kind === "exceeded_limit") {
          return ErrorHandler.system({
            operation: "processDocuments",
            method: "checkMemoryBounds",
          }).memoryBoundsViolation(
            `Processing exceeded bounds: ${state.limit}`,
          );
        }

        logger?.debug(
          `Processing file: ${filePath}`,
          {
            operation: "file-processing",
            filePath,
            timestamp: new Date().toISOString(),
          },
        );

        const documentResult = this.processDocument(
          filePath,
          validationRules,
          logger,
        );
        if (documentResult.ok) {
          processedData.push(documentResult.data.frontmatterData);
          documents.push(documentResult.data.document);

          logger?.debug(
            `Successfully processed: ${filePath}`,
            {
              operation: "file-processing",
              filePath,
              timestamp: new Date().toISOString(),
            },
          );
        } else {
          logger?.error(
            `Failed to process file: ${filePath}`,
            {
              operation: "file-processing",
              filePath,
              error: documentResult.error,
              timestamp: new Date().toISOString(),
            },
          );
        }
      }
    }

    if (ValidationHelpers.isEmptyArray(processedData)) {
      const noDataError = ErrorHandler.aggregation({
        operation: "processDocuments",
        method: "validateProcessedData",
      }).aggregationFailed("No valid documents found to process");

      logger?.error(
        "No valid documents found to process",
        {
          operation: "document-processing",
          error: "No valid documents found to process",
          timestamp: new Date().toISOString(),
        },
      );
      return noDataError;
    }

    logger?.info(
      `Successfully processed ${processedData.length} documents`,
      {
        operation: "document-processing",
        processedCount: processedData.length,
        totalFiles: files.length,
        timestamp: new Date().toISOString(),
      },
    );

    return ok({ processedData, documents });
  }

  /**
   * Stage 4: Process frontmatter parts if schema defines x-frontmatter-part
   */
  private processFrontmatterParts(
    data: FrontmatterData[],
    schema: Schema,
    logger?: DebugLogger,
  ): FrontmatterData[] {
    const extensionKey = defaultSchemaExtensionRegistry.getFrontmatterPartKey()
      .getValue();

    logger?.debug(
      `Checking for ${extensionKey} schema definition`,
      createLogContext({
        operation: "frontmatter-parts",
      }),
    );

    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();
    if (!frontmatterPartSchemaResult.ok) {
      logger?.debug(
        `No ${extensionKey} schema found, returning original data`,
        createLogContext({
          operation: "frontmatter-parts",
        }),
      );
      return data;
    }

    // Get the path to the frontmatter part
    const frontmatterPartPathResult = schema.findFrontmatterPartPath();
    if (!frontmatterPartPathResult.ok) {
      logger?.debug(
        `No ${extensionKey} path found, returning original data`,
        createLogContext({
          operation: "frontmatter-parts",
        }),
      );
      return data;
    }

    const partPath = frontmatterPartPathResult.data;
    logger?.info(
      `Processing frontmatter parts at path: ${partPath}`,
      createLogContext({
        operation: "frontmatter-parts",
        inputs: `path: ${partPath}, inputCount: ${data.length}`,
      }),
    );

    const extractedParts: FrontmatterData[] = [];

    // Extract the frontmatter part from each document
    for (const frontmatterData of data) {
      const _dataObj = frontmatterData.getData();

      const partData = frontmatterData.getData();

      if (partData && typeof partData === "object") {
        const itemDataResult = this.config.frontmatterDataCreationService
          .createFromRaw(partData);
        if (itemDataResult.ok) {
          extractedParts.push(itemDataResult.data);
        } else {
          logger?.error(
            `Failed to process frontmatter as array item: ${itemDataResult.error.message}`,
            createLogContext({
              operation: "frontmatter-part-extraction",
            }),
          );
        }
      }
    }

    const result = !ValidationHelpers.isEmptyArray(extractedParts)
      ? extractedParts
      : data;
    logger?.info(
      `Frontmatter parts processing complete`,
      createLogContext({
        operation: "frontmatter-parts",
        inputs:
          `inputCount: ${data.length}, extractedCount: ${extractedParts.length}`,
      }),
    );

    return result;
  }

  /**
   * Stage 5: Aggregate data and populate base properties
   */
  private aggregateAndPopulateBaseProperties(
    data: FrontmatterData[],
    schema: Schema,
    logger?: DebugLogger,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Aggregate data using derivation rules
    logger?.debug(
      "Starting data aggregation with derivation rules",
      {
        operation: "aggregation",
        timestamp: new Date().toISOString(),
      },
    );

    const derivationRules = schema.getDerivedRules();
    logger?.info(
      `Found ${derivationRules.length} derivation rules`,
      {
        operation: "aggregation",
        rulesCount: derivationRules.length,
        timestamp: new Date().toISOString(),
      },
    );

    const aggregatedData = this.aggregateData(data, schema, logger);
    if (!aggregatedData.ok) {
      logger?.error(
        "Data aggregation failed",
        {
          operation: "aggregation",
          error: aggregatedData.error,
          timestamp: new Date().toISOString(),
        },
      );
      return aggregatedData;
    }

    // Populate base properties from schema defaults
    logger?.debug(
      "Starting base property population",
      {
        operation: "base-property-population",
        timestamp: new Date().toISOString(),
      },
    );

    const result = this.config.services.basePropertyPopulator.populate(
      aggregatedData.data,
      schema,
    );

    if (result.ok) {
      logger?.info(
        "Document processing pipeline completed successfully",
        {
          operation: "document-processing",
          timestamp: new Date().toISOString(),
        },
      );
    } else {
      logger?.error(
        "Base property population failed",
        {
          operation: "base-property-population",
          error: result.error,
          timestamp: new Date().toISOString(),
        },
      );
    }

    return result;
  }

  /**
   * Process a single document file
   */
  private processDocument(
    filePath: string,
    validationRules: ValidationRules,
    logger?: DebugLogger,
  ): Result<
    { document: MarkdownDocument; frontmatterData: FrontmatterData },
    DomainError & { message: string }
  > {
    // Create file path value object
    const filePathResult = FilePath.create(filePath);
    if (!filePathResult.ok) {
      logger?.error(
        `File path validation failed: ${filePathResult.error.message}`,
        createLogContext({
          operation: "file-path-validation",
          location: filePath,
        }),
      );
      return filePathResult;
    }

    // Read file content
    const contentResult = this.config.fileSystem.reader.read(filePath);
    if (!contentResult.ok) {
      logger?.error(
        `File reading failed: ${contentResult.error.message}`,
        createLogContext({
          operation: "file-reading",
          location: filePath,
        }),
      );
      return contentResult;
    }

    // Extract frontmatter
    const extractResult = this.config.processor.extract(contentResult.data);
    if (!extractResult.ok) {
      logger?.error(
        `Frontmatter extraction failed: ${extractResult.error.message}`,
        createLogContext({
          operation: "frontmatter-extraction",
          location: filePath,
        }),
      );
      return extractResult;
    }

    const { frontmatter, body } = extractResult.data;

    // Validate frontmatter
    const validationResult = this.config.processor.validate(
      frontmatter,
      validationRules,
    );
    if (!validationResult.ok) {
      logger?.error(
        `Frontmatter validation failed: ${validationResult.error.message}`,
        createLogContext({
          operation: "frontmatter-validation",
          location: filePath,
        }),
      );
      return validationResult;
    }

    // Create document entity
    const docResult = MarkdownDocument.create(
      filePathResult.data,
      contentResult.data,
      validationResult.data,
      body,
    );
    if (!docResult.ok) {
      logger?.error(
        `Document creation failed: ${docResult.error.message}`,
        createLogContext({
          operation: "document-creation",
          location: filePath,
        }),
      );
      return docResult;
    }

    return ok({
      document: docResult.data,
      frontmatterData: validationResult.data,
    });
  }

  /**
   * Process files in parallel using a worker pool pattern
   */
  private async processFilesInParallel(
    filePaths: string[],
    validationRules: ValidationRules,
    maxWorkers: number,
    boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Promise<
    Result<
      Array<{ document: MarkdownDocument; frontmatterData: FrontmatterData }>,
      DomainError & { message: string }
    >
  > {
    const results: Array<
      { document: MarkdownDocument; frontmatterData: FrontmatterData }
    > = [];
    const errors: Array<DomainError & { message: string }> = [];

    // Create batches for worker processing
    const batchSize = Math.max(1, Math.ceil(filePaths.length / maxWorkers));
    const batches: string[][] = [];

    for (let i = 0; i < filePaths.length; i += batchSize) {
      batches.push(filePaths.slice(i, i + batchSize));
    }

    logger?.debug(
      `Created ${batches.length} batches with batch size ${batchSize}`,
      {
        operation: "parallel-batch-creation",
        batchCount: batches.length,
        batchSize,
        totalFiles: filePaths.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Process batches in parallel using Promise.all
    try {
      const batchPromises = batches.map((batch, _batchIndex) => {
        return new Promise<{
          batchResults: Array<
            { document: MarkdownDocument; frontmatterData: FrontmatterData }
          >;
          batchErrors: Array<DomainError & { message: string }>;
        }>((resolve) => {
          const batchResults: Array<
            { document: MarkdownDocument; frontmatterData: FrontmatterData }
          > = [];
          const batchErrors: Array<DomainError & { message: string }> = [];

          for (const filePath of batch) {
            // Memory bounds monitoring for each file
            const state = boundsMonitor.checkState(
              results.length + batchResults.length,
            );
            if (state.kind === "exceeded_limit") {
              const boundsError = ErrorHandler.system({
                operation: "processFilesInParallel",
                method: "checkBatchMemoryBounds",
              }).memoryBoundsViolation(
                `Processing exceeded bounds: ${state.limit}`,
              );
              if (!boundsError.ok) {
                batchErrors.push(boundsError.error);
              }
              break;
            }

            const documentResult = this.processDocument(
              filePath,
              validationRules,
              logger,
            );
            if (documentResult.ok) {
              batchResults.push(documentResult.data);
            } else {
              batchErrors.push(documentResult.error);
            }
          }

          resolve({ batchResults, batchErrors });
        });
      });

      // Wait for all batches to complete
      const batchOutputs = await Promise.all(batchPromises);

      // Collect all results and errors
      for (const { batchResults, batchErrors } of batchOutputs) {
        results.push(...batchResults);
        errors.push(...batchErrors);
      }

      logger?.info(
        `Parallel processing completed: ${results.length} successful, ${errors.length} errors`,
        {
          operation: "parallel-processing-completion",
          successCount: results.length,
          errorCount: errors.length,
          totalFiles: filePaths.length,
          timestamp: new Date().toISOString(),
        },
      );

      // Return results even if some files failed (matching sequential behavior)
      if (
        ValidationHelpers.isEmptyArray(results) &&
        !ValidationHelpers.isEmptyArray(errors)
      ) {
        return err(errors[0]);
      }

      return ok(results);
    } catch (error) {
      const processingError = ErrorHandlingUtils.handleException(
        error,
        "FrontmatterDocumentTransformationPipeline",
        "processFilesInParallel",
      );

      logger?.error(
        "Parallel processing encountered an unexpected error",
        {
          operation: "parallel-processing-error",
          error: processingError.message,
          timestamp: new Date().toISOString(),
        },
      );

      return err(processingError);
    }
  }

  /**
   * Aggregate data using derivation rules from schema
   */
  private aggregateData(
    data: FrontmatterData[],
    schema: Schema,
    logger?: DebugLogger,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const derivationRules = schema.getDerivedRules();

    if (!ValidationHelpers.isEmptyArray(derivationRules)) {
      return this.aggregateWithDerivationRules(
        data,
        schema,
        derivationRules,
        logger,
      );
    } else {
      return this.aggregateWithoutDerivationRules(data, schema, logger);
    }
  }

  /**
   * Handles aggregation with derivation rules using schema-driven approach
   */
  private aggregateWithDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
    logger?: DebugLogger,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      return this.config.mergeOperations.mergeDataDirectly(data);
    }

    // Handle empty data by creating empty structure
    if (ValidationHelpers.isEmptyArray(data)) {
      const emptyStructureResult = SchemaPathResolver.createEmptyStructure(
        schema,
      );
      if (!emptyStructureResult.ok) {
        return emptyStructureResult;
      }

      const baseDataResult = emptyStructureResult.data.toFrontmatterData();
      if (!baseDataResult.ok) {
        return baseDataResult;
      }

      return this.applyDerivationRules(baseDataResult.data, derivationRules);
    }

    // Use SchemaPathResolver for structure creation
    const commandsArray = data.map((item) => item.getData());
    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      logger?.error(
        `Data structure creation failed: ${structureResult.error.message}`,
        createLogContext({
          operation: "data-structure-creation",
        }),
      );
      return structureResult;
    }

    // Convert to FrontmatterData and apply derivation rules
    const baseDataResult = structureResult.data.toFrontmatterData();
    if (!baseDataResult.ok) {
      return baseDataResult;
    }

    return this.applyDerivationRules(baseDataResult.data, derivationRules);
  }

  /**
   * Handles aggregation without derivation rules using schema-driven approach
   */
  private aggregateWithoutDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
    _logger?: DebugLogger,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      return this.config.mergeOperations.mergeDataDirectly(data);
    }

    // Handle empty data by creating empty structure
    if (ValidationHelpers.isEmptyArray(data)) {
      const emptyStructureResult = SchemaPathResolver.createEmptyStructure(
        schema,
      );
      if (!emptyStructureResult.ok) {
        return emptyStructureResult;
      }

      return emptyStructureResult.data.toFrontmatterData();
    }

    // Use SchemaPathResolver for structure creation
    const commandsArray = data.map((item) => item.getData());
    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      return structureResult;
    }

    return structureResult.data.toFrontmatterData();
  }

  /**
   * Applies derivation rules to base data using existing aggregator
   */
  private applyDerivationRules(
    baseData: FrontmatterData,
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Convert schema rules to domain rules
    const ruleConversion = this.convertDerivationRules(derivationRules);
    const rules = ruleConversion.successfulRules;

    // Apply derivation rules and merge with base data
    const aggregationResult = this.config.services.aggregator.aggregate(
      [baseData],
      rules,
      baseData,
    );
    if (!aggregationResult.ok) {
      return aggregationResult;
    }

    // Use aggregator's mergeWithBase to properly apply derived fields
    const mergeResult = this.config.services.aggregator.mergeWithBase(
      aggregationResult.data,
    );
    if (!mergeResult.ok) {
      return mergeResult;
    }

    return ok(mergeResult.data);
  }

  /**
   * Convert schema derivation rules to domain rules with explicit error handling
   */
  private convertDerivationRules(
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): {
    successfulRules: DerivationRule[];
    failedRuleCount: number;
    errors: Array<DomainError & { message: string }>;
  } {
    const successfulRules: DerivationRule[] = [];
    const errors: Array<DomainError & { message: string }> = [];
    let failedRuleCount = 0;

    for (const rule of derivationRules) {
      const ruleResult = DerivationRule.create(
        rule.sourcePath,
        rule.targetField,
        rule.unique,
      );

      if (ruleResult.ok) {
        successfulRules.push(ruleResult.data);
      } else {
        failedRuleCount++;
        errors.push(ruleResult.error);
      }
    }

    return { successfulRules, failedRuleCount, errors };
  }
}
