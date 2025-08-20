/**
 * BreakdownLogger - Strategic Test Debugging Utility
 * 
 * Provides structured logging for test execution analysis
 * following Totality principles and DDD architecture.
 * 
 * Usage:
 * - Enabled only when BREAKDOWN_LOG environment variable is set
 * - Logs to structured format for easy parsing
 * - Minimal performance impact when disabled
 */

export interface LogContext {
  testName: string;
  phase: "arrange" | "act" | "assert" | "cleanup";
  domain?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  context: LogContext;
  message: string;
  data?: unknown;
  duration?: number;
}

/**
 * BreakdownLogger provides structured logging for test debugging
 * with minimal overhead when disabled
 */
export class BreakdownLogger {
  private static instance: BreakdownLogger;
  private enabled: boolean;
  private entries: LogEntry[] = [];
  private timers = new Map<string, number>();

  private constructor() {
    try {
      this.enabled = Deno.env.get("BREAKDOWN_LOG") === "true";
    } catch {
      // If env access is not allowed, default to disabled
      this.enabled = false;
    }
  }

  static getInstance(): BreakdownLogger {
    if (!BreakdownLogger.instance) {
      BreakdownLogger.instance = new BreakdownLogger();
    }
    return BreakdownLogger.instance;
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable logging (useful for test control)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Start a timer for performance measurement
   */
  startTimer(key: string): void {
    if (!this.enabled) return;
    this.timers.set(key, performance.now());
  }

  /**
   * End a timer and return duration
   */
  endTimer(key: string): number | undefined {
    if (!this.enabled) return undefined;
    const start = this.timers.get(key);
    if (start === undefined) return undefined;
    
    const duration = performance.now() - start;
    this.timers.delete(key);
    return duration;
  }

  /**
   * Log a debug message
   */
  debug(context: LogContext, message: string, data?: unknown): void {
    this.log("debug", context, message, data);
  }

  /**
   * Log an info message
   */
  info(context: LogContext, message: string, data?: unknown): void {
    this.log("info", context, message, data);
  }

  /**
   * Log a warning message
   */
  warn(context: LogContext, message: string, data?: unknown): void {
    this.log("warn", context, message, data);
  }

  /**
   * Log an error message
   */
  error(context: LogContext, message: string, data?: unknown): void {
    this.log("error", context, message, data);
  }

  /**
   * Log with performance timing
   */
  logWithTiming(
    context: LogContext,
    message: string,
    timerKey: string,
    data?: unknown,
  ): void {
    if (!this.enabled) return;
    
    const duration = this.endTimer(timerKey);
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      context,
      message,
      data,
      duration,
    };
    
    this.entries.push(entry);
    this.output(entry);
  }

  /**
   * Log a test phase transition
   */
  logPhase(
    testName: string,
    phase: LogContext["phase"],
    message?: string,
  ): void {
    if (!this.enabled) return;
    
    const context: LogContext = { testName, phase };
    this.info(
      context,
      message || `Starting ${phase} phase`,
    );
  }

  /**
   * Log a Result type outcome
   */
  logResult<T, E extends { message: string }>(
    context: LogContext,
    result: { ok: boolean; data?: T; error?: E },
    message?: string,
  ): void {
    if (!this.enabled) return;
    
    if (result.ok) {
      this.info(
        context,
        message || "Operation succeeded",
        { data: result.data },
      );
    } else {
      this.error(
        context,
        message || `Operation failed: ${result.error?.message}`,
        { error: result.error },
      );
    }
  }

  /**
   * Create a scoped logger for a specific test
   */
  createTestScope(testName: string, domain?: string): TestScopeLogger {
    return new TestScopeLogger(this, testName, domain);
  }

  /**
   * Clear all log entries
   */
  clear(): void {
    this.entries.length = 0;
    this.timers.clear();
  }

  /**
   * Get all log entries
   */
  getEntries(): ReadonlyArray<LogEntry> {
    return this.entries;
  }

  /**
   * Export logs to JSON format
   */
  exportToJson(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogEntry["level"],
    context: LogContext,
    message: string,
    data?: unknown,
  ): void {
    if (!this.enabled) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
    };
    
    this.entries.push(entry);
    this.output(entry);
  }

  /**
   * Output log entry to console
   */
  private output(entry: LogEntry): void {
    if (!this.enabled) return;
    
    const prefix = `[${entry.level.toUpperCase()}]`;
    const contextStr = `[${entry.context.testName}:${entry.context.phase}]`;
    const timeStr = entry.duration 
      ? ` (${entry.duration.toFixed(2)}ms)`
      : "";
    
    const logMessage = `${prefix} ${contextStr} ${entry.message}${timeStr}`;
    
    switch (entry.level) {
      case "debug":
        console.debug(logMessage, entry.data || "");
        break;
      case "info":
        console.info(logMessage, entry.data || "");
        break;
      case "warn":
        console.warn(logMessage, entry.data || "");
        break;
      case "error":
        console.error(logMessage, entry.data || "");
        break;
    }
  }
}

/**
 * TestScopeLogger provides a scoped logger for individual tests
 */
export class TestScopeLogger {
  constructor(
    private logger: BreakdownLogger,
    private testName: string,
    private domain?: string,
  ) {}

  /**
   * Log arrange phase
   */
  arrange(message: string, data?: unknown): void {
    this.logger.info(
      this.createContext("arrange"),
      message,
      data,
    );
  }

  /**
   * Log act phase
   */
  act(message: string, data?: unknown): void {
    this.logger.info(
      this.createContext("act"),
      message,
      data,
    );
  }

  /**
   * Log assert phase
   */
  assert(message: string, data?: unknown): void {
    this.logger.info(
      this.createContext("assert"),
      message,
      data,
    );
  }

  /**
   * Log cleanup phase
   */
  cleanup(message: string, data?: unknown): void {
    this.logger.info(
      this.createContext("cleanup"),
      message,
      data,
    );
  }

  /**
   * Start a timer
   */
  startTimer(key: string): void {
    this.logger.startTimer(`${this.testName}:${key}`);
  }

  /**
   * End a timer and log result
   */
  endTimer(key: string, message: string, data?: unknown): void {
    this.logger.logWithTiming(
      this.createContext("act"),
      message,
      `${this.testName}:${key}`,
      data,
    );
  }

  /**
   * Log a Result type
   */
  logResult<T, E extends { message: string }>(
    phase: LogContext["phase"],
    result: { ok: boolean; data?: T; error?: E },
    message?: string,
  ): void {
    this.logger.logResult(
      this.createContext(phase),
      result,
      message,
    );
  }

  /**
   * Create a context for this scope
   */
  private createContext(phase: LogContext["phase"]): LogContext {
    return {
      testName: this.testName,
      phase,
      domain: this.domain,
    };
  }
}

/**
 * Convenience function to get the singleton logger
 */
export function getBreakdownLogger(): BreakdownLogger {
  return BreakdownLogger.getInstance();
}

/**
 * Decorator for automatic test method logging
 * (For future use with TypeScript decorators)
 */
export function logTestExecution(
  target: unknown,
  propertyKey: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function (...args: unknown[]) {
    const logger = getBreakdownLogger();
    if (!logger.isEnabled()) {
      return originalMethod.apply(this, args);
    }
    
    const testName = `${target?.constructor.name}.${propertyKey}`;
    const scope = logger.createTestScope(testName);
    
    scope.startTimer("total");
    
    try {
      const result = await originalMethod.apply(this, args);
      scope.endTimer("total", "Test completed successfully");
      return result;
    } catch (error) {
      scope.endTimer("total", `Test failed: ${error}`);
      throw error;
    }
  };
  
  return descriptor;
}