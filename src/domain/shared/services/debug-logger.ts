import { Result } from "../types/result.ts";

/**
 * Log level using discriminated union pattern for type safety
 */
export type LogLevel =
  | { readonly kind: "error"; readonly priority: 0 }
  | { readonly kind: "warn"; readonly priority: 1 }
  | { readonly kind: "info"; readonly priority: 2 }
  | { readonly kind: "debug"; readonly priority: 3 }
  | { readonly kind: "trace"; readonly priority: 4 };

/**
 * Log error types following Totality principles
 */
export type LogError =
  | { kind: "WriteFailed"; destination: string; cause: string }
  | { kind: "FormatError"; template: string; data: unknown }
  | {
    kind: "LevelFiltered";
    requestedLevel: LogLevel;
    configuredLevel: LogLevel;
  }
  | { kind: "LoggerDisabled"; reason: string };

/**
 * Context information for structured logging
 */
export interface LogContext {
  readonly operation?: string;
  readonly location?: string;
  readonly inputs?: string;
  readonly decisions?: string[];
  readonly progress?: string;
  readonly timestamp: string;
  readonly contextDepth?: number;
  readonly [key: string]: unknown;
}

/**
 * DebugLogger interface following DDD and Totality principles.
 * Provides logging functionality without creating dual execution paths.
 * All operations return Result<T,E> for complete error handling.
 */
export interface DebugLogger {
  /**
   * Log a message at the specified level
   */
  log(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }>;

  /**
   * Log an error message
   */
  error(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }>;

  /**
   * Log a warning message
   */
  warn(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }>;

  /**
   * Log an info message
   */
  info(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }>;

  /**
   * Log a debug message
   */
  debug(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }>;

  /**
   * Log a trace message
   */
  trace(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }>;

  /**
   * Create a logger with additional context
   */
  withContext(baseContext: LogContext): DebugLogger;
}

/**
 * Log level constants for easy access
 */
export const LogLevels = {
  ERROR: { kind: "error" as const, priority: 0 as const },
  WARN: { kind: "warn" as const, priority: 1 as const },
  INFO: { kind: "info" as const, priority: 2 as const },
  DEBUG: { kind: "debug" as const, priority: 3 as const },
  TRACE: { kind: "trace" as const, priority: 4 as const },
} as const;

/**
 * Helper function to create log context with timestamp
 */
export function createLogContext(
  context: Omit<LogContext, "timestamp">,
): LogContext {
  return {
    ...context,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper function to determine if a level should be logged
 */
export function shouldLogLevel(
  requestedLevel: LogLevel,
  configuredLevel: LogLevel,
): boolean {
  return requestedLevel.priority <= configuredLevel.priority;
}
