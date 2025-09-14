import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";

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
    if (!template.includes("{@items}")) {
      return ok({ kind: "NoItemsPlaceholder" });
    }

    const lines = template.split("\n");

    // Find the line containing {@items}
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("{@items}")) {
        // Check for YAML list format: "  - {@items}" or "  - \"{@items}\""
        const trimmedLine = line.trim();
        if (trimmedLine === "- {@items}" || trimmedLine === '- "{@items}"') {
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

        // Check for direct {@items} format
        if (trimmedLine === "{@items}" || trimmedLine === '"{@items}"') {
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

    // Shouldn't reach here since we checked template.includes("{@items}")
    return err(createError({
      kind: "RenderFailed",
      message: "Template contains {@items} but could not locate it in lines",
    }));
  }

  /**
   * Checks if template ends with {@items} placeholder.
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
