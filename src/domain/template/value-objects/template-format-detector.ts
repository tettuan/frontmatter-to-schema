import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import {
  ARRAY_EXPANSION_PLACEHOLDER,
  ERROR_MESSAGES,
  FORMAT_DETECTION_PATTERNS,
} from "../constants/template-variable-constants.ts";

/**
 * Represents different template format detection results.
 * Follows Totality principles with discriminated unions.
 */
export type TemplateFormatDetection =
  | {
    readonly kind: "YamlListFormat";
    readonly key: string;
    readonly lineIndex: number;
  }
  | {
    readonly kind: "JsonArrayFormat";
    readonly lineIndex: number;
  }
  | {
    readonly kind: "PlainTextFormat";
    readonly lineIndex: number;
  }
  | {
    readonly kind: "NoItemsPlaceholder";
  };

/**
 * Value Object for detecting template formats and extracting {@items} placeholders.
 * Follows DDD principles with immutable state and Totality error handling.
 */
export class TemplateFormatDetector {
  private constructor() {}

  /**
   * Smart Constructor following Totality principles.
   * @returns Result containing detector instance or error
   */
  static create(): Result<
    TemplateFormatDetector,
    TemplateError & { message: string }
  > {
    return ok(new TemplateFormatDetector());
  }

  /**
   * Detects {@items} placeholder format in template content.
   * Handles YAML list format, JSON array format, and plain text.
   * @param template - Template content as string
   * @returns Result containing format detection or error
   */
  detectItemsPlaceholder(
    template: string,
  ): Result<TemplateFormatDetection, TemplateError & { message: string }> {
    if (!template.includes(ARRAY_EXPANSION_PLACEHOLDER)) {
      return ok({ kind: "NoItemsPlaceholder" });
    }

    const lines = template.split("\n");

    // Find the line containing array expansion placeholder
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(ARRAY_EXPANSION_PLACEHOLDER)) {
        // Check for YAML list format using pattern matching
        const trimmedLine = line.trim();
        if (FORMAT_DETECTION_PATTERNS.YAML_LIST.test(trimmedLine)) {
          // Extract key from previous line (e.g., "books:" -> "books")
          const keyLine = i > 0 ? lines[i - 1] : null;
          if (keyLine && keyLine.includes(":")) {
            const key = keyLine.replace(":", "").trim();
            if (key) {
              return ok({
                kind: "YamlListFormat",
                key,
                lineIndex: i,
              });
            }
          }
        }

        // Check for direct format using pattern matching
        if (FORMAT_DETECTION_PATTERNS.DIRECT.test(trimmedLine)) {
          return ok({
            kind: "JsonArrayFormat",
            lineIndex: i,
          });
        }

        // Fallback: plain text embedded format
        return ok({
          kind: "PlainTextFormat",
          lineIndex: i,
        });
      }
    }

    // Shouldn't reach here since we checked template.includes(ARRAY_EXPANSION_PLACEHOLDER)
    return ErrorHandler.template({
      operation: "detectItemsPlaceholder",
      method: "findPlaceholder",
    }).invalid(ERROR_MESSAGES.TEMPLATE_ITEMS_NOT_FOUND);
  }

  /**
   * Checks if template ends with array expansion placeholder.
   * More robust than simple string matching.
   * @param template - Template content
   * @returns Boolean indicating if template ends with items placeholder
   */
  endsWithItemsPlaceholder(template: string): boolean {
    const detectionResult = this.detectItemsPlaceholder(template);
    if (!detectionResult.ok) return false;

    const detection = detectionResult.data;
    if (detection.kind === "NoItemsPlaceholder") return false;

    const lines = template.split("\n");
    const lastNonEmptyLineIndex = this.findLastNonEmptyLineIndex(lines);

    return "lineIndex" in detection &&
      detection.lineIndex === lastNonEmptyLineIndex;
  }

  private findLastNonEmptyLineIndex(lines: string[]): number {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() !== "") {
        return i;
      }
    }
    return -1;
  }
}
