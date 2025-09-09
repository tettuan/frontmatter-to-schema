/**
 * TOML Frontmatter Extractor
 * Handles TOML-specific frontmatter extraction
 * Follows Totality principles with Result types and no partial functions
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { ResultHandlerService } from "../services/result-handler-service.ts";

/**
 * Parse TOML frontmatter content
 * Simple implementation for basic TOML key-value pairs
 * @param tomlContent - The raw TOML frontmatter content
 * @returns Result containing parsed data or error
 */
export function parseTomlFrontmatter(
  tomlContent: string,
): Result<Record<string, unknown>, DomainError & { message: string }> {
  try {
    const frontmatterData: Record<string, unknown> = {};

    // Parse simple key-value pairs from TOML
    const lines = tomlContent.split("\n");
    for (const line of lines) {
      // Skip comments and empty lines
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("#") || trimmedLine === "") {
        continue;
      }

      // Parse simple key = value format
      const match = line.match(/^(\w+)\s*=\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        // Remove quotes if present
        const cleanValue = value.trim().replace(/^["']|["']$/g, "");
        frontmatterData[key] = cleanValue;
      }
    }

    return { ok: true, data: frontmatterData };
  } catch (error) {
    return ResultHandlerService.createError(
      createDomainError(
        {
          kind: "InvalidFormat",
          input: tomlContent,
          expectedFormat: "TOML",
        },
        `TOML parsing failed: ${error}`,
      ),
      {
        operation: "parseTomlFrontmatter",
        component: "TomlExtractor",
      },
    );
  }
}
