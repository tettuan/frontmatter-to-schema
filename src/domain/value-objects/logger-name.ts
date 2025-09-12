/**
 * Logger Name Value Object - Smart Constructor for typed logger names
 *
 * Eliminates hardcoded logger strings and provides type-safe logging
 * following DDD and Totality principles
 *
 * Addresses Issue #677: CLI Hardcoding Violations
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type ValidationError } from "../core/result.ts";

/**
 * Logger categories representing different application domains
 */
export type LoggerCategory =
  | { kind: "CLI"; subsystem?: string }
  | { kind: "Domain"; domain: string; entity?: string }
  | { kind: "Infrastructure"; component: string }
  | { kind: "Application"; service: string; operation?: string }
  | { kind: "System"; process: string };

/**
 * Logger contexts for specific operational phases
 */
export type LoggerContext =
  | "startup"
  | "processing"
  | "validation"
  | "output"
  | "error"
  | "debug"
  | "performance";

/**
 * LoggerName - Validated and typed logger identifier
 *
 * Provides structured naming for loggers with domain context
 * and consistent formatting across the application
 */
export class LoggerName {
  private constructor(
    private readonly category: LoggerCategory,
    private readonly formatted: string,
    private readonly context?: LoggerContext,
  ) {}

  /**
   * Create LoggerName with validation and formatting
   */
  static create(
    category: LoggerCategory,
    context?: LoggerContext,
  ): Result<LoggerName, ValidationError & { message: string }> {
    try {
      const formatted = LoggerName.formatLoggerName(category, context);

      // Validate formatted name length
      if (formatted.length > 100) {
        return {
          ok: false,
          error: createDomainError({
            kind: "TooLong",
            value: formatted,
            maxLength: 100,
            message: `Logger name too long: ${formatted}`,
          }),
        };
      }

      // Validate no invalid characters
      if (LoggerName.containsInvalidChars(formatted)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "PatternMismatch",
            value: formatted,
            pattern: "alphanumeric, dash, underscore only",
            message: `Logger name contains invalid characters: ${formatted}`,
          }),
        };
      }

      return {
        ok: true,
        data: new LoggerName(category, formatted, context),
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: JSON.stringify({ category, context }),
          message: `Failed to create logger name: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        }),
      };
    }
  }

  /**
   * Create CLI logger name (most common use case)
   */
  static createCLI(
    subsystem?: string,
    context?: LoggerContext,
  ): Result<LoggerName, ValidationError & { message: string }> {
    return LoggerName.create({ kind: "CLI", subsystem }, context);
  }

  /**
   * Create domain logger name
   */
  static createDomain(
    domain: string,
    entity?: string,
    context?: LoggerContext,
  ): Result<LoggerName, ValidationError & { message: string }> {
    return LoggerName.create({ kind: "Domain", domain, entity }, context);
  }

  /**
   * Create application service logger name
   */
  static createApplication(
    service: string,
    operation?: string,
    context?: LoggerContext,
  ): Result<LoggerName, ValidationError & { message: string }> {
    return LoggerName.create(
      { kind: "Application", service, operation },
      context,
    );
  }

  /**
   * Get the formatted logger name for use with LoggerFactory
   */
  getName(): string {
    return this.formatted;
  }

  /**
   * Get the logger category
   */
  getCategory(): LoggerCategory {
    return this.category;
  }

  /**
   * Get the logger context
   */
  getContext(): LoggerContext | undefined {
    return this.context;
  }

  /**
   * Create a child logger with additional context
   */
  withContext(
    newContext: LoggerContext,
  ): Result<LoggerName, ValidationError & { message: string }> {
    return LoggerName.create(this.category, newContext);
  }

  /**
   * Check if this logger should be used for a specific context
   */
  matchesContext(context: LoggerContext): boolean {
    return this.context === context;
  }

  /**
   * Business rules: Format logger name according to conventions
   */
  private static formatLoggerName(
    category: LoggerCategory,
    context?: LoggerContext,
  ): string {
    let base = LoggerName.formatCategory(category);

    if (context) {
      base += `-${context}`;
    }

    return base;
  }

  /**
   * Format category part of logger name
   */
  private static formatCategory(category: LoggerCategory): string {
    switch (category.kind) {
      case "CLI":
        return category.subsystem ? `cli-${category.subsystem}` : "CLI";

      case "Domain":
        if (category.entity) {
          return `domain-${category.domain}-${category.entity}`;
        }
        return `domain-${category.domain}`;

      case "Infrastructure":
        return `infra-${category.component}`;

      case "Application":
        if (category.operation) {
          return `app-${category.service}-${category.operation}`;
        }
        return `app-${category.service}`;

      case "System":
        return `sys-${category.process}`;
    }
  }

  /**
   * Validate logger name doesn't contain invalid characters
   */
  private static containsInvalidChars(name: string): boolean {
    // Allow alphanumeric, dash, underscore only
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    return !validPattern.test(name);
  }

  /**
   * String representation
   */
  toString(): string {
    return this.formatted;
  }

  /**
   * Equality comparison
   */
  equals(other: LoggerName): boolean {
    return this.formatted === other.formatted;
  }
}

/**
 * Pre-defined common logger names for CLI operations
 */
export class CLILoggers {
  private static createFallback(name: string): LoggerName {
    // Create a simple LoggerName with system category as fallback
    const fallbackResult = LoggerName.create({ kind: "System", process: name });
    if (fallbackResult.ok) {
      return fallbackResult.data;
    }
    // If even the fallback fails, throw an error since this should never happen
    throw new Error(
      `Critical error: Cannot create fallback logger name for ${name}`,
    );
  }

  static get MAIN(): LoggerName {
    const result = LoggerName.createCLI();
    return result.ok ? result.data : CLILoggers.createFallback("CLI");
  }
  static get EXIT(): LoggerName {
    const result = LoggerName.createCLI("exit");
    return result.ok ? result.data : CLILoggers.createFallback("cli-exit");
  }
  static get VERBOSE(): LoggerName {
    const result = LoggerName.createCLI("verbose");
    return result.ok ? result.data : CLILoggers.createFallback("cli-verbose");
  }
  static get PROCESS(): LoggerName {
    const result = LoggerName.createCLI("process");
    return result.ok ? result.data : CLILoggers.createFallback("cli-process");
  }
  static get SUMMARY(): LoggerName {
    const result = LoggerName.createCLI("summary");
    return result.ok ? result.data : CLILoggers.createFallback("cli-summary");
  }
  static get ERRORS(): LoggerName {
    const result = LoggerName.createCLI("errors");
    return result.ok ? result.data : CLILoggers.createFallback("cli-errors");
  }
  static get OUTPUT(): LoggerName {
    const result = LoggerName.createCLI("output");
    return result.ok ? result.data : CLILoggers.createFallback("cli-output");
  }
  static get VALIDATION(): LoggerName {
    const result = LoggerName.createCLI("validation");
    return result.ok
      ? result.data
      : CLILoggers.createFallback("cli-validation");
  }
  static get HELP(): LoggerName {
    const result = LoggerName.createCLI("help");
    return result.ok ? result.data : CLILoggers.createFallback("cli-help");
  }
}

/**
 * Utility functions for logger name operations
 */
export const LoggerNameUtils = {
  /**
   * Create logger name from legacy string (for migration)
   */
  fromLegacyString(
    legacyName: string,
  ): Result<LoggerName, ValidationError & { message: string }> {
    // Parse common legacy patterns
    if (legacyName === "CLI") {
      return LoggerName.createCLI();
    }

    if (legacyName.startsWith("cli-")) {
      const subsystem = legacyName.substring(4);
      return LoggerName.createCLI(subsystem);
    }

    // Default to system category for unknown patterns
    return LoggerName.create({ kind: "System", process: legacyName });
  },

  /**
   * Validate legacy logger name patterns
   */
  isValidLegacyPattern(name: string): boolean {
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    return validPattern.test(name) && name.length <= 100;
  },

  /**
   * Get all predefined CLI logger names
   */
  getAllCLILoggers(): LoggerName[] {
    return [
      CLILoggers.MAIN,
      CLILoggers.EXIT,
      CLILoggers.VERBOSE,
      CLILoggers.PROCESS,
      CLILoggers.SUMMARY,
      CLILoggers.ERRORS,
      CLILoggers.OUTPUT,
      CLILoggers.VALIDATION,
      CLILoggers.HELP,
    ];
  },
};
