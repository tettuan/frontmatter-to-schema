/**
 * YAML Frontmatter Extractor
 * Handles YAML-specific frontmatter extraction
 * Follows Totality principles with Result types and no partial functions
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { ResultHandlerService } from "../services/result-handler-service.ts";

/**
 * Parse YAML frontmatter content
 * @param yamlContent - The raw YAML frontmatter content
 * @returns Result containing parsed data or error
 */
export function parseYamlFrontmatter(
  yamlContent: string,
): Result<Record<string, unknown>, DomainError & { message: string }> {
  try {
    const frontmatterData: Record<string, unknown> = {};

    // Parse simple key-value pairs from YAML
    const lines = yamlContent.split("\n");
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, "");
        frontmatterData[key] = cleanValue;
      }
    }

    return { ok: true, data: frontmatterData };
  } catch (error) {
    return ResultHandlerService.createError(
      createDomainError(
        {
          kind: "InvalidFormat",
          input: yamlContent,
          expectedFormat: "YAML",
        },
        `YAML parsing failed: ${error}`,
      ),
      {
        operation: "parseYamlFrontmatter",
        component: "YamlExtractor",
      },
    );
  }
}

/**
 * Parse YAML frontmatter for simple key:value format
 * Handles the specific format from tasks (e.g., "title:プロジェクト全体の深掘り調査と修正タスク洗い出し")
 * @param frontmatterYaml - The frontmatter YAML string
 * @returns Result containing parsed data or error
 */
export function parseSimpleYamlFormat(
  frontmatterYaml: string,
): Result<Record<string, unknown>, DomainError & { message: string }> {
  try {
    const frontmatterData: Record<string, unknown> = {};

    // Handle the specific format from the task
    const parts = frontmatterYaml.split(":");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join(":").trim();
      frontmatterData[key] = value;
    }

    return { ok: true, data: frontmatterData };
  } catch (error) {
    return ResultHandlerService.createError(
      createDomainError(
        {
          kind: "InvalidFormat",
          input: frontmatterYaml,
          expectedFormat: "Simple YAML (key:value)",
        },
        `Simple YAML parsing failed: ${error}`,
      ),
      {
        operation: "parseSimpleYamlFormat",
        component: "YamlExtractor",
      },
    );
  }
}
