/**
 * Output Formatting Services
 *
 * Infrastructure services responsible for serializing domain data to various formats.
 * These services handle the technical concerns of data serialization,
 * keeping format-specific logic out of domain entities.
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";

/**
 * Output format discriminated union
 * Eliminates string-based format selection for totality
 */
export type OutputFormat =
  | { kind: "JSON"; indent?: number }
  | { kind: "YAML"; indentSize?: number };

/**
 * Output formatter interface
 */
export interface OutputFormatter {
  format(data: unknown): Result<string, DomainError>;
  getFormatKind(): OutputFormat["kind"];
}

/**
 * JSON output formatter
 */
export class JsonOutputFormatter implements OutputFormatter {
  constructor(private readonly indent: number = 2) {}

  format(data: unknown): Result<string, DomainError> {
    try {
      return {
        ok: true,
        data: JSON.stringify(data, null, this.indent),
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "json formatting",
          error: {
            kind: "SerializationError",
            data: String(data),
            format: "JSON",
          },
        }, `JSON serialization failed: ${error}`),
      };
    }
  }

  getFormatKind(): "JSON" {
    return "JSON";
  }
}

/**
 * YAML output formatter
 */
export class YamlOutputFormatter implements OutputFormatter {
  constructor(private readonly indentSize: number = 2) {}

  format(data: unknown): Result<string, DomainError> {
    try {
      // Simple YAML formatting for basic structures
      if (Array.isArray(data)) {
        return {
          ok: true,
          data: `results:\n${
            data.map((item) => this.objectToYaml(item, 1)).join("\n")
          }`,
        };
      }

      if (typeof data === "object" && data !== null) {
        return {
          ok: true,
          data: this.objectToYaml(data, 0),
        };
      }

      return {
        ok: true,
        data: String(data),
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "yaml formatting",
          error: {
            kind: "SerializationError",
            data: String(data),
            format: "YAML",
          },
        }, `YAML serialization failed: ${error}`),
      };
    }
  }

  getFormatKind(): "YAML" {
    return "YAML";
  }

  private objectToYaml(obj: unknown, indent: number): string {
    const lines: string[] = [];
    const spaces = " ".repeat(indent * this.indentSize);

    if (Array.isArray(obj)) {
      lines.push(`${spaces}-`);
      for (const item of obj) {
        lines.push(this.objectToYaml(item, indent + 1));
      }
    } else if (typeof obj === "object" && obj !== null) {
      const entries = Object.entries(obj);
      for (const [key, value] of entries) {
        if (typeof value === "object" && value !== null) {
          lines.push(`${spaces}${key}:`);
          lines.push(this.objectToYaml(value, indent + 1));
        } else {
          lines.push(`${spaces}${key}: ${this.formatValue(value)}`);
        }
      }
    } else {
      lines.push(`${spaces}${this.formatValue(obj)}`);
    }

    return lines.join("\n");
  }

  private formatValue(value: unknown): string {
    if (typeof value === "string") {
      // Simple string escaping for YAML
      if (value.includes(":") || value.includes("\n") || value.includes("'")) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    return String(value);
  }
}

/**
 * Factory for creating output formatters
 * Implements totality principle with exhaustive pattern matching
 */
export class OutputFormatterFactory {
  static createFormatter(format: OutputFormat): OutputFormatter {
    switch (format.kind) {
      case "JSON":
        return new JsonOutputFormatter(format.indent);
      case "YAML":
        return new YamlOutputFormatter(format.indentSize);
    }
  }

  static fromString(
    formatString: string,
  ): Result<OutputFormat, DomainError> {
    switch (formatString.toLowerCase()) {
      case "json":
        return { ok: true, data: { kind: "JSON", indent: 2 } };
      case "yaml":
      case "yml":
        return { ok: true, data: { kind: "YAML", indentSize: 2 } };
      default:
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: formatString,
            expectedFormat: "json or yaml",
          }, `Unsupported output format: ${formatString}`),
        };
    }
  }
}

/**
 * Multi-format output service
 * Provides high-level formatting with format detection
 */
export class MultiFormatOutputService {
  format(
    data: unknown,
    format: OutputFormat,
  ): Result<string, DomainError> {
    const formatter = OutputFormatterFactory.createFormatter(format);
    return formatter.format(data);
  }

  formatWithString(
    data: unknown,
    formatString: string,
  ): Result<string, DomainError> {
    const formatResult = OutputFormatterFactory.fromString(formatString);
    if (!formatResult.ok) {
      return formatResult;
    }

    return this.format(data, formatResult.data);
  }

  getSupportedFormats(): OutputFormat["kind"][] {
    return ["JSON", "YAML"];
  }
}
