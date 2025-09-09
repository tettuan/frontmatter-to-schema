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
import type { FileSystemRepository } from "../../../domain/repositories/file-system-repository.ts";
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
  constructor(private readonly fileSystem: FileSystemRepository) {}
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
            const statResult = await this.fileSystem.stat(trimmedFile);
            if (statResult.ok && statResult.data.isFile) {
              files.push(trimmedFile);
            }
          }
        }
        return {
          ok: true,
          data: { files, count: files.length },
        };
      }

      // Check if pattern is existing file
      const statResult = await this.fileSystem.stat(input.pattern);
      if (statResult.ok) {
        const stat = statResult.data;
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
          for await (const filePath of this.fileSystem.findFiles(dirPattern)) {
            files.push(filePath);
          }
          return {
            ok: true,
            data: { files, count: files.length },
          };
        }
      }

      // Treat as glob pattern
      for await (const filePath of this.fileSystem.findFiles(input.pattern)) {
        if (this.hasValidExtension(filePath, extensions)) {
          files.push(filePath);
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
