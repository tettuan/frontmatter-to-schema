import { err, ok, Result } from "../types/result.ts";
import {
  createLogContext,
  DebugLogger,
  LogContext,
  LogError,
  LogLevel,
  LogLevels,
  shouldLogLevel,
} from "./debug-logger.ts";

/**
 * Enhanced Debug Logger - Simplified BreakdownLogger Integration
 *
 * Addresses Issue #1024: BreakdownLogger未統合によるデバッグ効率低下
 *
 * Provides environment variable-based debugging control compatible with
 * existing DebugLogger interface while adding strategic debugging capabilities.
 */
export class EnhancedDebugLogger implements DebugLogger {
  private readonly componentKey: string;
  private readonly enabledKeys: string[];
  private readonly logLevel: LogLevel;
  private readonly isTestEnvironment: boolean;

  private constructor(
    componentKey: string,
    enabledKeys: string[],
    logLevel: LogLevel,
    isTestEnvironment: boolean,
  ) {
    this.componentKey = componentKey;
    this.enabledKeys = enabledKeys;
    this.logLevel = logLevel;
    this.isTestEnvironment = isTestEnvironment;
  }

  /**
   * Create enhanced debug logger with environment variable support
   */
  static create(
    componentKey: string,
  ): Result<DebugLogger, LogError & { message: string }> {
    try {
      // Parse LOG_KEY environment variable
      const logKeyEnv = Deno.env.get("LOG_KEY") || "";
      const enabledKeys = logKeyEnv
        ? logKeyEnv.split(/[,:\/]/).map((k) => k.trim()).filter((k) =>
          k.length > 0
        )
        : [];

      // Parse LOG_LEVEL environment variable
      const logLevelEnv = Deno.env.get("LOG_LEVEL") || "info";
      const logLevel = parseLogLevel(logLevelEnv);

      // Detect test environment
      const isTestEnvironment = detectTestEnvironment();

      return ok(
        new EnhancedDebugLogger(
          componentKey,
          enabledKeys,
          logLevel,
          isTestEnvironment,
        ),
      );
    } catch (error) {
      return err({
        kind: "LoggerDisabled",
        reason: `Failed to create enhanced debug logger: ${
          error instanceof Error ? error.message : String(error)
        }`,
        message: "Enhanced debug logger creation failed",
      });
    }
  }

  /**
   * Check if logging is enabled for this component
   */
  private isLoggingEnabled(level: LogLevel): boolean {
    // Check log level
    if (!shouldLogLevel(level, this.logLevel)) {
      return false;
    }

    // If no keys specified, all components are enabled
    if (this.enabledKeys.length === 0) {
      return true;
    }

    // Check if component key matches any enabled key
    return this.enabledKeys.some((enabledKey) =>
      this.componentKey.includes(enabledKey) ||
      enabledKey.includes(this.componentKey)
    );
  }

  /**
   * Enhanced logging output with component and environment awareness
   */
  private logMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    if (!this.isLoggingEnabled(level)) {
      return err({
        kind: "LevelFiltered",
        requestedLevel: level,
        configuredLevel: this.logLevel,
        message:
          `Logging filtered for component '${this.componentKey}' at level '${level.kind}'`,
      });
    }

    // Only output in test environment for strategic debugging
    // But still return success when not in test environment for compatibility
    if (this.isTestEnvironment) {
      // Format message with component key and context
      const timestamp = new Date().toISOString().slice(11, 23);
      const levelIcon = getLevelIcon(level);
      const contextStr = context ? formatContext(context) : "";
      const fullMessage = contextStr
        ? `[${timestamp}] ${levelIcon} [${this.componentKey}] ${message} | ${contextStr}`
        : `[${timestamp}] ${levelIcon} [${this.componentKey}] ${message}`;

      console.log(fullMessage);
    }

    return ok(void 0);
  }

  // DebugLogger Interface Implementation

  log(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return this.logMessage(level, message, context);
  }

  error(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return this.logMessage(LogLevels.ERROR, message, context);
  }

  warn(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return this.logMessage(LogLevels.WARN, message, context);
  }

  info(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return this.logMessage(LogLevels.INFO, message, context);
  }

  debug(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return this.logMessage(LogLevels.DEBUG, message, context);
  }

  trace(
    message: string,
    context?: LogContext,
  ): Result<void, LogError & { message: string }> {
    return this.logMessage(LogLevels.TRACE, message, context);
  }

  withContext(baseContext: LogContext): DebugLogger {
    const enhancedLogger = new EnhancedDebugLogger(
      this.componentKey,
      this.enabledKeys,
      this.logLevel,
      this.isTestEnvironment,
    );
    enhancedLogger.baseContext = baseContext;
    return enhancedLogger;
  }

  private baseContext?: LogContext;

  /**
   * Enhanced debugging method for data structure analysis
   */
  analyzeDataStructure(
    label: string,
    data: unknown,
  ): Result<void, LogError & { message: string }> {
    const analysis = analyzeData(data);
    return this.debug(
      `STRUCTURE [${label}]: ${analysis}`,
      this.mergeContext({
        operation: "data-structure-analysis",
        analysis: label,
      }),
    );
  }

  /**
   * Enhanced debugging method for flow tracking
   */
  trackFlow(
    step: string,
    details?: Record<string, unknown>,
  ): Result<void, LogError & { message: string }> {
    return this.info(
      `FLOW: ${step}`,
      this.mergeContext({
        operation: "flow-tracking",
        step,
        ...details,
      }),
    );
  }

  private mergeContext(additional: Partial<LogContext>): LogContext {
    return createLogContext({
      ...this.baseContext,
      ...additional,
    });
  }
}

// Helper Functions

function parseLogLevel(level: string): LogLevel {
  switch (level.toLowerCase()) {
    case "error":
      return LogLevels.ERROR;
    case "warn":
      return LogLevels.WARN;
    case "info":
      return LogLevels.INFO;
    case "debug":
      return LogLevels.DEBUG;
    case "trace":
      return LogLevels.TRACE;
    default:
      return LogLevels.INFO;
  }
}

function detectTestEnvironment(): boolean {
  // Primary check: explicit test environment variable
  const denoTesting = Deno.env.get("DENO_TESTING");
  if (denoTesting === "true") {
    return true;
  }

  // If explicitly disabled, respect that
  if (denoTesting === "false") {
    return false;
  }

  // Fallback checks only if DENO_TESTING is not explicitly set
  if (denoTesting === undefined) {
    // Check if running via deno test command
    if (Deno.args.some((arg) => arg.includes("test"))) {
      return true;
    }

    // Check stack trace for test files
    const stack = new Error().stack;
    if (stack && stack.includes("_test.ts")) {
      return true;
    }
  }

  return false;
}

function getLevelIcon(level: LogLevel): string {
  switch (level.kind) {
    case "error":
      return "💥";
    case "warn":
      return "⚠️";
    case "info":
      return "ℹ️";
    case "debug":
      return "🐛";
    case "trace":
      return "🔍";
    default:
      return "📝";
  }
}

function formatContext(context: LogContext): string {
  const parts: string[] = [];

  if (context.operation) parts.push(`op:${context.operation}`);
  if (context.location) parts.push(`loc:${context.location}`);
  if (context.progress) parts.push(`progress:${context.progress}`);

  // Add other properties excluding standard ones
  const customProps = Object.entries(context)
    .filter(([key]) =>
      !["operation", "location", "progress", "timestamp"].includes(key)
    )
    .slice(0, 3) // Limit to prevent log bloat
    .map(([key, value]) => `${key}:${formatValue(value)}`);

  parts.push(...customProps);

  return parts.join(" ");
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return `Array[${value.length}]`;
  if (value && typeof value === "object") {
    return `Object{${Object.keys(value).length}}`;
  }
  if (typeof value === "string") {
    return value.length > 20 ? `"${value.slice(0, 17)}..."` : `"${value}"`;
  }
  return String(value);
}

function analyzeData(data: unknown): string {
  if (Array.isArray(data)) return `Array[${data.length}]`;
  if (data && typeof data === "object") {
    return `Object{${Object.keys(data).length} keys}`;
  }
  if (typeof data === "string") return `String(${data.length} chars)`;
  return typeof data;
}

/**
 * Factory function for creating enhanced debug loggers
 */
export function createEnhancedDebugLogger(
  componentKey: string,
): Result<DebugLogger, LogError & { message: string }> {
  return EnhancedDebugLogger.create(componentKey);
}
