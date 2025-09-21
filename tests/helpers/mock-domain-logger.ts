/**
 * @fileoverview Mock Domain Logger for Testing
 * @description Test helper for capturing log messages during testing
 */

import { DomainLogger } from "../../src/domain/shared/services/domain-logger.ts";

export interface LogEntry {
  level: string;
  category: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Mock implementation of DomainLogger for testing purposes
 */
export class MockDomainLogger implements DomainLogger {
  public readonly infoLogs: LogEntry[] = [];
  public readonly debugLogs: LogEntry[] = [];
  public readonly errorLogs: LogEntry[] = [];
  public readonly warnLogs: LogEntry[] = [];

  logInfo(
    category: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    this.infoLogs.push({
      level: "info",
      category,
      message,
      context,
      timestamp: Date.now(),
    });
  }

  logDebug(
    category: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    this.debugLogs.push({
      level: "debug",
      category,
      message,
      context,
      timestamp: Date.now(),
    });
  }

  logError(
    category: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): void {
    this.errorLogs.push({
      level: "error",
      category,
      message: error instanceof Error ? error.message : String(error),
      context,
      timestamp: Date.now(),
    });
  }

  logWarn(
    category: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    this.warnLogs.push({
      level: "warn",
      category,
      message,
      context,
      timestamp: Date.now(),
    });
  }

  logWarning(
    category: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    this.warnLogs.push({
      level: "warn",
      category,
      message,
      context,
      timestamp: Date.now(),
    });
  }

  /**
   * Helper methods for testing
   */
  clear(): void {
    this.infoLogs.length = 0;
    this.debugLogs.length = 0;
    this.errorLogs.length = 0;
    this.warnLogs.length = 0;
  }

  getAllLogs(): LogEntry[] {
    return [
      ...this.infoLogs,
      ...this.debugLogs,
      ...this.errorLogs,
      ...this.warnLogs,
    ].sort((a, b) => a.timestamp - b.timestamp);
  }

  hasLogWithMessage(message: string): boolean {
    return this.getAllLogs().some((log) => log.message.includes(message));
  }

  hasLogWithCategory(category: string): boolean {
    return this.getAllLogs().some((log) => log.category === category);
  }

  getLogsForCategory(category: string): LogEntry[] {
    return this.getAllLogs().filter((log) => log.category === category);
  }
}
