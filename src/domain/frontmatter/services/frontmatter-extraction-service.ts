/**
 * @fileoverview Frontmatter Extraction Service
 * @description Service for extracting frontmatter data from markdown documents
 * Following DDD and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterProcessor } from "../processors/frontmatter-processor.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import {
  JsonFrontmatterParser,
  YamlFrontmatterExtractor,
} from "../../../infrastructure/index.ts";

/**
 * Domain service for frontmatter extraction operations
 * Encapsulates the logic for extracting frontmatter from markdown documents
 */
export class FrontmatterExtractionService {
  private constructor(
    private readonly processor: FrontmatterProcessor,
  ) {}

  /**
   * Smart Constructor
   */
  static create(
    processor?: FrontmatterProcessor,
  ): Result<FrontmatterExtractionService, DomainError & { message: string }> {
    try {
      if (processor) {
        return ok(new FrontmatterExtractionService(processor));
      } else {
        // Create default processor with required dependencies
        const extractor = new YamlFrontmatterExtractor();
        const parser = new JsonFrontmatterParser();
        const processorResult = FrontmatterProcessor.create(extractor, parser);

        if (!processorResult.ok) {
          return err({
            kind: "ConfigurationError",
            message:
              `Failed to create FrontmatterProcessor: ${processorResult.error.message}`,
          });
        }

        return ok(new FrontmatterExtractionService(processorResult.data));
      }
    } catch (error) {
      return err({
        kind: "ConfigurationError",
        message: `Failed to create FrontmatterExtractionService: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  /**
   * Extract frontmatter data from a markdown document
   */
  extractFromDocument(
    document: MarkdownDocument,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    try {
      const content = document.getContent();
      const extractResult = this.processor.extract(content);
      if (!extractResult.ok) {
        return err({
          kind: "ExtractionFailed",
          message:
            `Frontmatter extraction failed: ${extractResult.error.message}`,
        });
      }

      return ok(extractResult.data.frontmatter);
    } catch (error) {
      return err({
        kind: "ExtractionFailed",
        message: `Frontmatter extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  /**
   * Extract frontmatter data from raw markdown content
   */
  extractFromContent(
    content: string,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    try {
      const extractResult = this.processor.extract(content);
      if (!extractResult.ok) {
        return err({
          kind: "ExtractionFailed",
          message: `Content extraction failed: ${extractResult.error.message}`,
        });
      }

      return ok(extractResult.data.frontmatter);
    } catch (error) {
      return err({
        kind: "ExtractionFailed",
        message: `Content extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }
}
