import { createLogContext, DebugLogger } from "./debug-logger.ts";
import { SafePropertyAccess } from "../utils/safe-property-access.ts";

/**
 * Log context discriminated union following Totality principles
 * Eliminates optional context parameters in favor of explicit state
 */
export type LogContext =
  | { kind: "with-context"; context: Record<string, unknown> }
  | { kind: "without-context" };

/**
 * Logger state using discriminated union for explicit logging capabilities
 * Follows Totality principle - eliminates optional logger dependencies
 */
export type LoggerState =
  | {
    readonly kind: "enabled";
    readonly logger: DebugLogger;
  }
  | {
    readonly kind: "disabled";
  };

/**
 * Domain-level logging adapter that provides simple methods for domain services.
 * This adapter wraps the existing DebugLogger to maintain DDD boundaries.
 * Supports both legacy optional context and Totality-compliant discriminated union.
 */
export interface DomainLogger {
  /**
   * Log informational messages with discriminated union context (preferred)
   */
  logInfo(
    operation: string,
    message: string,
    logContext: LogContext,
  ): void;

  /**
   * Log informational messages with optional context (deprecated)
   * @deprecated Use logInfo(operation, message, LogContext) for Totality compliance
   */
  logInfo(
    operation: string,
    message: string,
    context?: Record<string, unknown>,
  ): void;

  /**
   * Log debug messages with discriminated union context (preferred)
   */
  logDebug(
    operation: string,
    message: string,
    logContext: LogContext,
  ): void;

  /**
   * Log debug messages with optional context (deprecated)
   * @deprecated Use logDebug(operation, message, LogContext) for Totality compliance
   */
  logDebug(
    operation: string,
    message: string,
    context?: Record<string, unknown>,
  ): void;

  /**
   * Log error messages with discriminated union context (preferred)
   */
  logError(
    operation: string,
    error: unknown,
    logContext: LogContext,
  ): void;

  /**
   * Log error messages with optional context (deprecated)
   * @deprecated Use logError(operation, error, LogContext) for Totality compliance
   */
  logError(
    operation: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): void;

  /**
   * Log warning messages with discriminated union context (preferred)
   */
  logWarning(
    operation: string,
    message: string,
    logContext: LogContext,
  ): void;

  /**
   * Log warning messages with optional context (deprecated)
   * @deprecated Use logWarning(operation, message, LogContext) for Totality compliance
   */
  logWarning(
    operation: string,
    message: string,
    context?: Record<string, unknown>,
  ): void;
}

/**
 * Adapter implementation that wraps DebugLogger for domain use
 * Uses discriminated union for explicit logger state management
 * Following Smart Constructor pattern for Totality compliance
 */
export class DomainLoggerAdapter implements DomainLogger {
  private constructor(private readonly loggerState: LoggerState) {}

  /**
   * Smart Constructor following Totality principles
   * Creates a domain logger adapter with the specified logger state
   */
  static create(loggerState: LoggerState): DomainLoggerAdapter {
    return new DomainLoggerAdapter(loggerState);
  }

  /**
   * Factory method to create an enabled logger
   */
  static createEnabled(logger: DebugLogger): DomainLoggerAdapter {
    return new DomainLoggerAdapter({ kind: "enabled", logger });
  }

  /**
   * Factory method to create a disabled logger
   */
  static createDisabled(): DomainLoggerAdapter {
    return new DomainLoggerAdapter({ kind: "disabled" });
  }

  logInfo(
    operation: string,
    message: string,
    contextOrLogContext?: Record<string, unknown> | LogContext,
  ): void {
    if (this.loggerState.kind === "disabled") return;

    const logContext = this.normalizeLogContext(contextOrLogContext);
    const contextData = this.extractContextData(logContext, operation);
    const debugLogContext = createLogContext(contextData);

    // Result is intentionally ignored to maintain simple domain interface
    this.loggerState.logger.info(message, debugLogContext);
  }

  logDebug(
    operation: string,
    message: string,
    contextOrLogContext?: Record<string, unknown> | LogContext,
  ): void {
    if (this.loggerState.kind === "disabled") return;

    const logContext = this.normalizeLogContext(contextOrLogContext);
    const contextData = this.extractContextData(logContext, operation);
    const debugLogContext = createLogContext(contextData);

    this.loggerState.logger.debug(message, debugLogContext);
  }

  logError(
    operation: string,
    error: unknown,
    contextOrLogContext?: Record<string, unknown> | LogContext,
  ): void {
    if (this.loggerState.kind === "disabled") return;

    const logContext = this.normalizeLogContext(contextOrLogContext);
    const contextData = this.extractContextData(logContext, operation);
    const debugLogContext = createLogContext(contextData);

    const errorMessage = error instanceof Error ? error.message : String(error);
    this.loggerState.logger.error(errorMessage, debugLogContext);
  }

  logWarning(
    operation: string,
    message: string,
    contextOrLogContext?: Record<string, unknown> | LogContext,
  ): void {
    if (this.loggerState.kind === "disabled") return;

    const logContext = this.normalizeLogContext(contextOrLogContext);
    const contextData = this.extractContextData(logContext, operation);
    const debugLogContext = createLogContext(contextData);

    this.loggerState.logger.warn(message, debugLogContext);
  }

  /**
   * Normalizes input to LogContext discriminated union
   * Handles both legacy optional context and new discriminated union
   */
  private normalizeLogContext(
    contextOrLogContext?: Record<string, unknown> | LogContext,
  ): LogContext {
    if (!contextOrLogContext) {
      return { kind: "without-context" };
    }

    // Check if it's already a LogContext discriminated union
    if (
      typeof contextOrLogContext === "object" && "kind" in contextOrLogContext
    ) {
      // Safely check if it has the discriminated union structure
      const recordResult = SafePropertyAccess.asRecord(contextOrLogContext);
      if (recordResult.ok) {
        const record = recordResult.data;
        if (record.kind === "with-context") {
          // Validate the with-context structure
          if (record.context && typeof record.context === "object") {
            const contextRecordResult = SafePropertyAccess.asRecord(
              record.context,
            );
            if (contextRecordResult.ok) {
              return {
                kind: "with-context",
                context: contextRecordResult.data,
              };
            }
          }
        } else if (record.kind === "without-context") {
          return { kind: "without-context" };
        }
      }
    }

    // Treat as legacy optional context - safely convert to Record
    const contextResult = SafePropertyAccess.asRecord(contextOrLogContext);
    if (contextResult.ok) {
      return {
        kind: "with-context",
        context: contextResult.data,
      };
    }

    // Fallback for non-object context
    return { kind: "without-context" };
  }

  /**
   * Extracts context data from LogContext discriminated union
   * Follows Totality principle with exhaustive pattern matching
   */
  private extractContextData(
    logContext: LogContext,
    operation: string,
  ): Record<string, unknown> {
    switch (logContext.kind) {
      case "with-context":
        return {
          operation,
          ...logContext.context,
        };
      case "without-context":
        return {
          operation,
        };
    }
  }
}

/**
 * Null object pattern implementation for cases where logging is not needed
 */
export class NullDomainLogger implements DomainLogger {
  logInfo(
    _operation: string,
    _message: string,
    _contextOrLogContext?: Record<string, unknown> | LogContext,
  ): void {
    // No-op
  }

  logDebug(
    _operation: string,
    _message: string,
    _contextOrLogContext?: Record<string, unknown> | LogContext,
  ): void {
    // No-op
  }

  logError(
    _operation: string,
    _error: unknown,
    _contextOrLogContext?: Record<string, unknown> | LogContext,
  ): void {
    // No-op
  }

  logWarning(
    _operation: string,
    _message: string,
    _contextOrLogContext?: Record<string, unknown> | LogContext,
  ): void {
    // No-op
  }
}

/**
 * Helper functions for creating LogContext discriminated union instances
 */
export class LogContextFactory {
  /**
   * Create LogContext with context data
   */
  static withContext(context: Record<string, unknown>): LogContext {
    return { kind: "with-context", context };
  }

  /**
   * Create LogContext without context data
   */
  static withoutContext(): LogContext {
    return { kind: "without-context" };
  }

  /**
   * Backward compatibility helper - converts optional context to discriminated union
   * @deprecated Use withContext() or withoutContext() for explicit state management
   */
  static fromOptional(context?: Record<string, unknown>): LogContext {
    return context ? this.withContext(context) : this.withoutContext();
  }
}

/**
 * Factory for creating DomainLogger instances with explicit logger states
 * Follows Totality principle with discriminated union approach
 */
export class DomainLoggerFactory {
  /**
   * Create a logger with enabled debug logging
   */
  static createEnabled(debugLogger: DebugLogger): DomainLoggerAdapter {
    return DomainLoggerAdapter.createEnabled(debugLogger);
  }

  /**
   * Create a logger with disabled logging (no-op)
   */
  static createDisabled(): DomainLoggerAdapter {
    return DomainLoggerAdapter.createDisabled();
  }

  /**
   * Backward compatibility helper - converts optional logger to discriminated union
   * @deprecated Use createEnabled() or createDisabled() for explicit state management
   */
  static fromOptional(debugLogger?: DebugLogger): DomainLoggerAdapter {
    return debugLogger
      ? this.createEnabled(debugLogger)
      : this.createDisabled();
  }
}
