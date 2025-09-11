/**
 * File Pattern Matcher Service - Smart Constructor Pattern
 *
 * Follows totality principles by eliminating hardcoded pattern matching logic
 * and providing configurable, validated pattern matching.
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";
import { PATTERN_LENGTH_LIMIT } from "../shared/constants.ts";

/**
 * Configuration for pattern matching rules
 */
export interface PatternMatchingConfig {
  readonly caseSensitive?: boolean;
  readonly dotMatches?: boolean;
  readonly multiline?: boolean;
}

/**
 * FilePatternMatcher - Smart Constructor for file pattern matching
 *
 * Eliminates hardcoded pattern matching logic and provides validation
 * for pattern syntax. Follows totality principle by making all configuration explicit.
 */
export class FilePatternMatcher {
  private constructor(
    readonly pattern: RegExp,
    readonly originalPattern: string,
    readonly config: PatternMatchingConfig,
  ) {}

  /**
   * Create FilePatternMatcher with validation
   * Follows totality principle - no invalid patterns allowed
   */
  static create(
    pattern: string,
    config?: PatternMatchingConfig,
  ): Result<FilePatternMatcher, DomainError & { message: string }> {
    const validationResult = FilePatternMatcher.validatePattern(pattern);
    if (!validationResult.ok) {
      return validationResult;
    }

    const finalConfig: PatternMatchingConfig = {
      caseSensitive: true,
      dotMatches: false,
      multiline: false,
      ...config,
    };

    try {
      const convertedPattern = FilePatternMatcher.convertGlobToRegex(
        pattern,
        finalConfig,
      );
      const flags = FilePatternMatcher.createRegexFlags(finalConfig);
      const regex = new RegExp(convertedPattern, flags);

      return {
        ok: true,
        data: new FilePatternMatcher(regex, pattern, finalConfig),
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidRegex",
            pattern,
          },
          `Failed to create pattern matcher: ${error}`,
        ),
      };
    }
  }

  /**
   * Create FilePatternMatcher for common glob patterns
   * Pre-configured for typical file matching scenarios
   */
  static createGlob(
    pattern: string,
  ): Result<FilePatternMatcher, DomainError & { message: string }> {
    return FilePatternMatcher.create(pattern, {
      caseSensitive: false,
      dotMatches: false,
      multiline: false,
    });
  }

  /**
   * Create FilePatternMatcher for strict matching
   * Case-sensitive and exact pattern matching
   */
  static createStrict(
    pattern: string,
  ): Result<FilePatternMatcher, DomainError & { message: string }> {
    return FilePatternMatcher.create(pattern, {
      caseSensitive: true,
      dotMatches: true,
      multiline: false,
    });
  }

  /**
   * Validate pattern syntax before processing
   * Follows totality principle - all patterns must be explicitly validated
   */
  private static validatePattern(
    pattern: string,
  ): Result<void, DomainError & { message: string }> {
    if (!pattern || pattern.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "EmptyInput",
            field: "pattern",
          },
          "Pattern cannot be empty",
        ),
      };
    }

    if (PATTERN_LENGTH_LIMIT.isExceeded(pattern.length)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "TooLong",
            value: pattern,
            maxLength: PATTERN_LENGTH_LIMIT.getValue(),
          },
          "Pattern too long for performance reasons",
        ),
      };
    }

    // Check for potentially dangerous patterns
    if (pattern.includes(".*.*.*")) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "PatternMismatch",
            value: pattern,
            pattern: "safe pattern without excessive wildcards",
          },
          "Pattern contains excessive wildcards that could cause performance issues",
        ),
      };
    }

    return { ok: true, data: undefined };
  }

  /**
   * Convert glob pattern to regex
   * Configurable conversion following totality principles
   */
  private static convertGlobToRegex(
    pattern: string,
    config: PatternMatchingConfig,
  ): string {
    let regexPattern = pattern
      .replace(/\./g, "\\.") // Escape dots
      .replace(/\*/g, ".*") // Convert * to .*
      .replace(/\?/g, "."); // Convert ? to .

    // Handle dot matching configuration
    if (!config.dotMatches) {
      // Don't match hidden files by default
      regexPattern = regexPattern.replace(/^\.\*/, "[^.]*");
    }

    // Anchor the pattern to match full filename
    return `^${regexPattern}$`;
  }

  /**
   * Create regex flags based on configuration
   */
  private static createRegexFlags(config: PatternMatchingConfig): string {
    let flags = "";

    if (!config.caseSensitive) {
      flags += "i";
    }

    if (config.multiline) {
      flags += "m";
    }

    if (config.dotMatches) {
      flags += "s";
    }

    return flags;
  }

  /**
   * Test if filename matches the pattern
   */
  matches(filename: string): boolean {
    if (!filename) {
      return false;
    }

    return this.pattern.test(filename);
  }

  /**
   * Test multiple filenames against the pattern
   * Returns array of matching filenames
   */
  filterMatches(filenames: string[]): string[] {
    return filenames.filter((filename) => this.matches(filename));
  }

  /**
   * Get pattern information for debugging
   */
  getPatternInfo(): {
    originalPattern: string;
    regexPattern: string;
    config: PatternMatchingConfig;
  } {
    return {
      originalPattern: this.originalPattern,
      regexPattern: this.pattern.source,
      config: this.config,
    };
  }

  /**
   * Create a new matcher with modified configuration
   * Immutable update pattern following totality principles
   */
  withConfig(
    newConfig: Partial<PatternMatchingConfig>,
  ): Result<FilePatternMatcher, DomainError & { message: string }> {
    const mergedConfig = { ...this.config, ...newConfig };
    return FilePatternMatcher.create(this.originalPattern, mergedConfig);
  }

  /**
   * Check if pattern is case sensitive
   */
  isCaseSensitive(): boolean {
    return this.config.caseSensitive ?? true;
  }

  /**
   * Check if pattern matches hidden files
   */
  matchesHiddenFiles(): boolean {
    return this.config.dotMatches ?? false;
  }

  /**
   * Get the original pattern string
   */
  getOriginalPattern(): string {
    return this.originalPattern;
  }
}
