import { err, ok, Result } from "../../domain/shared/types/result.ts";
import {
  DebugLogger,
  LogContext,
  LogError,
  LogLevel,
  LogLevels,
  shouldLogLevel,
} from "../../domain/shared/services/debug-logger.ts";

/**
 * Console implementation of DebugLogger.
 * Outputs formatted log messages to console based on configuration.
 */
export class ConsoleDebugLogger implements DebugLogger {
  private constructor(
    private readonly maxLevel: LogLevel,
    private readonly enabled: boolean,
    private readonly baseContext?: LogContext,
  ) {}

  /**
   * Smart Constructor for ConsoleDebugLogger
   */
  static create(
    maxLevel: LogLevel,
    enabled: boolean,
    baseContext?: LogContext,
  ): Result<ConsoleDebugLogger, LogError & { message: string }> {
    return ok(new ConsoleDebugLogger(maxLevel, enabled, baseContext));
  }

  /**
   * Create logger for verbose mode compatibility
   */
  static createForVerbose(
    verbose: boolean,
  ): Result<ConsoleDebugLogger, LogError & { message: string }> {
    const level = verbose ? LogLevels.DEBUG : LogLevels.ERROR;
    return ConsoleDebugLogger.create(level, verbose);
  }

  log(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    if (!this.enabled) {
      return err({
        kind: "LoggerDisabled",
        reason: "Logger is disabled in configuration",
        message: "Logger is disabled in configuration",
      });
    }

    if (!shouldLogLevel(level, this.maxLevel)) {
      return err({
        kind: "LevelFiltered",
        requestedLevel: level,
        configuredLevel: this.maxLevel,
        message:
          `Log level ${level.kind} filtered (max: ${this.maxLevel.kind})`,
      });
    }

    try {
      const formattedMessage = this.formatMessage(level, message, context);
      console.log(formattedMessage);
      return ok(undefined);
    } catch (error) {
      return err({
        kind: "WriteFailed",
        destination: "console",
        cause: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to write to console: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  error(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return this.log(LogLevels.ERROR, message, context);
  }

  warn(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return this.log(LogLevels.WARN, message, context);
  }

  info(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return this.log(LogLevels.INFO, message, context);
  }

  debug(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return this.log(LogLevels.DEBUG, message, context);
  }

  trace(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return this.log(LogLevels.TRACE, message, context);
  }

  withContext(baseContext: LogContext): DebugLogger {
    const mergedContext = this.baseContext
      ? { ...this.baseContext, ...baseContext }
      : baseContext;

    const result = ConsoleDebugLogger.create(
      this.maxLevel,
      this.enabled,
      mergedContext,
    );

    // This should never fail since we're using valid parameters
    return result.ok ? result.data : this;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const levelTag = this.getLevelTag(level);

    const fullContext = context
      ? (this.baseContext ? { ...this.baseContext, ...context } : context)
      : this.baseContext;

    let formatted = `${levelTag} ${message}`;

    if (fullContext) {
      if (fullContext.operation) {
        formatted += ` [${fullContext.operation}]`;
      }
      if (fullContext.location) {
        formatted += ` @${fullContext.location}`;
      }
      if (fullContext.progress) {
        formatted += ` (${fullContext.progress})`;
      }
    }

    return formatted;
  }

  private getLevelTag(level: LogLevel): string {
    switch (level.kind) {
      case "error":
        return "[ERROR]";
      case "warn":
        return "[WARN]";
      case "info":
        return "[INFO]";
      case "debug":
        return "[DEBUG]";
      case "trace":
        return "[TRACE]";
    }
  }
}
