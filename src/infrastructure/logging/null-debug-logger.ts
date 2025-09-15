import { ok, Result } from "../../domain/shared/types/result.ts";
import {
  DebugLogger,
  LogContext,
  LogError,
  LogLevel,
} from "../../domain/shared/services/debug-logger.ts";

/**
 * Null Object Pattern implementation of DebugLogger.
 * Used for testing and when logging is disabled.
 * All operations succeed but produce no output.
 */
export class NullDebugLogger implements DebugLogger {
  private constructor() {}

  /**
   * Smart Constructor for NullDebugLogger
   */
  static create(): Result<NullDebugLogger, never> {
    return ok(new NullDebugLogger());
  }

  log(
    _level: LogLevel,
    _message: string,
    _context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return ok(undefined);
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

  withContext(_baseContext: LogContext): DebugLogger {
    return this;
  }
}
