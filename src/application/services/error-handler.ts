/**
 * @fileoverview Enhanced Error Handler - Provides error recovery and user-friendly messaging
 * @description Application service for handling errors with recovery strategies and debug information
 * Following DDD principles with comprehensive error handling and recovery patterns
 */

import { err, ok, Result } from "../../domain/shared/types/result.ts";
import {
  ExtractionError,
  ExtractionErrorContext,
  ExtractionErrorContextFactory,
  ExtractionErrorFactory,
  ExtractionResult,
} from "../../domain/errors/extraction-errors.ts";

/**
 * Error handling configuration
 */
export interface ErrorHandlerConfig {
  readonly enableRecovery: boolean;
  readonly debugMode: boolean;
  readonly verboseLogging: boolean;
  readonly maxRecoveryAttempts: number;
  readonly continueOnError: boolean;
}

/**
 * Error recovery strategy types
 */
export type RecoveryStrategy =
  | { kind: "skip"; reason: string }
  | { kind: "defaultValue"; value: unknown; reason: string }
  | { kind: "partialResult"; data: unknown; reason: string }
  | { kind: "retry"; maxAttempts: number; reason: string }
  | { kind: "abort"; reason: string };

/**
 * Error handling result with recovery information
 */
export interface ErrorHandlingResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly errors: Array<ExtractionError & { message: string }>;
  readonly warnings: Array<ExtractionError & { message: string }>;
  readonly recoveryActions: Array<
    { action: RecoveryStrategy; appliedTo: string }
  >;
  readonly debugInfo?: Record<string, unknown>;
}

/**
 * Enhanced Error Handler - Application Service
 * Provides error recovery, user-friendly messaging, and debugging support
 */
export class ErrorHandler {
  private readonly config: ErrorHandlerConfig;
  private readonly recoveryStrategies: Map<string, RecoveryStrategy>;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      enableRecovery: true,
      debugMode: false,
      verboseLogging: false,
      maxRecoveryAttempts: 3,
      continueOnError: true,
      ...config,
    };

    this.recoveryStrategies = new Map();
    this.initializeDefaultRecoveryStrategies();
  }

  /**
   * Smart Constructor
   */
  static create(config: Partial<ErrorHandlerConfig> = {}): ErrorHandler {
    return new ErrorHandler(config);
  }

  /**
   * Handle extraction operation with error recovery
   */
  async handleExtractionOperation<T>(
    operation: () => Promise<ExtractionResult<T>>,
    operationName: string,
    context?: Partial<ExtractionErrorContext>,
  ): Promise<ErrorHandlingResult<T>> {
    const errors: Array<ExtractionError & { message: string }> = [];
    const warnings: Array<ExtractionError & { message: string }> = [];
    const recoveryActions: Array<
      { action: RecoveryStrategy; appliedTo: string }
    > = [];
    let attemptCount = 0;
    let lastResult: ExtractionResult<T> | undefined;

    const fullContext = ExtractionErrorContextFactory.create(
      operationName,
      context?.processingStage || "extraction",
      context?.sourceData,
      context?.schemaContext,
      context?.debugInfo,
    );

    // Attempt operation with recovery
    while (attemptCount < this.config.maxRecoveryAttempts) {
      attemptCount++;

      try {
        const result = await operation();
        lastResult = result;

        if (result.success) {
          // Success - but check for warnings
          if (result.warnings) {
            warnings.push(
              ...result.warnings.map((w) => ({
                ...w,
                message: this.formatErrorMessage(w),
              })),
            );
          }

          return {
            success: true,
            data: result.data,
            errors,
            warnings,
            recoveryActions,
            debugInfo: this.config.debugMode
              ? { attemptCount, context: fullContext }
              : undefined,
          };
        }

        // Operation failed - apply recovery strategy
        const errorWithMessage = {
          ...result.error,
          message: this.formatErrorMessage(result.error),
        };
        errors.push(errorWithMessage);

        if (!this.config.enableRecovery) {
          break;
        }

        const recoveryStrategy = this.selectRecoveryStrategy(
          result.error,
          attemptCount,
        );
        recoveryActions.push({
          action: recoveryStrategy,
          appliedTo: operationName,
        });

        // Apply recovery strategy
        const recoveredResult = this.applyRecoveryStrategy(
          recoveryStrategy,
          result,
          operationName,
          fullContext,
        );

        if (recoveredResult) {
          if (recoveredResult.success) {
            return {
              success: true,
              data: recoveredResult.data,
              errors,
              warnings,
              recoveryActions,
              debugInfo: this.config.debugMode
                ? { attemptCount, context: fullContext, recovered: true }
                : undefined,
            };
          }
          lastResult = recoveredResult;
        }

        // Check if we should continue retrying
        if (recoveryStrategy.kind === "abort" || !this.config.continueOnError) {
          break;
        }
      } catch (error) {
        const extractionError = ExtractionErrorFactory
          .createExtractionRecoverable(
            operationName,
            undefined,
            `Unexpected error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        errors.push(extractionError);
        break;
      }
    }

    // Return partial result if available
    const partialData = lastResult?.success === false
      ? lastResult.partialData
      : undefined;

    return {
      success: false,
      data: partialData,
      errors,
      warnings,
      recoveryActions,
      debugInfo: this.config.debugMode
        ? { attemptCount, context: fullContext, finalResult: lastResult }
        : undefined,
    };
  }

  /**
   * Handle property extraction with smart recovery
   */
  handlePropertyExtraction(
    path: string,
    sourceData: unknown,
    expectedType?: string,
  ): Result<unknown, ExtractionError & { message: string }> {
    try {
      // Validate path
      if (!this.isValidPath(path)) {
        const error = ExtractionErrorFactory.createPropertyPathInvalid(
          path,
          this.getPathValidationError(path),
          this.suggestPathCorrection(path),
        );
        const formattedError = {
          ...error,
          message: this.formatErrorMessage(error),
        };
        return err(formattedError);
      }

      // Attempt extraction
      const result = this.extractPropertyValue(path, sourceData);

      if (result.success) {
        // Validate type if specified
        if (expectedType && !this.validateType(result.data, expectedType)) {
          const actualType = this.getActualType(result.data);
          const typeError = ExtractionErrorFactory
            .createTypeMismatchInExtraction(
              expectedType,
              actualType,
              path,
              result.data,
            );

          // Attempt type conversion if recovery is enabled
          if (this.config.enableRecovery) {
            const convertedValue = this.attemptTypeConversion(
              result.data,
              expectedType,
            );
            if (convertedValue.success) {
              return ok(convertedValue.data);
            }
          }

          const formattedError = {
            ...typeError,
            message: this.formatErrorMessage(typeError),
          };
          return err(formattedError);
        }

        return ok(result.data);
      }

      // Property not found - provide helpful error
      const availablePaths = this.getAvailablePaths(sourceData);
      const notFoundError = ExtractionErrorFactory.createPropertyNotFound(
        path,
        availablePaths,
        "source data",
      );

      const formattedError = {
        ...notFoundError,
        message: this.formatErrorMessage(notFoundError),
      };
      return err(formattedError);
    } catch (error) {
      const recoverableError = ExtractionErrorFactory
        .createExtractionRecoverable(
          path,
          undefined,
          `Extraction failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      return err(recoverableError);
    }
  }

  /**
   * Format error message with user-friendly information
   */
  private formatErrorMessage(error: ExtractionError): string {
    switch (error.kind) {
      case "PropertyPathInvalid":
        return this.formatPropertyPathError(error);
      case "PropertyNotFound":
        return this.formatPropertyNotFoundError(error);
      case "TypeMismatchInExtraction":
        return this.formatTypeMismatchError(error);
      case "ArrayExpansionFailed":
        return this.formatArrayExpansionError(error);
      case "CircularDependency":
        return this.formatCircularDependencyError(error);
      case "DirectiveConflict":
        return this.formatDirectiveConflictError(error);
      case "ExtractionRecoverable":
        return this.formatRecoverableError(error);
      case "SchemaValidationFailed":
        return this.formatSchemaValidationError(error);
    }
  }

  /**
   * Select appropriate recovery strategy based on error type
   */
  private selectRecoveryStrategy(
    error: ExtractionError,
    attemptCount: number,
  ): RecoveryStrategy {
    const strategyKey = `${error.kind}_${attemptCount}`;
    const existingStrategy = this.recoveryStrategies.get(strategyKey);

    if (existingStrategy) {
      return existingStrategy;
    }

    // Default strategies based on error type
    switch (error.kind) {
      case "PropertyNotFound":
        if (attemptCount === 1) {
          return {
            kind: "retry",
            maxAttempts: 2,
            reason: "Retrying operation for recovery",
          };
        }
        return {
          kind: "defaultValue",
          value: null,
          reason: "Property not found, using null as default",
        };
      case "TypeMismatchInExtraction":
        return {
          kind: "retry",
          maxAttempts: 2,
          reason: "Attempting type conversion",
        };
      case "ArrayExpansionFailed":
        return {
          kind: "partialResult",
          data: [],
          reason: "Using empty array as fallback",
        };
      case "CircularDependency":
        return {
          kind: "abort",
          reason: "Circular dependency cannot be resolved",
        };
      case "DirectiveConflict":
        return { kind: "skip", reason: "Skipping conflicting directive" };
      case "ExtractionRecoverable":
        return {
          kind: "partialResult",
          data: error.partialResult,
          reason: "Using partial result",
        };
      default:
        return { kind: "abort", reason: "No recovery strategy available" };
    }
  }

  /**
   * Apply recovery strategy to failed operation
   */
  private applyRecoveryStrategy<T>(
    strategy: RecoveryStrategy,
    failedResult: ExtractionResult<T>,
    _operationName: string,
    _context: ExtractionErrorContext,
  ): ExtractionResult<T> | undefined {
    switch (strategy.kind) {
      case "skip":
        return undefined;

      case "defaultValue":
        return ExtractionErrorContextFactory.createSuccessResult(
          strategy.value as T,
        );

      case "partialResult":
        if (strategy.data !== undefined) {
          return ExtractionErrorContextFactory.createSuccessResult(
            strategy.data as T,
          );
        }
        if (
          failedResult.success === false &&
          failedResult.partialData !== undefined
        ) {
          return ExtractionErrorContextFactory.createSuccessResult(
            failedResult.partialData,
          );
        }
        return undefined;

      case "retry":
        // For retry, we return undefined to signal the caller to retry
        return undefined;

      case "abort":
        return undefined;
    }
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeDefaultRecoveryStrategies(): void {
    // Add default strategies that can be customized
    // PropertyNotFound uses dynamic strategy based on attempt count

    this.recoveryStrategies.set("TypeMismatchInExtraction_1", {
      kind: "retry",
      maxAttempts: 1,
      reason: "Attempting type conversion",
    });

    this.recoveryStrategies.set("ArrayExpansionFailed_1", {
      kind: "partialResult",
      data: [],
      reason: "Using empty array as fallback",
    });
  }

  /**
   * Utility methods for error handling
   */
  private isValidPath(path: string): boolean {
    return !(!path || path.includes("..") || path.startsWith(".") ||
      path.endsWith("."));
  }

  private getPathValidationError(path: string): string {
    if (!path) return "Path cannot be empty";
    if (path.includes("..")) return "Consecutive dots are not allowed";
    if (path.startsWith(".")) return "Path cannot start with dot";
    if (path.endsWith(".")) return "Path cannot end with dot";
    return "Invalid path format";
  }

  private suggestPathCorrection(path: string): string {
    if (path.includes("..")) return path.replace(/\.+/g, ".");
    if (path.startsWith(".")) return path.substring(1);
    if (path.endsWith(".")) return path.slice(0, -1);
    return path;
  }

  private extractPropertyValue(
    path: string,
    data: unknown,
  ): { success: boolean; data?: unknown } {
    try {
      let current = data;
      const segments = path.split(".");

      for (const segment of segments) {
        if (current === null || current === undefined) {
          return { success: false };
        }

        if (typeof current !== "object") {
          return { success: false };
        }

        current = (current as Record<string, unknown>)[segment];
      }

      return { success: true, data: current };
    } catch {
      return { success: false };
    }
  }

  private getAvailablePaths(data: unknown, prefix = ""): string[] {
    if (!data || typeof data !== "object") return [];

    const paths: string[] = [];
    const record = data as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      paths.push(currentPath);

      if (value && typeof value === "object" && !Array.isArray(value)) {
        paths.push(...this.getAvailablePaths(value, currentPath));
      }
    }

    return paths;
  }

  private validateType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number";
      case "boolean":
        return typeof value === "boolean";
      case "array":
        return Array.isArray(value);
      case "object":
        return value !== null && typeof value === "object" &&
          !Array.isArray(value);
      default:
        return true;
    }
  }

  private getActualType(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }

  private attemptTypeConversion(
    value: unknown,
    targetType: string,
  ): { success: boolean; data?: unknown } {
    try {
      switch (targetType) {
        case "string":
          return { success: true, data: String(value) };
        case "number": {
          const num = Number(value);
          return { success: !isNaN(num), data: num };
        }
        case "boolean":
          return { success: true, data: Boolean(value) };
        case "array":
          return {
            success: true,
            data: Array.isArray(value) ? value : [value],
          };
        default:
          return { success: false };
      }
    } catch {
      return { success: false };
    }
  }

  // Error formatting methods
  private formatPropertyPathError(
    error: { path: string; reason: string; suggestion?: string },
  ): string {
    let message =
      `❌ Invalid property path: "${error.path}"\\n   Reason: ${error.reason}`;
    if (error.suggestion) {
      message += `\\n   💡 Try: "${error.suggestion}"`;
    }
    return message;
  }

  private formatPropertyNotFoundError(
    error: { path: string; availablePaths: string[]; searchContext: string },
  ): string {
    let message =
      `❌ Property "${error.path}" not found in ${error.searchContext}`;
    if (error.availablePaths.length > 0) {
      const suggestions = error.availablePaths.slice(0, 3);
      message += `\\n   📋 Available: ${suggestions.join(", ")}`;
    }
    return message;
  }

  private formatTypeMismatchError(
    error: { expected: string; actual: string; path: string; value: unknown },
  ): string {
    return `❌ Type mismatch at "${error.path}"\\n   Expected: ${error.expected}\\n   Got: ${error.actual}\\n   Value: ${
      String(error.value).slice(0, 50)
    }`;
  }

  private formatArrayExpansionError(
    error: { path: string; reason: string; dataStructure: string },
  ): string {
    return `❌ Array expansion failed for "${error.path}"\\n   Reason: ${error.reason}\\n   Structure: ${error.dataStructure}`;
  }

  private formatCircularDependencyError(
    error: { dependencyChain: string[]; conflictingPath: string },
  ): string {
    return `❌ Circular dependency: ${
      error.dependencyChain.join(" → ")
    } → ${error.conflictingPath}`;
  }

  private formatDirectiveConflictError(
    error: {
      conflictingDirectives: string[];
      path: string;
      resolution: string;
    },
  ): string {
    return `⚠️  Directive conflict at "${error.path}": ${
      error.conflictingDirectives.join(", ")
    }\\n   Resolution: ${error.resolution}`;
  }

  private formatRecoverableError(
    error: { path: string; issue: string },
  ): string {
    return `⚠️  Recoverable issue at "${error.path}": ${error.issue}`;
  }

  private formatSchemaValidationError(
    error: { schemaPath: string; validationErrors: string[] },
  ): string {
    return `❌ Schema validation failed at "${error.schemaPath}":\\n   ${
      error.validationErrors.join("\\n   ")
    }`;
  }
}
