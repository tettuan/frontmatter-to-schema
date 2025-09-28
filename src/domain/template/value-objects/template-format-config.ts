import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";

/**
 * Domain configuration for template format detection
 * Eliminates hardcoded format type strings following DDD principles
 */
export type TemplateFormatType = "json" | "yaml" | "markdown";

export interface TemplateFormatDetectionStrategy {
  readonly contentBased: boolean;
  readonly pathBased: boolean;
  readonly defaultFormat: TemplateFormatType;
}

/**
 * Template format configuration following Totality principles
 * Replaces hardcoded format_type strings with proper domain abstractions
 */
export class TemplateFormatConfig {
  private constructor(
    private readonly yamlFormatKey: string,
    private readonly markdownFormatKey: string,
    private readonly jsonFormatKey: string,
    private readonly detectionStrategy: TemplateFormatDetectionStrategy,
  ) {}

  /**
   * Smart constructor following Totality principles
   */
  static create(
    detectionStrategy?: Partial<TemplateFormatDetectionStrategy>,
  ): Result<TemplateFormatConfig, TemplateError & { message: string }> {
    const strategy: TemplateFormatDetectionStrategy = {
      contentBased: true,
      pathBased: true,
      defaultFormat: "json",
      ...detectionStrategy,
    };

    return ok(
      new TemplateFormatConfig(
        "yaml",
        "markdown",
        "json",
        strategy,
      ),
    );
  }

  /**
   * Default configuration instance
   */
  static default(): Result<
    TemplateFormatConfig,
    TemplateError & { message: string }
  > {
    return TemplateFormatConfig.create();
  }

  /**
   * Detect format from content using domain rules
   * Following Totality principles - total function returning Result<T,E>
   */
  detectFormatFromContent(
    content: Record<string, unknown>,
  ): Result<TemplateFormatType, TemplateError & { message: string }> {
    if (!this.detectionStrategy.contentBased) {
      return ErrorHandler.template({
        operation: "detectFormatFromContent",
        method: "checkStrategy",
      }).invalid(
        "Content-based detection is disabled in strategy configuration",
      );
    }

    const formatType = content.format_type;
    if (typeof formatType !== "string") {
      return ErrorHandler.template({
        operation: "detectFormatFromContent",
        method: "validateFormatType",
      }).invalid("format_type property must be a string");
    }

    // Use domain-configured keys instead of hardcoded strings
    if (formatType === this.yamlFormatKey) {
      return ok("yaml");
    }
    if (formatType === this.markdownFormatKey) {
      return ok("markdown");
    }
    if (formatType === this.jsonFormatKey) {
      return ok("json");
    }

    return ErrorHandler.template({
      operation: "detectFormatFromContent",
      method: "validateFormat",
    }).invalid(`Unsupported format type: ${formatType}`);
  }

  /**
   * Get default format according to strategy
   */
  getDefaultFormat(): TemplateFormatType {
    return this.detectionStrategy.defaultFormat;
  }

  /**
   * Check if path-based detection is enabled
   */
  isPathBasedDetectionEnabled(): boolean {
    return this.detectionStrategy.pathBased;
  }

  /**
   * Get format keys for external integrations
   */
  getFormatKeys(): {
    yaml: string;
    markdown: string;
    json: string;
  } {
    return {
      yaml: this.yamlFormatKey,
      markdown: this.markdownFormatKey,
      json: this.jsonFormatKey,
    };
  }
}
