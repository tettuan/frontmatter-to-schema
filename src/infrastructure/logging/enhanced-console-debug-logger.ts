import { err, ok, Result } from "../../domain/shared/types/result.ts";
import {
  createLogContext,
  EnhancedDebugLogger,
  LogContext,
  LogError,
  LogLevel,
  LogLevels,
  PerformanceMetrics,
  ProcessingDetails,
  shouldLogLevel,
} from "../../domain/shared/services/debug-logger.ts";

/**
 * Output mode for controlling what gets displayed to console
 */
export type OutputMode =
  | { readonly kind: "silent" } // Nothing to console except errors
  | { readonly kind: "output-only" } // Only .output() and .errorOutput()
  | { readonly kind: "verbose" } // All logging based on level
  | { readonly kind: "debug-full" }; // All logging + full debug context

/**
 * Enhanced console implementation of DebugLogger with CLI-specific functionality.
 * Provides unified logging architecture while maintaining DDD and Totality principles.
 */
export class EnhancedConsoleDebugLogger implements EnhancedDebugLogger {
  private constructor(
    private readonly maxLevel: LogLevel,
    private readonly enabled: boolean,
    private readonly outputMode: OutputMode,
    private readonly baseContext?: LogContext,
  ) {}

  /**
   * Smart Constructor for EnhancedConsoleDebugLogger
   */
  static create(
    maxLevel: LogLevel,
    enabled: boolean,
    outputMode: OutputMode,
    baseContext?: LogContext,
  ): Result<EnhancedConsoleDebugLogger, LogError & { message: string }> {
    return ok(
      new EnhancedConsoleDebugLogger(
        maxLevel,
        enabled,
        outputMode,
        baseContext,
      ),
    );
  }

  /**
   * Create logger for CLI with appropriate output mode
   */
  static createForCLI(
    verboseFlag: boolean,
    debugLevel?: LogLevel,
  ): Result<EnhancedConsoleDebugLogger, LogError & { message: string }> {
    const level = debugLevel ??
      (verboseFlag ? LogLevels.DEBUG : LogLevels.INFO);
    const outputMode: OutputMode = verboseFlag
      ? { kind: "verbose" }
      : { kind: "output-only" };

    const baseContext = createLogContext({
      component: "CLI",
      session: crypto.randomUUID(),
    });

    return EnhancedConsoleDebugLogger.create(
      level,
      true,
      outputMode,
      baseContext,
    );
  }

  /**
   * Create logger for service components
   */
  static createForService(
    serviceName: string,
    parentLogger?: EnhancedDebugLogger,
  ): Result<EnhancedConsoleDebugLogger, LogError & { message: string }> {
    const parentContext = parentLogger?.getContext();
    const baseContext = createLogContext({
      component: "Service",
      service: serviceName,
      ...(parentContext ? { parentSession: parentContext.session } : {}),
    });

    // Inherit output mode and level from parent if available
    const outputMode: OutputMode = { kind: "verbose" };
    const level = LogLevels.DEBUG;

    return EnhancedConsoleDebugLogger.create(
      level,
      true,
      outputMode,
      baseContext,
    );
  }

  // Standard DebugLogger interface implementation
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

    // Check if output mode allows this level
    if (!this.shouldOutputLevel(level)) {
      return err({
        kind: "LevelFiltered",
        requestedLevel: level,
        configuredLevel: this.maxLevel,
        message: `Log level ${level.kind} filtered by output mode`,
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

  withContext(baseContext: LogContext): EnhancedDebugLogger {
    const mergedContext = this.baseContext
      ? { ...this.baseContext, ...baseContext }
      : baseContext;

    const result = EnhancedConsoleDebugLogger.create(
      this.maxLevel,
      this.enabled,
      this.outputMode,
      mergedContext,
    );

    // This should never fail since we're using valid parameters
    return result.ok ? result.data : this;
  }

  // Enhanced DebugLogger interface implementation
  output(
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

    // Output always goes to console regardless of level filtering
    try {
      const outputContext = context
        ? { ...context, outputType: "user-output" }
        : createLogContext({ outputType: "user-output" });
      const formattedMessage = this.formatOutputMessage(message, outputContext);
      console.log(formattedMessage);
      return ok(undefined);
    } catch (error) {
      return err({
        kind: "WriteFailed",
        destination: "console",
        cause: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to write output to console: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  errorOutput(
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

    // Error output always goes to console regardless of level filtering
    try {
      const errorContext = context
        ? { ...context, outputType: "user-error" }
        : createLogContext({ outputType: "user-error" });
      const formattedMessage = this.formatErrorMessage(message, errorContext);
      console.error(formattedMessage);
      return ok(undefined);
    } catch (error) {
      return err({
        kind: "WriteFailed",
        destination: "console",
        cause: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to write error to console: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  progress(
    stage: string,
    details: ProcessingDetails,
  ): Result<void, LogError & { message: string }> {
    const progressContext = createLogContext({
      operation: details.operation,
      stage,
      progress: `${details.itemsProcessed}/${details.totalItems}`,
      currentItem: details.currentItem,
      elapsedMs: details.elapsedMs,
    });

    const progressMessage =
      `${stage}: ${details.itemsProcessed}/${details.totalItems}${
        details.currentItem ? ` (${details.currentItem})` : ""
      }`;

    return this.info(progressMessage, progressContext);
  }

  metrics(
    operation: string,
    metrics: PerformanceMetrics,
  ): Result<void, LogError & { message: string }> {
    const metricsContext = createLogContext({
      operation: metrics.operation,
      duration: `${metrics.duration}ms`,
      memoryUsed: metrics.memoryUsed,
      itemCount: metrics.itemCount,
    });

    const metricsMessage =
      `Performance: ${operation} completed in ${metrics.duration}ms${
        metrics.itemCount ? ` (${metrics.itemCount} items)` : ""
      }`;

    return this.debug(metricsMessage, metricsContext);
  }

  getContext(): LogContext {
    return this.baseContext ?? createLogContext({});
  }

  // Private helper methods
  private shouldOutputLevel(_level: LogLevel): boolean {
    switch (this.outputMode.kind) {
      case "silent":
        return false;
      case "output-only":
        // Only output() and errorOutput() should reach console in this mode
        return false;
      case "verbose":
      case "debug-full":
        return true;
    }
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const levelTag = this.getLevelTag(level);
    const fullContext = this.mergeContext(context);

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

      // Add full context in debug mode
      if (this.outputMode.kind === "debug-full") {
        const contextStr = JSON.stringify(fullContext, null, 2);
        formatted += `\nContext: ${contextStr}`;
      }
    }

    return formatted;
  }

  private formatOutputMessage(message: string, _context?: LogContext): string {
    // Simple formatting for user-facing output
    return message;
  }

  private formatErrorMessage(message: string, _context?: LogContext): string {
    // Error formatting - add Error prefix for clarity
    return `Error: ${message}`;
  }

  private mergeContext(context?: LogContext): LogContext | undefined {
    if (!context && !this.baseContext) return undefined;
    if (context && !this.baseContext) return context;
    if (!context && this.baseContext) return this.baseContext;
    return { ...this.baseContext!, ...context! };
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
