/**
 * Format Detector Service - Smart Constructor Pattern
 *
 * Follows totality principles by eliminating hardcoded format detection logic
 * and providing configurable, extensible format detection.
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";

/**
 * Template format types following totality principle
 */
export type TemplateFormat = "json" | "yaml" | "xml" | "custom";

/**
 * Format detection rule
 */
export interface FormatRule {
  readonly extension: string;
  readonly format: TemplateFormat;
  readonly priority?: number;
}

/**
 * Configuration for format detection
 */
export interface FormatDetectionConfig {
  readonly caseSensitive?: boolean;
  readonly strictMatching?: boolean;
  readonly defaultFormat?: TemplateFormat;
}

/**
 * FormatDetector - Smart Constructor for format detection
 *
 * Eliminates hardcoded format detection logic and provides validation
 * for format rules. Follows totality principle by making all configuration explicit.
 */
export class FormatDetector {
  private constructor(
    readonly rules: Map<string, TemplateFormat>,
    readonly config: FormatDetectionConfig,
  ) {}

  /**
   * Create FormatDetector with custom rules and validation
   * Follows totality principle - no invalid rules allowed
   */
  static create(
    rules: FormatRule[],
    config?: FormatDetectionConfig,
  ): Result<FormatDetector, DomainError & { message: string }> {
    const validationResult = FormatDetector.validateRules(rules);
    if (!validationResult.ok) {
      return validationResult;
    }

    const finalConfig: FormatDetectionConfig = {
      caseSensitive: false,
      strictMatching: true,
      defaultFormat: "custom",
      ...config,
    };

    // Sort rules by priority (higher priority first)
    const sortedRules = [...rules].sort((a, b) =>
      (b.priority || 0) - (a.priority || 0)
    );

    const ruleMap = new Map<string, TemplateFormat>();
    for (const rule of sortedRules) {
      const extension = FormatDetector.normalizeExtension(
        rule.extension,
        finalConfig,
      );
      ruleMap.set(extension, rule.format);
    }

    return {
      ok: true,
      data: new FormatDetector(ruleMap, finalConfig),
    };
  }

  /**
   * Create FormatDetector with default format detection rules
   * Pre-configured for common template formats
   */
  static createDefault(): Result<
    FormatDetector,
    DomainError & { message: string }
  > {
    const defaultRules: FormatRule[] = [
      { extension: ".json", format: "json", priority: 10 },
      { extension: ".yaml", format: "yaml", priority: 10 },
      { extension: ".yml", format: "yaml", priority: 9 },
      { extension: ".xml", format: "xml", priority: 10 },
    ];

    return FormatDetector.create(defaultRules, {
      caseSensitive: false,
      strictMatching: true,
      defaultFormat: "custom",
    });
  }

  /**
   * Create FormatDetector with web-focused format detection
   * Optimized for web template formats
   */
  static createWebFormats(): Result<
    FormatDetector,
    DomainError & { message: string }
  > {
    const webRules: FormatRule[] = [
      { extension: ".json", format: "json", priority: 10 },
      { extension: ".yaml", format: "yaml", priority: 10 },
      { extension: ".yml", format: "yaml", priority: 9 },
      { extension: ".xml", format: "xml", priority: 8 },
      { extension: ".html", format: "custom", priority: 5 },
      { extension: ".htm", format: "custom", priority: 4 },
    ];

    return FormatDetector.create(webRules, {
      caseSensitive: false,
      strictMatching: false,
      defaultFormat: "custom",
    });
  }

  /**
   * Validate format detection rules
   * Follows totality principle - all rules must be explicitly validated
   */
  private static validateRules(
    rules: FormatRule[],
  ): Result<void, DomainError & { message: string }> {
    if (!rules || rules.length === 0) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "EmptyInput",
            field: "rules",
          },
          "Format detection rules cannot be empty",
        ),
      };
    }

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];

      if (!rule.extension || rule.extension.trim() === "") {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "EmptyInput",
              field: `rules[${i}].extension`,
            },
            `Rule ${i} has empty extension`,
          ),
        };
      }

      if (!rule.extension.startsWith(".")) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: rule.extension,
              expectedFormat: "extension starting with dot",
            },
            `Rule ${i} extension must start with dot: ${rule.extension}`,
          ),
        };
      }

      if (rule.extension.length > 10) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "TooLong",
              value: rule.extension,
              maxLength: 10,
            },
            `Rule ${i} extension too long: ${rule.extension}`,
          ),
        };
      }
    }

    // Check for duplicate extensions
    const extensions = new Set<string>();
    for (const rule of rules) {
      const normalizedExt = rule.extension.toLowerCase();
      if (extensions.has(normalizedExt)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidState",
              expected: "unique extensions",
              actual: `duplicate extension: ${rule.extension}`,
            },
            `Duplicate extension found: ${rule.extension}`,
          ),
        };
      }
      extensions.add(normalizedExt);
    }

    return { ok: true, data: undefined };
  }

  /**
   * Normalize extension based on configuration
   */
  private static normalizeExtension(
    extension: string,
    config: FormatDetectionConfig,
  ): string {
    return config.caseSensitive ? extension : extension.toLowerCase();
  }

  /**
   * Detect format from file path
   */
  detect(filepath: string): TemplateFormat {
    if (!filepath) {
      return this.config.defaultFormat || "custom";
    }

    const extension = this.extractExtension(filepath);
    const normalizedExt = FormatDetector.normalizeExtension(
      extension,
      this.config,
    );

    const detectedFormat = this.rules.get(normalizedExt);

    if (detectedFormat) {
      return detectedFormat;
    }

    return this.config.defaultFormat || "custom";
  }

  /**
   * Extract extension from filepath
   */
  private extractExtension(filepath: string): string {
    const lastDotIndex = filepath.lastIndexOf(".");
    const lastSlashIndex = Math.max(
      filepath.lastIndexOf("/"),
      filepath.lastIndexOf("\\"),
    );

    // Extension must be after the last directory separator
    if (lastDotIndex === -1 || lastDotIndex < lastSlashIndex) {
      return "";
    }

    return filepath.substring(lastDotIndex);
  }

  /**
   * Check if format is supported
   */
  isSupported(format: TemplateFormat): boolean {
    return Array.from(this.rules.values()).includes(format);
  }

  /**
   * Get all supported extensions for a format
   */
  getExtensionsForFormat(format: TemplateFormat): string[] {
    const extensions: string[] = [];
    for (const [ext, fmt] of this.rules.entries()) {
      if (fmt === format) {
        extensions.push(ext);
      }
    }
    return extensions;
  }

  /**
   * Get all supported formats
   */
  getSupportedFormats(): TemplateFormat[] {
    return Array.from(new Set(this.rules.values()));
  }

  /**
   * Get detection information for debugging
   */
  getDetectionInfo(): {
    rules: Array<{ extension: string; format: TemplateFormat }>;
    config: FormatDetectionConfig;
  } {
    const rules = Array.from(this.rules.entries()).map((
      [extension, format],
    ) => ({
      extension,
      format,
    }));

    return {
      rules,
      config: this.config,
    };
  }

  /**
   * Create a new detector with additional rules
   * Immutable update pattern following totality principles
   */
  withAdditionalRules(
    newRules: FormatRule[],
  ): Result<FormatDetector, DomainError & { message: string }> {
    const existingRules = Array.from(this.rules.entries()).map((
      [extension, format],
    ) => ({
      extension,
      format,
      priority: 5, // Default priority for existing rules
    }));

    const allRules = [...existingRules, ...newRules];
    return FormatDetector.create(allRules, this.config);
  }

  /**
   * Create a new detector with modified configuration
   */
  withConfig(
    newConfig: Partial<FormatDetectionConfig>,
  ): Result<FormatDetector, DomainError & { message: string }> {
    const existingRules = Array.from(this.rules.entries()).map((
      [extension, format],
    ) => ({
      extension,
      format,
      priority: 5,
    }));

    const mergedConfig = { ...this.config, ...newConfig };
    return FormatDetector.create(existingRules, mergedConfig);
  }

  /**
   * Get default format
   */
  getDefaultFormat(): TemplateFormat {
    return this.config.defaultFormat || "custom";
  }
}
