/**
 * Centralized Logging Service - DDD/Totality Architecture
 * Replaces scattered LoggerFactory usage with proper dependency injection
 * Follows AI Complexity Control: reduces logging complexity entropy
 */

import type { Logger, LoggerConfiguration } from "../shared/logger.ts";
import {
  ConsoleLogger,
  NullLogger,
  StructuredLogger,
} from "../shared/logger.ts";

/**
 * Centralized logging service for dependency injection
 * Replaces direct LoggerFactory calls throughout the system
 */
export class LoggingService {
  private readonly configuration: LoggerConfiguration;
  private readonly loggers = new Map<string, Logger>();

  constructor(configuration?: LoggerConfiguration) {
    this.configuration = {
      environment: "development",
      logLevel: "info",
      ...configuration,
    };
  }

  /**
   * Get or create a logger for a specific source
   * Provides caching to avoid recreating loggers
   */
  getLogger(source: string): Logger {
    if (this.loggers.has(source)) {
      return this.loggers.get(source)!;
    }

    const logger = this.createLogger(source);
    this.loggers.set(source, logger);
    return logger;
  }

  /**
   * Create a new logger instance
   * Respects environment configuration for production/development
   */
  private createLogger(source: string): Logger {
    const { environment, logLevel } = this.configuration;

    if (environment === "production") {
      return new NullLogger();
    }

    return new ConsoleLogger(source, logLevel || "info");
  }

  /**
   * Update configuration and clear cached loggers
   * Allows runtime reconfiguration of logging behavior
   */
  reconfigure(configuration: LoggerConfiguration): void {
    Object.assign(this.configuration, configuration);
    this.loggers.clear(); // Force recreation with new config
    StructuredLogger.clearCache(); // Clear structured logger cache too
  }

  /**
   * Get default logger for components that don't specify a source
   */
  getDefaultLogger(): Logger {
    return this.getLogger("default");
  }

  /**
   * Get environment-specific loggers for common use cases
   */
  getStageLogger(stage: string): Logger {
    return this.getLogger(`stage-${stage}`);
  }

  getDomainLogger(domain: string): Logger {
    return this.getLogger(`domain-${domain}`);
  }

  getServiceLogger(service: string): Logger {
    return this.getLogger(`service-${service}`);
  }

  /**
   * Get current configuration
   */
  getConfiguration(): Readonly<LoggerConfiguration> {
    return Object.freeze({ ...this.configuration });
  }

  /**
   * Clear all cached loggers
   * Useful for testing or configuration changes
   */
  clearCache(): void {
    this.loggers.clear();
    StructuredLogger.clearCache();
  }
}

/**
 * Logger dependency injection interface
 * Components that need logging should accept this interface
 */
export interface LoggerProvider {
  getLogger(source: string): Logger;
}

/**
 * Default logging service instance for convenience
 * Can be replaced with custom configuration as needed
 */
export const defaultLoggingService = new LoggingService();

/**
 * Factory for creating environment-specific logging services
 * Provides common configurations for different environments
 */
export class LoggingServiceFactory {
  static createDevelopmentService(): LoggingService {
    return new LoggingService({
      environment: "development",
      logLevel: "debug",
    });
  }

  static createProductionService(): LoggingService {
    return new LoggingService({
      environment: "production",
      logLevel: "error",
    });
  }

  static createTestService(): LoggingService {
    return new LoggingService({
      environment: "test",
      logLevel: "warn",
    });
  }

  static createCustomService(config: LoggerConfiguration): LoggingService {
    return new LoggingService(config);
  }
}
