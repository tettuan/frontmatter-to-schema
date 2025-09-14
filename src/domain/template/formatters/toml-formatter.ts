import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { BaseFormatter, OutputFormat } from "./output-formatter.ts";

/**
 * TOML formatter for template output
 */
export class TomlFormatter extends BaseFormatter {
  format(data: unknown): Result<string, DomainError & { message: string }> {
    if (!this.isSerializable(data)) {
      return err(createError({
        kind: "InvalidTemplate",
        message: "Data contains non-serializable values",
      }));
    }

    try {
      const formatted = this.toToml(data);
      return ok(formatted);
    } catch (error) {
      return err(createError({
        kind: "InvalidTemplate",
        message: `Failed to format as TOML: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }));
    }
  }

  getFormat(): OutputFormat {
    return "toml";
  }

  private toToml(data: unknown): string {
    if (data === null) {
      return "null";
    }

    if (data === undefined) {
      return "";
    }

    if (typeof data === "string") {
      return `"${this.escapeTomlString(data)}"`;
    }

    if (typeof data === "number" || typeof data === "boolean") {
      return String(data);
    }

    if (Array.isArray(data)) {
      const items = data.map((item) => this.toToml(item)).join(", ");
      return `[${items}]`;
    }

    if (typeof data === "object" && data !== null) {
      const obj = data as Record<string, unknown>;
      const lines: string[] = [];

      // Handle simple key-value pairs first
      const simpleEntries = Object.entries(obj).filter(([_, value]) =>
        typeof value !== "object" || value === null
      );

      for (const [key, value] of simpleEntries) {
        lines.push(`${key} = ${this.toToml(value)}`);
      }

      // Handle nested objects as sections
      const complexEntries = Object.entries(obj).filter(([_, value]) =>
        typeof value === "object" && value !== null && !Array.isArray(value)
      );

      for (const [key, value] of complexEntries) {
        if (lines.length > 0) {
          lines.push(""); // Add empty line before section
        }
        lines.push(`[${key}]`);
        const nested = this.toToml(value);
        if (nested) {
          lines.push(nested);
        }
      }

      // Handle arrays of objects as array of tables
      const arrayEntries = Object.entries(obj).filter(([_, value]) =>
        Array.isArray(value) &&
        value.some((item) => typeof item === "object" && item !== null)
      );

      for (const [key, value] of arrayEntries) {
        const array = value as unknown[];
        for (const item of array) {
          if (typeof item === "object" && item !== null) {
            if (lines.length > 0) {
              lines.push(""); // Add empty line before array table
            }
            lines.push(`[[${key}]]`);
            const nested = this.toToml(item);
            if (nested) {
              lines.push(nested);
            }
          }
        }
      }

      return lines.join("\n");
    }

    return String(data);
  }

  private escapeTomlString(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  }
}
