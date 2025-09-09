/**
 * Markdown Processing Service
 * Extracted from process-documents-usecase.ts for better domain separation
 * Handles individual Markdown file processing following DDD principles
 */

import type { Result } from "../../domain/core/result.ts";
import { FrontmatterExtractor } from "../../domain/services/frontmatter-extractor-v2.ts";
import * as yaml from "jsr:@std/yaml@1.0.9";
import * as toml from "jsr:@std/toml@1.0.1";

/**
 * Markdown Processing Service - Handles individual Markdown file processing
 */
export class MarkdownProcessingService {
  private readonly frontmatterExtractor: FrontmatterExtractor;

  constructor() {
    this.frontmatterExtractor = new FrontmatterExtractor();
  }

  /**
   * Process a single Markdown file
   */
  async processMarkdownFile(
    filePath: string,
    _schema: unknown, // Schema validation to be implemented in separate service
  ): Promise<Result<unknown, { kind: string; message: string }>> {
    try {
      // Read file content
      const content = await Deno.readTextFile(filePath);

      // Extract frontmatter
      const extractResult = this.frontmatterExtractor.extract(content);
      if (!extractResult.ok) {
        return {
          ok: false,
          error: {
            kind: "FrontmatterExtractionFailed",
            message: extractResult.error.message,
          },
        };
      }

      // Parse frontmatter based on format
      const frontmatter = extractResult.data;
      const parseResult = this.parseFrontmatter(
        frontmatter.content,
        frontmatter.format,
      );
      if (!parseResult.ok) {
        return parseResult;
      }

      // Add metadata
      const result = {
        ...parseResult.data as Record<string, unknown>,
        _meta: {
          filePath: filePath,
          format: frontmatter.format,
          extractedAt: new Date().toISOString(),
        },
      };

      return {
        ok: true,
        data: result,
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "FileProcessingError",
          message: error instanceof Error
            ? `Failed to process file ${filePath}: ${error.message}`
            : `Failed to process file ${filePath}: Unknown error`,
        },
      };
    }
  }

  /**
   * Parse frontmatter content based on detected format
   */
  private parseFrontmatter(
    content: string,
    format: string,
  ): Result<unknown, { kind: string; message: string }> {
    try {
      switch (format) {
        case "yaml":
          return { ok: true, data: yaml.parse(content) };
        case "json":
          return { ok: true, data: JSON.parse(content) };
        case "toml":
          return { ok: true, data: toml.parse(content) };
        default:
          return {
            ok: false,
            error: {
              kind: "UnsupportedFormat",
              message: `Unsupported frontmatter format: ${format}`,
            },
          };
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ParseError",
          message: error instanceof Error
            ? `Failed to parse ${format} frontmatter: ${error.message}`
            : `Failed to parse ${format} frontmatter: Unknown error`,
        },
      };
    }
  }
}
