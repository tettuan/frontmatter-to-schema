/**
 * JSON Frontmatter Extractor
 * Handles JSON-specific frontmatter extraction
 * Follows Totality principles with Result types and no partial functions
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { ResultHandlerService } from "../services/result-handler-service.ts";

/**
 * Parse JSON frontmatter content
 * @param jsonContent - The raw JSON frontmatter content
 * @returns Result containing parsed data or error
 */
export function parseJsonFrontmatter(
  jsonContent: string,
): Result<Record<string, unknown>, DomainError & { message: string }> {
  try {
    const parsed = JSON.parse(jsonContent);

    if (
      typeof parsed !== "object" || parsed === null || Array.isArray(parsed)
    ) {
      return ResultHandlerService.createError(
        createDomainError(
          {
            kind: "InvalidFormat",
            input: jsonContent,
            expectedFormat: "JSON object",
          },
          "JSON must be an object",
        ),
        {
          operation: "parseJsonFrontmatter",
          component: "JsonExtractor",
        },
      );
    }

    return { ok: true, data: parsed as Record<string, unknown> };
  } catch (error) {
    return ResultHandlerService.createError(
      createDomainError(
        {
          kind: "InvalidFormat",
          input: jsonContent,
          expectedFormat: "JSON",
        },
        `JSON parsing failed: ${error}`,
      ),
      {
        operation: "parseJsonFrontmatter",
        component: "JsonExtractor",
      },
    );
  }
}
