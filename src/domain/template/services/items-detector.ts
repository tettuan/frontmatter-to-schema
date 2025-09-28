import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";

/**
 * Items pattern detection result containing location and context information.
 */
export interface ItemsPattern {
  readonly path: string[];
  readonly position: number;
  readonly context: string;
  readonly isValid: boolean;
}

/**
 * Detection result containing all found {@items} patterns.
 */
export interface ItemsDetectionResult {
  readonly hasItems: boolean;
  readonly patterns: readonly ItemsPattern[];
  readonly isExpandable: boolean;
}

/**
 * Detection errors following totality principle.
 */
export type ItemsDetectionError =
  | { kind: "InvalidTemplate"; reason: string }
  | { kind: "MalformedPattern"; pattern: string; position: number }
  | { kind: "ConflictingPatterns"; patterns: string[] };

/**
 * Service for detecting {@items} patterns in template content.
 * Implements totality principle with comprehensive error handling.
 */
export class ItemsDetector {
  private constructor() {}

  /**
   * Creates an ItemsDetector instance.
   */
  static create(): ItemsDetector {
    return new ItemsDetector();
  }

  /**
   * Detects {@items} patterns in template content.
   * Returns detection result or error.
   */
  detectItems(
    templateContent: Record<string, unknown>,
  ): Result<ItemsDetectionResult, TemplateError> {
    // Validate that template content is a proper object
    if (
      !templateContent || typeof templateContent !== "object" ||
      Array.isArray(templateContent)
    ) {
      return Result.error(
        new TemplateError(
          "Template content must be a valid object",
          "ITEMS_DETECTION_ERROR",
          { templateContent },
        ),
      );
    }

    try {
      const patterns = this.findItemsPatterns(templateContent, []);

      if (patterns.isError()) {
        return Result.error(
          this.convertDetectionErrorToTemplateError(patterns.unwrapError()),
        );
      }

      const foundPatterns = patterns.unwrap();
      const validPatterns = foundPatterns.filter((p) => p.isValid);

      return Result.ok({
        hasItems: foundPatterns.length > 0,
        patterns: foundPatterns,
        isExpandable: validPatterns.length > 0,
      });
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new TemplateError(
          `Items detection failed: ${errorMessage}`,
          "ITEMS_DETECTION_ERROR",
          { templateContent, error },
        ),
      );
    }
  }

  /**
   * Validates that {@items} patterns are properly formed and positioned.
   */
  validateItemsPatterns(
    patterns: readonly ItemsPattern[],
  ): Result<void, TemplateError> {
    const validationErrors: string[] = [];

    // Check for multiple {@items} in same context
    const contextCounts = new Map<string, number>();
    for (const pattern of patterns) {
      const contextKey = pattern.path.join(".");
      contextCounts.set(contextKey, (contextCounts.get(contextKey) || 0) + 1);
    }

    for (const [context, count] of contextCounts) {
      if (count > 1) {
        validationErrors.push(
          `Multiple {@items} patterns found in same context: ${context}`,
        );
      }
    }

    // Check for nested {@items} patterns
    const sortedPaths = patterns.map((p) => p.path).sort((a, b) =>
      a.join(".").localeCompare(b.join("."))
    );

    for (let i = 0; i < sortedPaths.length - 1; i++) {
      const current = sortedPaths[i];
      const next = sortedPaths[i + 1];

      if (this.isNestedPath(current, next)) {
        validationErrors.push(
          `Nested {@items} patterns detected: ${current.join(".")} and ${
            next.join(".")
          }`,
        );
      }
    }

    if (validationErrors.length > 0) {
      return Result.error(
        new TemplateError(
          `Invalid {@items} patterns: ${validationErrors.join("; ")}`,
          "INVALID_ITEMS_PATTERNS",
          { patterns, errors: validationErrors },
        ),
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Recursively finds {@items} patterns in template content.
   */
  private findItemsPatterns(
    obj: unknown,
    currentPath: string[],
  ): Result<ItemsPattern[], ItemsDetectionError> {
    const patterns: ItemsPattern[] = [];

    if (typeof obj === "string") {
      const stringPatterns = this.findItemsPatternsInString(obj, currentPath);
      if (stringPatterns.isError()) {
        return stringPatterns;
      }
      patterns.push(...stringPatterns.unwrap());
    } else if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const itemResult = this.findItemsPatterns(obj[i], [
          ...currentPath,
          i.toString(),
        ]);
        if (itemResult.isError()) {
          return itemResult;
        }
        patterns.push(...itemResult.unwrap());
      }
    } else if (obj && typeof obj === "object") {
      for (
        const [key, value] of Object.entries(obj as Record<string, unknown>)
      ) {
        const childResult = this.findItemsPatterns(value, [
          ...currentPath,
          key,
        ]);
        if (childResult.isError()) {
          return childResult;
        }
        patterns.push(...childResult.unwrap());
      }
    }

    return Result.ok(patterns);
  }

  /**
   * Finds {@items} patterns in a string value.
   */
  private findItemsPatternsInString(
    str: string,
    path: string[],
  ): Result<ItemsPattern[], ItemsDetectionError> {
    const patterns: ItemsPattern[] = [];
    const itemsRegex = /\{@items\}/g;
    let match;

    while ((match = itemsRegex.exec(str)) !== null) {
      const position = match.index;
      const context = this.extractContext(str, position);

      // Validate pattern format
      if (!this.isValidItemsPattern(str, position)) {
        return Result.error({
          kind: "MalformedPattern",
          pattern: match[0],
          position,
        });
      }

      patterns.push({
        path: [...path],
        position,
        context,
        isValid: this.validatePatternContext(str, position),
      });
    }

    return Result.ok(patterns);
  }

  /**
   * Extracts surrounding context for an {@items} pattern.
   */
  private extractContext(str: string, position: number): string {
    const contextRadius = 50;
    const start = Math.max(0, position - contextRadius);
    const end = Math.min(str.length, position + contextRadius);
    const beforeContext = str.substring(start, position);
    const afterContext = str.substring(position + 8, end); // 8 = "{@items}".length
    return `${beforeContext}{@items}${afterContext}`;
  }

  /**
   * Validates that the {@items} pattern is properly formatted.
   */
  private isValidItemsPattern(str: string, position: number): boolean {
    const beforeChar = position > 0 ? str[position - 1] : "";
    const afterPos = position + 8; // "{@items}".length
    const afterChar = afterPos < str.length ? str[afterPos] : "";

    // Check for proper delimiters or boundaries
    const validBefore = beforeChar === "" || beforeChar === '"' ||
      beforeChar === "'" || /\s/.test(beforeChar);
    const validAfter = afterChar === "" || afterChar === '"' ||
      afterChar === "'" || /\s/.test(afterChar);

    return validBefore && validAfter;
  }

  /**
   * Validates the context where {@items} pattern appears.
   */
  private validatePatternContext(str: string, position: number): boolean {
    // For now, accept all valid patterns
    // Future: Add more sophisticated context validation
    return this.isValidItemsPattern(str, position);
  }

  /**
   * Checks if one path is nested within another.
   */
  private isNestedPath(parent: string[], child: string[]): boolean {
    if (parent.length >= child.length) {
      return false;
    }

    for (let i = 0; i < parent.length; i++) {
      if (parent[i] !== child[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Converts detection error to template error.
   */
  private convertDetectionErrorToTemplateError(
    error: ItemsDetectionError,
  ): TemplateError {
    switch (error.kind) {
      case "InvalidTemplate":
        return new TemplateError(
          `Invalid template for items detection: ${error.reason}`,
          "INVALID_TEMPLATE",
          { reason: error.reason },
        );
      case "MalformedPattern":
        return new TemplateError(
          `Malformed {@items} pattern: ${error.pattern} at position ${error.position}`,
          "MALFORMED_ITEMS_PATTERN",
          { pattern: error.pattern, position: error.position },
        );
      case "ConflictingPatterns":
        return new TemplateError(
          `Conflicting {@items} patterns: ${error.patterns.join(", ")}`,
          "CONFLICTING_ITEMS_PATTERNS",
          { patterns: error.patterns },
        );
    }
  }
}
