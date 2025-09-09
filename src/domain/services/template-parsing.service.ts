/**
 * Template Parsing Service
 * Extracted from Template entity for better separation of concerns
 * Handles parsing of template content and placeholder detection
 */

import type { TemplateParsingResult } from "../types/domain-types.ts";

/**
 * Service for parsing template content and handling placeholders
 * Focuses on parsing logic separated from template entity
 */
export class TemplateParsingService {
  /**
   * Parse template content and determine if it's JSON with placeholders
   * Returns discriminated union result following Totality principles
   */
  parseTemplateContent(templateContent: string): TemplateParsingResult {
    // Check for placeholder patterns like {field} or {path.to.field}
    const hasPlaceholders = templateContent &&
      /\{[a-zA-Z_][\w.]*\}/.test(templateContent);

    if (!hasPlaceholders) {
      return { kind: "NoPlaceholders" };
    }

    try {
      const templateObj = JSON.parse(templateContent);
      if (
        templateObj && typeof templateObj === "object" &&
        !Array.isArray(templateObj)
      ) {
        return {
          kind: "JsonParsed",
          template: templateObj as Record<string, unknown>,
        };
      }
      return { kind: "ParseFailed", reason: "Parsed JSON is not an object" };
    } catch (error) {
      return {
        kind: "ParseFailed",
        reason: `JSON parse error: ${String(error)}`,
      };
    }
  }

  /**
   * Check if template content contains placeholders
   * Utility method for quick placeholder detection
   */
  hasPlaceholders(templateContent: string): boolean {
    return Boolean(templateContent) &&
      /\{[a-zA-Z_][\w.]*\}/.test(templateContent);
  }

  /**
   * Extract placeholder names from template content
   * Returns array of placeholder names without braces
   */
  extractPlaceholders(templateContent: string): string[] {
    const placeholders: string[] = [];
    const regex = /\{([a-zA-Z_][\w.]*)\}/g;
    let match;

    while ((match = regex.exec(templateContent)) !== null) {
      const placeholderName = match[1].trim();
      if (!placeholders.includes(placeholderName)) {
        placeholders.push(placeholderName);
      }
    }

    return placeholders;
  }
}
