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
 * File Extensions Value Object (Totality Pattern)
 * Eliminates hardcoded defaults, provides general solution
 */
class FileExtensions {
  private constructor(private readonly extensions: string[]) {}

  static create(
    extensions?: string[],
  ): Result<FileExtensions, DomainError & { message: string }> {
    // Totality: No hardcoded defaults - require explicit configuration
    if (!extensions || extensions.length === 0) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ConfigurationError",
            config: { extensions },
          },
          "File extensions must be explicitly specified for discovery",
        ),
      };
    }

    // Validate all extensions start with dot
    const invalidExtensions = extensions.filter((ext) => !ext.startsWith("."));
    if (invalidExtensions.length > 0) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: invalidExtensions.join(", "),
            expectedFormat: "extensions starting with '.'",
          },
          `Invalid file extensions: ${invalidExtensions.join(", ")}`,
        ),
      };
    }

    return {
      ok: true,
      data: new FileExtensions(extensions),
    };
  }

  /**
   * Create with common document extensions
   * Provides explicit defaults rather than hidden hardcoding
   */
  static createWithDocumentDefaults(): FileExtensions {
    return new FileExtensions([".md", ".mdx", ".markdown"]);
  }

  getExtensions(): string[] {
    return [...this.extensions];
  }

  matches(filePath: string): boolean {
    return this.extensions.some((ext) => filePath.endsWith(ext));
  }
}

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

      // Totality: Use explicit configuration instead of hardcoded defaults
      const fileExtensions = input.extensions
        ? FileExtensions.create(input.extensions)
        : {
          ok: true as const,
          data: FileExtensions.createWithDocumentDefaults(),
        };

      if (!fileExtensions.ok) {
        return fileExtensions;
      }

      // Handle comma-separated file list
      if (input.pattern.includes(",")) {
        const fileList = input.pattern.split(",");
        for (const file of fileList) {
          const trimmedFile = file.trim();
          if (fileExtensions.data.matches(trimmedFile)) {
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
        if (stat.isFile && fileExtensions.data.matches(input.pattern)) {
          return {
            ok: true,
            data: { files: [input.pattern], count: 1 },
          };
        } else if (stat.isDirectory) {
          // Directory: find all matching files recursively
          const dirPattern = path.join(
            input.pattern,
            `**/*{${fileExtensions.data.getExtensions().join(",")}}`,
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
        if (fileExtensions.data.matches(filePath)) {
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
}
