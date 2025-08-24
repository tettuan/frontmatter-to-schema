/**
 * Domain logging interface following DDD principles and Totality
 * Replaces console.log with proper domain-aware logging
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly source?: string;
}

/**
 * Total logging interface - all operations are safe and complete
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Console logger implementation for development
 * This is the only place console.* should be used
 */
export class ConsoleLogger implements Logger {
  constructor(
    private readonly source?: string,
    private readonly minLevel: LogLevel = "info",
  ) {}

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      this.log("debug", message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      this.log("info", message, context);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      this.log("warn", message, context);
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      this.log("error", message, context);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.minLevel];
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const timestamp = new Date().toISOString();
    const prefix = this.source ? `[${this.source}]` : "";
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";

    const logMessage =
      `${timestamp} ${level.toUpperCase()} ${prefix} ${message}${contextStr}`;

    // This is the only place console methods are allowed
    switch (level) {
      case "debug":
        console.debug(logMessage);
        break;
      case "info":
        console.info(logMessage);
        break;
      case "warn":
        console.warn(logMessage);
        break;
      case "error":
        console.error(logMessage);
        break;
    }
  }
}

/**
 * No-op logger for production environments where logging should be disabled
 */
export class NullLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Logger factory following DDD principles
 */
export class LoggerFactory {
  private static instance: Logger | null = null;

  static createLogger(source?: string): Logger {
    // Try to check environment, but fallback gracefully if not allowed
    try {
      if (Deno.env.get("NODE_ENV") === "production") {
        return new NullLogger();
      }
      const minLevel = (Deno.env.get("LOG_LEVEL") as LogLevel) || "info";
      return new ConsoleLogger(source, minLevel);
    } catch {
      // If we can't access env vars, default to info level console logger
      return new ConsoleLogger(source, "info");
    }
  }

  static getDefaultLogger(): Logger {
    if (!LoggerFactory.instance) {
      LoggerFactory.instance = LoggerFactory.createLogger("default");
    }
    return LoggerFactory.instance;
  }
}

// Default logger instance for convenience
export const logger = LoggerFactory.getDefaultLogger();
