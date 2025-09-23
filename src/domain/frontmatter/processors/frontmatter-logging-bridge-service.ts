/**
 * @fileoverview FrontmatterLoggingBridgeService - Debug Logger Bridge Creation
 * @description Handles debug logger bridge creation between DomainLogger and DebugLogger interfaces
 * Following DDD boundaries and Totality principles for logging coordination
 */

import { ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { DebugLogger, LogContext } from "../../shared/services/debug-logger.ts";
import { DomainLogger } from "../../shared/services/domain-logger.ts";

/**
 * Configuration interface for logging bridge service dependencies
 * Following dependency injection pattern for DDD compliance
 */
export interface FrontmatterLoggingBridgeServiceConfig {
  readonly domainLogger: DomainLogger;
}

/**
 * FrontmatterLoggingBridgeService - Debug Logger Bridge Creation Coordinator
 *
 * Responsibilities:
 * - Create debug logger bridges between DomainLogger and DebugLogger interfaces
 * - Handle log level mapping and context translation
 * - Provide backward compatibility for legacy DebugLogger usage
 * - Maintain logging consistency across service boundaries
 *
 * Following DDD principles:
 * - Single responsibility: Logger bridge creation and management only
 * - Domain service: Logging coordination within Frontmatter Context
 * - Totality: All methods return Result<T,E>
 * - Interface adaptation: Clean translation between logging interfaces
 */
export class FrontmatterLoggingBridgeService {
  private constructor(
    private readonly config: FrontmatterLoggingBridgeServiceConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates logging bridge service with validated configuration
   */
  static create(
    config: FrontmatterLoggingBridgeServiceConfig,
  ): Result<
    FrontmatterLoggingBridgeService,
    DomainError & { message: string }
  > {
    // Validate required dependencies
    if (!config.domainLogger) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Domain logger is required for logging bridge service",
        }),
      };
    }

    return ok(new FrontmatterLoggingBridgeService(config));
  }

  /**
   * Create debug logger bridge for configuration processor
   * Converts DomainLogger to DebugLogger interface for compatibility
   */
  createConfigurationDebugLoggerBridge(): DebugLogger {
    const domainLogger = this.config.domainLogger;

    return {
      info: (message: string, context?: LogContext) => {
        domainLogger.logInfo("configuration", message, context);
        return ok(void 0);
      },
      debug: (message: string, context?: LogContext) => {
        domainLogger.logDebug("configuration", message, context);
        return ok(void 0);
      },
      trace: (message: string, context?: LogContext) => {
        domainLogger.logDebug("configuration", message, context);
        return ok(void 0);
      },
      warn: (message: string, context?: LogContext) => {
        domainLogger.logWarning("configuration", message, context);
        return ok(void 0);
      },
      error: (message: string, context?: LogContext) => {
        domainLogger.logError("configuration", message, context);
        return ok(void 0);
      },
      log: (level, message, context?) => {
        switch (level.kind) {
          case "error":
            domainLogger.logError("configuration", message, context);
            return ok(void 0);
          case "warn":
            domainLogger.logWarning("configuration", message, context);
            return ok(void 0);
          case "info":
            domainLogger.logInfo("configuration", message, context);
            return ok(void 0);
          case "debug":
          case "trace":
            domainLogger.logDebug("configuration", message, context);
            return ok(void 0);
        }
      },
      withContext: (_baseContext: LogContext) => {
        return this.createConfigurationDebugLoggerBridge();
      },
    };
  }

  /**
   * Create debug logger bridge for transformation processor
   * Provides backward compatibility while transitioning to DomainLogger
   */
  createTransformationDebugLoggerBridge(): DebugLogger {
    const domainLogger = this.config.domainLogger;

    // Return proper DebugLogger implementation following Totality principles
    const debugLogger: DebugLogger = {
      info: (message: string, context?: LogContext) => {
        domainLogger.logInfo("transformation", message, context);
        return ok(void 0);
      },
      debug: (message: string, context?: LogContext) => {
        domainLogger.logDebug("transformation", message, context);
        return ok(void 0);
      },
      trace: (message: string, context?: LogContext) => {
        domainLogger.logDebug("transformation", message, context); // Use debug level for trace
        return ok(void 0);
      },
      warn: (message: string, context?: LogContext) => {
        domainLogger.logWarning("transformation", message, context);
        return ok(void 0);
      },
      error: (message: string, context?: LogContext) => {
        domainLogger.logError("transformation", message, context);
        return ok(void 0);
      },
      log: (level, message, context?) => {
        // Delegate to appropriate method based on level
        switch (level.kind) {
          case "error":
            return debugLogger.error(message, context);
          case "warn":
            return debugLogger.warn(message, context);
          case "info":
            return debugLogger.info(message, context);
          case "debug":
          case "trace":
            return debugLogger.debug(message, context);
        }
      },
      withContext: (_baseContext: LogContext) => {
        // For simplicity, return the same logger (could be enhanced to merge contexts)
        return debugLogger;
      },
    };

    return debugLogger;
  }

  /**
   * Create generic debug logger bridge with custom context prefix
   * Allows for flexible context-specific logging bridges
   */
  createGenericDebugLoggerBridge(contextPrefix: string): DebugLogger {
    const domainLogger = this.config.domainLogger;

    const debugLogger: DebugLogger = {
      info: (message: string, context?: LogContext) => {
        domainLogger.logInfo(contextPrefix, message, context);
        return ok(void 0);
      },
      debug: (message: string, context?: LogContext) => {
        domainLogger.logDebug(contextPrefix, message, context);
        return ok(void 0);
      },
      trace: (message: string, context?: LogContext) => {
        domainLogger.logDebug(contextPrefix, message, context);
        return ok(void 0);
      },
      warn: (message: string, context?: LogContext) => {
        domainLogger.logWarning(contextPrefix, message, context);
        return ok(void 0);
      },
      error: (message: string, context?: LogContext) => {
        domainLogger.logError(contextPrefix, message, context);
        return ok(void 0);
      },
      log: (level, message, context?) => {
        switch (level.kind) {
          case "error":
            return debugLogger.error(message, context);
          case "warn":
            return debugLogger.warn(message, context);
          case "info":
            return debugLogger.info(message, context);
          case "debug":
          case "trace":
            return debugLogger.debug(message, context);
        }
      },
      withContext: (_baseContext: LogContext) => {
        return debugLogger;
      },
    };

    return debugLogger;
  }

  /**
   * Validate logging bridge preconditions
   * Ensures proper context for logger bridge creation
   */
  validateLoggingBridgePreconditions(
    contextPrefix?: string,
  ): Result<void, DomainError & { message: string }> {
    // Validate context prefix if provided
    if (contextPrefix !== undefined && contextPrefix.trim() === "") {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Context prefix cannot be empty when provided",
        }),
      };
    }

    return ok(void 0);
  }

  /**
   * Create logging bridge context for monitoring and debugging
   * Provides structured context for logging bridge operations
   */
  createLoggingBridgeContext(
    operation: string,
    contextPrefix?: string,
  ): Record<string, unknown> {
    return {
      operation,
      loggingBridgeContext: {
        contextPrefix: contextPrefix ?? "default",
        timestamp: new Date().toISOString(),
      },
    };
  }
}
