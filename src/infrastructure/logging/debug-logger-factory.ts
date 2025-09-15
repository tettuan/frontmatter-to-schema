import { err, ok, Result } from "../../domain/shared/types/result.ts";
import {
  DebugLogger,
  LogContext,
  LogLevel,
  LogLevels,
} from "../../domain/shared/services/debug-logger.ts";
import { NullDebugLogger } from "./null-debug-logger.ts";
import { ConsoleDebugLogger } from "./console-debug-logger.ts";

/**
 * Factory error types
 */
export type DebugLoggerFactoryError =
  | { kind: "InvalidConfiguration"; reason: string }
  | { kind: "CreationFailed"; cause: string };

/**
 * Configuration for logger creation using discriminated unions
 */
export type LoggerConfiguration =
  | { readonly kind: "disabled" }
  | {
    readonly kind: "console";
    readonly level: LogLevel;
    readonly baseContext?: LogContext;
  }
  | { readonly kind: "null" };

/**
 * Factory for creating DebugLogger instances following DDD and Totality principles.
 * Provides centralized logger creation with proper error handling.
 */
export class DebugLoggerFactory {
  private constructor() {}

  /**
   * Create a DebugLogger based on configuration
   */
  static create(
    config: LoggerConfiguration,
  ): Result<
    DebugLogger,
    DebugLoggerFactoryError & { message: string }
  > {
    switch (config.kind) {
      case "disabled":
      case "null":
        return DebugLoggerFactory.createNull();

      case "console":
        return DebugLoggerFactory.createConsole(
          config.level,
          true,
          config.baseContext,
        );
    }
  }

  /**
   * Create logger for verbose mode compatibility (legacy support)
   */
  static createForVerbose(
    verbose: boolean,
    baseContext?: LogContext,
  ): Result<
    DebugLogger,
    DebugLoggerFactoryError & { message: string }
  > {
    if (!verbose) {
      return DebugLoggerFactory.createNull();
    }

    return DebugLoggerFactory.createConsole(
      LogLevels.DEBUG,
      true,
      baseContext,
    );
  }

  /**
   * Create logger from environment or CLI configuration
   */
  static createFromEnvironment(
    verboseFlag?: boolean,
    logLevel?: string,
  ): Result<
    DebugLogger,
    DebugLoggerFactoryError & { message: string }
  > {
    // Priority: explicit log level > verbose flag > default (disabled)
    if (logLevel) {
      const levelResult = DebugLoggerFactory.parseLogLevel(logLevel);
      if (!levelResult.ok) {
        return err({
          kind: "InvalidConfiguration",
          reason: `Invalid log level: ${logLevel}`,
          message: `Invalid log level: ${logLevel}`,
        });
      }

      const config: LoggerConfiguration = {
        kind: "console",
        level: levelResult.data,
      };
      return DebugLoggerFactory.create(config);
    }

    if (verboseFlag !== undefined) {
      return DebugLoggerFactory.createForVerbose(verboseFlag);
    }

    // Default: disabled
    return DebugLoggerFactory.createNull();
  }

  private static createNull(): Result<
    DebugLogger,
    DebugLoggerFactoryError & { message: string }
  > {
    const result = NullDebugLogger.create();
    if (!result.ok) {
      // This should never happen, but for completeness
      return err({
        kind: "CreationFailed",
        cause: "Failed to create null logger",
        message: "Failed to create null logger",
      });
    }
    return ok(result.data);
  }

  private static createConsole(
    level: LogLevel,
    enabled: boolean,
    baseContext?: LogContext,
  ): Result<
    DebugLogger,
    DebugLoggerFactoryError & { message: string }
  > {
    const result = ConsoleDebugLogger.create(level, enabled, baseContext);
    if (!result.ok) {
      return err({
        kind: "CreationFailed",
        cause: result.error.message,
        message: `Failed to create console logger: ${result.error.message}`,
      });
    }

    return ok(result.data);
  }

  private static parseLogLevel(
    levelString: string,
  ): Result<LogLevel, DebugLoggerFactoryError & { message: string }> {
    const normalized = levelString.toLowerCase().trim();

    switch (normalized) {
      case "error":
        return ok(LogLevels.ERROR);
      case "warn":
      case "warning":
        return ok(LogLevels.WARN);
      case "info":
        return ok(LogLevels.INFO);
      case "debug":
        return ok(LogLevels.DEBUG);
      case "trace":
        return ok(LogLevels.TRACE);
      default:
        return err({
          kind: "InvalidConfiguration",
          reason: `Unknown log level: ${levelString}`,
          message: `Unknown log level: ${levelString}`,
        });
    }
  }
}
