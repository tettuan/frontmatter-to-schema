/**
 * Discover Files Use Case
 *
 * Responsible for finding Markdown files matching input patterns
 * Part of the File Management Context in DDD
 * Follows Totality principles with Result types
 */

import type { UseCase } from "../base.usecase.ts";
import type { DomainError, Result } from "../../../domain/core/result.ts";
import { createDomainError } from "../../../domain/core/result.ts";
import { expandGlob } from "jsr:@std/fs@1.0.8/expand-glob";
import * as path from "jsr:@std/path@1.0.9";

/**
 * Input for file discovery
 */
export interface DiscoverFilesInput {
  pattern: string;
  extensions?: string[];
}

/**
 * Output from file discovery
 */
export interface DiscoverFilesOutput {
  files: string[];
  count: number;
}

/**
 * Discover Files Use Case Implementation
 * Handles file pattern matching and discovery
 */
export class DiscoverFilesUseCase
  implements UseCase<DiscoverFilesInput, DiscoverFilesOutput> {
  async execute(
    input: DiscoverFilesInput,
  ): Promise<Result<DiscoverFilesOutput, DomainError & { message: string }>> {
    try {
      const files: string[] = [];
      const extensions = input.extensions || [".md"];

      // Handle comma-separated file list
      if (input.pattern.includes(",")) {
        const fileList = input.pattern.split(",");
        for (const file of fileList) {
          const trimmedFile = file.trim();
          if (this.hasValidExtension(trimmedFile, extensions)) {
            try {
              const stat = await Deno.stat(trimmedFile);
              if (stat.isFile) {
                files.push(trimmedFile);
              }
            } catch {
              // File doesn't exist, skip
            }
          }
        }
        return {
          ok: true,
          data: { files, count: files.length },
        };
      }

      // Check if pattern is existing file
      try {
        const stat = await Deno.stat(input.pattern);
        if (stat.isFile && this.hasValidExtension(input.pattern, extensions)) {
          return {
            ok: true,
            data: { files: [input.pattern], count: 1 },
          };
        } else if (stat.isDirectory) {
          // Directory: find all matching files recursively
          const dirPattern = path.join(
            input.pattern,
            `**/*{${extensions.join(",")}}`,
          );
          for await (const entry of expandGlob(dirPattern)) {
            if (entry.isFile) {
              files.push(entry.path);
            }
          }
          return {
            ok: true,
            data: { files, count: files.length },
          };
        }
      } catch {
        // Not a file or directory, treat as glob
      }

      // Treat as glob pattern
      for await (const entry of expandGlob(input.pattern)) {
        if (entry.isFile && this.hasValidExtension(entry.path, extensions)) {
          files.push(entry.path);
        }
      }

      return {
        ok: true,
        data: { files, count: files.length },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "FileDiscoveryFailed",
            directory: ".",
            pattern: input.pattern,
          },
          `Failed to scan files: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  private hasValidExtension(filePath: string, extensions: string[]): boolean {
    return extensions.some((ext) => filePath.endsWith(ext));
  }
}
