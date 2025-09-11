/**
 * Verbose Logger Service
 *
 * Centralized verbose logging with decorator pattern.
 * Eliminates verbose logging code duplication.
 * Addresses issue #500: Code duplication patterns.
 */

import { getGlobalEnvironmentConfig } from "./dependency-container.ts";
import { StructuredLogger } from "../../domain/shared/logger.ts";

/**
 * Verbose log levels
 */
export type VerboseLevel = "info" | "debug" | "trace";

/**
 * Verbose log context - flexible to accept any additional properties
 */
export interface VerboseContext {
  operation?: string;
  document?: string;
  stage?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown; // Allow any additional properties
}

/**
 * Centralized verbose logging service
 * Implements decorator pattern for conditional logging
 */
export class VerboseLoggerService {
  private static readonly SERVICE_NAME = "verbose-logger";
  private static defaultInstance: VerboseLoggerService | null = null;
  private readonly logger: ReturnType<typeof StructuredLogger.getServiceLogger>;
  private readonly isVerboseMode: boolean;

  constructor(serviceName: string = VerboseLoggerService.SERVICE_NAME) {
    this.logger = StructuredLogger.getServiceLogger(serviceName);
    const envConfig = getGlobalEnvironmentConfig();
    this.isVerboseMode = envConfig.getVerboseMode();
  }

  /**
   * Get default instance for static methods
   */
  private static getDefaultInstance(): VerboseLoggerService {
    if (!VerboseLoggerService.defaultInstance) {
      VerboseLoggerService.defaultInstance = new VerboseLoggerService();
    }
    return VerboseLoggerService.defaultInstance;
  }

  /**
   * Static method for debug logging
   */
  static logDebug(
    serviceNameOrMessage: string,
    messageOrContext?: string | VerboseContext,
    context?: VerboseContext,
  ): void {
    // Handle both 2-arg and 3-arg calls for backward compatibility
    if (typeof messageOrContext === "string") {
      // 3-arg call: (serviceName, message, context)
      const logger = VerboseLoggerService.forService(serviceNameOrMessage);
      logger.debug(messageOrContext, context);
    } else {
      // 2-arg call: (message, context)
      VerboseLoggerService.getDefaultInstance().debug(
        serviceNameOrMessage,
        messageOrContext,
      );
    }
  }

  /**
   * Static method for warning logging
   */
  static logWarn(
    serviceNameOrMessage: string,
    messageOrContext?: string | VerboseContext,
    context?: VerboseContext,
  ): void {
    // Handle both 2-arg and 3-arg calls for backward compatibility
    if (typeof messageOrContext === "string") {
      // 3-arg call: (serviceName, message, context)
      const logger = VerboseLoggerService.forService(serviceNameOrMessage);
      logger.info(messageOrContext, context);
    } else {
      // 2-arg call: (message, context)
      VerboseLoggerService.getDefaultInstance().info(
        serviceNameOrMessage,
        messageOrContext,
      );
    }
  }

  /**
   * Static method for info logging
   */
  static logInfo(
    serviceNameOrMessage: string,
    messageOrContext?: string | VerboseContext,
    context?: VerboseContext,
  ): void {
    // Handle both 2-arg and 3-arg calls for backward compatibility
    if (typeof messageOrContext === "string") {
      // 3-arg call: (serviceName, message, context)
      const logger = VerboseLoggerService.forService(serviceNameOrMessage);
      logger.info(messageOrContext, context);
    } else {
      // 2-arg call: (message, context)
      VerboseLoggerService.getDefaultInstance().info(
        serviceNameOrMessage,
        messageOrContext,
      );
    }
  }

  /**
   * Create a verbose logger for a specific service
   */
  static forService(serviceName: string): VerboseLoggerService {
    return new VerboseLoggerService(serviceName);
  }

  /**
   * Log verbose message if verbose mode is enabled
   * Replaces duplicate verbose mode checks
   */
  logVerbose(
    level: VerboseLevel,
    message: string,
    context?: VerboseContext,
  ): void {
    if (!this.isVerboseMode) {
      return;
    }

    const logData = this.formatLogData(context);

    switch (level) {
      case "info":
        this.logger.info(message, logData);
        break;
      case "debug":
        this.logger.debug(message, logData);
        break;
      case "trace":
        this.logger.debug(`[TRACE] ${message}`, logData);
        break;
    }
  }

  /**
   * Log info level verbose message
   */
  info(message: string, context?: VerboseContext): void {
    this.logVerbose("info", message, context);
  }

  /**
   * Log debug level verbose message
   */
  debug(message: string, context?: VerboseContext): void {
    this.logVerbose("debug", message, context);
  }

  /**
   * Log trace level verbose message
   */
  trace(message: string, context?: VerboseContext): void {
    this.logVerbose("trace", message, context);
  }

  /**
   * Log stage completion in verbose mode
   * Common pattern for processing stages
   */
  logStageCompletion(
    stage: string,
    document?: string,
    additionalData?: Record<string, unknown>,
  ): void {
    this.info(`[${stage}] Stage completed`, {
      operation: "stage-completion",
      stage,
      document,
      data: additionalData,
    });
  }

  /**
   * Log extraction result in verbose mode
   * Common pattern for extraction operations
   */
  logExtractionResult(
    extractionType: string,
    document: string,
    result: Record<string, unknown>,
  ): void {
    this.info(`[${extractionType}] Extraction completed`, {
      operation: "extraction",
      document,
      data: {
        type: extractionType,
        keys: Object.keys(result),
        itemCount: Object.keys(result).length,
      },
    });
  }

  /**
   * Log validation result in verbose mode
   */
  logValidationResult(
    validationType: string,
    isValid: boolean,
    details?: Record<string, unknown>,
  ): void {
    const message = isValid
      ? `[${validationType}] Validation passed`
      : `[${validationType}] Validation failed`;

    this.info(message, {
      operation: "validation",
      data: {
        type: validationType,
        isValid,
        ...details,
      },
    });
  }

  /**
   * Decorator method for wrapping operations with verbose logging
   */
  async withVerboseLogging<T>(
    operation: string,
    document: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    this.info(`[${operation}] Starting`, {
      operation,
      document,
      stage: "start",
    });

    try {
      const result = await fn();

      this.info(`[${operation}] Completed successfully`, {
        operation,
        document,
        stage: "complete",
      });

      return result;
    } catch (error) {
      this.info(`[${operation}] Failed with error`, {
        operation,
        document,
        stage: "error",
        data: {
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  /**
   * Format log data from context
   */
  private formatLogData(
    context?: VerboseContext,
  ): Record<string, unknown> {
    if (!context) {
      return {};
    }

    const logData: Record<string, unknown> = {};

    if (context.document) {
      logData.document = context.document;
    }

    if (context.stage) {
      logData.stage = context.stage;
    }

    if (context.data) {
      Object.assign(logData, context.data);
    }

    return logData;
  }

  /**
   * Check if verbose mode is currently enabled
   */
  isVerbose(): boolean {
    return this.isVerboseMode;
  }
}
