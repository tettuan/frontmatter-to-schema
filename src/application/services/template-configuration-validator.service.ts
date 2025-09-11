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

    // Accept both string and TemplateFormat object for flexibility
    let formatResult: Result<TemplateFormat, DomainError>;

    if (typeof template.format === "string") {
      // Handle string format - create TemplateFormat object
      formatResult = TemplateFormat.create(template.format);
    } else if (
      template.format && typeof template.format === "object" &&
      "getValue" in template.format
    ) {
      // Handle TemplateFormat object - use directly
      formatResult = { ok: true, data: template.format as TemplateFormat };
    } else {
      // Default to handlebars if no format provided
      formatResult = TemplateFormat.create("handlebars");
    }

    if (!formatResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          formatResult.error,
          "Template format validation failed",
        ),
      };
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
