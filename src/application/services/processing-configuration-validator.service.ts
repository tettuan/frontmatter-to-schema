/**
 * Processing Configuration Validator Service
 * Extracted from configuration.ts for better domain separation
 * Handles validation of processing configuration following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";
import type { ProcessingConfiguration } from "../value-objects/configuration-types.value-object.ts";

/**
 * Processing Configuration Validator Service - Validates processing configuration
 */
export class ProcessingConfigurationValidator {
  /**
   * Validate processing configuration with proper type guards instead of type assertions
   */
  validateProcessingConfiguration(
    processing: unknown,
  ): Result<ProcessingConfiguration, DomainError & { message: string }> {
    // Processing is optional, default to BasicProcessing if not provided
    if (!processing) {
      return {
        ok: true,
        data: { kind: "BasicProcessing" },
      };
    }

    if (typeof processing !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: processing,
        }, "Processing configuration must be an object"),
      };
    }

    // Use type guard instead of type assertion
    if (!this.isRecord(processing)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: processing,
        }, "Processing configuration must be an object"),
      };
    }

    // Determine processing configuration type based on provided properties
    const hasExtractionPrompt = processing.extractionPrompt &&
      typeof processing.extractionPrompt === "string";
    const hasMappingPrompt = processing.mappingPrompt &&
      typeof processing.mappingPrompt === "string";
    const hasParallel = processing.parallel === true;
    const hasContinueOnError = typeof processing.continueOnError === "boolean";

    // Use discriminated union based on provided configuration
    if (
      hasExtractionPrompt && hasMappingPrompt && hasParallel &&
      hasContinueOnError
    ) {
      // Already validated these values exist and have correct types
      const extractionPrompt = this.getStringValue(
        processing,
        "extractionPrompt",
      );
      const mappingPrompt = this.getStringValue(processing, "mappingPrompt");
      const continueOnError = this.getBooleanValue(
        processing,
        "continueOnError",
      );

      if (
        !extractionPrompt || !mappingPrompt || continueOnError === undefined
      ) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ConfigurationError",
            config: processing,
          }, "Invalid processing configuration values"),
        };
      }

      return {
        ok: true,
        data: {
          kind: "FullCustom",
          extractionPrompt,
          mappingPrompt,
          parallel: true,
          continueOnError,
        },
      };
    } else if (hasExtractionPrompt && hasMappingPrompt) {
      const extractionPrompt = this.getStringValue(
        processing,
        "extractionPrompt",
      );
      const mappingPrompt = this.getStringValue(processing, "mappingPrompt");

      if (!extractionPrompt || !mappingPrompt) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ConfigurationError",
            config: processing,
          }, "Invalid prompt configuration values"),
        };
      }

      return {
        ok: true,
        data: {
          kind: "CustomPrompts",
          extractionPrompt,
          mappingPrompt,
        },
      };
    } else if (hasParallel && hasContinueOnError) {
      const continueOnError = this.getBooleanValue(
        processing,
        "continueOnError",
      );

      if (continueOnError === undefined) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ConfigurationError",
            config: processing,
          }, "Invalid parallel processing configuration values"),
        };
      }

      return {
        ok: true,
        data: {
          kind: "ParallelProcessing",
          parallel: true,
          continueOnError,
        },
      };
    } else {
      // Default to BasicProcessing for any other combination
      return {
        ok: true,
        data: { kind: "BasicProcessing" },
      };
    }
  }

  /**
   * Type guard to check if value is a record
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  /**
   * Safely extract string value from record
   */
  private getStringValue(
    record: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = record[key];
    return typeof value === "string" ? value : undefined;
  }

  /**
   * Safely extract boolean value from record
   */
  private getBooleanValue(
    record: Record<string, unknown>,
    key: string,
  ): boolean | undefined {
    const value = record[key];
    return typeof value === "boolean" ? value : undefined;
  }
}
