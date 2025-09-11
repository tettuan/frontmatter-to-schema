/**
 * Document Reader Service
 *
 * Handles file content reading and basic validation
 * Part of the File Management Context (Infrastructure Layer)
 * Follows Totality principles with Result types
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import { VerboseLoggerService } from "../services/verbose-logger-service.ts";

/**
 * Result of reading file content with metadata
 */
export interface FileContentResult {
  readonly content: string;
  readonly path: string;
}

/**
 * Service for reading file content from the file system
 */
export class DocumentReaderService {
  /**
   * Read content from a file path
   */
  async readFileContent(
    filePath: string,
  ): Promise<Result<FileContentResult, DomainError & { message: string }>> {
    VerboseLoggerService.logDebug(
      "document-reader-service",
      "Reading file",
      { path: filePath },
    );

    try {
      const content = await Deno.readTextFile(filePath);

      VerboseLoggerService.logDebug(
        "document-reader-service",
        "File read successfully",
        {
          path: filePath,
          contentLength: content.length,
        },
      );

      return {
        ok: true,
        data: {
          content,
          path: filePath,
        },
      };
    } catch (error) {
      return this.handleFileReadError(error, filePath);
    }
  }

  /**
   * Read content from multiple file paths
   */
  async readMultipleFiles(
    filePaths: string[],
  ): Promise<Result<FileContentResult[], DomainError & { message: string }>> {
    VerboseLoggerService.logInfo(
      "document-reader-service",
      "Reading multiple files",
      { fileCount: filePaths.length },
    );

    const results: FileContentResult[] = [];
    const errors: string[] = [];

    for (const filePath of filePaths) {
      const result = await this.readFileContent(filePath);
      if (result.ok) {
        results.push(result.data);
      } else {
        errors.push(`${filePath}: ${result.error.message}`);
        VerboseLoggerService.logWarn(
          "document-reader-service",
          "Failed to read file",
          {
            path: filePath,
            error: result.error.message || result.error.kind,
          },
        );
      }
    }

    VerboseLoggerService.logInfo(
      "document-reader-service",
      "Multiple file read completed",
      {
        successCount: results.length,
        errorCount: errors.length,
        totalFiles: filePaths.length,
      },
    );

    if (results.length === 0 && errors.length > 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: "multiple files",
          details: `All files failed to read: ${errors.join("; ")}`,
        }),
      };
    }

    return { ok: true, data: results };
  }

  /**
   * Handle file reading errors with proper domain error mapping
   */
  private handleFileReadError(
    error: unknown,
    filePath: string,
  ): Result<never, DomainError & { message: string }> {
    if (error instanceof Deno.errors.NotFound) {
      return {
        ok: false,
        error: createDomainError({ kind: "FileNotFound", path: filePath }),
      };
    }

    if (error instanceof Deno.errors.PermissionDenied) {
      return {
        ok: false,
        error: createDomainError({
          kind: "PermissionDenied",
          path: filePath,
          operation: "read",
        }),
      };
    }

    return {
      ok: false,
      error: createDomainError({
        kind: "ReadError",
        path: filePath,
        details: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
}
