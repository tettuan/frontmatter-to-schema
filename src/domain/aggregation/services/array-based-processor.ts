/**
 * ArrayBasedProcessor Domain Service
 *
 * Implements array-based processing for multiple markdown files into a single array structure.
 * This service handles the core domain logic for collecting multiple files and transforming
 * them into a unified array following x-frontmatter-part semantics.
 *
 * Following DDD principles:
 * - Pure domain service with no infrastructure dependencies
 * - Totality principles with Result types throughout
 * - Smart Constructor pattern for value objects
 * - Discriminated unions for state management
 */

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";
import type { ArrayTarget } from "../../schema/value-objects/array-target.ts";
import type { FilePath } from "../../core/file-path.ts";

/**
 * Input data structure for processing a single file
 */
export interface FileData {
  readonly filePath: FilePath;
  readonly frontmatter: unknown;
  readonly templateApplied: boolean;
  readonly transformedData: unknown;
}

/**
 * Processing result for array-based transformation
 */
export interface ArrayProcessingResult {
  readonly arrayData: unknown[];
  readonly filesProcessed: number;
  readonly metadata: {
    readonly targetPropertyPath: string;
    readonly templateApplication: "applied" | "raw" | "mixed";
  };
}

/**
 * ArrayBasedProcessor Domain Service
 *
 * Processes multiple files into a single array structure based on ArrayTarget specification.
 * Handles template application and data transformation according to x-frontmatter-part semantics.
 */
export class ArrayBasedProcessor {
  /**
   * Smart Constructor following Totality principles
   */
  static create(): Result<
    ArrayBasedProcessor,
    DomainError & { message: string }
  > {
    return {
      ok: true,
      data: new ArrayBasedProcessor(),
    };
  }

  private constructor() {
    // Private constructor enforces Smart Constructor pattern
  }

  /**
   * Processes multiple files into array structure
   *
   * @param arrayTarget - Target array specification from schema analysis
   * @param fileData - Collection of processed file data
   * @returns Result containing array processing result or domain error
   */
  processFilesToArray(
    arrayTarget: ArrayTarget,
    fileData: readonly FileData[],
  ): Result<ArrayProcessingResult, DomainError & { message: string }> {
    // Handle empty file data gracefully
    if (fileData.length === 0) {
      return {
        ok: true,
        data: {
          arrayData: [],
          filesProcessed: 0,
          metadata: {
            targetPropertyPath: arrayTarget.getPropertyPath(),
            templateApplication: "raw",
          },
        },
      };
    }

    try {
      // Validate all file data entries
      const validationResult = this.validateFileData(fileData);
      if (!validationResult.ok) {
        return validationResult;
      }

      // Transform file data into array items
      const arrayItems: unknown[] = [];
      let templateApplicationCount = 0;
      let rawDataCount = 0;

      for (const file of fileData) {
        // Validate individual file data
        const fileValidationResult = this.validateSingleFileData(file);
        if (!fileValidationResult.ok) {
          return fileValidationResult;
        }

        // Add transformed data to array
        arrayItems.push(file.transformedData);

        // Track template application statistics
        if (file.templateApplied) {
          templateApplicationCount++;
        } else {
          rawDataCount++;
        }
      }

      // Determine template application status
      const templateApplication = this.determineTemplateApplicationStatus(
        templateApplicationCount,
        rawDataCount,
      );

      return {
        ok: true,
        data: {
          arrayData: arrayItems,
          filesProcessed: fileData.length,
          metadata: {
            targetPropertyPath: arrayTarget.getPropertyPath(),
            templateApplication,
          },
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ProcessingStageError",
            stage: "array processing",
            error: {
              kind: "ComputationError",
              expression: "array processing",
              details: error instanceof Error ? error.message : "Unknown error",
            },
          },
          `Array processing failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ),
      };
    }
  }

  /**
   * Validates the entire file data collection
   */
  private validateFileData(
    fileData: readonly FileData[],
  ): Result<void, DomainError & { message: string }> {
    // Check for null or undefined entries
    for (let i = 0; i < fileData.length; i++) {
      const file = fileData[i];
      if (!file) {
        return {
          ok: false,
          error: createDomainError(
            { kind: "EmptyInput", field: `fileData[${i}]` },
            `File data at index ${i} is null or undefined`,
          ),
        };
      }
    }

    // Check for duplicate file paths
    const seenPaths = new Set<string>();
    for (let i = 0; i < fileData.length; i++) {
      const filePath = fileData[i]?.filePath?.toString();
      if (!filePath) {
        return {
          ok: false,
          error: createDomainError(
            { kind: "InvalidPath", path: `fileData[${i}].filePath` },
            `File data at index ${i} has invalid file path`,
          ),
        };
      }

      if (seenPaths.has(filePath)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidState",
              expected: "unique file paths",
              actual: `duplicate path: ${filePath}`,
            },
            `Duplicate file path detected: ${filePath}`,
          ),
        };
      }
      seenPaths.add(filePath);
    }

    return { ok: true, data: undefined };
  }

  /**
   * Validates a single file data entry
   */
  private validateSingleFileData(
    file: FileData,
  ): Result<void, DomainError & { message: string }> {
    // Validate required properties
    if (!file.filePath) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput", field: "filePath" },
          "File data must have a valid filePath",
        ),
      };
    }

    if (file.frontmatter === undefined) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "MissingRequiredField", fields: ["frontmatter"] },
          "File data must have frontmatter property (can be null)",
        ),
      };
    }

    if (file.transformedData === undefined) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "MissingRequiredField", fields: ["transformedData"] },
          "File data must have transformedData property",
        ),
      };
    }

    if (typeof file.templateApplied !== "boolean") {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(file.templateApplied),
            expectedFormat: "boolean",
          },
          "File data must have boolean templateApplied property",
        ),
      };
    }

    return { ok: true, data: undefined };
  }

  /**
   * Determines template application status based on statistics
   */
  private determineTemplateApplicationStatus(
    templateCount: number,
    rawCount: number,
  ): "applied" | "raw" | "mixed" {
    if (templateCount > 0 && rawCount > 0) {
      return "mixed";
    } else if (templateCount > 0) {
      return "applied";
    } else {
      return "raw";
    }
  }

  /**
   * Creates array structure following x-frontmatter-part semantics
   *
   * This method handles the domain logic for wrapping array items in the proper
   * schema structure as specified by the ArrayTarget.
   */
  createArrayStructure(
    arrayTarget: ArrayTarget,
    arrayData: unknown[],
    baseStructure: Record<string, unknown> = {},
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    try {
      // Create a copy of the base structure to avoid mutation
      const result = { ...baseStructure };

      // Set the array data at the target property path
      const propertyPath = arrayTarget.getPropertyPath();

      // For simple property paths (no dots), directly assign
      if (!propertyPath.includes(".")) {
        result[propertyPath] = arrayData;
        return { ok: true, data: result };
      }

      // For nested property paths, create nested structure
      const pathParts = propertyPath.split(".");
      let current: Record<string, unknown> = result;

      // Navigate/create nested structure up to the last part
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (
          !(part in current) || typeof current[part] !== "object" ||
          current[part] === null
        ) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }

      // Set the array data at the final property
      const finalProperty = pathParts[pathParts.length - 1];
      current[finalProperty] = arrayData;

      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ProcessingStageError",
            stage: "array structure creation",
            error: {
              kind: "ComputationError",
              expression: "array structure",
              details: error instanceof Error ? error.message : "Unknown error",
            },
          },
          `Failed to create array structure: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ),
      };
    }
  }
}
