/**
 * Logging Decorator Service
 *
 * Eliminates verbose logging pattern duplication through decorator pattern.
 * Provides structured logging with consistent context management following
 * DDD principles and AI complexity control guidelines.
 */

import { StructuredLogger } from "../shared/structured-logger.ts";

/**
 * Logging context for structured messages
 */
export interface LoggingContext {
  service: string;
  operation: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logging decorator that eliminates verbose logging duplication
 */
export class LoggingDecoratorService {
  private static verboseMode: boolean = false;

  /**
   * Set verbose mode globally
   */
  static setVerboseMode(enabled: boolean): void {
    this.verboseMode = enabled;
  }

  /**
   * Get current verbose mode status
   */
  static isVerboseMode(): boolean {
    return this.verboseMode;
  }

  /**
   * Log with automatic verbose mode check - eliminates if (verboseMode) pattern
   */
  static logInfo(context: LoggingContext, message: string): void {
    if (!this.verboseMode) return;

    const logger = StructuredLogger.getServiceLogger(context.service);
    logger.info(message, context.metadata || {});
  }

  /**
   * Log debug information with verbose check
   */
  static logDebug(context: LoggingContext, message: string): void {
    if (!this.verboseMode) return;

    const logger = StructuredLogger.getServiceLogger(context.service);
    logger.debug(message, context.metadata || {});
  }

  /**
   * Log warning with verbose check
   */
  static logWarning(context: LoggingContext, message: string): void {
    if (!this.verboseMode) return;

    const logger = StructuredLogger.getServiceLogger(context.service);
    logger.warn(message, context.metadata || {});
  }

  /**
   * Log error (always logged regardless of verbose mode)
   */
  static logError(context: LoggingContext, message: string, error?: unknown): void {
    const logger = StructuredLogger.getServiceLogger(context.service);
    logger.error(message, { ...context.metadata, error });
  }

  /**
   * Create a logging decorator for a class method
   */
  static decorateMethod<T extends (...args: any[]) => any>(
    context: LoggingContext,
    method: T,
    options?: {
      logEntry?: boolean;
      logExit?: boolean;
      logArgs?: boolean;
      logResult?: boolean;
    }
  ): T {
    const { logEntry = true, logExit = true, logArgs = false, logResult = false } = options || {};

    return ((...args: Parameters<T>) => {
      if (logEntry) {
        this.logInfo(
          { ...context, metadata: { ...context.metadata, args: logArgs ? args : undefined } },
          `Starting ${context.operation}`
        );
      }

      try {
        const result = method(...args);

        if (logExit) {
          this.logInfo(
            { ...context, metadata: { ...context.metadata, result: logResult ? result : undefined } },
            `Completed ${context.operation}`
          );
        }

        return result;
      } catch (error) {
        this.logError(
          { ...context, metadata: { ...context.metadata, args: logArgs ? args : undefined } },
          `Failed ${context.operation}`,
          error
        );
        throw error;
      }
    }) as T;
  }

  /**
   * Create an async logging decorator for promises
   */
  static decorateAsyncMethod<T extends (...args: any[]) => Promise<any>>(
    context: LoggingContext,
    method: T,
    options?: {
      logEntry?: boolean;
      logExit?: boolean;
      logArgs?: boolean;
      logResult?: boolean;
    }
  ): T {
    const { logEntry = true, logExit = true, logArgs = false, logResult = false } = options || {};

    return (async (...args: Parameters<T>) => {
      if (logEntry) {
        this.logInfo(
          { ...context, metadata: { ...context.metadata, args: logArgs ? args : undefined } },
          `Starting ${context.operation}`
        );
      }

      try {
        const result = await method(...args);

        if (logExit) {
          this.logInfo(
            { ...context, metadata: { ...context.metadata, result: logResult ? result : undefined } },
            `Completed ${context.operation}`
          );
        }

        return result;
      } catch (error) {
        this.logError(
          { ...context, metadata: { ...context.metadata, args: logArgs ? args : undefined } },
          `Failed ${context.operation}`,
          error
        );
        throw error;
      }
    }) as T;
  }

  /**
   * Batch log multiple operations with common context
   */
  static logBatch(
    baseContext: LoggingContext,
    operations: Array<{ operation: string; metadata?: Record<string, unknown> }>
  ): void {
    if (!this.verboseMode) return;

    operations.forEach(({ operation, metadata }) => {
      this.logInfo(
        { ...baseContext, operation, metadata: { ...baseContext.metadata, ...metadata } },
        `Batch operation: ${operation}`
      );
    });
  }

  /**
   * Log progress with percentage and context
   */
  static logProgress(
    context: LoggingContext,
    current: number,
    total: number,
    customMessage?: string
  ): void {
    if (!this.verboseMode) return;

    const percentage = Math.round((current / total) * 100);
    const message = customMessage || `Progress: ${current}/${total} (${percentage}%)`;

    this.logInfo(
      { ...context, metadata: { ...context.metadata, current, total, percentage } },
      message
    );
  }
}