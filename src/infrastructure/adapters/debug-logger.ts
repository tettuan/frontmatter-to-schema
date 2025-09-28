/**
 * Debug logging infrastructure for enhanced processing flow visibility.
 * Implements issue #798 requirements for debug output functionality.
 */

import { Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";

/**
 * Debug levels for controlling log output verbosity
 */
export enum DebugLevel {
  ERROR = 0, // Errors only
  WARNING = 1, // Warnings and errors
  INFO = 2, // Info, warnings, and errors
  DEBUG = 3, // All debug information
}

/**
 * Log entry structure for structured JSON logging
 */
export interface LogEntry {
  readonly timestamp: string;
  readonly level: string;
  readonly stage: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Debug logger interface for enhanced processing flow visibility
 */
export interface DebugLogger {
  logSchemaResolution(path: string, success: boolean, details?: string): void;
  logFrontmatterParsing(
    file: string,
    result: Result<unknown, DomainError>,
  ): void;
  logTemplateRendering(template: string, variables: string[]): void;
  logAggregation(rule: string, items: number): void;
  logDerivationRule(
    sourcePath: string,
    targetField: string,
    success: boolean,
    details?: string,
  ): void;
  logRefResolution(ref: string, success: boolean, details?: string): void;
  logVariableReplacement(
    variable: string,
    value: string,
    success: boolean,
  ): void;
  logExtensionDetection(
    extensionName: string,
    found: boolean,
    value?: unknown,
  ): void;
  logError(
    stage: string,
    error: DomainError,
    context?: Record<string, unknown>,
  ): void;
  logInfo(
    stage: string,
    message: string,
    details?: Record<string, unknown>,
  ): void;
  logDebug(
    stage: string,
    message: string,
    details?: Record<string, unknown>,
  ): void;
}

/**
 * Console-based debug logger implementation with environment variable control
 */
export class ConsoleDebugLogger implements DebugLogger {
  private readonly debugLevel: DebugLevel;
  private readonly enableJsonOutput: boolean;

  constructor() {
    this.debugLevel = this.parseDebugLevel();
    this.enableJsonOutput = Deno.env.get("DEBUG_JSON") === "true";
  }

  private parseDebugLevel(): DebugLevel {
    const level = Deno.env.get("DEBUG_LEVEL");
    switch (level) {
      case "0":
        return DebugLevel.ERROR;
      case "1":
        return DebugLevel.WARNING;
      case "2":
        return DebugLevel.INFO;
      case "3":
        return DebugLevel.DEBUG;
      default:
        return DebugLevel.ERROR; // Default to error only
    }
  }

  private shouldLog(level: DebugLevel): boolean {
    return level <= this.debugLevel;
  }

  private createLogEntry(
    level: string,
    stage: string,
    message: string,
    details?: Record<string, unknown>,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      stage,
      message,
      details,
    };
  }

  private outputLog(entry: LogEntry): void {
    if (this.enableJsonOutput) {
      console.log(JSON.stringify(entry));
    } else {
      const detailsStr = entry.details
        ? ` ${JSON.stringify(entry.details)}`
        : "";
      console.log(
        `[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.stage}] ${entry.message}${detailsStr}`,
      );
    }
  }

  logSchemaResolution(path: string, success: boolean, details?: string): void {
    if (!this.shouldLog(DebugLevel.INFO)) return;

    const entry = this.createLogEntry(
      "info",
      "schema-resolution",
      `Schema resolution for path '${path}': ${success ? "SUCCESS" : "FAILED"}`,
      { path, success, details },
    );
    this.outputLog(entry);
  }

  logFrontmatterParsing(
    file: string,
    result: Result<unknown, DomainError>,
  ): void {
    if (result.ok) {
      if (!this.shouldLog(DebugLevel.DEBUG)) return;
      const entry = this.createLogEntry(
        "debug",
        "frontmatter-parsing",
        `Frontmatter parsing for '${file}': SUCCESS`,
        { file, success: true },
      );
      this.outputLog(entry);
    } else {
      if (!this.shouldLog(DebugLevel.ERROR)) return;
      const errorMessage = "message" in result.error
        ? result.error.message
        : `Error kind: ${result.error.kind}`;
      const entry = this.createLogEntry(
        "error",
        "frontmatter-parsing",
        `Frontmatter parsing for '${file}': FAILED - ${errorMessage}`,
        { file, success: false, error: result.error },
      );
      this.outputLog(entry);
    }
  }

  logTemplateRendering(template: string, variables: string[]): void {
    if (!this.shouldLog(DebugLevel.INFO)) return;

    const entry = this.createLogEntry(
      "info",
      "template-rendering",
      `Template rendering for '${template}' with ${variables.length} variables`,
      { template, variables },
    );
    this.outputLog(entry);
  }

  logAggregation(rule: string, items: number): void {
    if (!this.shouldLog(DebugLevel.INFO)) return;

    const entry = this.createLogEntry(
      "info",
      "aggregation",
      `Aggregation rule '${rule}' processed ${items} items`,
      { rule, items },
    );
    this.outputLog(entry);
  }

  logDerivationRule(
    sourcePath: string,
    targetField: string,
    success: boolean,
    details?: string,
  ): void {
    if (!this.shouldLog(DebugLevel.INFO)) return;

    const entry = this.createLogEntry(
      "info",
      "derivation-rule",
      `Derivation rule ${sourcePath} -> ${targetField}: ${
        success ? "SUCCESS" : "FAILED"
      }`,
      { sourcePath, targetField, success, details },
    );
    this.outputLog(entry);
  }

  logRefResolution(ref: string, success: boolean, details?: string): void {
    if (!this.shouldLog(DebugLevel.DEBUG)) return;

    const entry = this.createLogEntry(
      "debug",
      "ref-resolution",
      `$ref resolution for '${ref}': ${success ? "SUCCESS" : "FAILED"}`,
      { ref, success, details },
    );
    this.outputLog(entry);
  }

  logVariableReplacement(
    variable: string,
    value: string,
    success: boolean,
  ): void {
    if (!this.shouldLog(DebugLevel.DEBUG)) return;

    const entry = this.createLogEntry(
      "debug",
      "variable-replacement",
      `Variable replacement '${variable}' -> '${value}': ${
        success ? "SUCCESS" : "FAILED"
      }`,
      { variable, value, success },
    );
    this.outputLog(entry);
  }

  logExtensionDetection(
    extensionName: string,
    found: boolean,
    value?: unknown,
  ): void {
    if (!this.shouldLog(DebugLevel.DEBUG)) return;

    const entry = this.createLogEntry(
      "debug",
      "extension-detection",
      `Extension '${extensionName}': ${found ? "FOUND" : "NOT_FOUND"}`,
      { extensionName, found, value },
    );
    this.outputLog(entry);
  }

  logError(
    stage: string,
    error: DomainError,
    context?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog(DebugLevel.ERROR)) return;

    const errorMessage = "message" in error
      ? error.message
      : `Error kind: ${error.kind}`;
    const errorInfo = "message" in error
      ? { kind: error.kind, message: error.message }
      : { kind: error.kind, details: error };

    const entry = this.createLogEntry(
      "error",
      stage,
      `Error: ${errorMessage}`,
      { error: errorInfo, context },
    );
    this.outputLog(entry);
  }

  logInfo(
    stage: string,
    message: string,
    details?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog(DebugLevel.INFO)) return;

    const entry = this.createLogEntry("info", stage, message, details);
    this.outputLog(entry);
  }

  logDebug(
    stage: string,
    message: string,
    details?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog(DebugLevel.DEBUG)) return;

    const entry = this.createLogEntry("debug", stage, message, details);
    this.outputLog(entry);
  }
}

/**
 * No-op debug logger for production or when debugging is disabled
 */
export class NoOpDebugLogger implements DebugLogger {
  logSchemaResolution(): void {}
  logFrontmatterParsing(): void {}
  logTemplateRendering(): void {}
  logAggregation(): void {}
  logDerivationRule(): void {}
  logRefResolution(): void {}
  logVariableReplacement(): void {}
  logExtensionDetection(): void {}
  logError(): void {}
  logInfo(): void {}
  logDebug(): void {}
}

/**
 * Factory for creating debug logger instances based on environment
 */
export class DebugLoggerFactory {
  static create(): DebugLogger {
    try {
      const debugEnabled = Deno.env.get("DEBUG_LEVEL") !== undefined;
      return debugEnabled ? new ConsoleDebugLogger() : new NoOpDebugLogger();
    } catch (_error) {
      // If environment access is not permitted, default to NoOpDebugLogger
      // This prevents permission errors from breaking the application
      return new NoOpDebugLogger();
    }
  }
}
