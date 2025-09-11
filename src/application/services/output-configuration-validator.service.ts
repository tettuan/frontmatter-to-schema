/**
 * Output Configuration Validator Service
 * Extracted from configuration.ts for better domain separation
 * Handles validation of output configuration following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";
import { OutputFormat } from "../value-objects/configuration-formats.value-object.ts";
import type { OutputConfiguration } from "../value-objects/configuration-types.value-object.ts";

/**
 * Output Configuration Validator Service - Validates output configuration
 */
export class OutputConfigurationValidator {
  /**
   * Validate output configuration with proper type guards instead of type assertions
   */
  validateOutputConfiguration(
    output: unknown,
  ): Result<OutputConfiguration, DomainError & { message: string }> {
    if (!output || typeof output !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: output,
        }, "Missing or invalid 'output' configuration"),
      };
    }

    // Use type guard instead of type assertion
    if (!this.isRecord(output)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: output,
        }, "Output configuration must be an object"),
      };
    }

    if (!output.path || typeof output.path !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: output.path,
        }, "Output path is required and must be a string"),
      };
    }

    // Accept both string and OutputFormat object for flexibility
    let formatResult: Result<OutputFormat, DomainError>;

    if (typeof output.format === "string") {
      // Handle string format - create OutputFormat object
      formatResult = OutputFormat.create(output.format);
    } else if (
      output.format && typeof output.format === "object" &&
      "getValue" in output.format
    ) {
      // Handle OutputFormat object - use directly
      formatResult = { ok: true, data: output.format as OutputFormat };
    } else {
      // Default to json if no format provided
      formatResult = OutputFormat.create("json");
    }

    if (!formatResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          formatResult.error,
          "Output format validation failed",
        ),
      };
    }

    return {
      ok: true,
      data: {
        path: output.path,
        format: formatResult.data,
      },
    };
  }

  /**
   * Type guard to check if value is a record
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
}
