/**
 * Placeholder Processor
 *
 * Unified placeholder replacement logic following DDD and Totality principles.
 * Consolidates duplicate placeholder processing from SimpleTemplateMapper and NativeTemplateStrategy.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

/**
 * Smart Constructor for Placeholder Pattern validation
 * Following Totality principle - constrained value type
 */
export class PlaceholderPattern {
  private constructor(readonly pattern: RegExp, readonly name: string) {}

  static create(
    patternType: PlaceholderPatternType,
  ): Result<PlaceholderPattern, DomainError & { message: string }> {
    try {
      switch (patternType) {
        case "mustache":
          return {
            ok: true,
            data: new PlaceholderPattern(/\{\{([^}]+)\}\}/g, "mustache"),
          };
        case "dollar":
          return {
            ok: true,
            data: new PlaceholderPattern(/\$\{([^}]+)\}/g, "dollar"),
          };
        case "percent":
          return {
            ok: true,
            data: new PlaceholderPattern(/%([^%]+)%/g, "percent"),
          };
        default:
          return {
            ok: false,
            error: createDomainError({
              kind: "InvalidFormat",
              input: patternType,
              expectedFormat: "mustache, dollar, or percent",
            }, `Unsupported placeholder pattern type: ${patternType}`),
          };
      }
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidRegex",
            pattern: patternType,
          },
          `Failed to create placeholder pattern: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  getPattern(): RegExp {
    return this.pattern;
  }

  getName(): string {
    return this.name;
  }
}

/**
 * Supported placeholder pattern types
 */
export type PlaceholderPatternType = "mustache" | "dollar" | "percent";

/**
 * Context for placeholder processing
 */
export interface PlaceholderProcessingContext {
  data: Record<string, unknown>;
  patternType: PlaceholderPatternType;
  strictMode: boolean; // If true, fail on missing placeholders
}

/**
 * Result of placeholder processing
 * Following Totality principle - discriminated union for clear state representation
 */
export type PlaceholderProcessingResult =
  | { kind: "Success"; processedContent: unknown; replacedCount: number }
  | {
    kind: "PartialSuccess";
    processedContent: unknown;
    missingPlaceholders: string[];
  }
  | { kind: "Failure"; error: DomainError & { message: string } };

/**
 * Unified Placeholder Processor
 * Consolidates placeholder replacement logic from multiple sources
 */
export class PlaceholderProcessor {
  /**
   * Process placeholders in template content
   * Consolidates logic from SimpleTemplateMapper.replacePlaceholders() and NativeTemplateStrategy.applyDataToTemplate()
   */
  process(
    templateContent: unknown,
    context: PlaceholderProcessingContext,
  ): Result<PlaceholderProcessingResult, DomainError & { message: string }> {
    const patternResult = PlaceholderPattern.create(context.patternType);
    if (!patternResult.ok) {
      return {
        ok: false,
        error: patternResult.error,
      };
    }

    try {
      const result = this.processContent(
        templateContent,
        context,
        patternResult.data,
      );

      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidAnalysisContext",
            context: templateContent,
          },
          `Placeholder processing failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Process content recursively
   * Unified logic from both SimpleTemplateMapper and NativeTemplateStrategy
   */
  private processContent(
    content: unknown,
    context: PlaceholderProcessingContext,
    pattern: PlaceholderPattern,
  ): PlaceholderProcessingResult {
    const missingPlaceholders: string[] = [];
    let replacedCount = 0;

    const processedContent = this.processRecursive(
      content,
      context,
      pattern,
      missingPlaceholders,
      (count) => replacedCount += count,
    );

    // Determine result type based on missing placeholders and strict mode
    if (missingPlaceholders.length === 0) {
      return {
        kind: "Success",
        processedContent,
        replacedCount,
      };
    }

    if (context.strictMode) {
      return {
        kind: "Failure",
        error: createDomainError(
          {
            kind: "NotFound",
            resource: "placeholders",
            name: missingPlaceholders.join(", "),
          },
          `Missing placeholders in strict mode: ${
            missingPlaceholders.join(", ")
          }`,
        ),
      };
    }

    return {
      kind: "PartialSuccess",
      processedContent,
      missingPlaceholders,
    };
  }

  /**
   * Recursive content processing
   * Handles strings, arrays, and objects uniformly
   */
  private processRecursive(
    content: unknown,
    context: PlaceholderProcessingContext,
    pattern: PlaceholderPattern,
    missingPlaceholders: string[],
    onReplace: (count: number) => void,
  ): unknown {
    if (typeof content === "string") {
      return this.processStringContent(
        content,
        context,
        pattern,
        missingPlaceholders,
        onReplace,
      );
    }

    if (Array.isArray(content)) {
      return content.map((item) =>
        this.processRecursive(
          item,
          context,
          pattern,
          missingPlaceholders,
          onReplace,
        )
      );
    }

    if (typeof content === "object" && content !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(content)) {
        result[key] = this.processRecursive(
          value,
          context,
          pattern,
          missingPlaceholders,
          onReplace,
        );
      }
      return result;
    }

    // Return primitive values as-is
    return content;
  }

  /**
   * Process string content with placeholder replacement
   * Consolidated from SimpleTemplateMapper and NativeTemplateStrategy
   */
  private processStringContent(
    content: string,
    context: PlaceholderProcessingContext,
    pattern: PlaceholderPattern,
    missingPlaceholders: string[],
    onReplace: (count: number) => void,
  ): string {
    let result = content;
    let replaceCount = 0;

    // For single placeholder strings (like "{{path.to.value}}")
    if (this.isSinglePlaceholder(content, pattern)) {
      const placeholderPath = this.extractPlaceholderPath(content, pattern);
      if (placeholderPath) {
        const valueResult = this.getValueByPath(context.data, placeholderPath);
        if (valueResult.ok) {
          onReplace(1);
          return String(valueResult.data ?? "");
        } else {
          if (!missingPlaceholders.includes(placeholderPath)) {
            missingPlaceholders.push(placeholderPath);
          }
          return content; // Return original placeholder if value not found
        }
      }
    }

    // For strings with multiple placeholders
    result = content.replace(pattern.getPattern(), (match, path) => {
      const valueResult = this.getValueByPath(context.data, path.trim());
      if (valueResult.ok) {
        replaceCount++;
        return String(valueResult.data ?? "");
      } else {
        if (!missingPlaceholders.includes(path.trim())) {
          missingPlaceholders.push(path.trim());
        }
        return match; // Keep original placeholder if value not found
      }
    });

    onReplace(replaceCount);
    return result;
  }

  /**
   * Check if string contains only a single placeholder
   */
  private isSinglePlaceholder(
    content: string,
    pattern: PlaceholderPattern,
  ): boolean {
    const matches = content.match(pattern.getPattern());
    return matches !== null && matches.length === 1 && matches[0] === content;
  }

  /**
   * Extract placeholder path from single placeholder string
   */
  private extractPlaceholderPath(
    content: string,
    pattern: PlaceholderPattern,
  ): string | null {
    // Reset regex lastIndex
    const regex = new RegExp(
      pattern.getPattern().source,
      pattern.getPattern().flags,
    );
    const match = regex.exec(content);
    return match ? match[1].trim() : null;
  }

  /**
   * Get value by path with Result type (Totality principle)
   * Consolidated from NativeTemplateStrategy.getValueByPath()
   */
  public getValueByPath(
    data: Record<string, unknown>,
    path: string,
  ): Result<unknown, DomainError & { message: string }> {
    if (!path || path.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Placeholder path cannot be empty"),
      };
    }

    const parts = path.split(".");
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return {
          ok: false,
          error: createDomainError({
            kind: "NotFound",
            resource: "path",
            name: path,
            key: part,
          }, `Path "${path}" not found: value is null/undefined at "${part}"`),
        };
      }

      if (typeof current !== "object") {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: typeof current,
              expectedFormat: "object",
            },
            `Path "${path}" not found: expected object at "${part}" but got ${typeof current}`,
          ),
        };
      }

      const obj = current as Record<string, unknown>;
      if (!(part in obj)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "NotFound",
            resource: "property",
            name: part,
            key: path,
          }, `Path "${path}" not found: property "${part}" does not exist`),
        };
      }

      current = obj[part];
    }

    return { ok: true, data: current };
  }
}

/**
 * Factory for creating pre-configured PlaceholderProcessor instances
 *
 * @deprecated Use TemplateDomainFactory from component-factory.ts for better domain separation
 */
export class PlaceholderProcessorFactory {
  /**
   * Create processor with mustache-style placeholders ({{variable}})
   * Default configuration matching SimpleTemplateMapper behavior
   */
  static createMustacheProcessor(): PlaceholderProcessor {
    return new PlaceholderProcessor();
  }

  /**
   * Create processor with dollar-style placeholders (${variable})
   */
  static createDollarProcessor(): PlaceholderProcessor {
    return new PlaceholderProcessor();
  }

  /**
   * Create processor with percent-style placeholders (%variable%)
   */
  static createPercentProcessor(): PlaceholderProcessor {
    return new PlaceholderProcessor();
  }
}

/**
 * Utility functions for common placeholder operations
 */
export class PlaceholderUtils {
  /**
   * Extract all placeholder paths from content
   */
  static extractPlaceholders(
    content: string,
    patternType: PlaceholderPatternType = "mustache",
  ): Result<string[], DomainError & { message: string }> {
    const patternResult = PlaceholderPattern.create(patternType);
    if (!patternResult.ok) {
      return patternResult;
    }

    const placeholders: string[] = [];
    const pattern = patternResult.data.getPattern();
    let match;

    // Reset regex lastIndex to ensure we get all matches
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(content)) !== null) {
      const placeholder = match[1].trim();
      if (!placeholders.includes(placeholder)) {
        placeholders.push(placeholder);
      }
    }

    return { ok: true, data: placeholders };
  }

  /**
   * Validate that all required placeholders are present in data
   */
  static validatePlaceholders(
    placeholders: string[],
    data: Record<string, unknown>,
  ): Result<void, DomainError & { message: string }> {
    const processor = new PlaceholderProcessor();
    const missing: string[] = [];

    for (const placeholder of placeholders) {
      // Use public method for validation
      const result = processor.getValueByPath(data, placeholder);
      if (!result.ok) {
        missing.push(placeholder);
      }
    }

    if (missing.length > 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotFound",
          resource: "placeholders",
          name: missing.join(", "),
        }, `Missing required placeholders: ${missing.join(", ")}`),
      };
    }

    return { ok: true, data: undefined };
  }
}
