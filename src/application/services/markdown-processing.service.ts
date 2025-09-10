/**
 * Markdown Processing Service
 * Extracted from process-documents-usecase.ts for better domain separation
 * Handles individual Markdown file processing following DDD principles
 */

import type { Result } from "../../domain/core/result.ts";
import { FrontMatterExtractorImpl as FrontmatterExtractor } from "../../infrastructure/adapters/frontmatter-extractor-impl.ts";
import { Document } from "../../domain/models/entities.ts";
import {
  DocumentContent,
  DocumentPath,
} from "../../domain/models/value-objects.ts";
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

      // Create value objects for Document
      const pathResult = DocumentPath.create(filePath);
      if (!pathResult.ok) {
        return {
          ok: false,
          error: {
            kind: "InvalidPath",
            message: `Invalid document path: ${filePath}`,
          },
        };
      }

      const contentResult = DocumentContent.create(content);
      if (!contentResult.ok) {
        return {
          ok: false,
          error: {
            kind: "InvalidContent",
            message: `Invalid document content`,
          },
        };
      }

      // Create Document for extraction
      const doc = Document.create(
        pathResult.data,
        { kind: "NoFrontMatter" },
        contentResult.data,
      );

      // Extract frontmatter
      const extractResult = this.frontmatterExtractor.extract(doc);
      if (!extractResult.ok) {
        return {
          ok: false,
          error: {
            kind: "FrontmatterExtractionFailed",
            message: extractResult.error.message,
          },
        };
      }

      // Check if frontmatter was extracted
      if (extractResult.data.kind === "NotPresent") {
        return {
          ok: true,
          data: {
            _meta: {
              filePath: filePath,
              format: "none",
              extractedAt: new Date().toISOString(),
            },
          },
        };
      }

      // Get the frontmatter content from the extraction result
      const frontMatter = extractResult.data.frontMatter;
      const frontMatterContent = frontMatter.getContent();

      // Parse frontmatter based on format (default to YAML)
      const parseResult = this.parseFrontmatter(
        frontMatterContent.getValue(),
        "yaml", // Default format
      );
      if (!parseResult.ok) {
        return parseResult;
      }

      // Add metadata
      const result = {
        ...parseResult.data as Record<string, unknown>,
        _meta: {
          filePath: filePath,
          format: "yaml",
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
