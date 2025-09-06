// Verbose Logger - consolidates conditional logging patterns to reduce entropy
// Addresses Issue #410: Excessive logging verbosity and infrastructure code smell

import { StructuredLogger } from "./logger.ts";
import { getEnvironmentConfig } from "../config/environment-config.ts";

export class VerboseLogger {
  private readonly isVerbose: boolean;
  private readonly serviceName: string;

  constructor(serviceName: string) {
    const envConfig = getEnvironmentConfig();
    this.isVerbose = envConfig.getVerboseMode();
    this.serviceName = serviceName;
  }

  /**
   * Log info message only if verbose mode is enabled
   */
  info(message: string, data?: Record<string, unknown>): void {
    if (this.isVerbose) {
      const logger = StructuredLogger.getServiceLogger(this.serviceName);
      logger.info(message, data);
    }
  }

  /**
   * Log warning message only if verbose mode is enabled
   */
  warn(message: string, data?: Record<string, unknown>): void {
    if (this.isVerbose) {
      const logger = StructuredLogger.getServiceLogger(this.serviceName);
      logger.warn(message, data);
    }
  }

  /**
   * Log error message only if verbose mode is enabled
   */
  error(message: string, data?: Record<string, unknown>): void {
    if (this.isVerbose) {
      const logger = StructuredLogger.getServiceLogger(this.serviceName);
      logger.error(message, data);
    }
  }

  /**
   * Check if verbose mode is enabled without logging
   */
  get enabled(): boolean {
    return this.isVerbose;
  }

  /**
   * Create a scoped verbose logger for specific contexts
   */
  createScoped(scope: string): VerboseLogger {
    return new VerboseLogger(`${this.serviceName}-${scope}`);
  }
}
