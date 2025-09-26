/**
 * @fileoverview Unified Debug Logger System
 * @description Centralized debug logging with environment-controlled levels and filtering
 * Following DDD, TDD, and Totality principles
 */

export type LogLevel = "none" | "error" | "warn" | "info" | "debug" | "verbose";
export type DebugComponent =
  | "directive"
  | "ir"
  | "memory"
  | "template"
  | "schema"
  | "frontmatter"
  | "aggregation"
  | "file";
export type OutputFormat = "plain" | "json" | "structured";

/**
 * Debug Log Entry
 */
export interface DebugLogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly component: DebugComponent;
  readonly message: string;
  readonly data?: unknown;
  readonly sessionId?: string;
  readonly operationId?: string;
}

/**
 * Debug Configuration
 */
export interface DebugConfiguration {
  readonly level: LogLevel;
  readonly components: DebugComponent[];
  readonly outputFormat: OutputFormat;
  readonly enableSessionTracking: boolean;
  readonly enableOperationTracking: boolean;
  readonly logFilePath?: string;
  readonly maxLogEntries?: number;
}

/**
 * Unified Debug Logger
 *
 * Provides centralized, environment-controlled debug logging for all components.
 * Eliminates duplicate logging code and provides consistent debug output format.
 */
export class UnifiedDebugLogger {
  private static instance: UnifiedDebugLogger | null = null;
  private readonly config: DebugConfiguration;
  private readonly logEntries: DebugLogEntry[] = [];
  private readonly sessionId: string;
  private operationCounter = 0;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.config = this.loadConfiguration();

    if (this.config.level !== "none") {
      console.log(
        `[DEBUG] Unified Debug Logger initialized - Session: ${this.sessionId}`,
      );
      console.log(
        `[DEBUG] Configuration:`,
        JSON.stringify(this.config, null, 2),
      );
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): UnifiedDebugLogger {
    if (!this.instance) {
      this.instance = new UnifiedDebugLogger();
    }
    return this.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): DebugConfiguration {
    const level = (Deno.env.get("DEBUG_LEVEL") || "none") as LogLevel;
    const componentsStr = Deno.env.get("DEBUG_COMPONENTS") || "";
    const components = componentsStr
      ? componentsStr.split(",") as DebugComponent[]
      : [];
    const outputFormat =
      (Deno.env.get("DEBUG_OUTPUT_FORMAT") || "plain") as OutputFormat;
    const enableSessionTracking =
      Deno.env.get("DEBUG_SESSION_TRACKING") === "true";
    const enableOperationTracking =
      Deno.env.get("DEBUG_OPERATION_TRACKING") === "true";
    const logFilePath = Deno.env.get("DEBUG_LOG_FILE");
    const maxLogEntries = parseInt(
      Deno.env.get("DEBUG_MAX_LOG_ENTRIES") || "1000",
      10,
    );

    return {
      level,
      components,
      outputFormat,
      enableSessionTracking,
      enableOperationTracking,
      logFilePath,
      maxLogEntries,
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = new Date().toISOString().replace(/[:-]/g, "").replace(
      /\..+/,
      "",
    );
    const random = Math.random().toString(36).substr(2, 6);
    return `sess_${timestamp}_${random}`;
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId(operation: string): string {
    this.operationCounter++;
    return `op_${operation}_${
      this.operationCounter.toString().padStart(4, "0")
    }`;
  }

  /**
   * Check if logging is enabled for the given level and component
   */
  private isEnabled(level: LogLevel, component: DebugComponent): boolean {
    if (this.config.level === "none") return false;
    if (
      this.config.components.length > 0 &&
      !this.config.components.includes(component)
    ) return false;

    const levelPriority = {
      none: -1,
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      verbose: 4,
    };

    const currentPriority = levelPriority[this.config.level];
    const messagePriority = levelPriority[level];

    return messagePriority <= currentPriority;
  }

  /**
   * Core logging method
   */
  log(
    level: LogLevel,
    component: DebugComponent,
    message: string,
    data?: unknown,
    operationId?: string,
  ): void {
    if (!this.isEnabled(level, component)) return;

    const logEntry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
      sessionId: this.config.enableSessionTracking ? this.sessionId : undefined,
      operationId: this.config.enableOperationTracking
        ? operationId
        : undefined,
    };

    // Store log entry
    this.logEntries.push(logEntry);

    // Trim log entries if needed
    if (
      this.config.maxLogEntries &&
      this.logEntries.length > this.config.maxLogEntries
    ) {
      this.logEntries.splice(
        0,
        this.logEntries.length - this.config.maxLogEntries,
      );
    }

    // Output log entry
    this.outputLogEntry(logEntry);

    // Write to file if configured
    if (this.config.logFilePath) {
      this.writeToFile(logEntry);
    }
  }

  /**
   * Output log entry to console
   */
  private outputLogEntry(logEntry: DebugLogEntry): void {
    if (this.config.outputFormat === "json") {
      console.log(JSON.stringify(logEntry));
    } else if (this.config.outputFormat === "structured") {
      const prefix =
        `[${logEntry.level.toUpperCase()}] [${logEntry.component.toUpperCase()}]`;
      const sessionInfo = logEntry.sessionId ? ` [${logEntry.sessionId}]` : "";
      const operationInfo = logEntry.operationId
        ? ` [${logEntry.operationId}]`
        : "";
      const timestamp = ` ${logEntry.timestamp}`;

      console.log(
        `${prefix}${sessionInfo}${operationInfo}${timestamp} ${logEntry.message}`,
      );
      if (logEntry.data) {
        console.log(JSON.stringify(logEntry.data, null, 2));
      }
    } else {
      // Plain format
      const prefix =
        `[${logEntry.level.toUpperCase()}] [${logEntry.component.toUpperCase()}] ${logEntry.message}`;
      if (logEntry.data) {
        console.log(prefix, JSON.stringify(logEntry.data, null, 2));
      } else {
        console.log(prefix);
      }
    }
  }

  /**
   * Write log entry to file
   */
  private async writeToFile(logEntry: DebugLogEntry): Promise<void> {
    if (!this.config.logFilePath) return;

    try {
      const logLine = JSON.stringify(logEntry) + "\n";
      await Deno.writeTextFile(this.config.logFilePath, logLine, {
        append: true,
      });
    } catch (error) {
      console.error(
        `Failed to write to log file: ${this.config.logFilePath}`,
        error,
      );
    }
  }

  /**
   * Component-specific logging methods
   */
  directive = {
    error: (message: string, data?: unknown, operationId?: string) =>
      this.log("error", "directive", message, data, operationId),
    warn: (message: string, data?: unknown, operationId?: string) =>
      this.log("warn", "directive", message, data, operationId),
    info: (message: string, data?: unknown, operationId?: string) =>
      this.log("info", "directive", message, data, operationId),
    debug: (message: string, data?: unknown, operationId?: string) =>
      this.log("debug", "directive", message, data, operationId),
    verbose: (message: string, data?: unknown, operationId?: string) =>
      this.log("verbose", "directive", message, data, operationId),
  };

  ir = {
    error: (message: string, data?: unknown, operationId?: string) =>
      this.log("error", "ir", message, data, operationId),
    warn: (message: string, data?: unknown, operationId?: string) =>
      this.log("warn", "ir", message, data, operationId),
    info: (message: string, data?: unknown, operationId?: string) =>
      this.log("info", "ir", message, data, operationId),
    debug: (message: string, data?: unknown, operationId?: string) =>
      this.log("debug", "ir", message, data, operationId),
    verbose: (message: string, data?: unknown, operationId?: string) =>
      this.log("verbose", "ir", message, data, operationId),
  };

  memory = {
    error: (message: string, data?: unknown, operationId?: string) =>
      this.log("error", "memory", message, data, operationId),
    warn: (message: string, data?: unknown, operationId?: string) =>
      this.log("warn", "memory", message, data, operationId),
    info: (message: string, data?: unknown, operationId?: string) =>
      this.log("info", "memory", message, data, operationId),
    debug: (message: string, data?: unknown, operationId?: string) =>
      this.log("debug", "memory", message, data, operationId),
    verbose: (message: string, data?: unknown, operationId?: string) =>
      this.log("verbose", "memory", message, data, operationId),
  };

  template = {
    error: (message: string, data?: unknown, operationId?: string) =>
      this.log("error", "template", message, data, operationId),
    warn: (message: string, data?: unknown, operationId?: string) =>
      this.log("warn", "template", message, data, operationId),
    info: (message: string, data?: unknown, operationId?: string) =>
      this.log("info", "template", message, data, operationId),
    debug: (message: string, data?: unknown, operationId?: string) =>
      this.log("debug", "template", message, data, operationId),
    verbose: (message: string, data?: unknown, operationId?: string) =>
      this.log("verbose", "template", message, data, operationId),
  };

  schema = {
    error: (message: string, data?: unknown, operationId?: string) =>
      this.log("error", "schema", message, data, operationId),
    warn: (message: string, data?: unknown, operationId?: string) =>
      this.log("warn", "schema", message, data, operationId),
    info: (message: string, data?: unknown, operationId?: string) =>
      this.log("info", "schema", message, data, operationId),
    debug: (message: string, data?: unknown, operationId?: string) =>
      this.log("debug", "schema", message, data, operationId),
    verbose: (message: string, data?: unknown, operationId?: string) =>
      this.log("verbose", "schema", message, data, operationId),
  };

  frontmatter = {
    error: (message: string, data?: unknown, operationId?: string) =>
      this.log("error", "frontmatter", message, data, operationId),
    warn: (message: string, data?: unknown, operationId?: string) =>
      this.log("warn", "frontmatter", message, data, operationId),
    info: (message: string, data?: unknown, operationId?: string) =>
      this.log("info", "frontmatter", message, data, operationId),
    debug: (message: string, data?: unknown, operationId?: string) =>
      this.log("debug", "frontmatter", message, data, operationId),
    verbose: (message: string, data?: unknown, operationId?: string) =>
      this.log("verbose", "frontmatter", message, data, operationId),
  };

  /**
   * Get current configuration
   */
  getConfiguration(): DebugConfiguration {
    return { ...this.config };
  }

  /**
   * Get session information
   */
  getSessionInfo(): {
    sessionId: string;
    operationCounter: number;
    logEntriesCount: number;
  } {
    return {
      sessionId: this.sessionId,
      operationCounter: this.operationCounter,
      logEntriesCount: this.logEntries.length,
    };
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count = 50): DebugLogEntry[] {
    return this.logEntries.slice(-count);
  }

  /**
   * Get logs by component
   */
  getLogsByComponent(component: DebugComponent, count = 50): DebugLogEntry[] {
    return this.logEntries
      .filter((entry) => entry.component === component)
      .slice(-count);
  }

  /**
   * Get logs by operation ID
   */
  getLogsByOperation(operationId: string): DebugLogEntry[] {
    return this.logEntries.filter((entry) => entry.operationId === operationId);
  }

  /**
   * Clear log entries
   */
  clearLogs(): void {
    this.logEntries.length = 0;
    if (this.config.level !== "none") {
      console.log(`[DEBUG] Log entries cleared - Session: ${this.sessionId}`);
    }
  }

  /**
   * Generate summary report
   */
  generateSummaryReport(): {
    session: { sessionId: string; operationCounter: number };
    configuration: DebugConfiguration;
    statistics: {
      totalLogs: number;
      logsByLevel: Record<LogLevel, number>;
      logsByComponent: Record<DebugComponent, number>;
    };
    recentErrors: DebugLogEntry[];
  } {
    const logsByLevel = {} as Record<LogLevel, number>;
    const logsByComponent = {} as Record<DebugComponent, number>;

    for (const entry of this.logEntries) {
      logsByLevel[entry.level] = (logsByLevel[entry.level] || 0) + 1;
      logsByComponent[entry.component] =
        (logsByComponent[entry.component] || 0) + 1;
    }

    const recentErrors = this.logEntries
      .filter((entry) => entry.level === "error")
      .slice(-10);

    return {
      session: {
        sessionId: this.sessionId,
        operationCounter: this.operationCounter,
      },
      configuration: this.config,
      statistics: {
        totalLogs: this.logEntries.length,
        logsByLevel,
        logsByComponent,
      },
      recentErrors,
    };
  }
}

/**
 * Global debug logger instance
 */
export const debugLogger = UnifiedDebugLogger.getInstance();
