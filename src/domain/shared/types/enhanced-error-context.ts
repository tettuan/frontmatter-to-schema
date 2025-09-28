/**
 * Enhanced Error Context Value Objects for Phase 1 Error Handling Enhancement
 *
 * Extends the existing ErrorContext with:
 * - Correlation ID generation
 * - Stack trace capture
 * - User context information
 * - System context metrics
 *
 * Implements Totality principle with Smart Constructor pattern
 * Follows DDD principles with immutable value objects
 */

import { ok, Result } from "./result.ts";
import type { DomainError } from "./errors.ts";
import { ErrorContext, SourceLocation } from "./error-context.ts";

/**
 * Correlation ID for tracking errors across distributed operations
 */
export class CorrelationId {
  private constructor(readonly value: string) {}

  static create(customId?: string): CorrelationId {
    const id = customId || this.generateId();
    return new CorrelationId(id);
  }

  private static generateId(): string {
    // Generate UUID-like correlation ID with timestamp prefix for traceability
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}-${random}`;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Stack trace information for error diagnosis
 */
export class StackTrace {
  private constructor(
    readonly frames: string[],
    readonly captureTime: Date,
  ) {}

  static capture(): StackTrace {
    const error = new Error();
    const stack = error.stack || "";

    // Parse stack trace, excluding the capture function itself
    const frames = stack
      .split("\n")
      .slice(1) // Remove "Error" line
      .filter((line) => line.trim() && !line.includes("StackTrace.capture"))
      .map((line) => line.trim())
      .slice(0, 10); // Limit to 10 frames to avoid excessive data

    return new StackTrace(frames, new Date());
  }

  static empty(): StackTrace {
    return new StackTrace([], new Date());
  }

  toString(): string {
    if (this.frames.length === 0) return "No stack trace available";
    return this.frames.slice(0, 3).join(" <- ") +
      (this.frames.length > 3
        ? ` (${this.frames.length - 3} more frames)`
        : "");
  }

  getFullTrace(): string {
    return this.frames.join("\n");
  }
}

/**
 * User context information for error tracking
 */
export class UserContext {
  private constructor(
    readonly inputFile?: string,
    readonly schema?: string,
    readonly template?: string,
    readonly operation?: string,
    readonly targetFormat?: string,
  ) {}

  static create(options: {
    inputFile?: string;
    schema?: string;
    template?: string;
    operation?: string;
    targetFormat?: string;
  } = {}): UserContext {
    return new UserContext(
      options.inputFile,
      options.schema,
      options.template,
      options.operation,
      options.targetFormat,
    );
  }

  static empty(): UserContext {
    return new UserContext();
  }

  toString(): string {
    const parts: string[] = [];
    if (this.inputFile) parts.push(`file=${this.inputFile}`);
    if (this.schema) parts.push(`schema=${this.schema}`);
    if (this.template) parts.push(`template=${this.template}`);
    if (this.operation) parts.push(`op=${this.operation}`);
    if (this.targetFormat) parts.push(`format=${this.targetFormat}`);

    return parts.length > 0 ? parts.join(", ") : "No user context";
  }
}

/**
 * System context metrics for error analysis
 */
export class SystemContext {
  private constructor(
    readonly memoryUsage?: number,
    readonly processingTime?: number,
    readonly retryCount: number = 0,
    readonly nodeVersion?: string,
    readonly denoVersion?: string,
    readonly platform?: string,
  ) {}

  static create(options: {
    memoryUsage?: number;
    processingTime?: number;
    retryCount?: number;
    captureSystemInfo?: boolean;
  } = {}): SystemContext {
    const systemInfo = options.captureSystemInfo
      ? this.captureSystemInfo()
      : {};

    return new SystemContext(
      options.memoryUsage,
      options.processingTime,
      options.retryCount || 0,
      systemInfo.nodeVersion,
      systemInfo.denoVersion,
      systemInfo.platform,
    );
  }

  private static captureSystemInfo(): {
    nodeVersion?: string;
    denoVersion?: string;
    platform?: string;
  } {
    try {
      // Safely check for Node.js environment
      const global = globalThis as any;
      const nodeProcess = global.process;

      return {
        nodeVersion: typeof Deno !== "undefined"
          ? undefined
          : nodeProcess?.version,
        denoVersion: typeof Deno !== "undefined"
          ? Deno.version?.deno
          : undefined,
        platform: typeof Deno !== "undefined"
          ? Deno.build?.os
          : nodeProcess?.platform,
      };
    } catch {
      return {};
    }
  }

  static empty(): SystemContext {
    return new SystemContext();
  }

  withRetryCount(count: number): SystemContext {
    return new SystemContext(
      this.memoryUsage,
      this.processingTime,
      count,
      this.nodeVersion,
      this.denoVersion,
      this.platform,
    );
  }

  withMemoryUsage(usage: number): SystemContext {
    return new SystemContext(
      usage,
      this.processingTime,
      this.retryCount,
      this.nodeVersion,
      this.denoVersion,
      this.platform,
    );
  }

  withProcessingTime(time: number): SystemContext {
    return new SystemContext(
      this.memoryUsage,
      time,
      this.retryCount,
      this.nodeVersion,
      this.denoVersion,
      this.platform,
    );
  }

  toString(): string {
    const parts: string[] = [];
    if (this.memoryUsage) {
      parts.push(`mem=${Math.round(this.memoryUsage / 1024 / 1024)}MB`);
    }
    if (this.processingTime) parts.push(`time=${this.processingTime}ms`);
    if (this.retryCount > 0) parts.push(`retries=${this.retryCount}`);
    if (this.platform) parts.push(`platform=${this.platform}`);

    return parts.length > 0 ? parts.join(", ") : "No system context";
  }
}

/**
 * Enhanced Error Context extending the base ErrorContext with additional diagnostic information
 */
export class EnhancedErrorContext {
  private constructor(
    readonly baseContext: ErrorContext,
    readonly correlationId: CorrelationId,
    readonly stackTrace: StackTrace,
    readonly userContext: UserContext,
    readonly systemContext: SystemContext,
    readonly enhancementTimestamp: Date,
  ) {}

  static create(
    operation: string,
    location: SourceLocation,
    options: {
      correlationId?: CorrelationId;
      captureStackTrace?: boolean;
      userContext?: UserContext;
      systemContext?: SystemContext;
    } = {},
  ): Result<EnhancedErrorContext, DomainError & { message: string }> {
    const baseContextResult = ErrorContext.create(operation, location);
    if (!baseContextResult.ok) return baseContextResult;

    const correlationId = options.correlationId || CorrelationId.create();
    const stackTrace = options.captureStackTrace !== false
      ? StackTrace.capture()
      : StackTrace.empty();
    const userContext = options.userContext || UserContext.empty();
    const systemContext = options.systemContext || SystemContext.empty();

    return ok(
      new EnhancedErrorContext(
        baseContextResult.data,
        correlationId,
        stackTrace,
        userContext,
        systemContext,
        new Date(),
      ),
    );
  }

  static fromBaseContext(
    baseContext: ErrorContext,
    options: {
      correlationId?: CorrelationId;
      captureStackTrace?: boolean;
      userContext?: UserContext;
      systemContext?: SystemContext;
    } = {},
  ): EnhancedErrorContext {
    const correlationId = options.correlationId || CorrelationId.create();
    const stackTrace = options.captureStackTrace !== false
      ? StackTrace.capture()
      : StackTrace.empty();
    const userContext = options.userContext || UserContext.empty();
    const systemContext = options.systemContext || SystemContext.empty();

    return new EnhancedErrorContext(
      baseContext,
      correlationId,
      stackTrace,
      userContext,
      systemContext,
      new Date(),
    );
  }

  /**
   * Create new context with updated user context
   */
  withUserContext(userContext: UserContext): EnhancedErrorContext {
    return new EnhancedErrorContext(
      this.baseContext,
      this.correlationId,
      this.stackTrace,
      userContext,
      this.systemContext,
      this.enhancementTimestamp,
    );
  }

  /**
   * Create new context with updated system context
   */
  withSystemContext(systemContext: SystemContext): EnhancedErrorContext {
    return new EnhancedErrorContext(
      this.baseContext,
      this.correlationId,
      this.stackTrace,
      this.userContext,
      systemContext,
      this.enhancementTimestamp,
    );
  }

  /**
   * Create new context with updated base context (preserving enhancements)
   */
  withBaseContext(baseContext: ErrorContext): EnhancedErrorContext {
    return new EnhancedErrorContext(
      baseContext,
      this.correlationId,
      this.stackTrace,
      this.userContext,
      this.systemContext,
      this.enhancementTimestamp,
    );
  }

  /**
   * Generate comprehensive debug information
   */
  getEnhancedDebugInfo(): Record<string, unknown> {
    return {
      ...this.baseContext.getDebugInfo(),
      correlationId: this.correlationId.toString(),
      stackTrace: this.stackTrace.toString(),
      userContext: this.userContext.toString(),
      systemContext: this.systemContext.toString(),
      enhancementTimestamp: this.enhancementTimestamp.toISOString(),
      fullStackTrace: this.stackTrace.getFullTrace(),
    };
  }

  /**
   * Generate enhanced human-readable summary
   */
  toString(): string {
    const baseParts = [
      this.baseContext.toString(),
      `ID: ${this.correlationId.toString()}`,
    ];

    if (this.userContext.toString() !== "No user context") {
      baseParts.push(`User: ${this.userContext.toString()}`);
    }

    if (this.systemContext.toString() !== "No system context") {
      baseParts.push(`System: ${this.systemContext.toString()}`);
    }

    if (this.stackTrace.toString() !== "No stack trace available") {
      baseParts.push(`Stack: ${this.stackTrace.toString()}`);
    }

    return baseParts.join(" | ");
  }
}

/**
 * Enhanced Error Context Factory for common patterns
 */
export class EnhancedErrorContextFactory {
  /**
   * Create enhanced context for file processing operations
   */
  static forFileProcessing(
    inputFile: string,
    schema: string,
    operation: string,
    method: string,
    options: {
      template?: string;
      targetFormat?: string;
      captureSystemMetrics?: boolean;
    } = {},
  ): Result<EnhancedErrorContext, DomainError & { message: string }> {
    const locationResult = SourceLocation.create("FileProcessor", method);
    if (!locationResult.ok) return locationResult;

    const userContext = UserContext.create({
      inputFile,
      schema,
      template: options.template,
      operation,
      targetFormat: options.targetFormat,
    });

    const systemContext = SystemContext.create({
      captureSystemInfo: options.captureSystemMetrics !== false,
    });

    return EnhancedErrorContext.create(
      `File Processing: ${operation}`,
      locationResult.data,
      {
        userContext,
        systemContext,
        captureStackTrace: true,
      },
    );
  }

  /**
   * Create enhanced context for schema operations
   */
  static forSchemaOperation(
    schemaPath: string,
    operation: string,
    method: string,
    correlationId?: CorrelationId,
  ): Result<EnhancedErrorContext, DomainError & { message: string }> {
    const locationResult = SourceLocation.create("SchemaProcessor", method);
    if (!locationResult.ok) return locationResult;

    const userContext = UserContext.create({
      schema: schemaPath,
      operation,
    });

    return EnhancedErrorContext.create(
      `Schema: ${operation}`,
      locationResult.data,
      {
        correlationId,
        userContext,
        captureStackTrace: true,
      },
    );
  }

  /**
   * Create enhanced context for template operations
   */
  static forTemplateOperation(
    templatePath: string,
    operation: string,
    method: string,
    correlationId?: CorrelationId,
  ): Result<EnhancedErrorContext, DomainError & { message: string }> {
    const locationResult = SourceLocation.create("TemplateProcessor", method);
    if (!locationResult.ok) return locationResult;

    const userContext = UserContext.create({
      template: templatePath,
      operation,
    });

    return EnhancedErrorContext.create(
      `Template: ${operation}`,
      locationResult.data,
      {
        correlationId,
        userContext,
        captureStackTrace: true,
      },
    );
  }
}
