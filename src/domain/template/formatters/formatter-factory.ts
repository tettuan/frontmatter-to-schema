import { Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { OutputFormat, OutputFormatter } from "./output-formatter.ts";
import { JsonFormatter } from "./json-formatter.ts";
import { YamlFormatter } from "./yaml-formatter.ts";
import { MarkdownFormatter } from "./markdown-formatter.ts";
import { XmlFormatter } from "./xml-formatter.ts";

/**
 * Factory for creating output formatters based on format type
 */
export class FormatterFactory {
  private static readonly formatters = new Map<
    OutputFormat,
    () => Result<OutputFormatter, DomainError & { message: string }>
  >([
    ["json", () => JsonFormatter.create()],
    ["yaml", () => YamlFormatter.create()],
    ["markdown", () => MarkdownFormatter.create()],
    ["xml", () => XmlFormatter.create()],
  ]);

  /**
   * Create a formatter for the specified output format
   * @param format - The output format
   * @returns Result containing the formatter or error
   */
  static createFormatter(
    format: OutputFormat,
  ): Result<OutputFormatter, DomainError & { message: string }> {
    const formatterFactory = this.formatters.get(format);

    if (!formatterFactory) {
      return ErrorHandler.template({
        operation: "createFormatter",
        method: "validateFormat",
      }).invalid(`Unsupported output format: ${format}`);
    }

    return formatterFactory();
  }

  /**
   * Get all supported output formats
   */
  static getSupportedFormats(): OutputFormat[] {
    return Array.from(this.formatters.keys());
  }

  /**
   * Check if a format is supported
   */
  static isFormatSupported(format: string): format is OutputFormat {
    // Safe type checking without type assertion
    return format === "json" || format === "yaml" || format === "markdown" ||
      format === "xml";
  }
}
