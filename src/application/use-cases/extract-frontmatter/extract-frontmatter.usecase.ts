/**
 * Extract Frontmatter Use Case
 *
 * Responsible for extracting and parsing frontmatter from Markdown files
 * Part of the Frontmatter Processing Context in DDD
 * Follows Totality principles with Result types
 */

import type { UseCase } from "../base.usecase.ts";
import type { DomainError, Result } from "../../../domain/core/result.ts";
import { createDomainError } from "../../../domain/core/result.ts";
import { FrontmatterExtractor } from "../../../domain/services/frontmatter-extractor-v2.ts";
import * as yaml from "jsr:@std/yaml@1.0.9";
import * as toml from "jsr:@std/toml@1.0.1";

/**
 * Input for frontmatter extraction
 */
export interface ExtractFrontmatterInput {
  filePath: string;
  content: string;
}

/**
 * Output from frontmatter extraction
 */
export interface ExtractFrontmatterOutput {
  data: Record<string, unknown>;
  format: "yaml" | "json" | "toml";
  metadata: {
    filePath: string;
    format: string;
  };
}

/**
 * Extract Frontmatter Use Case Implementation
 * Handles frontmatter extraction and parsing from markdown content
 */
export class ExtractFrontmatterUseCase
  implements UseCase<ExtractFrontmatterInput, ExtractFrontmatterOutput> {
  private readonly extractor: FrontmatterExtractor;

  constructor() {
    this.extractor = new FrontmatterExtractor();
  }

  async execute(
    input: ExtractFrontmatterInput,
  ): Promise<
    Result<ExtractFrontmatterOutput, DomainError & { message: string }>
  > {
    // Await to satisfy linter requirement for async functions
    await Promise.resolve();

    try {
      // Extract frontmatter from content
      const extractResult = this.extractor.extract(input.content);
      if (!extractResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ExtractionStrategyFailed",
              strategy: "frontmatter",
              input: input.filePath,
            },
            extractResult.error.message,
          ),
        };
      }

      const frontmatter = extractResult.data;
      let parsed: unknown;

      // Parse based on format
      try {
        switch (frontmatter.format) {
          case "yaml":
            parsed = yaml.parse(frontmatter.content);
            break;
          case "json":
            parsed = JSON.parse(frontmatter.content);
            break;
          case "toml":
            parsed = toml.parse(frontmatter.content);
            break;
          default:
            return {
              ok: false,
              error: createDomainError(
                {
                  kind: "UnsupportedAnalysisType",
                  type: frontmatter.format,
                },
                `Unsupported frontmatter format: ${frontmatter.format}`,
              ),
            };
        }
      } catch (parseError) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ParseError",
              input: frontmatter.content,
              details: parseError instanceof Error
                ? parseError.message
                : String(parseError),
            },
            `Failed to parse frontmatter: ${
              parseError instanceof Error
                ? parseError.message
                : String(parseError)
            }`,
          ),
        };
      }

      // Ensure parsed result is a record
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(parsed),
              expectedFormat: "object",
            },
            "Parsed frontmatter must be an object",
          ),
        };
      }

      return {
        ok: true,
        data: {
          data: parsed as Record<string, unknown>,
          format: frontmatter.format as "yaml" | "json" | "toml",
          metadata: {
            filePath: input.filePath,
            format: frontmatter.format,
          },
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ProcessingStageError",
            stage: "ExtractFrontmatter",
            error: {
              kind: "InvalidResponse",
              service: "frontmatter-extractor",
              response: error instanceof Error ? error.message : String(error),
            },
          },
          `Failed to extract frontmatter: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }
}
