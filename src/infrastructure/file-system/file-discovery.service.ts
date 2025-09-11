/**
 * File Discovery Service
 *
 * Handles file system traversal and pattern matching for document discovery
 * Part of the File Management Context (Infrastructure Layer)
 * Follows Totality principles with Result types
 */

import { walk } from "jsr:@std/fs@1.0.8/walk";
import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import { VerboseLoggerService } from "../services/verbose-logger-service.ts";
import type { DocumentPath } from "../../domain/models/value-objects.ts";

/**
 * Service for discovering markdown files in the file system
 */
export class FileDiscoveryService {
  /**
   * Find all markdown files matching the given path pattern
   */
  async findMarkdownFiles(
    path: DocumentPath,
  ): Promise<Result<string[], DomainError & { message: string }>> {
    const pathValue = path.getValue();

    VerboseLoggerService.logInfo(
      "file-discovery-service",
      "Starting file discovery",
      { path: pathValue },
    );

    // Extract directory from glob pattern (e.g., "dir/*.md" -> "dir")
    let dirPath = pathValue;
    if (pathValue.includes("*.md") || pathValue.includes("*.markdown")) {
      // Remove the glob pattern to get the directory
      dirPath = pathValue.replace(/\/?\*\.(md|markdown)$/, "");
      if (!dirPath) dirPath = ".";
    }

    VerboseLoggerService.logInfo(
      "file-discovery-service",
      "Resolved directory path",
      { dirPath },
    );

    try {
      // Check if path exists and is directory
      const stat = await Deno.stat(dirPath);
      if (!stat.isDirectory) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: dirPath,
            details: "Path is not a directory",
          }),
        };
      }

      return await this.walkDirectoryForMarkdownFiles(dirPath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({ kind: "FileNotFound", path: dirPath }),
        };
      }
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError({
            kind: "PermissionDenied",
            path: dirPath,
            operation: "read",
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: dirPath,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  /**
   * Find markdown files matching a regex pattern
   */
  async findByPattern(
    pattern: string,
    basePath: string = ".",
  ): Promise<Result<string[], DomainError & { message: string }>> {
    VerboseLoggerService.logInfo(
      "file-discovery-service",
      "Starting pattern-based discovery",
      { pattern, basePath },
    );

    try {
      const regex = new RegExp(pattern);
      const filePaths: string[] = [];

      for await (
        const entry of walk(basePath, {
          exts: [".md", ".markdown"],
          skip: [/node_modules/, /\.git/],
          match: [regex],
        })
      ) {
        if (entry.isFile) {
          filePaths.push(entry.path);
        }
      }

      VerboseLoggerService.logInfo(
        "file-discovery-service",
        "Pattern discovery completed",
        { foundFiles: filePaths.length },
      );

      return { ok: true, data: filePaths };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: basePath,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  /**
   * Walk through directory to find markdown files
   */
  private async walkDirectoryForMarkdownFiles(
    dirPath: string,
  ): Promise<Result<string[], DomainError & { message: string }>> {
    const filePaths: string[] = [];

    VerboseLoggerService.logInfo(
      "file-discovery-service",
      "Starting directory walk",
      { dirPath },
    );

    try {
      let fileCount = 0;
      for await (
        const entry of walk(dirPath, {
          exts: [".md", ".markdown"],
          skip: [/node_modules/, /\.git/],
        })
      ) {
        VerboseLoggerService.logDebug(
          "file-discovery-service",
          "Found entry",
          {
            path: entry.path,
            isFile: entry.isFile,
          },
        );

        if (entry.isFile) {
          fileCount++;
          filePaths.push(entry.path);

          VerboseLoggerService.logDebug(
            "file-discovery-service",
            "Added file to collection",
            {
              fileCount,
              path: entry.path,
            },
          );
        }
      }

      VerboseLoggerService.logInfo(
        "file-discovery-service",
        "Directory walk completed",
        {
          fileCount,
          totalFound: filePaths.length,
        },
      );

      return { ok: true, data: filePaths };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: dirPath,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }
}
