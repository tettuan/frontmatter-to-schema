import { Result } from "../../domain/shared/types/result.ts";
import {
  OutputFormatError,
  OutputFormatOptions,
  OutputFormatterPort,
  OutputFormatType,
} from "../ports/output-formatter-port.ts";
import { stringify as yamlStringify } from "@std/yaml";

/**
 * Default implementation of OutputFormatterPort.
 * Provides formatting for JSON, YAML, XML, and Markdown output formats.
 *
 * ## Adding a New Format
 *
 * To add support for a new format (e.g., "toml"):
 *
 * 1. Add the format to `OutputFormatType` in `output-formatter-port.ts`
 *
 * 2. Add the format to `SUPPORTED_FORMATS` array below
 *
 * 3. Add a case in the `format()` method's switch statement:
 *    ```typescript
 *    case "toml":
 *      return this.formatToml(data, mergedOptions);
 *    ```
 *
 * 4. Implement the private formatting method:
 *    ```typescript
 *    private formatToml(
 *      data: unknown,
 *      options: Required<OutputFormatOptions>,
 *    ): Result<string, OutputFormatError> {
 *      // Implementation using a TOML library
 *    }
 *    ```
 *
 * 5. Add corresponding tests in `default-output-formatter_test.ts`
 *
 * The TypeScript exhaustive check pattern (`never` type) ensures compile-time
 * errors if a format is added to the type but not handled in the switch.
 */
export class DefaultOutputFormatter implements OutputFormatterPort {
  /**
   * List of supported formats.
   * Add new formats here when extending the formatter.
   */
  private static readonly SUPPORTED_FORMATS: readonly OutputFormatType[] = [
    "json",
    "yaml",
    "xml",
    "markdown",
  ] as const;

  private static readonly DEFAULT_OPTIONS: Required<OutputFormatOptions> = {
    indent: 2,
    sortKeys: false,
    prettyPrint: true,
  };

  private constructor() {}

  /**
   * Creates a DefaultOutputFormatter instance.
   */
  static create(): Result<DefaultOutputFormatter, OutputFormatError> {
    return Result.ok(new DefaultOutputFormatter());
  }

  /**
   * Formats data to the specified output format.
   */
  format(
    data: unknown,
    format: OutputFormatType,
    options?: OutputFormatOptions,
  ): Result<string, OutputFormatError> {
    const mergedOptions = {
      ...DefaultOutputFormatter.DEFAULT_OPTIONS,
      ...options,
    };

    if (!this.isFormatSupported(format)) {
      return Result.error(
        new OutputFormatError(
          `Unsupported output format: ${format}`,
          "UNSUPPORTED_FORMAT",
          { format, supportedFormats: this.getSupportedFormats() },
        ),
      );
    }

    try {
      switch (format) {
        case "json":
          return this.formatJson(data, mergedOptions);
        case "yaml":
          return this.formatYaml(data, mergedOptions);
        case "xml":
          return this.formatXml(data, mergedOptions);
        case "markdown":
          return this.formatMarkdown(data, mergedOptions);
        default: {
          const exhaustiveCheck: never = format;
          return Result.error(
            new OutputFormatError(
              `Unhandled format: ${exhaustiveCheck}`,
              "UNHANDLED_FORMAT",
              { format },
            ),
          );
        }
      }
    } catch (error) {
      return Result.error(
        new OutputFormatError(
          `Formatting failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "FORMAT_ERROR",
          { format, error },
        ),
      );
    }
  }

  /**
   * Checks if a format is supported.
   */
  isFormatSupported(format: string): format is OutputFormatType {
    return (DefaultOutputFormatter.SUPPORTED_FORMATS as readonly string[])
      .includes(format);
  }

  /**
   * Returns the list of supported formats.
   */
  getSupportedFormats(): readonly OutputFormatType[] {
    return DefaultOutputFormatter.SUPPORTED_FORMATS;
  }

  /**
   * Formats data to JSON.
   */
  private formatJson(
    data: unknown,
    options: Required<OutputFormatOptions>,
  ): Result<string, OutputFormatError> {
    try {
      const formatted = options.prettyPrint
        ? JSON.stringify(data, null, options.indent)
        : JSON.stringify(data);
      return Result.ok(formatted);
    } catch (error) {
      return Result.error(
        new OutputFormatError(
          `JSON formatting failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "JSON_FORMAT_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Formats data to YAML using @std/yaml.
   */
  private formatYaml(
    data: unknown,
    _options: Required<OutputFormatOptions>,
  ): Result<string, OutputFormatError> {
    try {
      const formatted = yamlStringify(data as Record<string, unknown>);
      return Result.ok(formatted);
    } catch (error) {
      return Result.error(
        new OutputFormatError(
          `YAML formatting failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "YAML_FORMAT_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Formats data to XML.
   */
  private formatXml(
    data: unknown,
    options: Required<OutputFormatOptions>,
  ): Result<string, OutputFormatError> {
    try {
      const indent = " ".repeat(options.indent);
      const formatted = this.objectToXml(
        data,
        "root",
        indent,
        0,
        options.sortKeys,
      );
      return Result.ok(`<?xml version="1.0" encoding="UTF-8"?>\n${formatted}`);
    } catch (error) {
      return Result.error(
        new OutputFormatError(
          `XML formatting failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "XML_FORMAT_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Formats data to Markdown.
   */
  private formatMarkdown(
    data: unknown,
    options: Required<OutputFormatOptions>,
  ): Result<string, OutputFormatError> {
    try {
      const formatted = this.objectToMarkdown(data, 1, options.sortKeys);
      return Result.ok(formatted);
    } catch (error) {
      return Result.error(
        new OutputFormatError(
          `Markdown formatting failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "MARKDOWN_FORMAT_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Converts object to XML string recursively.
   */
  private objectToXml(
    value: unknown,
    tagName: string,
    indent: string,
    depth: number,
    sortKeys: boolean,
  ): string {
    const currentIndent = indent.repeat(depth);
    const nextIndent = indent.repeat(depth + 1);

    if (value === null || value === undefined) {
      return `${currentIndent}<${tagName}></${tagName}>`;
    }

    if (
      typeof value === "string" || typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const escaped = this.escapeXml(String(value));
      return `${currentIndent}<${tagName}>${escaped}</${tagName}>`;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `${currentIndent}<${tagName}></${tagName}>`;
      }
      const items = value.map((item, index) => {
        if (this.isObject(item)) {
          const keys = sortKeys ? Object.keys(item).sort() : Object.keys(item);
          const children = keys.map((key) =>
            this.objectToXml(item[key], key, indent, depth + 2, sortKeys)
          ).join("\n");
          return `${nextIndent}<item index="${index}">\n${children}\n${nextIndent}</item>`;
        }
        return `${nextIndent}<item index="${index}">${
          this.escapeXml(String(item))
        }</item>`;
      }).join("\n");
      return `${currentIndent}<${tagName}>\n${items}\n${currentIndent}</${tagName}>`;
    }

    if (this.isObject(value)) {
      const keys = sortKeys ? Object.keys(value).sort() : Object.keys(value);
      if (keys.length === 0) {
        return `${currentIndent}<${tagName}></${tagName}>`;
      }
      const children = keys.map((key) =>
        this.objectToXml(value[key], key, indent, depth + 1, sortKeys)
      ).join("\n");
      return `${currentIndent}<${tagName}>\n${children}\n${currentIndent}</${tagName}>`;
    }

    return `${currentIndent}<${tagName}>${
      this.escapeXml(String(value))
    }</${tagName}>`;
  }

  /**
   * Converts object to Markdown string recursively.
   */
  private objectToMarkdown(
    value: unknown,
    depth: number,
    sortKeys: boolean,
  ): string {
    const headerLevel = Math.min(depth, 6);
    const header = "#".repeat(headerLevel);

    if (value === null || value === undefined) {
      return "_null_\n";
    }

    if (
      typeof value === "string" || typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const escaped = this.escapeMarkdown(String(value));
      if (typeof value === "string" && value.includes("\n")) {
        return `\n\`\`\`\n${value}\n\`\`\`\n`;
      }
      return `${escaped}\n`;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "_empty array_\n";
      }
      const items = value.map((item, index) => {
        if (this.isObject(item)) {
          const keys = sortKeys ? Object.keys(item).sort() : Object.keys(item);
          const fields = keys.map((key) => `  **${key}**: ${item[key]}`).join(
            "\n",
          );
          return `- Item ${index}:\n${fields}`;
        }
        return `- ${String(item)}`;
      }).join("\n");
      return `${items}\n`;
    }

    if (this.isObject(value)) {
      const keys = sortKeys ? Object.keys(value).sort() : Object.keys(value);
      if (keys.length === 0) {
        return "_empty object_\n";
      }
      const sections = keys.map((key) => {
        const childValue = value[key];
        if (this.isObject(childValue) || Array.isArray(childValue)) {
          return `${header} ${key}\n\n${
            this.objectToMarkdown(childValue, depth + 1, sortKeys)
          }`;
        }
        return `**${key}**: ${
          this.objectToMarkdown(childValue, depth, sortKeys)
        }`;
      }).join("\n");
      return sections;
    }

    return `${this.escapeMarkdown(String(value))}\n`;
  }

  /**
   * Escapes XML special characters.
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Escapes Markdown special characters.
   */
  private escapeMarkdown(str: string): string {
    return str
      .replace(/\*/g, "\\*")
      .replace(/_/g, "\\_")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]")
      .replace(/`/g, "\\`");
  }

  /**
   * Type guard for plain objects.
   */
  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
