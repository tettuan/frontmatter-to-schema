import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { BaseFormatter, OutputFormat } from "./output-formatter.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";

/**
 * Markdown formatter for template output
 * Follows Totality principles with Smart Constructor pattern
 */
export class MarkdownFormatter extends BaseFormatter {
  private constructor() {
    super();
  }

  /**
   * Smart Constructor for MarkdownFormatter
   * @returns Result containing MarkdownFormatter instance or error
   */
  static create(): Result<
    MarkdownFormatter,
    TemplateError & { message: string }
  > {
    return ok(new MarkdownFormatter());
  }
  format(data: unknown): Result<string, TemplateError & { message: string }> {
    if (!this.isSerializable(data)) {
      return err(createError({
        kind: "InvalidTemplate",
        message: "Data contains non-serializable values",
      }));
    }

    try {
      const formatted = this.toMarkdown(data, 1);
      return ok(formatted);
    } catch (error) {
      return err(createError({
        kind: "InvalidTemplate",
        message: `Failed to format as Markdown: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }));
    }
  }

  getFormat(): OutputFormat {
    return "markdown";
  }

  private toMarkdown(data: unknown, depth: number = 1): string {
    if (data === null || data === undefined) {
      return "";
    }

    if (typeof data === "string") {
      return data;
    }

    if (typeof data === "number" || typeof data === "boolean") {
      return String(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => {
        if (typeof item === "object" && item !== null) {
          return this.toMarkdown(item, depth);
        }
        return `- ${this.toMarkdown(item, depth)}`;
      }).join("\n");
    }

    if (typeof data === "object" && data !== null) {
      const objResult = SafePropertyAccess.asRecord(data);
      if (!objResult.ok) {
        return ""; // Fail gracefully for non-object data
      }
      const obj = objResult.data;
      const lines: string[] = [];

      for (const [key, value] of Object.entries(obj)) {
        const heading = "#".repeat(Math.min(depth, 6)) +
          ` ${this.formatKey(key)}`;
        lines.push(heading);
        lines.push("");

        if (Array.isArray(value)) {
          const listItems = value.map((item) => {
            if (typeof item === "object" && item !== null) {
              const subContent = this.toMarkdown(item, depth + 1);
              return subContent.split("\n").map((line) => `  ${line}`).join(
                "\n",
              );
            }
            return `- ${this.toMarkdown(item, depth + 1)}`;
          });
          lines.push(listItems.join("\n"));
        } else if (typeof value === "object" && value !== null) {
          lines.push(this.toMarkdown(value, depth + 1));
        } else {
          lines.push(this.toMarkdown(value, depth + 1));
        }

        lines.push("");
      }

      return lines.join("\n").trim();
    }

    return String(data);
  }

  private formatKey(key: string): string {
    // Convert camelCase and snake_case to title case
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }
}
