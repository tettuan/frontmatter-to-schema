import { createLogContext, DebugLogger } from "./debug-logger.ts";

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
 */
export interface DomainLogger {
  /**
   * Log informational messages
   */
  logInfo(
    operation: string,
    message: string,
    context?: Record<string, unknown>,
  ): void;

  /**
   * Log debug messages for development
   */
  logDebug(
    operation: string,
    message: string,
    context?: Record<string, unknown>,
  ): void;

  /**
   * Log error messages with error objects
   */
  logError(
    operation: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): void;

  /**
   * Log warning messages
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
 */
export class DomainLoggerAdapter implements DomainLogger {
  constructor(private readonly loggerState: LoggerState) {}

  logInfo(
    operation: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (this.loggerState.kind === "disabled") return;

    const logContext = createLogContext({
      operation,
      ...context,
    });

    // Result is intentionally ignored to maintain simple domain interface
    this.loggerState.logger.info(message, logContext);
  }

  logDebug(
    operation: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (this.loggerState.kind === "disabled") return;

    const logContext = createLogContext({
      operation,
      ...context,
    });

    this.loggerState.logger.debug(message, logContext);
  }

  logError(
    operation: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): void {
    if (this.loggerState.kind === "disabled") return;

    const logContext = createLogContext({
      operation,
      ...context,
    });

    const errorMessage = error instanceof Error ? error.message : String(error);
    this.loggerState.logger.error(errorMessage, logContext);
  }

  logWarning(
    operation: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (this.loggerState.kind === "disabled") return;

    const logContext = createLogContext({
      operation,
      ...context,
    });

    this.loggerState.logger.warn(message, logContext);
  }
}

/**
 * Null object pattern implementation for cases where logging is not needed
 */
export class NullDomainLogger implements DomainLogger {
  logInfo(
    _operation: string,
    _message: string,
    _context?: Record<string, unknown>,
  ): void {
    // No-op
  }

  logDebug(
    _operation: string,
    _message: string,
    _context?: Record<string, unknown>,
  ): void {
    // No-op
  }

  logError(
    _operation: string,
    _error: unknown,
    _context?: Record<string, unknown>,
  ): void {
    // No-op
  }

  logWarning(
    _operation: string,
    _message: string,
    _context?: Record<string, unknown>,
  ): void {
    // No-op
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
    return new DomainLoggerAdapter({ kind: "enabled", logger: debugLogger });
  }

  /**
   * Create a logger with disabled logging (no-op)
   */
  static createDisabled(): DomainLoggerAdapter {
    return new DomainLoggerAdapter({ kind: "disabled" });
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
