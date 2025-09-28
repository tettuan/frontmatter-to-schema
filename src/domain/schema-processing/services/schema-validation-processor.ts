import { err, ok, Result } from "../../shared/types/result.ts";
// import { createError } from "../../shared/types/errors.ts"; // Unused import
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { defaultSchemaExtensionRegistry } from "../../schema/value-objects/schema-extension-registry.ts";
import type { FrontmatterDataCreationService } from "../../frontmatter/services/frontmatter-data-creation-service.ts";
import {
  SchemaError,
  SchemaMetadata,
  SchemaProcessor,
  ValidatedData,
} from "../interfaces/schema-processor.ts";

/**
 * Implementation of SchemaProcessor focused on schema validation and transformation.
 * Handles x-frontmatter-part processing and data validation according to schema rules.
 *
 * Following DDD principles:
 * - Single Responsibility: Schema validation and transformation only
 * - Domain boundaries: Clear separation from document processing and aggregation concerns
 * - Dependency Inversion: Uses injected data creation service
 *
 * Following Totality principles:
 * - All methods return Result<T,E> types
 * - No partial functions or exceptions
 * - Comprehensive error handling through discriminated unions
 */
export class SchemaValidationProcessor implements SchemaProcessor {
  private constructor(
    private readonly frontmatterDataCreationService:
      FrontmatterDataCreationService,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates a schema processor with validated dependencies
   */
  static create(
    frontmatterDataCreationService: FrontmatterDataCreationService,
  ): Result<SchemaValidationProcessor, SchemaError & { message: string }> {
    if (!frontmatterDataCreationService) {
      return err({
        kind: "SchemaProcessorCreationFailure",
        cause: "FrontmatterDataCreationService is required",
        message:
          "FrontmatterDataCreationService dependency is required for schema processing",
      });
    }

    return ok(new SchemaValidationProcessor(frontmatterDataCreationService));
  }

  /**
   * Validate and transform frontmatter data according to schema rules.
   * This is the main entry point that orchestrates schema processing activities.
   */
  validateAndTransform(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<ValidatedData, SchemaError & { message: string }> {
    // Step 1: Process frontmatter parts if required by schema
    const frontmatterPartsResult = this.processFrontmatterParts(data, schema);
    if (!frontmatterPartsResult.ok) {
      return frontmatterPartsResult;
    }

    const processedFrontmatter = frontmatterPartsResult.data;

    // Step 2: Create metadata about the processing
    const metadata = this.createSchemaMetadata(
      data,
      processedFrontmatter,
      schema,
    );

    // Step 3: Additional schema validation could be added here
    // For now, we'll return the processed data with metadata

    return ok({
      processedFrontmatter,
      schemaMetadata: metadata,
    });
  }

  /**
   * Process frontmatter parts according to x-frontmatter-part schema directives.
   * This method is extracted from the original FrontmatterTransformationService.
   */
  processFrontmatterParts(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData[], SchemaError & { message: string }> {
    try {
      const _extensionKey = defaultSchemaExtensionRegistry
        .getFrontmatterPartKey()
        .getValue();

      // Check if schema has frontmatter-part configuration
      const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();
      if (!frontmatterPartSchemaResult.ok) {
        // No frontmatter-part schema found, return original data
        return ok(data);
      }

      // Get the path to the frontmatter part (e.g., "commands")
      const frontmatterPartPathResult = schema.findFrontmatterPartPath();
      if (!frontmatterPartPathResult.ok) {
        // No frontmatter-part path found, return original data
        return ok(data);
      }

      const partPath = frontmatterPartPathResult.data;
      const extractedParts: FrontmatterData[] = [];

      // Extract the frontmatter part from each document
      for (const frontmatterData of data) {
        const processResult = this.processSingleFrontmatterPart(
          frontmatterData,
          partPath,
        );
        if (processResult.ok && processResult.data !== null) {
          extractedParts.push(processResult.data);
        } else if (!processResult.ok) {
          return err({
            kind: "FrontmatterPartProcessingFailure",
            path: partPath,
            cause: processResult.error.message,
            message:
              `Failed to process frontmatter part at '${partPath}': ${processResult.error.message}`,
          });
        }
      }

      // Return extracted parts if any were found, otherwise return original data
      return ok(extractedParts.length > 0 ? extractedParts : data);
    } catch (error) {
      return err({
        kind: "FrontmatterPartProcessingFailure",
        path: "unknown",
        cause: error instanceof Error ? error.message : "Unknown error",
        message: `Unexpected error during frontmatter parts processing: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  /**
   * Process a single frontmatter data object for frontmatter-part extraction.
   * Extracted from the main processing loop to improve testability and clarity.
   */
  private processSingleFrontmatterPart(
    frontmatterData: FrontmatterData,
    _partPath: string,
  ): Result<FrontmatterData | null, SchemaError & { message: string }> {
    const _dataObj = frontmatterData.getData();

    // For frontmatter-part processing, the individual markdown files contain
    // the data that will become items in the target array. The partPath indicates
    // where the final array will be placed in the aggregated result, NOT where
    // to extract data from individual files.
    // Therefore, we extract the entire frontmatter object from each file.

    const partData = frontmatterData.getData(); // Use the processed frontmatter object

    if (partData && typeof partData === "object") {
      // Each individual frontmatter object becomes one item in the target array
      const itemDataResult = this.frontmatterDataCreationService
        .createFromRaw(partData);

      if (itemDataResult.ok) {
        return ok(itemDataResult.data);
      } else {
        return err({
          kind: "SchemaDataTransformationFailure",
          operation: "frontmatter-part-item-creation",
          cause: itemDataResult.error.message,
          message:
            `Failed to create frontmatter data from raw object: ${itemDataResult.error.message}`,
        });
      }
    }

    // No valid data found, return null (will be filtered out)
    return ok(null);
  }

  /**
   * Create metadata about the schema processing results.
   * Provides information about what was processed and extracted.
   */
  private createSchemaMetadata(
    originalData: FrontmatterData[],
    processedData: FrontmatterData[],
    schema: Schema,
  ): SchemaMetadata {
    const hasFrontmatterPart = schema.findFrontmatterPartSchema().ok;
    const frontmatterPartPathResult = schema.findFrontmatterPartPath();
    const frontmatterPartPath =
      hasFrontmatterPart && frontmatterPartPathResult.ok
        ? frontmatterPartPathResult.data
        : undefined;

    return {
      hasFrontmatterPart,
      frontmatterPartPath,
      processedCount: originalData.length,
      extractedCount: processedData.length,
    };
  }
}

// Helper function removed - using direct error object creation for simplicity
