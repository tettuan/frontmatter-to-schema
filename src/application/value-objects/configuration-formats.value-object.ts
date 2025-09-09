/**
 * Configuration Formats Value Objects
 * Extracted from configuration.ts for better domain separation
 * Provides Smart Constructors for format validation following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";

/**
 * Schema format with exhaustive validation
 */
export class SchemaFormat {
  private constructor(private readonly value: "json" | "yaml" | "custom") {}

  static create(
    format: string,
  ): Result<SchemaFormat, DomainError & { message: string }> {
    switch (format) {
      case "json":
        return { ok: true, data: new SchemaFormat("json") };
      case "yaml":
        return { ok: true, data: new SchemaFormat("yaml") };
      case "custom":
        return { ok: true, data: new SchemaFormat("custom") };
      default:
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: format,
              expectedFormat: "json, yaml, or custom",
            },
            `Invalid schema format "${format}". Supported formats: json, yaml, custom`,
          ),
        };
    }
  }

  getValue(): "json" | "yaml" | "custom" {
    return this.value;
  }
}

/**
 * Template format with exhaustive validation
 */
export class TemplateFormat {
  private constructor(
    private readonly value: "json" | "yaml" | "handlebars" | "custom",
  ) {}

  static create(
    format: string,
  ): Result<TemplateFormat, DomainError & { message: string }> {
    switch (format) {
      case "json":
        return { ok: true, data: new TemplateFormat("json") };
      case "yaml":
        return { ok: true, data: new TemplateFormat("yaml") };
      case "handlebars":
        return { ok: true, data: new TemplateFormat("handlebars") };
      case "custom":
        return { ok: true, data: new TemplateFormat("custom") };
      default:
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: format,
              expectedFormat: "json, yaml, handlebars, or custom",
            },
            `Invalid template format "${format}". Supported formats: json, yaml, handlebars, custom`,
          ),
        };
    }
  }

  getValue(): "json" | "yaml" | "handlebars" | "custom" {
    return this.value;
  }
}

/**
 * Output format with exhaustive validation
 */
export class OutputFormat {
  private constructor(
    private readonly value: "json" | "yaml" | "xml" | "custom",
  ) {}

  static create(
    format: string,
  ): Result<OutputFormat, DomainError & { message: string }> {
    switch (format) {
      case "json":
        return { ok: true, data: new OutputFormat("json") };
      case "yaml":
        return { ok: true, data: new OutputFormat("yaml") };
      case "xml":
        return { ok: true, data: new OutputFormat("xml") };
      case "custom":
        return { ok: true, data: new OutputFormat("custom") };
      default:
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: format,
              expectedFormat: "json, yaml, xml, or custom",
            },
            `Invalid output format "${format}". Supported formats: json, yaml, xml, custom`,
          ),
        };
    }
  }

  getValue(): "json" | "yaml" | "xml" | "custom" {
    return this.value;
  }
}
