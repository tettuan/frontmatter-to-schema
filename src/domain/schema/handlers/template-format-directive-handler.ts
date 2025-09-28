/**
 * @fileoverview x-template-format Directive Handler
 * @description Handles output format specification for templates
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../entities/schema.ts";
import {
  BaseDirectiveHandler,
  DirectiveConfig,
  DirectiveHandlerError,
  DirectiveHandlerFactory,
  DirectiveProcessingResult,
  LegacySchemaProperty,
} from "../interfaces/directive-handler.ts";

/**
 * Supported output formats
 */
export type TemplateFormat = "json" | "yaml" | "markdown" | "xml";

/**
 * Configuration for x-template-format directive
 */
interface TemplateFormatConfig {
  format: TemplateFormat;
}

/**
 * Metadata for template format processing
 */
interface TemplateFormatMetadata {
  format: TemplateFormat;
  formatApplied: boolean;
}

/**
 * Handler for x-template-format directive
 * Specifies the output format for template rendering
 */
export class TemplateFormatDirectiveHandler extends BaseDirectiveHandler<
  TemplateFormatConfig,
  TemplateFormatMetadata
> {
  private static readonly SUPPORTED_FORMATS: readonly TemplateFormat[] = [
    "json",
    "yaml",
    "markdown",
    "xml",
  ];

  constructor() {
    super("x-template-format", 50, ["x-template", "x-template-items"]); // Priority 50 - processes after template directives
  }

  extractConfig(
    schema: LegacySchemaProperty,
  ): Result<DirectiveConfig<TemplateFormatConfig>, DirectiveHandlerError> {
    const templateFormat = schema["x-template-format"];

    if (!templateFormat) {
      // Default to JSON if not specified
      return DirectiveHandlerFactory.createConfig(
        this.directiveName,
        { format: "json" },
        false,
      );
    }

    if (!this.isValidFormat(templateFormat)) {
      return err({
        kind: "ValidationError",
        directiveName: this.directiveName,
        message: `x-template-format must be one of: ${
          TemplateFormatDirectiveHandler.SUPPORTED_FORMATS.join(", ")
        }`,
        invalidValue: templateFormat,
      });
    }

    return DirectiveHandlerFactory.createConfig(
      this.directiveName,
      { format: templateFormat },
      true,
    );
  }

  processData(
    data: FrontmatterData,
    config: DirectiveConfig<TemplateFormatConfig>,
    _schema: Schema,
  ): Result<
    DirectiveProcessingResult<TemplateFormatMetadata>,
    DirectiveHandlerError
  > {
    // The format directive doesn't modify data, just adds metadata for rendering
    const metadata: TemplateFormatMetadata = {
      format: config.configuration.format,
      formatApplied: config.isPresent,
    };

    // Store format in data as metadata for template renderer
    const processedDataMap = new Map(Object.entries(data.getData()));

    // Add format metadata to be used by template renderer
    if (config.isPresent) {
      processedDataMap.set("__template_format__", config.configuration.format);
    }

    // Create new FrontmatterData with format metadata
    const processedDataResult = FrontmatterData.create(
      Object.fromEntries(processedDataMap),
    );

    if (!processedDataResult.ok) {
      return err({
        kind: "ProcessingError",
        directiveName: this.directiveName,
        message: "Failed to create processed frontmatter data",
        cause: processedDataResult.error,
      });
    }

    return DirectiveHandlerFactory.createResult(
      this.directiveName,
      processedDataResult.data,
      metadata,
    );
  }

  extractExtension(
    schema: LegacySchemaProperty,
  ): Result<{ key: string; value: unknown } | null, DirectiveHandlerError> {
    const templateFormat = schema["x-template-format"];

    if (!templateFormat) {
      return ok(null);
    }

    return ok({
      key: "x-template-format",
      value: templateFormat,
    });
  }

  /**
   * Check if a value is a valid template format
   */
  private isValidFormat(value: unknown): value is TemplateFormat {
    return (
      typeof value === "string" &&
      TemplateFormatDirectiveHandler.SUPPORTED_FORMATS.includes(
        value as TemplateFormat,
      )
    );
  }

  /**
   * Get formatter for the specified format
   * This would be used by the template renderer
   */
  static getFormatterForFormat(format: TemplateFormat): string {
    switch (format) {
      case "json":
        return "JsonFormatter";
      case "yaml":
        return "YamlFormatter";
      case "markdown":
        return "MarkdownFormatter";
      case "xml":
        return "XmlFormatter";
      default:
        return "JsonFormatter"; // Default fallback
    }
  }
}
