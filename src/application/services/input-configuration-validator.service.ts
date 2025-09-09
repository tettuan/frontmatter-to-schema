/**
 * Input Configuration Validator Service
 * Extracted from configuration.ts for better domain separation
 * Handles validation of input configuration following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";
import type { InputConfiguration } from "../value-objects/configuration-types.value-object.ts";

/**
 * Input Configuration Validator Service - Validates input configuration
 */
export class InputConfigurationValidator {
  /**
   * Validate input configuration with proper type guards instead of type assertions
   */
  validateInputConfiguration(
    input: unknown,
  ): Result<InputConfiguration, DomainError & { message: string }> {
    if (!input || typeof input !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: input,
        }, "Missing or invalid 'input' configuration"),
      };
    }

    // Use type guard instead of type assertion
    if (!this.isRecord(input)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: input,
        }, "Input configuration must be an object"),
      };
    }

    if (!input.path || typeof input.path !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: input.path,
        }, "Input path is required and must be a string"),
      };
    }

    // Use discriminated union based on presence of pattern
    if (input.pattern && typeof input.pattern === "string") {
      return {
        ok: true,
        data: {
          kind: "DirectoryInput",
          path: input.path,
          pattern: input.pattern,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: "FileInput",
        path: input.path,
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
