/**
 * Output Writing Service
 * Extracted from process-documents-usecase.ts for better domain separation
 * Handles output file writing in various formats following DDD principles
 */

import type { Result } from "../../domain/core/result.ts";
import { getDefaultErrorMessage } from "../../domain/core/result.ts";
import type { FileSystemRepository } from "../../domain/repositories/file-system-repository.ts";
import * as yaml from "jsr:@std/yaml@1.0.9";
import * as toml from "jsr:@std/toml@1.0.1";

/**
 * Output Writing Service - Handles writing processed data to various output formats
 */
export class OutputWritingService {
  constructor(
    private readonly fileSystem: FileSystemRepository,
  ) {}

  /**
   * Write aggregated data to output file
   */
  async writeOutput(
    data: unknown[],
    outputPath: string,
    outputFormat: "json" | "yaml" | "toml",
  ): Promise<Result<void, { kind: string; message: string }>> {
    try {
      // Serialize data based on format
      const serializationResult = this.serializeData(data, outputFormat);
      if (!serializationResult.ok) {
        return serializationResult;
      }

      // Write to file using injected file system
      const writeResult = await this.fileSystem.writeFile(
        outputPath,
        serializationResult.data,
      );

      if (!writeResult.ok) {
        return {
          ok: false,
          error: {
            kind: "WriteError",
            message: `Failed to write output file: ${
              getDefaultErrorMessage(writeResult.error)
            }`,
          },
        };
      }

      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "OutputProcessingError",
          message: error instanceof Error
            ? `Failed to process output: ${error.message}`
            : "Failed to process output: Unknown error",
        },
      };
    }
  }

  /**
   * Serialize data to the specified format
   */
  private serializeData(
    data: unknown[],
    format: "json" | "yaml" | "toml",
  ): Result<string, { kind: string; message: string }> {
    try {
      switch (format) {
        case "json":
          return {
            ok: true,
            data: JSON.stringify(data, null, 2),
          };
        case "yaml":
          return {
            ok: true,
            data: yaml.stringify(data),
          };
        case "toml":
          // TOML requires the data to be wrapped in a root object
          return {
            ok: true,
            data: toml.stringify({ items: data }),
          };
        default:
          return {
            ok: false,
            error: {
              kind: "UnsupportedFormat",
              message: `Unsupported output format: ${format}`,
            },
          };
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "SerializationError",
          message: error instanceof Error
            ? `Failed to serialize data as ${format}: ${error.message}`
            : `Failed to serialize data as ${format}: Unknown error`,
        },
      };
    }
  }
}
