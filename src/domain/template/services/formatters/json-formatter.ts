import { err, ok, Result } from "../../../shared/types/result.ts";
import { createError, TemplateError } from "../../../shared/types/errors.ts";

/**
 * JsonFormatter handles safe JSON serialization with proper error handling.
 * Follows Totality principles by returning Result<T,E> instead of throwing exceptions.
 */
export class JsonFormatter {
  private constructor() {}

  /**
   * Smart Constructor for JsonFormatter
   * @returns Result containing JsonFormatter instance or error
   */
  static create(): Result<JsonFormatter, TemplateError & { message: string }> {
    return ok(new JsonFormatter());
  }

  /**
   * Safely formats data as JSON string
   * @param data - Data to format as JSON
   * @param indent - Number of spaces for indentation (default: 2)
   * @returns Result containing formatted JSON string or error
   */
  format(
    data: unknown,
    indent: number = 2,
  ): Result<string, TemplateError & { message: string }> {
    try {
      const jsonString = JSON.stringify(data, null, indent);
      return ok(jsonString);
    } catch (error) {
      return err(createError({
        kind: "RenderFailed",
        message: error instanceof Error
          ? error.message
          : "JSON serialization failed",
      }));
    }
  }
}
