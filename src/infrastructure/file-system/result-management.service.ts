/**
 * Result Management Service
 *
 * Handles result file operations including saving and appending results
 * Part of the Infrastructure Layer - File System operations
 * Follows Totality principles with Result types
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import type { OutputPath } from "../../domain/models/value-objects.ts";
import type {
  AggregatedResult,
  AnalysisResult,
} from "../../domain/models/entities.ts";

/**
 * Output format types for result serialization
 */
type OutputFormat = "json" | "yaml" | "csv" | "txt";

/**
 * Service for result file operations
 * Encapsulates result persistence and file management
 */
export class ResultManagementService {
  /**
   * Save results to output file
   */
  async saveResults(
    results: AggregatedResult | AnalysisResult | unknown,
    path: OutputPath,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      const outputPath = path.getValue();
      const format = this.determineOutputFormat(outputPath);

      // Serialize results based on format
      const serializeResult = this.serializeResults(results, format);
      if (!serializeResult.ok) {
        return serializeResult;
      }

      // Write to file
      return await this.writeToFile(outputPath, serializeResult.data);
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path: path.getValue(),
          details: _error instanceof Error ? _error.message : "Unknown error",
        }, `Failed to save results: ${path.getValue()}`),
      };
    }
  }

  /**
   * Append results to existing output file
   */
  async appendResults(
    results: AggregatedResult | AnalysisResult | unknown,
    path: OutputPath,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      const outputPath = path.getValue();
      const format = this.determineOutputFormat(outputPath);

      // For JSON and YAML, we need to read existing content and merge
      if (format === "json" || format === "yaml") {
        return await this.appendStructuredResults(results, outputPath, format);
      }

      // For text formats, simple append
      const serializeResult = this.serializeResults(results, format);
      if (!serializeResult.ok) {
        return serializeResult;
      }

      return await this.appendToFile(outputPath, serializeResult.data);
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path: path.getValue(),
          details: _error instanceof Error ? _error.message : "Unknown error",
        }, `Failed to append results: ${path.getValue()}`),
      };
    }
  }

  /**
   * Check if output file exists
   */
  async fileExists(path: OutputPath): Promise<boolean> {
    try {
      await Deno.stat(path.getValue());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Determine output format from file extension
   */
  private determineOutputFormat(outputPath: string): OutputFormat {
    const extension = outputPath.split(".").pop()?.toLowerCase() || "";

    switch (extension) {
      case "json":
        return "json";
      case "yaml":
      case "yml":
        return "yaml";
      case "csv":
        return "csv";
      case "txt":
      case "md":
        return "txt";
      default:
        return "json"; // Default format
    }
  }

  /**
   * Serialize results based on output format
   */
  private serializeResults(
    results: unknown,
    format: OutputFormat,
  ): Result<string, DomainError & { message: string }> {
    try {
      switch (format) {
        case "json":
          return { ok: true, data: JSON.stringify(results, null, 2) };

        case "yaml":
          // Basic YAML serialization - could be enhanced with proper YAML library
          return { ok: true, data: this.toYamlString(results) };

        case "csv":
          return this.toCsvString(results);

        case "txt":
          return { ok: true, data: this.toTextString(results) };

        default:
          return {
            ok: false,
            error: createDomainError({
              kind: "InvalidFormat",
              input: format,
              expectedFormat: "json, yaml, csv, or txt",
            }, `Unsupported output format: ${format}`),
          };
      }
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SerializationError",
          data: "result serialization",
          format: format,
        }, `Failed to serialize results as ${format}`),
      };
    }
  }

  /**
   * Write content to file
   */
  private async writeToFile(
    filePath: string,
    content: string,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      await Deno.writeTextFile(filePath, content);
      return { ok: true, data: undefined };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path: filePath,
          details: _error instanceof Error ? _error.message : "Unknown error",
        }, `Failed to write file: ${filePath}`),
      };
    }
  }

  /**
   * Append content to file
   */
  private async appendToFile(
    filePath: string,
    content: string,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      const file = await Deno.open(filePath, {
        write: true,
        create: true,
        append: true,
      });
      const encoder = new TextEncoder();
      await file.write(encoder.encode(content + "\n"));
      file.close();
      return { ok: true, data: undefined };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path: filePath,
          details: _error instanceof Error ? _error.message : "Unknown error",
        }, `Failed to append to file: ${filePath}`),
      };
    }
  }

  /**
   * Append structured results (JSON/YAML) by merging with existing content
   */
  private async appendStructuredResults(
    results: unknown,
    outputPath: string,
    format: OutputFormat,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      let existingData: unknown = null;

      // Try to read existing file
      try {
        const existingContent = await Deno.readTextFile(outputPath);
        if (format === "json") {
          existingData = JSON.parse(existingContent);
        } else {
          // Basic YAML parsing would need proper library
          existingData = null; // For now, just overwrite
        }
      } catch {
        // File doesn't exist or is invalid, start fresh
        existingData = null;
      }

      // Merge results
      let mergedResults: unknown;
      if (Array.isArray(existingData) && Array.isArray(results)) {
        mergedResults = [...existingData, ...results];
      } else if (
        existingData && typeof existingData === "object" && results &&
        typeof results === "object"
      ) {
        mergedResults = { ...existingData, ...results };
      } else {
        // If can't merge, wrap in array
        mergedResults = existingData ? [existingData, results] : results;
      }

      // Serialize and write
      const serializeResult = this.serializeResults(mergedResults, format);
      if (!serializeResult.ok) {
        return serializeResult;
      }

      return await this.writeToFile(outputPath, serializeResult.data);
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path: outputPath,
          details: _error instanceof Error ? _error.message : "Unknown error",
        }, `Failed to append structured results: ${outputPath}`),
      };
    }
  }

  /**
   * Convert to YAML string (basic implementation)
   */
  private toYamlString(obj: unknown): string {
    // Very basic YAML serialization - could be enhanced with proper library
    return JSON.stringify(obj, null, 2).replace(/"/g, "");
  }

  /**
   * Convert to CSV string
   */
  private toCsvString(
    results: unknown,
  ): Result<string, DomainError & { message: string }> {
    if (!Array.isArray(results)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof results,
          expectedFormat: "array",
        }, "Cannot convert non-array data to CSV"),
      };
    }

    if (results.length === 0) {
      return { ok: true, data: "" };
    }

    try {
      // Get headers from first object
      const firstItem = results[0];
      if (typeof firstItem !== "object" || firstItem === null) {
        return { ok: true, data: results.join("\n") };
      }

      const headers = Object.keys(firstItem as Record<string, unknown>);
      const csvLines = [headers.join(",")];

      // Convert each row
      for (const item of results) {
        if (typeof item === "object" && item !== null) {
          const row = headers.map((header) => {
            const value = (item as Record<string, unknown>)[header];
            return typeof value === "string" ? `"${value}"` : String(value);
          });
          csvLines.push(row.join(","));
        }
      }

      return { ok: true, data: csvLines.join("\n") };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SerializationError",
          data: "CSV conversion",
          format: "csv",
        }, "Failed to convert to CSV"),
      };
    }
  }

  /**
   * Convert to text string
   */
  private toTextString(results: unknown): string {
    if (typeof results === "string") {
      return results;
    }
    if (typeof results === "object") {
      return JSON.stringify(results, null, 2);
    }
    return String(results);
  }
}
