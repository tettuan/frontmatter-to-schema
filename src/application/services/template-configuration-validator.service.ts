/**
 * Template Configuration Validator Service
 * Extracted from configuration.ts for better domain separation
 * Handles validation of template configuration following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";
import { TemplateFormat } from "../value-objects/configuration-formats.value-object.ts";
import type { TemplateConfiguration } from "../value-objects/configuration-types.value-object.ts";

/**
 * Template Configuration Validator Service - Validates template configuration
 */
export class TemplateConfigurationValidator {
  /**
   * Validate template configuration with proper type guards instead of type assertions
   */
  validateTemplateConfiguration(
    template: unknown,
  ): Result<TemplateConfiguration, DomainError & { message: string }> {
    if (!template || typeof template !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: template,
        }, "Missing or invalid 'template' configuration"),
      };
    }

    // Use type guard instead of type assertion
    if (!this.isRecord(template)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: template,
        }, "Template configuration must be an object"),
      };
    }

    if (!template.definition || typeof template.definition !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: template.definition,
        }, "Template definition is required and must be a string"),
      };
    }

    // Use Smart Constructor for format validation
    const formatValue = template.format || "handlebars";
    if (typeof formatValue !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: formatValue,
        }, "Template format must be a string"),
      };
    }

    const formatResult = TemplateFormat.create(formatValue);
    if (!formatResult.ok) {
      return formatResult;
    }

    return {
      ok: true,
      data: {
        definition: template.definition,
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
