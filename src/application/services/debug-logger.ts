/**
 * @fileoverview Debug Logger - Comprehensive debugging and verbose logging functionality
 * @description Provides detailed logging for troubleshooting extraction and processing operations
 * Following DDD principles with configurable logging levels and structured output
 */

import { SchemaProperty } from "../../domain/schema/value-objects/schema-property-types.ts";
import {
  ExtractionError,
  ExtractionErrorContext,
} from "../../domain/errors/extraction-errors.ts";

/**
 * Debug logging levels
 */
export type DebugLevel =
  | "silent"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "verbose";

/**
 * Debug logging configuration
 */
export interface DebugConfig {
  readonly level: DebugLevel;
  readonly enableTimestamps: boolean;
  readonly enableStackTraces: boolean;
  readonly enableDataDumps: boolean;
  readonly maxDataDumpSize: number;
  readonly outputFormat: "console" | "json" | "structured";
  readonly logToFile?: string;
}

/**
 * Debug log entry structure
 */
export interface DebugLogEntry {
  readonly timestamp: string;
  readonly level: DebugLevel;
  readonly operation: string;
  readonly message: string;
  readonly data?: Record<string, unknown>;
  readonly stackTrace?: string;
  readonly context?: ExtractionErrorContext;
}

/**
 * Debug statistics
 */
export interface DebugStatistics {
  readonly totalOperations: number;
  readonly successfulOperations: number;
  readonly failedOperations: number;
  readonly warningsGenerated: number;
  readonly errorsRecovered: number;
  readonly averageOperationTime: number;
  readonly operationBreakdown: Record<string, number>;
}

/**
 * Debug Logger - Application Service
 * Provides comprehensive debugging and logging functionality
 */
export class DebugLogger {
  private readonly config: DebugConfig;
  private readonly logEntries: DebugLogEntry[] = [];
  private readonly statistics: DebugStatistics;
  private readonly operationTimings: Map<string, number> = new Map();

  constructor(config: Partial<DebugConfig> = {}) {
    this.config = {
      level: "warn",
      enableTimestamps: true,
      enableStackTraces: false,
      enableDataDumps: false,
      maxDataDumpSize: 1000,
      outputFormat: "console",
      ...config,
    };

    this.statistics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      warningsGenerated: 0,
      errorsRecovered: 0,
      averageOperationTime: 0,
      operationBreakdown: {},
    };
  }

  /**
   * Smart Constructor
   */
  static create(config: Partial<DebugConfig> = {}): DebugLogger {
    return new DebugLogger(config);
  }

  /**
   * Log extraction operation start
   */
  logOperationStart(
    operation: string,
    context?: Record<string, unknown>,
  ): string {
    const operationId = this.generateOperationId();
    this.operationTimings.set(operationId, Date.now());

    if (this.shouldLog("debug")) {
      this.log("debug", operation, `Starting operation: ${operation}`, context);
    }

    return operationId;
  }

  /**
   * Log extraction operation completion
   */
  logOperationComplete(
    operationId: string,
    operation: string,
    success: boolean,
    result?: unknown,
    errors?: ExtractionError[],
  ): void {
    const startTime = this.operationTimings.get(operationId);
    const duration = startTime ? Date.now() - startTime : 0;
    this.operationTimings.delete(operationId);

    // Update statistics
    this.updateStatistics(operation, success, duration, errors?.length || 0);

    if (this.shouldLog("debug")) {
      const logData: Record<string, unknown> = {
        operationId,
        duration: `${duration}ms`,
        success,
      };

      if (this.config.enableDataDumps && result) {
        logData.result = this.truncateData(result);
      }

      if (errors && errors.length > 0) {
        logData.errors = errors.map((e) => ({
          kind: e.kind,
          message: this.getErrorSummary(e),
        }));
      }

      this.log(
        "debug",
        operation,
        `Operation completed: ${operation}`,
        logData,
      );
    }
  }

  /**
   * Log directive validation details
   */
  logDirectiveValidation(
    propertyPath: string,
    property: SchemaProperty,
    validationResult: {
      isValid: boolean;
      errors: unknown[];
      warnings: unknown[];
    },
  ): void {
    if (!this.shouldLog("debug")) return;

    const logData: Record<string, unknown> = {
      propertyPath,
      directives: this.extractDirectives(property),
      isValid: validationResult.isValid,
      errorCount: validationResult.errors.length,
      warningCount: validationResult.warnings.length,
    };

    if (this.config.enableDataDumps) {
      logData.validationDetails = {
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      };
    }

    const level = validationResult.isValid ? "debug" : "warn";
    this.log(
      level,
      "DirectiveValidation",
      `Validated directives for ${propertyPath}`,
      logData,
    );
  }

  /**
   * Log property extraction attempt
   */
  logPropertyExtraction(
    path: string,
    sourceData: unknown,
    extractedValue: unknown,
    success: boolean,
    error?: ExtractionError,
  ): void {
    if (!this.shouldLog("debug")) return;

    const logData: Record<string, unknown> = {
      path,
      success,
      extractedType: this.getTypeDescription(extractedValue),
    };

    if (this.config.enableDataDumps) {
      logData.sourceDataStructure = this.analyzeDataStructure(sourceData);
      if (success) {
        logData.extractedValue = this.truncateData(extractedValue);
      }
    }

    if (error) {
      logData.error = {
        kind: error.kind,
        summary: this.getErrorSummary(error),
      };
    }

    const level = success ? "debug" : "warn";
    this.log(
      level,
      "PropertyExtraction",
      `Extracted property: ${path}`,
      logData,
    );
  }

  /**
   * Log array normalization process
   */
  logArrayNormalization(
    path: string,
    originalValue: unknown,
    normalizedValue: unknown[],
    normalizationApplied: boolean,
  ): void {
    if (!this.shouldLog("verbose")) return;

    const logData: Record<string, unknown> = {
      path,
      originalType: this.getTypeDescription(originalValue),
      resultLength: normalizedValue.length,
      normalizationApplied,
    };

    if (this.config.enableDataDumps) {
      logData.originalValue = this.truncateData(originalValue);
      logData.normalizedValue = normalizedValue.map((v) =>
        this.truncateData(v)
      );
    }

    this.log(
      "verbose",
      "ArrayNormalization",
      `Array normalization for ${path}`,
      logData,
    );
  }

  /**
   * Log error recovery attempt
   */
  logErrorRecovery(
    operation: string,
    originalError: ExtractionError,
    recoveryStrategy: string,
    recoverySuccess: boolean,
    recoveredValue?: unknown,
  ): void {
    if (!this.shouldLog("info")) return;

    const logData: Record<string, unknown> = {
      operation,
      originalError: {
        kind: originalError.kind,
        summary: this.getErrorSummary(originalError),
      },
      recoveryStrategy,
      recoverySuccess,
    };

    if (
      recoverySuccess && this.config.enableDataDumps &&
      recoveredValue !== undefined
    ) {
      logData.recoveredValue = this.truncateData(recoveredValue);
    }

    const level = recoverySuccess ? "info" : "warn";
    this.log(
      level,
      "ErrorRecovery",
      `Error recovery attempt for ${operation}`,
      logData,
    );

    if (recoverySuccess) {
      (this.statistics as { errorsRecovered: number }).errorsRecovered++;
    }
  }

  /**
   * Log schema processing context
   */
  logSchemaContext(
    schemaPath: string,
    schemaProperty: SchemaProperty,
    processingStage: string,
  ): void {
    if (!this.shouldLog("verbose")) return;

    const logData: Record<string, unknown> = {
      schemaPath,
      processingStage,
      propertyType: schemaProperty.kind,
      hasDirectives: Object.keys(schemaProperty.extensions || {}).length > 0,
      directives: this.extractDirectives(schemaProperty),
    };

    if (this.config.enableDataDumps) {
      logData.fullSchemaProperty = this.truncateData(schemaProperty);
    }

    this.log(
      "verbose",
      "SchemaProcessing",
      `Processing schema at ${schemaPath}`,
      logData,
    );
  }

  /**
   * Log data transformation steps
   */
  logDataTransformation(
    transformationType: string,
    inputData: unknown,
    outputData: unknown,
    transformationRules: Record<string, unknown>,
  ): void {
    if (!this.shouldLog("debug")) return;

    const logData: Record<string, unknown> = {
      transformationType,
      inputType: this.getTypeDescription(inputData),
      outputType: this.getTypeDescription(outputData),
      transformationRules,
    };

    if (this.config.enableDataDumps) {
      logData.inputData = this.truncateData(inputData);
      logData.outputData = this.truncateData(outputData);
    }

    this.log(
      "debug",
      "DataTransformation",
      `Applied transformation: ${transformationType}`,
      logData,
    );
  }

  /**
   * Get current debug statistics
   */
  /**
   * Log debug message
   */
  logDebug(
    operation: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    this.log("debug", operation, message, data);
  }

  /**
   * Log warning message
   */
  logWarning(
    operation: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    this.log("warn", operation, message, data);
  }

  /**
   * Log info message
   */
  logInfo(
    operation: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    this.log("info", operation, message, data);
  }

  /**
   * Log error message
   */
  logError(
    operation: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    this.log("error", operation, message, data);
  }

  getStatistics(): DebugStatistics {
    return { ...this.statistics };
  }

  /**
   * Export debug log for analysis
   */
  exportDebugLog(): {
    config: DebugConfig;
    statistics: DebugStatistics;
    logEntries: DebugLogEntry[];
    exportedAt: string;
  } {
    return {
      config: this.config,
      statistics: this.getStatistics(),
      logEntries: [...this.logEntries],
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Clear debug log and reset statistics
   */
  clear(): void {
    this.logEntries.length = 0;
    this.operationTimings.clear();
    Object.assign(this.statistics, {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      warningsGenerated: 0,
      errorsRecovered: 0,
      averageOperationTime: 0,
      operationBreakdown: {},
    });
  }

  /**
   * Core logging method
   */
  private log(
    level: DebugLevel,
    operation: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: DebugLogEntry = {
      timestamp: this.config.enableTimestamps ? new Date().toISOString() : "",
      level,
      operation,
      message,
      data,
      stackTrace: this.config.enableStackTraces
        ? this.captureStackTrace()
        : undefined,
    };

    this.logEntries.push(entry);

    // Output based on format
    switch (this.config.outputFormat) {
      case "console":
        this.outputToConsole(entry);
        break;
      case "json":
        this.outputAsJson(entry);
        break;
      case "structured":
        this.outputStructured(entry);
        break;
    }
  }

  /**
   * Check if should log at given level
   */
  private shouldLog(level: DebugLevel): boolean {
    const levels: DebugLevel[] = [
      "silent",
      "error",
      "warn",
      "info",
      "debug",
      "verbose",
    ];
    const configLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= configLevelIndex;
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update statistics
   */
  private updateStatistics(
    operation: string,
    success: boolean,
    duration: number,
    errorCount: number,
  ): void {
    const stats = this.statistics as {
      totalOperations: number;
      successfulOperations: number;
      failedOperations: number;
      warningsGenerated: number;
      averageOperationTime: number;
      operationBreakdown: Record<string, number>;
    };

    stats.totalOperations++;
    if (success) {
      stats.successfulOperations++;
    } else {
      stats.failedOperations++;
    }
    stats.warningsGenerated += errorCount;

    // Update average operation time
    const totalTime = stats.averageOperationTime * (stats.totalOperations - 1) +
      duration;
    stats.averageOperationTime = totalTime / stats.totalOperations;

    // Update operation breakdown
    stats.operationBreakdown[operation] =
      (stats.operationBreakdown[operation] || 0) + 1;
  }

  /**
   * Extract directives from schema property
   */
  private extractDirectives(property: SchemaProperty): string[] {
    if (!property.extensions) return [];
    return Object.keys(property.extensions).filter((key) =>
      key.startsWith("x-")
    );
  }

  /**
   * Get type description for logging
   */
  private getTypeDescription(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return `array[${value.length}]`;
    if (typeof value === "object") {
      return `object{${Object.keys(value).length}}`;
    }
    return typeof value;
  }

  /**
   * Analyze data structure for logging
   */
  private analyzeDataStructure(data: unknown): string {
    if (data === null || data === undefined) return String(data);
    if (typeof data !== "object") return typeof data;
    if (Array.isArray(data)) return `Array[${data.length}]`;

    const obj = data as Record<string, unknown>;
    const keys = Object.keys(obj);
    return `Object{${keys.slice(0, 5).join(", ")}${
      keys.length > 5 ? "..." : ""
    }}`;
  }

  /**
   * Truncate data for logging
   */
  private truncateData(data: unknown): unknown {
    if (typeof data === "string" && data.length > this.config.maxDataDumpSize) {
      return data.slice(0, this.config.maxDataDumpSize) + "...";
    }
    if (Array.isArray(data) && data.length > 10) {
      return [...data.slice(0, 10), `...(${data.length - 10} more items)`];
    }
    return data;
  }

  /**
   * Get error summary for logging
   */
  private getErrorSummary(error: ExtractionError): string {
    switch (error.kind) {
      case "PropertyNotFound":
        return `Property '${error.path}' not found`;
      case "TypeMismatchInExtraction":
        return `Type mismatch: expected ${error.expected}, got ${error.actual}`;
      case "ArrayExpansionFailed":
        return `Array expansion failed for '${error.path}'`;
      case "CircularDependency":
        return `Circular dependency: ${error.dependencyChain.join(" → ")}`;
      case "DirectiveConflict":
        return `Conflicting directives: ${
          error.conflictingDirectives.join(", ")
        }`;
      default:
        return `${error.kind} error`;
    }
  }

  /**
   * Capture stack trace
   */
  private captureStackTrace(): string {
    const stack = new Error().stack;
    return stack
      ? stack.split("\\n").slice(3, 8).join("\\n")
      : "Stack trace not available";
  }

  /**
   * Output methods for different formats
   */
  private outputToConsole(entry: DebugLogEntry): void {
    const prefix = entry.timestamp ? `[${entry.timestamp}] ` : "";
    const levelPrefix = `[${entry.level.toUpperCase()}]`;
    const message =
      `${prefix}${levelPrefix} ${entry.operation}: ${entry.message}`;

    switch (entry.level) {
      case "error":
        console.error(message, entry.data || "");
        break;
      case "warn":
        console.warn(message, entry.data || "");
        break;
      case "info":
        console.info(message, entry.data || "");
        break;
      default:
        console.log(message, entry.data || "");
        break;
    }
  }

  private outputAsJson(entry: DebugLogEntry): void {
    console.log(JSON.stringify(entry, null, 2));
  }

  private outputStructured(entry: DebugLogEntry): void {
    const structured = {
      timestamp: entry.timestamp,
      level: entry.level,
      operation: entry.operation,
      message: entry.message,
      ...(entry.data || {}),
    };
    console.log(JSON.stringify(structured));
  }
}
