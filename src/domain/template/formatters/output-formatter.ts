import { Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";

/**
 * Output format types supported by the system
 */
export type OutputFormat = "json" | "yaml" | "markdown";

/**
 * Interface for formatting template output into different formats
 */
export interface OutputFormatter {
  /**
   * Format the given data into the target format
   * @param data - The data to format
   * @returns Result containing formatted string or error
   */
  format(data: unknown): Result<string, DomainError & { message: string }>;

  /**
   * Get the format type this formatter handles
   */
  getFormat(): OutputFormat;
}

/**
 * Abstract base class for output formatters providing common functionality
 */
export abstract class BaseFormatter implements OutputFormatter {
  abstract format(
    data: unknown,
  ): Result<string, DomainError & { message: string }>;
  abstract getFormat(): OutputFormat;

  /**
   * Validate that the data is serializable
   */
  protected isSerializable(
    data: unknown,
    visited: WeakSet<object> = new WeakSet(),
  ): boolean {
    if (data === null || data === undefined) {
      return true;
    }

    if (
      typeof data === "string" || typeof data === "number" ||
      typeof data === "boolean"
    ) {
      return true;
    }

    if (Array.isArray(data)) {
      if (visited.has(data)) {
        return false; // Circular reference detected
      }
      visited.add(data);
      return data.every((item) => this.isSerializable(item, visited));
    }

    if (typeof data === "object") {
      if (visited.has(data as object)) {
        return false; // Circular reference detected
      }
      visited.add(data as object);
      return Object.values(data as Record<string, unknown>).every((value) =>
        this.isSerializable(value, visited)
      );
    }

    return false;
  }
}
