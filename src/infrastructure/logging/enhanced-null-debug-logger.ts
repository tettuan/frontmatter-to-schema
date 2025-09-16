import { ok, Result } from "../../domain/shared/types/result.ts";
import {
  EnhancedDebugLogger,
  LogContext,
  LogError,
  LogLevel,
  LogLevels,
  PerformanceMetrics,
  ProcessingDetails,
} from "../../domain/shared/services/debug-logger.ts";

/**
 * Enhanced null implementation of DebugLogger that does nothing.
 * Follows Totality principle with complete implementation of all methods.
 * Used when logging is disabled or in test environments.
 */
export class EnhancedNullDebugLogger implements EnhancedDebugLogger {
  private readonly level: LogLevel;
  private readonly enabled: boolean;

  private constructor(level: LogLevel, enabled: boolean) {
    this.level = level;
    this.enabled = enabled;
  }

  /**
   * Smart constructor following Totality principle
   */
  static create(
    level: LogLevel = LogLevels.ERROR,
    enabled: boolean = false,
  ): Result<EnhancedNullDebugLogger, LogError & { message: string }> {
    return ok(new EnhancedNullDebugLogger(level, enabled));
  }

  /**
   * Create a disabled logger
   */
  static createDisabled(): Result<
    EnhancedNullDebugLogger,
    LogError & { message: string }
  > {
    return EnhancedNullDebugLogger.create(LogLevels.ERROR, false);
  }

  error(
    _message: string,
    _context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return ok(undefined);
  }

  warn(
    _message: string,
    _context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return ok(undefined);
  }

  info(
    _message: string,
    _context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return ok(undefined);
  }

  debug(
    _message: string,
    _context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return ok(undefined);
  }

  trace(
    _message: string,
    _context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return ok(undefined);
  }

  withContext(_baseContext: LogContext): EnhancedDebugLogger {
    return this;
  }

  output(
    _message: string,
    _context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return ok(undefined);
  }

  errorOutput(
    _message: string,
    _context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return ok(undefined);
  }

  progress(
    _stage: string,
    _details: ProcessingDetails,
  ): Result<void, LogError & { message: string }> {
    return ok(undefined);
  }

  metrics(
    _operation: string,
    _metrics: PerformanceMetrics,
  ): Result<void, LogError & { message: string }> {
    return ok(undefined);
  }

  withOperationContext(_operation: string): EnhancedDebugLogger {
    return this;
  }

  createChild(_context: LogContext): EnhancedDebugLogger {
    return this;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  log(
    _level: LogLevel,
    _message: string,
    _context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return ok(undefined);
  }

  getContext(): LogContext {
    return {
      component: "null-logger",
      timestamp: new Date().toISOString(),
    };
  }
}
