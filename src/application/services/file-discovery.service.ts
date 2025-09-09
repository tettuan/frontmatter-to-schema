/**
 * File Discovery Service
 * Extracted from process-documents-usecase.ts for better domain separation
 * Handles Markdown file discovery following DDD principles
 */

import type { Result } from "../../domain/core/result.ts";
import { expandGlob } from "jsr:@std/fs@1.0.8/expand-glob";
import * as path from "jsr:@std/path@1.0.9";

/**
 * File Discovery Service - Handles Markdown file pattern matching and discovery
 */
export class FileDiscoveryService {
  /**
   * Find Markdown files matching the given pattern
   */
  async findMarkdownFiles(
    inputPattern: string,
  ): Promise<Result<string[], { kind: string; message: string }>> {
    try {
      const files: string[] = [];

      // Handle direct file path vs glob pattern
      if (await this.isDirectFile(inputPattern)) {
        files.push(path.resolve(inputPattern));
      } else {
        // Use glob pattern expansion
        for await (
          const entry of expandGlob(inputPattern, {
            extended: true,
            globstar: true,
          })
        ) {
          if (entry.isFile && this.isMarkdownFile(entry.path)) {
            files.push(path.resolve(entry.path));
          }
        }
      }

      return {
        ok: true,
        data: files.sort(), // Sort for consistent ordering
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "FileDiscoveryError",
          message: error instanceof Error
            ? `Failed to discover files: ${error.message}`
            : "Failed to discover files: Unknown error",
        },
      };
    }
  }

  /**
   * Check if the given path is a direct file (not a pattern)
   */
  private async isDirectFile(inputPath: string): Promise<boolean> {
    try {
      const stat = await Deno.stat(inputPath);
      return stat.isFile && this.isMarkdownFile(inputPath);
    } catch {
      return false;
    }
  }

  /**
   * Check if file is a Markdown file based on extension
   */
  private isMarkdownFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === ".md" || ext === ".markdown";
  }
}
