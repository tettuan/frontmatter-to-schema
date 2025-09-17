import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";

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
  static default(): TemplateFormatConfig {
    const result = TemplateFormatConfig.create();
    if (!result.ok) {
      throw new Error("Failed to create default TemplateFormatConfig");
    }
    return result.data;
  }

  /**
   * Detect format from content using domain rules
   */
  detectFormatFromContent(
    content: Record<string, unknown>,
  ): TemplateFormatType | null {
    if (!this.detectionStrategy.contentBased) {
      return null;
    }

    const formatType = content.format_type;
    if (typeof formatType !== "string") {
      return null;
    }

    // Use domain-configured keys instead of hardcoded strings
    if (formatType === this.yamlFormatKey) {
      return "yaml";
    }
    if (formatType === this.markdownFormatKey) {
      return "markdown";
    }
    if (formatType === this.jsonFormatKey) {
      return "json";
    }

    return null;
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
