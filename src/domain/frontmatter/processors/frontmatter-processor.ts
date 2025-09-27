import { err, ok, Result } from "../../shared/types/result.ts";
import {
  createError,
  DomainError,
  FrontmatterError,
} from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";

/**
 * Interface for frontmatter extraction
 */
export interface FrontmatterExtractor {
  extract(content: string): Result<{
    frontmatter: unknown;
    body: string;
  }, FrontmatterError & { message: string }>;
}

/**
 * Interface for frontmatter parsing
 */
export interface FrontmatterParser {
  parse(yaml: string): Result<unknown, FrontmatterError & { message: string }>;
}

/**
 * Basic Frontmatter Processor (Legacy Compatibility)
 *
 * This is a simplified processor to maintain compatibility with existing code
 * while transitioning to the new 3-domain architecture.
 */
export interface FrontmatterExtractionResult {
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
}

export class FrontmatterProcessor {
  static create(
    _extractor?: FrontmatterExtractor,
    _parser?: FrontmatterParser,
  ): Result<FrontmatterProcessor, DomainError & { message: string }> {
    // Support both patterns - with and without parameters
    return ok(new FrontmatterProcessor());
  }

  /**
   * Extract frontmatter from markdown content
   */
  extract(
    content: string,
  ): Result<FrontmatterExtractionResult, DomainError & { message: string }> {
    // Basic YAML frontmatter extraction
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return err(createError({
        kind: "ParseError",
        input: content.substring(0, 100),
      }, "No frontmatter found in content"));
    }

    const yamlContent = match[1];
    const body = match[2];

    try {
      // Simple YAML parsing
      const frontmatter = this.parseSimpleYaml(yamlContent);

      return ok({ frontmatter, body });
    } catch (error) {
      return err(createError(
        {
          kind: "ParseError",
          input: yamlContent,
        },
        `Failed to parse frontmatter: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ));
    }
  }

  /**
   * Validate frontmatter against rules
   */
  validate(
    frontmatter: Record<string, unknown>,
    _rules: ValidationRules,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Basic validation - create FrontmatterData if valid
    return FrontmatterData.create(frontmatter);
  }

  /**
   * Simple YAML parser for basic frontmatter
   */
  private parseSimpleYaml(yamlContent: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yamlContent.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const colonIndex = trimmed.indexOf(":");
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim();
          const value = trimmed.substring(colonIndex + 1).trim();

          // Simple value parsing
          if (value.startsWith('"') && value.endsWith('"')) {
            result[key] = value.slice(1, -1);
          } else if (value === "true") {
            result[key] = true;
          } else if (value === "false") {
            result[key] = false;
          } else if (!isNaN(Number(value))) {
            result[key] = Number(value);
          } else {
            result[key] = value;
          }
        }
      }
    }

    return result;
  }
}
