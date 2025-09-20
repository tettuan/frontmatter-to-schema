import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../domain/schema/value-objects/validation-rules.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { FrontmatterTransformationService } from "../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { FrontmatterDataFactory } from "../../domain/frontmatter/factories/frontmatter-data-factory.ts";
import { ExtractFromProcessor } from "../../domain/schema/services/extract-from-processor.ts";
import { PropertyExtractor } from "../../domain/schema/extractors/property-extractor.ts";
import {
  ProcessingHints,
  SchemaStructureDetector,
} from "../../domain/schema/services/schema-structure-detector.ts";
import { StructureType } from "../../domain/schema/value-objects/structure-type.ts";

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
  private readonly extractFromProcessor: ExtractFromProcessor;

  constructor(
    private readonly frontmatterTransformer: FrontmatterTransformationService,
    propertyExtractor?: PropertyExtractor,
  ) {
    this.extractFromProcessor = ExtractFromProcessor.create(propertyExtractor);
  }

  /**
   * Smart Constructor for ProcessingCoordinator
   * Following Totality principles by returning Result<T,E>
   */
  static create(
    frontmatterTransformer: FrontmatterTransformationService,
    propertyExtractor?: PropertyExtractor,
  ): Result<ProcessingCoordinator, DomainError & { message: string }> {
    if (!frontmatterTransformer) {
      return err(createError({
        kind: "InitializationError",
        message: "FrontmatterTransformationService is required",
      }));
    }

    return ok(
      new ProcessingCoordinator(frontmatterTransformer, propertyExtractor),
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
    // Convert ProcessingOptions to transformation service options
    const transformationOptions = this.convertProcessingOptions(options);

    const result = await this.frontmatterTransformer.transformDocuments(
      inputPattern,
      validationRules,
      schema,
      undefined, // processingBounds - using default
      transformationOptions,
    );

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
    // Check if schema has frontmatter-part definition
    const pathResult = schema.findFrontmatterPartPath();
    if (!pathResult.ok) {
      // No frontmatter-part defined, return data as single item array
      return ok([data]);
    }

    const frontmatterPartPath = pathResult.data;

    // Check if this data already contains an array at the frontmatter-part path
    const arrayDataResult = data.get(frontmatterPartPath);
    const hasArrayData = arrayDataResult.ok &&
      Array.isArray(arrayDataResult.data);

    if (hasArrayData) {
      // File contains array at target path - extract individual items
      const result: FrontmatterData[] = [];
      for (let i = 0; i < arrayDataResult.data.length; i++) {
        const item = arrayDataResult.data[i];

        // Skip invalid items gracefully (null, primitives, etc.)
        if (!item || typeof item !== "object") {
          continue;
        }

        const itemDataResult = FrontmatterDataFactory.fromParsedData(item);
        if (itemDataResult.ok) {
          result.push(itemDataResult.data);
        }
        // Continue processing other items even if one fails
      }

      return ok(result);
    } else {
      // Default case: individual file contributes directly as one item
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

  /**
   * Process x-extract-from directives for data transformation
   * Similar to extractFrontmatterPartData, processes directives during transformation phase
   * Following DDD - coordination of domain operations
   */
  processExtractFromDirectives(
    data: FrontmatterData,
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Check if schema has x-extract-from directives
    if (!schema.hasExtractFromDirectives()) {
      // No directives, return data unchanged
      return ok(data);
    }

    const directivesResult = schema.getExtractFromDirectives();
    if (!directivesResult.ok) {
      const errorMessage = "message" in directivesResult.error
        ? directivesResult.error.message
        : JSON.stringify(directivesResult.error);
      return err(createError({
        kind: "AggregationFailed",
        message: `Failed to get x-extract-from directives: ${errorMessage}`,
      }));
    }

    // Process directives using ExtractFromProcessor
    const processResult = this.extractFromProcessor.processBatch(
      data,
      directivesResult.data,
    );

    if (!processResult.ok) {
      const errorMessage = "message" in processResult.error
        ? processResult.error.message
        : JSON.stringify(processResult.error);
      return err(createError({
        kind: "AggregationFailed",
        message: `Failed to process x-extract-from directives: ${errorMessage}`,
      }));
    }

    return processResult;
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

    // Check if we need to extract items data
    const frontmatterPartResult = schema.findFrontmatterPartPath();
    const hasFrontmatterPart = frontmatterPartResult.ok;

    if (hasFrontmatterPart) {
      const itemsResult = this.extractFrontmatterPartData(mainData, schema);
      if (!itemsResult.ok) {
        return itemsResult;
      }

      // Apply x-extract-from to each extracted item if needed
      if (schema.hasExtractFromDirectives()) {
        const processedItems: FrontmatterData[] = [];
        for (const item of itemsResult.data) {
          const processedItemResult = this.processExtractFromDirectives(
            item,
            schema,
          );
          if (processedItemResult.ok) {
            processedItems.push(processedItemResult.data);
          } else {
            // Log warning but continue processing other items
            const errorMessage = "message" in processedItemResult.error
              ? processedItemResult.error.message
              : JSON.stringify(processedItemResult.error);
            console.warn(
              `Failed to process x-extract-from for item: ${errorMessage}`,
            );
            processedItems.push(item);
          }
        }
        return ok({
          mainData,
          itemsData: processedItems,
        });
      }

      return ok({
        mainData,
        itemsData: itemsResult.data,
      });
    }

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
