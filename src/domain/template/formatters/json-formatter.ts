import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { BaseFormatter, OutputFormat } from "./output-formatter.ts";

/**
 * JSON formatter for template output
 * Follows Totality principles with Smart Constructor pattern
 */
export class JsonFormatter extends BaseFormatter {
  private constructor() {
    super();
  }

  /**
   * Smart Constructor for JsonFormatter
   * @returns Result containing JsonFormatter instance or error
   */
  static create(): Result<JsonFormatter, TemplateError & { message: string }> {
    return ok(new JsonFormatter());
  }
  format(data: unknown): Result<string, TemplateError & { message: string }> {
    if (!this.isSerializable(data)) {
      return err(createError({
        kind: "InvalidTemplate",
        message: "Data contains non-serializable values",
      }));
    }

    try {
      const formatted = JSON.stringify(data, null, 2);
      return ok(formatted);
    } catch (error) {
      return err(createError({
        kind: "InvalidTemplate",
        message: `Failed to format as JSON: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }));
    }
  }

  getFormat(): OutputFormat {
    return "json";
  }
}
