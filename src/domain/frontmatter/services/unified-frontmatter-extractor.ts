/**
 * Unified Frontmatter Extractor Service
 *
 * Consolidates yaml-extractor, toml-extractor, and json-extractor into a single service
 * following DDD bounded context principles and Totality patterns.
 *
 * This reduces code duplication and provides a single point of responsibility
 * for frontmatter extraction across all formats.
 */

import type { DomainError, Result } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";
import * as yaml from "jsr:@std/yaml@1.0.9";
import * as toml from "jsr:@std/toml@1.0.1";

/**
 * Supported frontmatter formats
 */
export type FrontmatterFormat = "yaml" | "json" | "toml";

/**
 * Extracted frontmatter data with format information
 */
export interface ExtractedFrontmatter {
  data: Record<string, unknown>;
  format: FrontmatterFormat;
  raw: string;
}

/**
 * Unified Frontmatter Extractor Service
 *
 * Handles extraction and parsing of frontmatter from markdown content
 * for all supported formats (YAML, JSON, TOML).
 */
export class UnifiedFrontmatterExtractor {
  /**
   * Extract frontmatter from markdown content
   * Automatically detects format and parses accordingly
   */
  extract(
    content: string,
  ): Result<ExtractedFrontmatter | null, DomainError & { message: string }> {
    // Check for frontmatter delimiters
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const tomlMatch = content.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+/);
    const jsonMatch = content.match(/^{\n([\s\S]*?)\n}/);

    if (yamlMatch) {
      return this.parseYaml(yamlMatch[1]);
    }

    if (tomlMatch) {
      return this.parseToml(tomlMatch[1]);
    }

    if (jsonMatch) {
      return this.parseJson(`{${jsonMatch[1]}}`);
    }

    // No frontmatter found
    return { ok: true, data: null };
  }

  /**
   * Parse YAML frontmatter
   */
  private parseYaml(
    raw: string,
  ): Result<ExtractedFrontmatter, DomainError & { message: string }> {
    try {
      const data = yaml.parse(raw) as Record<string, unknown>;

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ParseError",
              input: raw,
              parser: "yaml",
            },
            "YAML frontmatter must be an object",
          ),
        };
      }

      return {
        ok: true,
        data: {
          data,
          format: "yaml",
          raw,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ParseError",
            input: raw,
            parser: "yaml",
          },
          `Failed to parse YAML: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Parse TOML frontmatter
   */
  private parseToml(
    raw: string,
  ): Result<ExtractedFrontmatter, DomainError & { message: string }> {
    try {
      const data = toml.parse(raw) as Record<string, unknown>;

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ParseError",
              input: raw,
              parser: "toml",
            },
            "TOML frontmatter must be an object",
          ),
        };
      }

      return {
        ok: true,
        data: {
          data,
          format: "toml",
          raw,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ParseError",
            input: raw,
            parser: "toml",
          },
          `Failed to parse TOML: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Parse JSON frontmatter
   */
  private parseJson(
    raw: string,
  ): Result<ExtractedFrontmatter, DomainError & { message: string }> {
    try {
      const data = JSON.parse(raw) as Record<string, unknown>;

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ParseError",
              input: raw,
              parser: "json",
            },
            "JSON frontmatter must be an object",
          ),
        };
      }

      return {
        ok: true,
        data: {
          data,
          format: "json",
          raw,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ParseError",
            input: raw,
            parser: "json",
          },
          `Failed to parse JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Extract frontmatter with specific format expectation
   */
  extractWithFormat(
    content: string,
    expectedFormat: FrontmatterFormat,
  ): Result<ExtractedFrontmatter | null, DomainError & { message: string }> {
    const result = this.extract(content);

    if (!result.ok) {
      return result;
    }

    if (result.data === null) {
      return result;
    }

    if (result.data.format !== expectedFormat) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: result.data.format,
            expectedFormat,
          },
          `Expected ${expectedFormat} format but found ${result.data.format}`,
        ),
      };
    }

    return result;
  }
}
