/**
 * OutputFormatter Infrastructure Adapter
 *
 * Following Ports and Adapters pattern - infrastructure layer concern
 * Separates formatting responsibility from domain logic
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
// AggregatedStructure type moved inline
type AggregatedStructure = Record<string, unknown>;

// Type guard helper following Totality principle
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Output Format Types - Discriminated Union following Totality principle
 */
export type OutputFormat =
  | { kind: "json"; indent: number }
  | { kind: "yaml"; indentSize: number }
  | { kind: "xml"; pretty: boolean }
  | { kind: "csv"; delimiter: string };

/**
 * Formatted Output Value Object
 */
class FormattedOutput {
  private constructor(
    private readonly content: string,
    private readonly format: OutputFormat,
    private readonly timestamp: Date,
  ) {}

  static create(
    content: string,
    format: OutputFormat,
  ): Result<FormattedOutput, DomainError & { message: string }> {
    if (typeof content !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof content,
          expectedFormat: "string",
        }, "Output content must be a string"),
      };
    }

    if (content.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "content",
        }, "Output content cannot be empty"),
      };
    }

    return {
      ok: true,
      data: new FormattedOutput(content, format, new Date()),
    };
  }

  getContent(): string {
    return this.content;
  }

  getFormat(): OutputFormat {
    return this.format;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }
}

/**
 * OutputFormatter Infrastructure Adapter
 * Handles all output formatting concerns
 */
export class OutputFormatter {
  private constructor() {}

  /**
   * Smart Constructor following Totality principle
   */
  static create(): Result<OutputFormatter, DomainError & { message: string }> {
    return {
      ok: true,
      data: new OutputFormatter(),
    };
  }

  /**
   * Format aggregated structure to specified output format
   */
  format(
    structure: AggregatedStructure,
    format: OutputFormat,
  ): Result<FormattedOutput, DomainError & { message: string }> {
    try {
      const data = structure;
      let content: string;

      switch (format.kind) {
        case "json":
          content = this.formatToJson(data, format.indent);
          break;
        case "yaml":
          content = this.formatToYaml(data, format.indentSize);
          break;
        case "xml":
          content = this.formatToXml(data, format.pretty);
          break;
        case "csv":
          content = this.formatToCsv(data, format.delimiter);
          break;
        default: {
          // Exhaustive check - TypeScript will error if we miss a case
          const _exhaustiveCheck: never = format;
          // Return error Result instead of throwing to maintain Totality
          return {
            ok: false,
            error: createDomainError({
              kind: "InvalidFormat",
              input: String(_exhaustiveCheck),
              expectedFormat: "json, yaml, xml, csv, or toml",
            }, `Unhandled output format: ${String(_exhaustiveCheck)}`),
          };
        }
      }

      return FormattedOutput.create(content, format);
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "TemplateMappingFailed",
          template: format,
          source: structure,
        }, `Output formatting failed: ${error}`),
      };
    }
  }

  /**
   * Private helper: Format to JSON
   */
  private formatToJson(data: Record<string, unknown>, indent: number): string {
    return JSON.stringify(data, null, indent);
  }

  /**
   * Private helper: Format to YAML
   */
  private formatToYaml(
    data: Record<string, unknown>,
    indentSize: number,
  ): string {
    return this.objectToYaml(data, 0, indentSize);
  }

  /**
   * Private helper: Format to XML (basic implementation)
   */
  private formatToXml(data: Record<string, unknown>, pretty: boolean): string {
    const xml = this.objectToXml(data, "root", 0);
    return pretty ? this.prettifyXml(xml) : xml.replace(/\n\s*/g, "");
  }

  /**
   * Private helper: Format to CSV (flattened structure)
   */
  private formatToCsv(
    data: Record<string, unknown>,
    delimiter: string,
  ): string {
    const flattened = this.flattenObject(data);
    const headers = Object.keys(flattened);
    const values = Object.values(flattened).map((v) =>
      typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : String(v)
    );

    return [headers.join(delimiter), values.join(delimiter)].join("\n");
  }

  /**
   * Private helper: Convert object to YAML format
   */
  private objectToYaml(
    obj: unknown,
    depth: number,
    indentSize: number,
  ): string {
    const indent = " ".repeat(depth * indentSize);

    if (obj === null || obj === undefined) {
      return "null";
    }

    if (typeof obj === "string") {
      // Quote if contains special characters or is empty
      if (obj === "" || /[:#@!|>%&*{}[\],]/.test(obj)) {
        return `"${obj.replace(/"/g, '\\"')}"`;
      }
      return obj;
    }

    if (typeof obj === "number" || typeof obj === "boolean") {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return "[]";
      }
      return obj.map((item) =>
        `${indent}- ${this.objectToYaml(item, depth + 1, indentSize)}`
      ).join("\n");
    }

    if (typeof obj === "object" && obj !== null) {
      if (!isRecord(obj)) {
        return String(obj);
      }

      const entries = Object.entries(obj);
      if (entries.length === 0) {
        return "{}";
      }

      return entries.map(([key, value]) => {
        if (
          typeof value === "object" && value !== null && !Array.isArray(value)
        ) {
          return `${indent}${key}:\n${
            this.objectToYaml(value, depth + 1, indentSize)
          }`;
        } else {
          return `${indent}${key}: ${
            this.objectToYaml(value, depth + 1, indentSize)
          }`;
        }
      }).join("\n");
    }

    return String(obj);
  }

  /**
   * Private helper: Convert object to XML
   */
  private objectToXml(obj: unknown, tagName: string, depth: number): string {
    const indent = "  ".repeat(depth);

    if (obj === null || obj === undefined) {
      return `${indent}<${tagName} />\n`;
    }

    if (
      typeof obj === "string" || typeof obj === "number" ||
      typeof obj === "boolean"
    ) {
      return `${indent}<${tagName}>${String(obj)}</${tagName}>\n`;
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) =>
        this.objectToXml(item, `${tagName}_${index}`, depth)
      ).join("");
    }

    if (typeof obj === "object") {
      if (!isRecord(obj)) {
        return `${indent}<${tagName}>${String(obj)}</${tagName}>\n`;
      }

      const entries = Object.entries(obj);
      if (entries.length === 0) {
        return `${indent}<${tagName} />\n`;
      }

      const content = entries.map(([key, value]) =>
        this.objectToXml(value, key, depth + 1)
      ).join("");

      return `${indent}<${tagName}>\n${content}${indent}</${tagName}>\n`;
    }

    return `${indent}<${tagName}>${String(obj)}</${tagName}>\n`;
  }

  /**
   * Private helper: Prettify XML with proper indentation
   */
  private prettifyXml(xml: string): string {
    // Simple XML prettification - would use proper XML library in production
    return xml.replace(/></g, ">\n<").replace(/^\s*\n/gm, "");
  }

  /**
   * Private helper: Flatten nested object for CSV
   */
  private flattenObject(
    obj: Record<string, unknown>,
    prefix = "",
  ): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (
        value && typeof value === "object" && !Array.isArray(value) &&
        isRecord(value)
      ) {
        Object.assign(
          flattened,
          this.flattenObject(value, fullKey),
        );
      } else if (Array.isArray(value)) {
        flattened[fullKey] = `[${value.join(", ")}]`;
      } else {
        flattened[fullKey] = value;
      }
    }

    return flattened;
  }
}

/**
 * Type guards
 */
export function isFormattedOutput(value: unknown): value is FormattedOutput {
  return value instanceof FormattedOutput;
}

export function isOutputFormatter(value: unknown): value is OutputFormatter {
  return value instanceof OutputFormatter;
}
