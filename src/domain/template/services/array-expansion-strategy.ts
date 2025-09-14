import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import {
  TemplateFormatDetection,
  TemplateFormatDetector,
} from "../value-objects/template-format-detector.ts";

/**
 * Strategy pattern for handling different array expansion formats.
 * Follows DDD principles with clear separation of concerns.
 */
export class ArrayExpansionStrategy {
  private constructor(
    private readonly formatDetector: TemplateFormatDetector,
  ) {}

  /**
   * Smart Constructor following Totality principles.
   * @returns Result containing strategy instance or error
   */
  static create(): Result<
    ArrayExpansionStrategy,
    TemplateError & { message: string }
  > {
    const detectorResult = TemplateFormatDetector.create();
    if (!detectorResult.ok) return detectorResult;

    return ok(new ArrayExpansionStrategy(detectorResult.data));
  }

  /**
   * Expands {@items} placeholder based on detected format.
   * Handles YAML, JSON, and plain text formats consistently.
   * @param template - Template content
   * @param dataArray - Array data to expand
   * @returns Result containing expanded content or error
   */
  expandItems(
    template: string,
    dataArray: unknown[],
  ): Result<unknown, TemplateError & { message: string }> {
    const detectionResult = this.formatDetector.detectItemsPlaceholder(
      template,
    );
    if (!detectionResult.ok) return detectionResult;

    const detection = detectionResult.data;

    switch (detection.kind) {
      case "NoItemsPlaceholder": {
        return ok(template);
      }

      case "YamlListFormat": {
        return this.expandYamlList(detection, dataArray);
      }

      case "JsonArrayFormat": {
        return this.expandJsonArray(template, dataArray);
      }

      case "PlainTextFormat": {
        return this.expandPlainText(template, dataArray);
      }

      default: {
        // Exhaustive pattern matching ensures all cases handled
        const exhaustiveCheck: never = detection;
        return err(createError({
          kind: "RenderFailed",
          message: `Unhandled detection kind: ${
            JSON.stringify(exhaustiveCheck)
          }`,
        }));
      }
    }
  }

  /**
   * Handles YAML list format expansion.
   * Input: "books:\\n  - {@items}" -> Output: { books: dataArray }
   */
  private expandYamlList(
    detection: Extract<TemplateFormatDetection, { kind: "YamlListFormat" }>,
    dataArray: unknown[],
  ): Result<Record<string, unknown>, TemplateError & { message: string }> {
    return ok({ [detection.key]: dataArray });
  }

  /**
   * Handles JSON array format expansion.
   * Input: "{@items}" -> Output: dataArray
   */
  private expandJsonArray(
    template: string,
    dataArray: unknown[],
  ): Result<unknown, TemplateError & { message: string }> {
    // ✅ Fix: For JSON format, always use string replacement to maintain backward compatibility
    // This matches the original behavior where JSON object properties get stringified
    return this.expandPlainText(template, dataArray);
  }

  /**
   * Handles plain text format expansion.
   * Fallback strategy for embedded {@items} in text.
   */
  private expandPlainText(
    template: string,
    dataArray: unknown[],
  ): Result<string, TemplateError & { message: string }> {
    const expanded = template.replace(
      "{@items}",
      JSON.stringify(dataArray),
    );
    return ok(expanded);
  }

  /**
   * Checks if template should use structured data expansion.
   * Used to determine output format for formatters.
   * @param template - Template content
   * @returns Boolean indicating structured expansion needed
   */
  requiresStructuredExpansion(template: string): boolean {
    const detectionResult = this.formatDetector.detectItemsPlaceholder(
      template,
    );
    if (!detectionResult.ok) return false;

    const detection = detectionResult.data;
    return detection.kind === "YamlListFormat" &&
      this.formatDetector.endsWithItemsPlaceholder(template);
  }
}
