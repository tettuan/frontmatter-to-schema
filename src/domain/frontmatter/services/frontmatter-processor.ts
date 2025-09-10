/**
 * FrontmatterProcessor Domain Service
 *
 * Handles frontmatter extraction and parsing from Markdown content following DDD and Totality principles
 * Consolidates business logic from multiple existing implementations into a single domain service
 * Uses value objects and returns Result<T,E> for all operations
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import {
  FrontmatterData,
  type FrontmatterFormat,
} from "../../value-objects/frontmatter-data.ts";

/**
 * Raw frontmatter extraction result
 */
export interface ExtractedFrontmatter {
  readonly content: string;
  readonly format: FrontmatterFormat;
  readonly bodyContent: string;
}

/**
 * FrontmatterProcessor domain service for extracting and parsing frontmatter from Markdown
 * Follows Totality principles - all functions are total and return Result<T,E>
 */
export class FrontmatterProcessor {
  private constructor() {}

  /**
   * Smart Constructor for FrontmatterProcessor
   * @returns Result containing FrontmatterProcessor
   */
  static create(): Result<
    FrontmatterProcessor,
    DomainError & { message: string }
  > {
    return {
      ok: true,
      data: new FrontmatterProcessor(),
    };
  }

  /**
   * Extract frontmatter from Markdown content
   * @param markdown - Markdown content to extract frontmatter from
   * @returns Result containing FrontmatterData or null if no frontmatter found
   */
  extractFrontmatter(
    markdown: string,
  ): Result<FrontmatterData | null, DomainError & { message: string }> {
    if (!markdown || markdown.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Markdown content cannot be empty",
        ),
      };
    }

    const trimmedContent = markdown.trim();

    // Detect frontmatter format
    const format = this.detectFormat(trimmedContent);
    if (!format) {
      // No frontmatter found - this is valid
      return { ok: true, data: null };
    }

    // Extract raw frontmatter content
    const extractionResult = this.extractRawFrontmatter(trimmedContent, format);
    if (!extractionResult.ok) {
      return extractionResult;
    }

    const { content: rawContent } = extractionResult.data;

    // Create FrontmatterData value object
    const frontmatterResult = FrontmatterData.create(rawContent, format);
    if (!frontmatterResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ParseError",
            input: rawContent.substring(0, 100),
            details: frontmatterResult.error.message,
          },
          "Failed to create FrontmatterData from extracted content",
        ),
      };
    }

    return { ok: true, data: frontmatterResult.data };
  }

  /**
   * Extract frontmatter with body content separation
   * @param markdown - Markdown content to process
   * @returns Result containing extracted frontmatter and body content
   */
  extractWithBody(
    markdown: string,
  ): Result<ExtractedFrontmatter | null, DomainError & { message: string }> {
    if (!markdown || markdown.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Markdown content cannot be empty",
        ),
      };
    }

    const trimmedContent = markdown.trim();

    // Detect frontmatter format
    const format = this.detectFormat(trimmedContent);
    if (!format) {
      // No frontmatter found - return entire content as body
      return { ok: true, data: null };
    }

    // Extract raw frontmatter content and body
    const extractionResult = this.extractRawFrontmatter(trimmedContent, format);
    if (!extractionResult.ok) {
      return extractionResult;
    }

    return {
      ok: true,
      data: {
        content: extractionResult.data.content,
        format,
        bodyContent: extractionResult.data.bodyContent,
      },
    };
  }

  /**
   * Detect frontmatter format from content
   * @param content - Content to analyze
   * @returns Detected format or null if no frontmatter
   */
  detectFormat(content: string): FrontmatterFormat | null {
    if (!content || content.length === 0) {
      return null;
    }

    const lines = content.split("\n");
    const firstLine = lines[0]?.trim();

    // Check for YAML frontmatter (---)
    if (firstLine === "---") {
      return "yaml";
    }

    // Check for TOML frontmatter (+++)
    if (firstLine === "+++") {
      return "toml";
    }

    // Check for JSON frontmatter (starts with {)
    if (firstLine?.startsWith("{")) {
      return "json";
    }

    return null;
  }

  /**
   * Extract raw frontmatter content based on format
   * @param content - Full content to extract from
   * @param format - Detected format
   * @returns Result containing raw frontmatter and body content
   */
  private extractRawFrontmatter(
    content: string,
    format: FrontmatterFormat,
  ): Result<
    { content: string; bodyContent: string },
    DomainError & { message: string }
  > {
    switch (format) {
      case "yaml":
        return this.extractDelimitedFrontmatter(content, "---", "YAML");

      case "toml":
        return this.extractDelimitedFrontmatter(content, "+++", "TOML");

      case "json":
        return this.extractJSONFrontmatter(content);

      default: {
        // Exhaustive check
        const _exhaustiveCheck: never = format;
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(_exhaustiveCheck),
              expectedFormat: "yaml, json, or toml",
            },
            `Unknown frontmatter format: ${String(_exhaustiveCheck)}`,
          ),
        };
      }
    }
  }

  /**
   * Extract delimited frontmatter (YAML or TOML)
   * @param content - Content to extract from
   * @param delimiter - Delimiter to use (--- or +++)
   * @param formatName - Format name for error messages
   * @returns Result containing extracted content
   */
  private extractDelimitedFrontmatter(
    content: string,
    delimiter: string,
    formatName: string,
  ): Result<
    { content: string; bodyContent: string },
    DomainError & { message: string }
  > {
    const lines = content.split("\n");

    if (lines[0] !== delimiter) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: content.substring(0, 50),
            expectedFormat: `${formatName} starting with ${delimiter}`,
          },
          `${formatName} frontmatter must start with ${delimiter}`,
        ),
      };
    }

    const frontmatterLines: string[] = [];
    let endIndex = -1;

    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === delimiter) {
        endIndex = i;
        break;
      }
      frontmatterLines.push(lines[i]);
    }

    if (endIndex === -1) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: content.substring(0, 100),
            expectedFormat: `${formatName} properly closed with ${delimiter}`,
          },
          `${formatName} frontmatter is not properly closed with ${delimiter}`,
        ),
      };
    }

    if (frontmatterLines.length === 0) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          `${formatName} frontmatter is empty`,
        ),
      };
    }

    const frontmatterContent = frontmatterLines.join("\n");
    const bodyContent = lines.slice(endIndex + 1).join("\n");

    return {
      ok: true,
      data: {
        content: frontmatterContent,
        bodyContent,
      },
    };
  }

  /**
   * Extract JSON frontmatter
   * @param content - Content to extract from
   * @returns Result containing extracted JSON content
   */
  private extractJSONFrontmatter(
    content: string,
  ): Result<
    { content: string; bodyContent: string },
    DomainError & { message: string }
  > {
    // Find the end of the JSON object
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;
    let jsonEnd = -1;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\" && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") {
          braceCount++;
        } else if (char === "}") {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
    }

    if (jsonEnd === -1) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: content.substring(0, 100),
            expectedFormat: "properly closed JSON object",
          },
          "JSON frontmatter is not properly closed",
        ),
      };
    }

    const jsonContent = content.substring(0, jsonEnd).trim();
    const bodyContent = content.substring(jsonEnd).trim();

    // Verify it's valid JSON
    try {
      const parsed = JSON.parse(jsonContent);
      if (typeof parsed !== "object" || parsed === null) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: jsonContent.substring(0, 100),
              expectedFormat: "JSON object",
            },
            "JSON frontmatter must be an object",
          ),
        };
      }
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ParseError",
            input: jsonContent.substring(0, 100),
            details: error instanceof Error ? error.message : String(error),
          },
          "Invalid JSON frontmatter",
        ),
      };
    }

    return {
      ok: true,
      data: {
        content: jsonContent,
        bodyContent,
      },
    };
  }

  /**
   * Parse frontmatter content into structured data
   * @param content - Raw frontmatter content
   * @param format - Format of the content
   * @returns Result containing parsed data
   */
  parseContent(
    content: string,
    format: FrontmatterFormat,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    if (!content || content.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Frontmatter content cannot be empty",
        ),
      };
    }

    switch (format) {
      case "json": {
        try {
          const parsed = JSON.parse(content);
          if (typeof parsed !== "object" || parsed === null) {
            return {
              ok: false,
              error: createDomainError(
                {
                  kind: "InvalidFormat",
                  input: content.substring(0, 100),
                  expectedFormat: "JSON object",
                },
                "Parsed JSON must be an object",
              ),
            };
          }
          return { ok: true, data: parsed as Record<string, unknown> };
        } catch (error) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "ParseError",
                input: content.substring(0, 100),
                details: error instanceof Error ? error.message : String(error),
              },
              "Failed to parse JSON frontmatter",
            ),
          };
        }
      }

      case "yaml":
      case "toml": {
        // For now, return a placeholder that indicates the format
        // In production, this would use proper YAML/TOML parsers
        return {
          ok: true,
          data: {
            _raw: content,
            _format: format,
            _note:
              `${format.toUpperCase()} parsing not implemented - using raw content`,
          },
        };
      }

      default: {
        // Exhaustive check
        const _exhaustiveCheck: never = format;
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(_exhaustiveCheck),
              expectedFormat: "yaml, json, or toml",
            },
            `Unknown format: ${String(_exhaustiveCheck)}`,
          ),
        };
      }
    }
  }
}
