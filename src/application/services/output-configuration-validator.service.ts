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

    // Use Smart Constructor for format validation
    const formatValue = output.format || "json";
    if (typeof formatValue !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: formatValue,
        }, "Output format must be a string"),
      };
    }

    const formatResult = OutputFormat.create(formatValue);
    if (!formatResult.ok) {
      return formatResult;
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
