import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../domain/schema/value-objects/validation-rules.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { FrontmatterTransformationService } from "../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { FrontmatterDataFactory } from "../../domain/frontmatter/factories/frontmatter-data-factory.ts";

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
  constructor(
    private readonly frontmatterTransformer: FrontmatterTransformationService,
  ) {}

  /**
   * Smart Constructor for ProcessingCoordinator
   * Following Totality principles by returning Result<T,E>
   */
  static create(
    frontmatterTransformer: FrontmatterTransformationService,
  ): Result<ProcessingCoordinator, DomainError & { message: string }> {
    if (!frontmatterTransformer) {
      return err(createError({
        kind: "InitializationError",
        message: "FrontmatterTransformationService is required",
      }));
    }

    return ok(new ProcessingCoordinator(frontmatterTransformer));
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
