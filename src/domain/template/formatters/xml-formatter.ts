import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import {
  ErrorHandling,
  type OperationContext,
} from "../../shared/services/error-handling-service.ts";
import { BaseFormatter, OutputFormat } from "./output-formatter.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";

// XML error factory for ErrorHandlingService
const xmlErrorFactory = (
  message: string,
  context?: OperationContext,
): TemplateError & { message: string } => ({
  kind: "RenderFailed",
  message: context
    ? `${context.operation}.${context.method}: ${message}`
    : message,
});

/**
 * XML formatter for template output
 * Converts structured data to XML format with proper escaping
 */
export class XmlFormatter extends BaseFormatter {
  private static instance?: XmlFormatter;

  private constructor() {
    super();
  }

  static create(): Result<XmlFormatter, TemplateError & { message: string }> {
    if (!this.instance) {
      this.instance = new XmlFormatter();
    }
    return ok(this.instance);
  }

  getFormat(): OutputFormat {
    return "xml" as OutputFormat;
  }

  format(data: unknown): Result<string, TemplateError & { message: string }> {
    if (!this.isSerializable(data)) {
      return ErrorHandler.template({
        operation: "format",
        method: "validateSerializable",
      }).invalid(
        "Data contains circular references or non-serializable values",
      );
    }

    return ErrorHandling.wrapOperation(
      () => {
        const xmlContent = this.convertToXml(data, "root");
        return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlContent}`;
      },
      xmlErrorFactory,
      { operation: "format", method: "convertToXml" },
    );
  }

  private convertToXml(data: unknown, elementName: string): string {
    if (data === null || data === undefined) {
      return `<${elementName}></${elementName}>`;
    }

    if (typeof data === "string") {
      return `<${elementName}>${this.escapeXml(data)}</${elementName}>`;
    }

    if (typeof data === "number" || typeof data === "boolean") {
      return `<${elementName}>${String(data)}</${elementName}>`;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return `<${elementName}></${elementName}>`;
      }
      const items = data.map((item, index) =>
        this.convertToXml(item, `item_${index}`)
      ).join("\n");
      return `<${elementName}>\n${this.indent(items)}\n</${elementName}>`;
    }

    if (typeof data === "object") {
      const recordResult = SafePropertyAccess.asRecord(data);
      if (!recordResult.ok) {
        return `<${elementName}></${elementName}>`;
      }

      const entries = Object.entries(recordResult.data);
      if (entries.length === 0) {
        return `<${elementName}></${elementName}>`;
      }

      const elements = entries.map(([key, value]) => {
        const validKey = this.sanitizeElementName(key);
        return this.convertToXml(value, validKey);
      }).join("\n");

      return `<${elementName}>\n${this.indent(elements)}\n</${elementName}>`;
    }

    return `<${elementName}></${elementName}>`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private sanitizeElementName(name: string): string {
    // Replace invalid XML element name characters with underscores
    let sanitized = name.replace(/[^a-zA-Z0-9_.-]/g, "_");

    // Ensure it starts with letter or underscore
    if (!/^[a-zA-Z_]/.test(sanitized)) {
      sanitized = "_" + sanitized;
    }

    return sanitized;
  }

  private indent(text: string, level: number = 1): string {
    const indentation = "  ".repeat(level);
    return text.split("\n").map((line) =>
      line.trim() ? `${indentation}${line}` : line
    ).join("\n");
  }
}
