import { createLogContext, DebugLogger } from "./debug-logger.ts";

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
 */
export class DomainLoggerAdapter implements DomainLogger {
  constructor(private readonly debugLogger?: DebugLogger) {}

  logInfo(
    operation: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (!this.debugLogger) return;

    const logContext = createLogContext({
      operation,
      ...context,
    });

    // Result is intentionally ignored to maintain simple domain interface
    this.debugLogger.info(message, logContext);
  }

  logDebug(
    operation: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (!this.debugLogger) return;

    const logContext = createLogContext({
      operation,
      ...context,
    });

    this.debugLogger.debug(message, logContext);
  }

  logError(
    operation: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): void {
    if (!this.debugLogger) return;

    const logContext = createLogContext({
      operation,
      ...context,
    });

    const errorMessage = error instanceof Error ? error.message : String(error);
    this.debugLogger.error(errorMessage, logContext);
  }

  logWarning(
    operation: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (!this.debugLogger) return;

    const logContext = createLogContext({
      operation,
      ...context,
    });

    this.debugLogger.warn(message, logContext);
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
