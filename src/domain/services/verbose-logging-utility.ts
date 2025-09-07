/**
 * Verbose Logging Utility Service
 *
 * Consolidates repeated verbose logging patterns to reduce code duplication
 * Following AI Complexity Control Framework - eliminates logging entropy
 */

import { LoggerFactory } from "../shared/logger.ts";
import { getGlobalEnvironmentConfig } from "../../infrastructure/services/dependency-container.ts";

/**
 * Utility to eliminate verbose logging duplication patterns
 */
export class VerboseLoggingUtility {
  private static verboseMode: boolean | null = null;

  /**
   * Get verbose mode with caching to avoid repeated environment checks
   */
  private static getVerboseMode(): boolean {
    if (this.verboseMode === null) {
      this.verboseMode = getGlobalEnvironmentConfig().getVerboseMode();
    }
    return this.verboseMode;
  }

  /**
   * Log info message if in verbose mode, with consistent context
   */
  static logInfo(
    serviceName: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (this.getVerboseMode()) {
      const logger = LoggerFactory.createLogger(serviceName);
      logger.info(message, context || {});
    }
  }

  /**
   * Log debug message if in verbose mode, with consistent context
   */
  static logDebug(
    serviceName: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (this.getVerboseMode()) {
      const logger = LoggerFactory.createLogger(serviceName);
      logger.debug(message, context || {});
    }
  }

  /**
   * Log warning message if in verbose mode, with consistent context
   */
  static logWarn(
    serviceName: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (this.getVerboseMode()) {
      const logger = LoggerFactory.createLogger(serviceName);
      logger.warn(message, context || {});
    }
  }

  /**
   * Reset verbose mode cache (for testing)
   */
  static resetCache(): void {
    this.verboseMode = null;
  }
}
