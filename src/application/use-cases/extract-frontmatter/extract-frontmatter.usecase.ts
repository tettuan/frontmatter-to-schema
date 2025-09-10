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
import { FrontMatterExtractorImpl as FrontmatterExtractor } from "../../../infrastructure/adapters/frontmatter-extractor-impl.ts";
import { Document } from "../../../domain/models/entities.ts";
import {
  DocumentContent,
  DocumentPath,
} from "../../../domain/models/value-objects.ts";
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
      // Create value objects for Document
      const pathResult = DocumentPath.create(input.filePath);
      if (!pathResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: input.filePath,
              expectedFormat: "valid path",
            },
            `Failed to create document path: ${input.filePath}`,
          ),
        };
      }

      const contentResult = DocumentContent.create(input.content);
      if (!contentResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: "content",
              expectedFormat: "valid content",
            },
            `Failed to create document content`,
          ),
        };
      }

      // Create Document for extraction
      const doc = Document.create(
        pathResult.data,
        { kind: "NoFrontMatter" },
        contentResult.data,
      );

      // Extract frontmatter from content
      const extractResult = this.extractor.extract(doc);
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

      // Check extraction result
      if (extractResult.data.kind === "NotPresent") {
        return {
          ok: true,
          data: {
            data: {},
            format: "yaml" as "yaml" | "json" | "toml",
            metadata: {
              filePath: input.filePath,
              format: "none",
            },
          },
        };
      }

      const frontMatter = extractResult.data.frontMatter;
      const frontMatterContent = frontMatter.getContent();
      let parsed: unknown;

      // Parse based on format (default to YAML since we don't have format info)
      try {
        const content = frontMatterContent.getValue();
        // Try to detect format from content
        if (content.startsWith("{")) {
          parsed = JSON.parse(content);
        } else if (content.includes("=")) {
          parsed = toml.parse(content);
        } else {
          parsed = yaml.parse(content);
        }
      } catch (parseError) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ParseError",
              input: String(parseError),
              parser: "frontmatter",
            },
            `Failed to parse frontmatter: ${String(parseError)}`,
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

      // Detect format based on what we parsed
      let format: "yaml" | "json" | "toml" = "yaml";
      const content = frontMatterContent.getValue();
      if (content.startsWith("{")) {
        format = "json";
      } else if (content.includes("=")) {
        format = "toml";
      }

      return {
        ok: true,
        data: {
          data: parsed as Record<string, unknown>,
          format: format,
          metadata: {
            filePath: input.filePath,
            format: format,
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
