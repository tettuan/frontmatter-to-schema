/**
 * TemplateParser Domain Service
 *
 * Extracts variables and parses template content based on engine type
 * Handles template analysis and content processing
 */

import type { TemplateEngine } from "../value-objects/template-definition.ts";

/**
 * Domain service for template parsing and variable extraction
 * Encapsulates template analysis logic based on engine type
 */
export class TemplateParser {
  /**
   * Extract variables from template content based on engine
   */
  static extractVariables(content: string, engine: TemplateEngine): string[] {
    const variables: Set<string> = new Set();

    switch (engine) {
      case "handlebars":
      case "mustache": {
        // Extract {{variable}} patterns
        const matches = content.matchAll(
          /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
        );
        for (const match of matches) {
          variables.add(match[1]);
        }
        break;
      }

      case "liquid": {
        // Extract {{variable}} and {% assign variable patterns
        const outputMatches = content.matchAll(
          /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
        );
        for (const match of outputMatches) {
          variables.add(match[1]);
        }
        break;
      }

      case "ejs": {
        // Extract <%=variable%> patterns
        const matches = content.matchAll(
          /<%=\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*%>/g,
        );
        for (const match of matches) {
          variables.add(match[1]);
        }
        break;
      }

      default:
        // For other engines, return empty array
        break;
    }

    return Array.from(variables).sort();
  }

  /**
   * Check if template content contains specific text
   */
  static containsText(content: string, text: string): boolean {
    return content.includes(text);
  }

  /**
   * Get template content statistics
   */
  static getContentStats(content: string): {
    readonly length: number;
    readonly isEmpty: boolean;
    readonly lineCount: number;
    readonly wordCount: number;
  } {
    const trimmed = content.trim();
    const lines = content.split("\n").length;
    const words = trimmed ? trimmed.split(/\s+/).length : 0;

    return {
      length: content.length,
      isEmpty: trimmed.length === 0,
      lineCount: lines,
      wordCount: words,
    };
  }

  /**
   * Normalize template content (trim and standardize line endings)
   */
  static normalizeContent(content: string): string {
    return content.trim().replace(/\r\n/g, "\n");
  }
}
