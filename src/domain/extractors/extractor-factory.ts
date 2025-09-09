/**
 * Extractor Factory
 * Factory for creating format-specific frontmatter extractors
 * Follows Totality principles with exhaustive pattern matching
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { ResultHandlerService } from "../services/result-handler-service.ts";
import {
  parseSimpleYamlFormat,
  parseYamlFrontmatter,
} from "./yaml-extractor.ts";
import { parseJsonFrontmatter } from "./json-extractor.ts";
import { parseTomlFrontmatter } from "./toml-extractor.ts";

/**
 * Supported frontmatter formats
 */
export type FrontmatterFormat = "yaml" | "json" | "toml";

/**
 * Extracted frontmatter data
 */
export interface ExtractedFrontmatter {
  content: string;
  format: FrontmatterFormat;
}

/**
 * Parse frontmatter based on format
 * Uses exhaustive pattern matching for format selection
 * @param frontmatter - The extracted frontmatter with format info
 * @returns Result containing parsed data or error
 */
export function parseFrontmatter(
  frontmatter: ExtractedFrontmatter,
): Result<Record<string, unknown>, DomainError & { message: string }> {
  // Exhaustive pattern matching on format
  switch (frontmatter.format) {
    case "yaml":
      return parseYamlFrontmatter(frontmatter.content);
    case "json":
      return parseJsonFrontmatter(frontmatter.content);
    case "toml":
      return parseTomlFrontmatter(frontmatter.content);
    default: {
      // TypeScript ensures this is never reached if all formats are handled
      const _exhaustive: never = frontmatter.format;
      return ResultHandlerService.createError(
        createDomainError(
          {
            kind: "InvalidFormat",
            input: frontmatter.content,
            expectedFormat: "yaml | json | toml",
          },
          `Unsupported format: ${_exhaustive}`,
        ),
        {
          operation: "parseFrontmatter",
          component: "ExtractorFactory",
        },
      );
    }
  }
}

/**
 * Parse frontmatter with automatic format detection
 * @param content - The raw frontmatter content
 * @returns Result containing parsed data or error
 */
export function parseFrontmatterWithDetection(
  content: string,
): Result<Record<string, unknown>, DomainError & { message: string }> {
  const trimmed = content.trim();

  // Try to detect format
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    // Likely JSON
    return parseJsonFrontmatter(trimmed);
  } else if (trimmed.includes("=") && !trimmed.includes(":")) {
    // Likely TOML (has = but no :)
    return parseTomlFrontmatter(trimmed);
  } else if (trimmed.includes(":")) {
    // Likely YAML (has :)
    return parseYamlFrontmatter(trimmed);
  } else {
    // Try simple format for single key:value pairs
    if (trimmed.split("\n").length === 1) {
      return parseSimpleYamlFormat(trimmed);
    }

    // Default to YAML
    return parseYamlFrontmatter(trimmed);
  }
}
