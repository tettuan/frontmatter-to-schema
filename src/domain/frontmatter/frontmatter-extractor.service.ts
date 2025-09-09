/**
 * Frontmatter Extractor Service
 *
 * Handles frontmatter parsing and domain entity creation
 * Part of the Frontmatter Processing Context (Domain Layer)
 * Follows Totality principles with Result types and discriminated unions
 */

import { extract } from "jsr:@std/front-matter@1.0.5/any";
import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { VerboseLoggingUtility } from "../services/verbose-logging-utility.ts";
import { FrontMatter } from "../models/entities.ts";
import { FrontMatterContent } from "../models/value-objects.ts";

/**
 * Type guard for validating unknown data as Record<string, unknown>
 * Eliminates type assertions following Totality principles
 */
function isValidRecordData(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" &&
    data !== null &&
    !Array.isArray(data);
}

/**
 * Discriminated union for frontmatter extraction results
 * Follows Totality principles for complete type safety
 */
export type FrontmatterExtractionResult =
  | { kind: "Present"; frontMatter: FrontMatter; body: string }
  | { kind: "Absent"; body: string };

/**
 * Service for extracting and parsing frontmatter from markdown content
 */
export class FrontmatterExtractorService {
  /**
   * Extract frontmatter from markdown content
   * Returns discriminated union for complete type safety
   */
  extractFromContent(content: string): FrontmatterExtractionResult {
    VerboseLoggingUtility.logDebug(
      "frontmatter-extractor-service",
      "Starting frontmatter extraction",
      { contentLength: content.length },
    );

    try {
      const extracted = extract(content);

      // Check if frontmatter is present and valid
      if (
        isValidRecordData(extracted.attrs) &&
        Object.keys(extracted.attrs).length > 0
      ) {
        VerboseLoggingUtility.logDebug(
          "frontmatter-extractor-service",
          "Frontmatter found, creating domain objects",
          {
            keys: Object.keys(extracted.attrs),
            keyCount: Object.keys(extracted.attrs).length,
          },
        );

        // Create FrontMatterContent from parsed object
        const frontMatterContentResult = FrontMatterContent.fromObject(
          extracted.attrs,
        );

        if (frontMatterContentResult.ok) {
          // Get raw frontmatter section for metadata
          const rawFrontMatter = typeof extracted.frontMatter === "string"
            ? extracted.frontMatter
            : "";

          const frontMatter = FrontMatter.create(
            frontMatterContentResult.data,
            rawFrontMatter,
          );

          VerboseLoggingUtility.logDebug(
            "frontmatter-extractor-service",
            "Frontmatter extraction successful",
            { hasRawContent: rawFrontMatter.length > 0 },
          );

          return {
            kind: "Present",
            frontMatter,
            body: extracted.body,
          };
        } else {
          VerboseLoggingUtility.logWarn(
            "frontmatter-extractor-service",
            "Failed to create FrontMatterContent",
            { error: frontMatterContentResult.error },
          );
        }
      } else {
        VerboseLoggingUtility.logDebug(
          "frontmatter-extractor-service",
          "No valid frontmatter found",
          { hasAttrs: !!extracted.attrs },
        );
      }

      return {
        kind: "Absent",
        body: extracted.body,
      };
    } catch (error) {
      VerboseLoggingUtility.logWarn(
        "frontmatter-extractor-service",
        "Frontmatter extraction failed, treating as no frontmatter",
        { error: error instanceof Error ? error.message : "Unknown error" },
      );

      // If extraction fails completely, treat entire content as body
      return {
        kind: "Absent",
        body: content,
      };
    }
  }

  /**
   * Extract frontmatter with error handling
   * Alternative method that returns Result type for error propagation
   */
  extractWithErrorHandling(
    content: string,
  ): Result<FrontmatterExtractionResult, DomainError & { message: string }> {
    try {
      const result = this.extractFromContent(content);
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: content.substring(0, 100) + "...",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }
}
