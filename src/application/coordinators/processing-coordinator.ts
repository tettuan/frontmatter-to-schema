import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../domain/schema/value-objects/validation-rules.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { FrontmatterTransformationService } from "../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { FrontmatterDataFactory } from "../../domain/frontmatter/factories/frontmatter-data-factory.ts";
// TODO: Re-enable when ExtractFromProcessor is fully implemented
import { ExtractFromProcessor } from "../../domain/schema/services/extract-from-processor.ts";
import { PropertyExtractor } from "../../domain/schema/extractors/property-extractor.ts";
import {
  ProcessingHints,
  SchemaStructureDetector,
} from "../../domain/schema/services/schema-structure-detector.ts";
import { StructureType } from "../../domain/schema/value-objects/structure-type.ts";
import { DebugLogger } from "../../infrastructure/adapters/debug-logger.ts";

/**
 * Processing options using discriminated unions (Totality principle)
 */
export type ProcessingOptions =
  | {
    readonly kind: "sequential";
  }
  | {
    readonly kind: "parallel";
    readonly maxWorkers: number;
  };

/**
 * Processing Coordinator - Application Service
 *
 * Responsible for orchestrating document processing operations
 * Following DDD principles:
 * - Single responsibility: Document processing coordination
 * - Clean boundaries: Uses domain services, no infrastructure coupling
 * - Totality: All methods return Result<T,E>
 */
export class ProcessingCoordinator {
  // TODO: Re-enable when ExtractFromProcessor is fully implemented
  private readonly extractFromProcessor: ExtractFromProcessor;
  private readonly logger: DebugLogger | null;

  constructor(
    private readonly frontmatterTransformer: FrontmatterTransformationService,
    propertyExtractor?: PropertyExtractor,
    logger?: DebugLogger,
  ) {
    this.logger = logger || null;
    // TODO: Re-enable when ExtractFromProcessor is fully implemented
    const result = ExtractFromProcessor.create(propertyExtractor);
    if (!result.ok) {
      throw new Error("Failed to create ExtractFromProcessor");
    }
    this.extractFromProcessor = result.data;
  }

  /**
   * Smart Constructor for ProcessingCoordinator
   * Following Totality principles by returning Result<T,E>
   */
  static create(
    frontmatterTransformer: FrontmatterTransformationService,
    propertyExtractor?: PropertyExtractor,
    logger?: DebugLogger,
  ): Result<ProcessingCoordinator, DomainError & { message: string }> {
    if (!frontmatterTransformer) {
      return err(createError({
        kind: "InitializationError",
        message: "FrontmatterTransformationService is required",
      }));
    }

    return ok(
      new ProcessingCoordinator(
        frontmatterTransformer,
        propertyExtractor,
        logger,
      ),
    );
  }

  /**
   * Process documents using the frontmatter transformation service
   * Extracted from PipelineOrchestrator document processing logic
   * Following Totality principles - total function returning Result<T,E>
   */
  async processDocuments(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions = { kind: "sequential" },
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    // Debug: ValidationRules application timing (Issue #905 Phase 1)
    this.logger?.logDebug(
      "validation-timing",
      "ValidationRules application started",
      {
        inputPattern,
        validationStrategy: "fail-fast", // Current implementation strategy
        ruleCount: validationRules.getRules().length,
        processingMode: options.kind,
      },
    );

    // Convert ProcessingOptions to transformation service options
    const transformationOptions = this.convertProcessingOptions(options);

    // Debug: Processing variance tracking (Issue #905 Phase 1)
    this.logger?.logDebug(
      "processing-variance",
      "Processing options converted for transformation",
      {
        originalOptions: options,
        transformationOptions,
        expectedVariance: "low",
      },
    );

    const result = await this.frontmatterTransformer.transformDocuments(
      inputPattern,
      validationRules,
      schema,
      undefined, // processingBounds - using default
      transformationOptions,
    );

    // Debug: Error propagation tracking (Issue #905 Phase 1)
    if (!result.ok) {
      this.logger?.logDebug(
        "error-propagation",
        "Document processing failed",
        {
          errorKind: result.error.kind,
          propagationStrategy: "immediate-return",
          recoveryOptions: ["partial-result", "retry"],
        },
      );
    } else {
      this.logger?.logDebug(
        "processing-success",
        "Document processing completed successfully",
        {
          dataSize: result.data.getAllKeys().length,
          processingVariance: "within-tolerance",
        },
      );
    }

    return result;
  }

  /**
   * Extract frontmatter-part data as array for items expansion
   * Extracted from PipelineOrchestrator.extractFrontmatterPartData()
   * Following DDD - coordination of domain operations
   */
  extractFrontmatterPartData(
    data: FrontmatterData,
    schema: Schema,
  ): Result<FrontmatterData[], DomainError & { message: string }> {
    // Debug: Frontmatter-part extraction variance tracking (Issue #905 Phase 1)
    this.logger?.logDebug(
      "frontmatter-part-extraction",
      "Starting frontmatter-part data extraction",
      {
        dataKeys: data.getAllKeys(),
        schemaPath: schema.getPath().toString(),
        extractionStrategy: "array-expansion",
      },
    );

    // Check if schema has frontmatter-part definition
    const pathResult = schema.findFrontmatterPartPath();
    if (!pathResult.ok) {
      // No frontmatter-part defined, return data as single item array
      this.logger?.logDebug(
        "frontmatter-part-extraction",
        "No frontmatter-part path found, using single-item strategy",
        {
          reason: "no-frontmatter-part-defined",
          fallbackStrategy: "single-item-array",
        },
      );
      return ok([data]);
    }

    const frontmatterPartPath = pathResult.data;

    // Debug: Path resolution tracking (Issue #905 Phase 1)
    this.logger?.logDebug(
      "frontmatter-part-path",
      "Frontmatter-part path resolved",
      {
        path: frontmatterPartPath,
        pathResolutionStrategy: "schema-traversal",
      },
    );

    // Check if this data already contains an array at the frontmatter-part path
    const arrayDataResult = data.get(frontmatterPartPath);
    const hasArrayData = arrayDataResult.ok &&
      Array.isArray(arrayDataResult.data);

    if (hasArrayData) {
      // File contains array at target path - extract individual items
      this.logger?.logDebug(
        "array-processing-variance",
        "Processing array data at frontmatter-part path",
        {
          arrayLength: arrayDataResult.data.length,
          processingStrategy: "item-by-item-extraction",
          expectedVariance: "item-validation-failures",
        },
      );

      const result: FrontmatterData[] = [];
      let processedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < arrayDataResult.data.length; i++) {
        const item = arrayDataResult.data[i];

        // Skip invalid items gracefully (null, primitives, etc.)
        if (!item || typeof item !== "object") {
          skippedCount++;
          continue;
        }

        const itemDataResult = FrontmatterDataFactory.fromParsedData(item);
        if (itemDataResult.ok) {
          result.push(itemDataResult.data);
          processedCount++;
        } else {
          skippedCount++;
        }
        // Continue processing other items even if one fails
      }

      // Debug: Array processing results (Issue #905 Phase 1)
      this.logger?.logDebug(
        "array-processing-results",
        "Array processing completed",
        {
          totalItems: arrayDataResult.data.length,
          processedItems: processedCount,
          skippedItems: skippedCount,
          processingVariance: skippedCount > 0 ? "high" : "low",
        },
      );

      return ok(result);
    } else {
      // Default case: individual file contributes directly as one item
      this.logger?.logDebug(
        "frontmatter-part-extraction",
        "No array data found, using single-item fallback",
        {
          reason: "no-array-at-path",
          fallbackStrategy: "single-item-array",
          dataType: arrayDataResult.ok
            ? typeof arrayDataResult.data
            : "unknown",
        },
      );
      return ok([data]);
    }
  }

  /**
   * Process documents and extract items if needed
   * Common coordination pattern combining processing and extraction
   */
  async processDocumentsWithItemsExtraction(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions = { kind: "sequential" },
  ): Promise<
    Result<{
      mainData: FrontmatterData;
      itemsData?: FrontmatterData[];
    }, DomainError & { message: string }>
  > {
    // Process documents first
    const processResult = await this.processDocuments(
      inputPattern,
      validationRules,
      schema,
      options,
    );
    if (!processResult.ok) {
      return processResult;
    }

    const mainData = processResult.data;

    // Check if we need to extract items data
    const frontmatterPartResult = schema.findFrontmatterPartPath();
    const hasFrontmatterPart = frontmatterPartResult.ok;

    if (hasFrontmatterPart) {
      const itemsResult = this.extractFrontmatterPartData(mainData, schema);
      if (!itemsResult.ok) {
        return itemsResult;
      }

      return ok({
        mainData,
        itemsData: itemsResult.data,
      });
    }

    return ok({ mainData });
  }

  // TODO: Re-enable when ExtractFromProcessor is fully implemented
  processExtractFromDirectives(
    data: FrontmatterData,
    _schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Implementation temporarily disabled - just return data unchanged
    return ok(data);
  }

  /**
   * Process documents with x-extract-from directives applied
   * Combines document processing with directive application
   */
  async processDocumentsWithExtractFrom(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions = { kind: "sequential" },
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    // Process documents first
    const processResult = await this.processDocuments(
      inputPattern,
      validationRules,
      schema,
      options,
    );
    if (!processResult.ok) {
      return processResult;
    }

    // TODO: Re-enable when ExtractFromProcessor is fully implemented
    // Apply x-extract-from directives if present
    const extractResult = this.processExtractFromDirectives(
      processResult.data,
      schema,
    );

    return extractResult;
  }

  /**
   * Process documents with both items extraction and x-extract-from directives
   * Comprehensive coordination combining all processing steps
   */
  async processDocumentsWithFullExtraction(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions = { kind: "sequential" },
  ): Promise<
    Result<{
      mainData: FrontmatterData;
      itemsData?: FrontmatterData[];
    }, DomainError & { message: string }>
  > {
    // Debug: Track directive processing order variance
    console.log(
      "[DIRECTIVE-ORDER-DEBUG] Starting processDocumentsWithFullExtraction",
    );
    console.log(
      "[DIRECTIVE-ORDER-DEBUG] Processing sequence: 1. x-extract-from (initial)",
    );

    // Process documents with x-extract-from directives
    const processResult = await this.processDocumentsWithExtractFrom(
      inputPattern,
      validationRules,
      schema,
      options,
    );
    if (!processResult.ok) {
      return processResult;
    }

    const mainData = processResult.data;
    console.log(
      "[DIRECTIVE-ORDER-DEBUG] Processing sequence: 2. x-frontmatter-part detection",
    );

    // Check if we need to extract items data
    const frontmatterPartResult = schema.findFrontmatterPartPath();
    const hasFrontmatterPart = frontmatterPartResult.ok;

    if (hasFrontmatterPart) {
      console.debug(
        "[DIRECTIVE-ORDER-DEBUG] Processing sequence: 3. x-frontmatter-part extraction",
      );
    }

    if (hasFrontmatterPart) {
      const itemsResult = this.extractFrontmatterPartData(mainData, schema);
      if (!itemsResult.ok) {
        return itemsResult;
      }

      // Apply x-extract-from to each extracted item if needed
      // TODO: Re-enable when ExtractFromProcessor is fully implemented
      if (schema.hasExtractFromDirectives()) {
        console.log(
          "[DIRECTIVE-ORDER-DEBUG] Processing sequence: 4. x-extract-from (on items) - VARIANCE DETECTED",
        );
        console.log(
          "[DIRECTIVE-ORDER-DEBUG] WARNING: Second x-extract-from processing creates order dependency issue",
        );

        const processedItems: FrontmatterData[] = [];
        for (const item of itemsResult.data) {
          // TODO: Re-enable when ExtractFromProcessor is fully implemented
          const processedItemResult = this.processExtractFromDirectives(
            item,
            schema,
          );
          if (processedItemResult.ok) {
            processedItems.push(processedItemResult.data);
          } else {
            // For now, just use the item as-is if processing fails
            processedItems.push(item);
          }
        }

        console.debug(
          "[DIRECTIVE-ORDER-DEBUG] Completed items processing with variance pattern",
        );
        return ok({
          mainData,
          itemsData: processedItems,
        });
      }

      console.debug(
        "[DIRECTIVE-ORDER-DEBUG] No x-extract-from on items, completing frontmatter-part processing",
      );
      return ok({
        mainData,
        itemsData: itemsResult.data,
      });
    }

    console.debug(
      "[DIRECTIVE-ORDER-DEBUG] No frontmatter-part detected, single-pass processing complete",
    );
    return ok({ mainData });
  }

  /**
   * Process documents with StructureType detection (basic variant)
   * Returns structure information alongside processed data
   * Following DDD - coordination with structure intelligence
   */
  async processDocumentsWithStructureDetection(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions = { kind: "sequential" },
  ): Promise<
    Result<{
      data: FrontmatterData;
      structureType: StructureType;
      processingHints: ProcessingHints;
    }, DomainError & { message: string }>
  > {
    // Detect structure type first
    const structureResult = SchemaStructureDetector.detectStructureType(schema);
    if (!structureResult.ok) {
      return structureResult;
    }

    const structureType = structureResult.data;
    const processingHints = SchemaStructureDetector.getProcessingHints(
      structureType,
    );

    // Use basic processing logic
    const processResult = await this.processDocuments(
      inputPattern,
      validationRules,
      schema,
      options,
    );
    if (!processResult.ok) {
      return processResult;
    }

    return ok({
      data: processResult.data,
      structureType,
      processingHints,
    });
  }

  /**
   * Process documents with StructureType awareness and processing hints
   * Integrates structure detection with document processing for optimized handling
   * Following DDD - coordination of domain operations with structure intelligence
   */
  async processDocumentsWithStructureAwareness(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions = { kind: "sequential" },
  ): Promise<
    Result<{
      mainData: FrontmatterData;
      itemsData?: FrontmatterData[];
      structureType: StructureType;
      processingHints: ProcessingHints;
    }, DomainError & { message: string }>
  > {
    // Detect structure type first using our new SchemaStructureDetector
    const structureResult = SchemaStructureDetector.detectStructureType(schema);
    if (!structureResult.ok) {
      return structureResult;
    }

    const structureType = structureResult.data;
    const processingHints = SchemaStructureDetector.getProcessingHints(
      structureType,
    );

    // Use existing processing logic with structure intelligence
    const processResult = await this.processDocumentsWithFullExtraction(
      inputPattern,
      validationRules,
      schema,
      options,
    );
    if (!processResult.ok) {
      return processResult;
    }

    return ok({
      ...processResult.data,
      structureType,
      processingHints,
    });
  }

  /**
   * Convert ProcessingOptions to transformation service format
   * Following Totality principles - exhaustive pattern matching
   */
  private convertProcessingOptions(
    options: ProcessingOptions,
  ): { parallel: boolean; maxWorkers: number } {
    switch (options.kind) {
      case "sequential":
        return { parallel: false, maxWorkers: 1 };
      case "parallel":
        return { parallel: true, maxWorkers: options.maxWorkers };
    }
  }
}
