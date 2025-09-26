/**
 * @fileoverview Console Domain Logger Implementation
 * @description Infrastructure layer implementation of DomainLogger using console output
 * Provides safe console logging with proper error handling and Result<T,E> pattern
 */

import type { Result } from "../../domain/shared/types/result.ts";
import type { DomainError } from "../../domain/shared/types/errors.ts";
import type {
  DomainLogger,
  LogContext,
  LogMessage,
} from "../../domain/shared/interfaces/domain-logger.ts";

/**
 * Console-based implementation of DomainLogger
 * Infrastructure layer component - safe to use console here
 * Implements proper error handling following Totality principles
 */
export class ConsoleDomainLogger implements DomainLogger {
  private readonly isEnabled: boolean;

  constructor(enabled = true) {
    this.isEnabled = enabled;
  }

  /**
   * Log debug information to console
   * Safe implementation with error handling
   */
  logDebug(
    context: LogContext,
    message: LogMessage,
  ): Result<void, DomainError & { message: string }> {
    if (!this.isEnabled) {
      return { ok: true, data: undefined };
    }

    try {
      const formattedMessage = this.formatMessage(context, message);
      console.log(formattedMessage);
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "UnknownError",
          field: "console-logging",
          message: `Console logging failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      };
    }
  }

  /**
   * Log trace information to console
   * Safe implementation with error handling
   */
  logTrace(
    context: LogContext,
    message: LogMessage,
  ): Result<void, DomainError & { message: string }> {
    if (!this.isEnabled) {
      return { ok: true, data: undefined };
    }

    try {
      switch (message.kind) {
        case "trace": {
          if (message.data) {
            console.log(
              message.prefix,
              JSON.stringify(message.data, null, 2),
            );
          } else {
            console.log(message.prefix);
          }
          break;
        }
        case "debug":
        case "structured": {
          const formattedMessage = this.formatMessage(context, message);
          console.log(formattedMessage);
          break;
        }
      }
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "UnknownError",
          field: "console-trace-logging",
          message: `Console trace logging failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      };
    }
  }

  /**
   * Log structured data to console
   * Safe implementation with error handling
   */
  logStructured(
    context: LogContext,
    data: unknown,
  ): Result<void, DomainError & { message: string }> {
    if (!this.isEnabled) {
      return { ok: true, data: undefined };
    }

    try {
      const logEntry = {
        domain: context.domain,
        operation: context.operation,
        location: context.location,
        timestamp: new Date().toISOString(),
        data,
      };

      console.log(JSON.stringify(logEntry, null, 2));
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "UnknownError",
          field: "console-structured-logging",
          message: `Console structured logging failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      };
    }
  }

  /**
   * Format log message for console output
   * Private helper following single responsibility principle
   */
  private formatMessage(context: LogContext, message: LogMessage): string {
    const timestamp = new Date().toISOString();
    const prefix =
      `[${timestamp}] [${context.domain}] [${context.operation}] [${context.location}]`;

    switch (message.kind) {
      case "debug":
        return `${prefix} ${message.content}`;

      case "trace":
        return message.data
          ? `${prefix} ${message.prefix} ${
            JSON.stringify(message.data, null, 2)
          }`
          : `${prefix} ${message.prefix}`;

      case "structured":
        return `${prefix} ${JSON.stringify(message.metadata, null, 2)}`;
    }
  }
}

/**
 * No-Op implementation for production environments
 * Follows Totality principle - always returns success
 */
export class NoOpDomainLogger implements DomainLogger {
  logDebug(): Result<void, DomainError & { message: string }> {
    return { ok: true, data: undefined };
  }

  logTrace(): Result<void, DomainError & { message: string }> {
    return { ok: true, data: undefined };
  }

  logStructured(): Result<void, DomainError & { message: string }> {
    return { ok: true, data: undefined };
  }
}

/**
 * Factory for creating appropriate logger instances
 * Infrastructure layer responsibility
 */
export class DomainLoggerFactory {
  /**
   * Create logger based on environment
   * Development: Console logging enabled
   * Production: No-op logging
   */
  static create(environment = "development"): DomainLogger {
    switch (environment) {
      case "development":
      case "test":
        return new ConsoleDomainLogger(true);
      case "production":
        return new NoOpDomainLogger();
      default:
        return new ConsoleDomainLogger(false);
    }
  }

  /**
   * Create console logger with explicit enablement
   * For cases where console output is specifically needed
   */
  static createConsoleLogger(enabled = true): ConsoleDomainLogger {
    return new ConsoleDomainLogger(enabled);
  }

  /**
   * Create no-op logger
   * For cases where logging should be disabled
   */
  static createNoOpLogger(): NoOpDomainLogger {
    return new NoOpDomainLogger();
  }
}
