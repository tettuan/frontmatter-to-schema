/**
 * @fileoverview FrontmatterPartProcessor - Domain Service for frontmatter part processing
 * @description Extracted from FrontmatterTransformationService to follow DDD boundaries
 * Following Frontmatter Context responsibilities for document part extraction
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../shared/services/debug-logger.ts";
import { defaultSchemaExtensionRegistry } from "../../schema/value-objects/schema-extension-registry.ts";
import {
  FrontmatterDataCreationService,
} from "../services/frontmatter-data-creation-service.ts";

/**
 * Configuration for frontmatter part processor dependencies
 * Following dependency injection pattern for DDD compliance
 */
export interface FrontmatterPartProcessorConfig {
  readonly frontmatterDataCreationService: FrontmatterDataCreationService;
  readonly debugLogger?: DebugLogger;
}

/**
 * FrontmatterPartProcessor - Domain Service for Frontmatter Context
 *
 * Responsibilities:
 * - Process frontmatter parts if schema defines x-frontmatter-part
 * - Extract specific parts from each markdown file when x-frontmatter-part is true
 * - Handle frontmatter part path resolution and data extraction
 *
 * Following DDD principles:
 * - Single responsibility: Frontmatter part processing only
 * - Domain service: Cross-aggregate operations within Frontmatter Context
 * - Totality: All methods return Result<T,E>
 */
export class FrontmatterPartProcessor {
  private constructor(
    private readonly config: FrontmatterPartProcessorConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates part processor with validated configuration
   */
  static create(
    config: FrontmatterPartProcessorConfig,
  ): Result<FrontmatterPartProcessor, DomainError & { message: string }> {
    if (!config?.frontmatterDataCreationService) {
      return err(createError({
        kind: "InitializationError",
        message:
          "FrontmatterDataCreationService is required for part processor",
      }));
    }

    return ok(new FrontmatterPartProcessor(config));
  }

  /**
   * Process frontmatter parts if schema defines x-frontmatter-part.
   * When x-frontmatter-part is true, extracts the specific part from each markdown file.
   *
   * Following Totality principles with comprehensive error handling
   */
  processFrontmatterParts(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData[], DomainError & { message: string }> {
    const extensionKey = defaultSchemaExtensionRegistry.getFrontmatterPartKey()
      .getValue();

    this.config.debugLogger?.debug(
      `Checking for ${extensionKey} schema definition`,
      createLogContext({
        operation: "frontmatter-parts",
      }),
    );

    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();
    if (!frontmatterPartSchemaResult.ok) {
      this.config.debugLogger?.debug(
        `No ${extensionKey} schema found, returning original data`,
        createLogContext({
          operation: "frontmatter-parts",
        }),
      );
      return ok(data);
    }

    // Get the path to the frontmatter part (e.g., "commands")
    const frontmatterPartPathResult = schema.findFrontmatterPartPath();
    if (!frontmatterPartPathResult.ok) {
      this.config.debugLogger?.debug(
        `No ${extensionKey} path found, returning original data`,
        createLogContext({
          operation: "frontmatter-parts",
        }),
      );
      return ok(data);
    }

    const partPath = frontmatterPartPathResult.data;
    this.config.debugLogger?.info(
      `Processing frontmatter parts at path: ${partPath}`,
      createLogContext({
        operation: "frontmatter-parts",
        inputs: `path: ${partPath}, inputCount: ${data.length}`,
      }),
    );

    const extractPartsResult = this.extractFrontmatterParts(data, partPath);
    if (!extractPartsResult.ok) {
      return extractPartsResult;
    }

    const extractedParts = extractPartsResult.data;
    const result = extractedParts.length > 0 ? extractedParts : data;

    this.config.debugLogger?.info(
      `Frontmatter parts processing complete`,
      createLogContext({
        operation: "frontmatter-parts",
        inputs:
          `inputCount: ${data.length}, extractedCount: ${extractedParts.length}`,
        decisions: extractedParts.length === 0
          ? ["returning original data"]
          : undefined,
      }),
    );

    return ok(result);
  }

  /**
   * Extract frontmatter parts from the provided data array
   * Private helper method with comprehensive error handling
   */
  private extractFrontmatterParts(
    data: FrontmatterData[],
    partPath: string,
  ): Result<FrontmatterData[], DomainError & { message: string }> {
    const extractedParts: FrontmatterData[] = [];

    // Extract the frontmatter part from each document
    for (const frontmatterData of data) {
      const extractionResult = this.extractPartFromDocument(
        frontmatterData,
        partPath,
      );

      if (extractionResult.ok && extractionResult.data !== null) {
        extractedParts.push(extractionResult.data);
      } else if (!extractionResult.ok) {
        // Log error but continue processing other documents
        this.config.debugLogger?.error(
          `Failed to extract part from document: ${extractionResult.error.message}`,
          createLogContext({
            operation: "frontmatter-part-extraction",
          }),
        );
      }
    }

    return ok(extractedParts);
  }

  /**
   * Extract frontmatter part from a single document
   * Returns null if no valid part found (not an error condition)
   */
  private extractPartFromDocument(
    frontmatterData: FrontmatterData,
    partPath: string,
  ): Result<FrontmatterData | null, DomainError & { message: string }> {
    const dataObj = frontmatterData.getData();

    this.config.debugLogger?.debug(
      `Processing document for frontmatter-part at schema path '${partPath}'`,
      createLogContext({
        operation: "frontmatter-part-extraction",
        inputs: `availableKeys: ${Object.keys(dataObj).join(", ")}`,
      }),
    );

    // For frontmatter-part processing, the individual markdown files contain
    // the data that will become items in the target array. The partPath indicates
    // where the final array will be placed in the aggregated result, NOT where
    // to extract data from individual files.
    // Therefore, we extract the entire frontmatter object from each file.

    // CRITICAL FIX for Issue #966: Apply directive processing before using frontmatter data
    // Process frontmatter data directly
    const processedFrontmatterData = frontmatterData;
    const partData = processedFrontmatterData.getData(); // Use the processed frontmatter object

    if (partData && typeof partData === "object") {
      this.config.debugLogger?.debug(
        "Found frontmatter object to extract as array item",
        createLogContext({
          operation: "frontmatter-part-extraction",
          inputs: `keys: ${Object.keys(partData).join(", ")}`,
        }),
      );

      // Each individual frontmatter object becomes one item in the target array
      const itemDataResult = this.config.frontmatterDataCreationService
        .createFromRaw(partData);

      if (itemDataResult.ok) {
        this.config.debugLogger?.debug(
          "Successfully processed frontmatter as array item",
          createLogContext({
            operation: "frontmatter-part-extraction",
          }),
        );
        return ok(itemDataResult.data);
      } else {
        this.config.debugLogger?.error(
          `Failed to process frontmatter as array item: ${itemDataResult.error.message}`,
          createLogContext({
            operation: "frontmatter-part-extraction",
          }),
        );
        return itemDataResult;
      }
    } else {
      this.config.debugLogger?.debug(
        `No valid data found at '${partPath}' (type: ${typeof partData})`,
        createLogContext({
          operation: "frontmatter-part-extraction",
        }),
      );
      return ok(null);
    }
  }
}
