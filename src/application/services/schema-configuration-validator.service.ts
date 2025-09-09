/**
 * Schema Configuration Validator Service
 * Extracted from configuration.ts for better domain separation
 * Handles validation of schema configuration following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";
import { SchemaFormat } from "../value-objects/configuration-formats.value-object.ts";
import type { SchemaConfiguration } from "../value-objects/configuration-types.value-object.ts";

/**
 * Schema Configuration Validator Service - Validates schema configuration
 */
export class SchemaConfigurationValidator {
  /**
   * Validate schema configuration with proper type guards instead of type assertions
   */
  validateSchemaConfiguration(
    schema: unknown,
  ): Result<SchemaConfiguration, DomainError & { message: string }> {
    if (!schema || typeof schema !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: schema,
        }, "Missing or invalid 'schema' configuration"),
      };
    }

    // Use type guard instead of type assertion
    if (!this.isRecord(schema)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: schema,
        }, "Schema configuration must be an object"),
      };
    }

    if (!schema.definition) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: schema.definition,
        }, "Schema definition is required"),
      };
    }

    if (typeof schema.definition !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: schema.definition,
        }, "Schema definition must be a string"),
      };
    }

    // Use Smart Constructor for format validation
    const formatValue = schema.format || "json";
    if (typeof formatValue !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: formatValue,
        }, "Schema format must be a string"),
      };
    }

    const formatResult = SchemaFormat.create(formatValue);
    if (!formatResult.ok) {
      return formatResult;
    }

    return {
      ok: true,
      data: {
        definition: schema.definition,
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
