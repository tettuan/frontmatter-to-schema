/**
 * TypeScript-based frontmatter extractor
 */

import { extract as extractFrontMatter } from "jsr:@std/front-matter@1.0.5/any";
import type { Result } from "../core/result.ts";
import {
  createValidationError,
  type ValidationError,
} from "../shared/errors.ts";

export interface FrontMatterData {
  readonly data: Record<string, unknown>;
  readonly body: string;
  readonly rawFrontMatter: string;
}

export class TypeScriptFrontMatterExtractor {
  /**
   * Extract frontmatter from text content
   * Phase 1: Frontmatter extraction only (separate from schema matching)
   */
  extract(content: string): Result<FrontMatterData, ValidationError> {
    try {
      // Extract frontmatter using std library
      const extracted = extractFrontMatter(content);

      if (!extracted || typeof extracted.attrs !== "object") {
        return {
          ok: false,
          error: createValidationError("No valid frontmatter found in content"),
        };
      }

      // Get raw frontmatter text for later processing
      const rawFrontMatter = this.extractRawFrontMatter(content);

      const frontMatterData: FrontMatterData = {
        data: extracted.attrs as Record<string, unknown>,
        body: extracted.body,
        rawFrontMatter,
      };

      return {
        ok: true,
        data: frontMatterData,
      };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(
          `Failed to extract frontmatter: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Extract raw frontmatter text from content for template variable extraction
   */
  private extractRawFrontMatter(content: string): string {
    const lines = content.split("\n");
    const frontMatterLines: string[] = [];
    let inFrontMatter = false;
    let frontMatterDelimiterCount = 0;

    for (const line of lines) {
      if (line.trim() === "---") {
        frontMatterDelimiterCount++;
        if (frontMatterDelimiterCount === 1) {
          inFrontMatter = true;
          continue;
        } else if (frontMatterDelimiterCount === 2) {
          break;
        }
      }

      if (inFrontMatter && frontMatterDelimiterCount === 1) {
        frontMatterLines.push(line);
      }
    }

    return frontMatterLines.join("\n");
  }

  /**
   * Extract template variables in {SchemaPath} format from template content
   * Phase 1-2: Template variable extraction
   */
  extractTemplateVariables(
    templateContent: string,
  ): Result<string[], ValidationError> {
    try {
      // Regular expression to match {SchemaPath} format variables
      const variablePattern = /\{([^}]+)\}/g;
      const variables: string[] = [];
      let match;

      while ((match = variablePattern.exec(templateContent)) !== null) {
        const variableName = match[1].trim();
        if (variableName && !variables.includes(variableName)) {
          variables.push(variableName);
        }
      }

      return {
        ok: true,
        data: variables,
      };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(
          `Failed to extract template variables: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }
}
