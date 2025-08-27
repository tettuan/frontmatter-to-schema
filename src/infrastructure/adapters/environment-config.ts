/**
 * Environment configuration adapter
 *
 * This adapter reads environment variables and configures domain services accordingly.
 * It acts as a bridge between infrastructure (environment variables) and domain layer.
 */

import { LoggerFactory } from "../../domain/shared/logger.ts";
import type {
  LoggerConfiguration,
  LogLevel,
} from "../../domain/shared/logger.ts";

export class EnvironmentConfig {
  /**
   * Initializes domain services with environment-based configuration
   */
  static initialize(): void {
    this.configureLogger();
  }

  /**
   * Configures the logger based on environment variables
   */
  private static configureLogger(): void {
    const config: LoggerConfiguration = {};

    try {
      // Read environment variables
      const nodeEnv = Deno.env.get("NODE_ENV");
      const logLevel = Deno.env.get("LOG_LEVEL");

      // Map NODE_ENV to logger environment
      if (nodeEnv === "production") {
        config.environment = "production";
      } else if (nodeEnv === "test") {
        config.environment = "test";
      } else {
        config.environment = "development";
      }

      // Set log level if provided
      if (logLevel) {
        config.logLevel = logLevel as LogLevel;
      }
    } catch {
      // If we can't access environment variables, use defaults
      config.environment = "development";
      config.logLevel = "info";
    }

    // Configure the logger factory with environment settings
    LoggerFactory.configure(config);
  }
}
