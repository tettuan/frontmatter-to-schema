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
 * Context information for structured logging using discriminated union pattern (Future)
 * This replaces LogContext with type-safe alternatives eliminating optional properties
 */
export type StructuredLogContext =
  | {
    kind: "basic";
    timestamp: string;
    [key: string]: unknown;
  }
  | {
    kind: "operation";
    timestamp: string;
    operation: string;
    location: string;
    [key: string]: unknown;
  }
  | {
    kind: "progress";
    timestamp: string;
    operation: string;
    progress: string;
    [key: string]: unknown;
  }
  | {
    kind: "decision";
    timestamp: string;
    operation: string;
    decisions: string[];
    [key: string]: unknown;
  };

/**
 * Context information for structured logging (Legacy - to be replaced)
 * @deprecated Use StructuredLogContext instead for new code
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
 * Helper function to create structured log context with timestamp
 */
export function createStructuredLogContext(
  context: Omit<LogContext, "timestamp"> = {},
): StructuredLogContext {
  const timestamp = new Date().toISOString();
  const { operation, decisions, progress, location, ...rest } = context;

  // Determine context type based on provided properties with proper type guards
  if (
    typeof operation === "string" &&
    Array.isArray(decisions) &&
    decisions.length > 0 &&
    decisions.every((d) => typeof d === "string")
  ) {
    return {
      kind: "decision",
      timestamp,
      operation,
      decisions: decisions as string[],
      ...rest,
    };
  } else if (typeof operation === "string" && typeof progress === "string") {
    return {
      kind: "progress",
      timestamp,
      operation,
      progress,
      ...rest,
    };
  } else if (typeof operation === "string" && typeof location === "string") {
    return {
      kind: "operation",
      timestamp,
      operation,
      location,
      ...rest,
    };
  } else {
    return {
      kind: "basic",
      timestamp,
      ...context,
    };
  }
}

/**
 * Helper function to create basic structured log context
 */
export function createBasicLogContext(
  additionalContext: Record<string, unknown> = {},
): StructuredLogContext {
  return {
    kind: "basic",
    timestamp: new Date().toISOString(),
    ...additionalContext,
  };
}

/**
 * Helper function to create operation structured log context
 */
export function createOperationLogContext(
  operation: string,
  location: string,
  additionalContext: Record<string, unknown> = {},
): StructuredLogContext {
  return {
    kind: "operation",
    timestamp: new Date().toISOString(),
    operation,
    location,
    ...additionalContext,
  };
}

/**
 * Helper function to create progress structured log context
 */
export function createProgressLogContext(
  operation: string,
  progress: string,
  additionalContext: Record<string, unknown> = {},
): StructuredLogContext {
  return {
    kind: "progress",
    timestamp: new Date().toISOString(),
    operation,
    progress,
    ...additionalContext,
  };
}

/**
 * Helper function to create decision structured log context
 */
export function createDecisionLogContext(
  operation: string,
  decisions: string[],
  additionalContext: Record<string, unknown> = {},
): StructuredLogContext {
  return {
    kind: "decision",
    timestamp: new Date().toISOString(),
    operation,
    decisions,
    ...additionalContext,
  };
}

/**
 * Helper function to convert structured context to legacy context for backwards compatibility
 */
export function toLegacyLogContext(context: StructuredLogContext): LogContext {
  const { kind: _kind, ...rest } = context;
  switch (context.kind) {
    case "basic": {
      return {
        ...rest,
        timestamp: context.timestamp,
      };
    }
    case "operation": {
      return {
        ...rest,
        operation: context.operation,
        location: context.location,
        timestamp: context.timestamp,
      };
    }
    case "progress": {
      return {
        ...rest,
        operation: context.operation,
        progress: context.progress,
        timestamp: context.timestamp,
      };
    }
    case "decision": {
      return {
        ...rest,
        operation: context.operation,
        decisions: context.decisions,
        timestamp: context.timestamp,
      };
    }
  }
}

/**
 * Helper function to create log context with timestamp (Legacy)
 * @deprecated Use createStructuredLogContext instead
 */
export function createLogContext(
  context: Omit<LogContext, "timestamp"> = {},
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

/**
 * Processing details for progress logging
 */
export interface ProcessingDetails {
  readonly operation: string;
  readonly itemsProcessed: number;
  readonly totalItems: number;
  readonly currentItem?: string;
  readonly elapsedMs?: number;
}

/**
 * Performance metrics for operation logging
 */
export interface PerformanceMetrics {
  readonly operation: string;
  readonly duration: number;
  readonly memoryUsed?: number;
  readonly itemCount?: number;
}

/**
 * Enhanced DebugLogger with specialized methods for unified logging architecture.
 * Provides CLI-specific logging methods while maintaining DDD and Totality principles.
 */
export interface EnhancedDebugLogger extends DebugLogger {
  /**
   * Log CLI output that should always be visible (even when not verbose)
   * Used for help text, version info, and user-facing output
   */
  output(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }>;

  /**
   * Log CLI error output that should always be visible
   * Used for error messages that must reach the user
   */
  errorOutput(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }>;

  /**
   * Log processing progress with structured context
   * Used for file processing and pipeline progress
   */
  progress(
    stage: string,
    details: ProcessingDetails,
  ): Result<void, LogError & { message: string }>;

  /**
   * Log performance metrics
   * Used for timing and resource usage reporting
   */
  metrics(
    operation: string,
    metrics: PerformanceMetrics,
  ): Result<void, LogError & { message: string }>;

  /**
   * Get current logger context
   */
  getContext(): LogContext;
}
