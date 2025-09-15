/**
 * Error Context Value Objects for Enhanced Error Tracking
 *
 * Implements Totality principle with Smart Constructor pattern
 * Provides structured context for error diagnosis and debugging
 * Follows DDD principles with immutable value objects
 */

import { err, ok, Result } from "./result.ts";
import { createError, DomainError } from "./errors.ts";

/**
 * Source location information for error context
 */
export class SourceLocation {
  private constructor(
    readonly service: string,
    readonly method: string,
    readonly line?: number,
  ) {}

  static create(
    service: string,
    method: string,
    line?: number,
  ): Result<SourceLocation, DomainError & { message: string }> {
    if (!service || service.trim().length === 0) {
      return err(createError(
        { kind: "EmptyInput" },
        "Service name cannot be empty",
      ));
    }
    if (!method || method.trim().length === 0) {
      return err(createError(
        { kind: "EmptyInput" },
        "Method name cannot be empty",
      ));
    }
    return ok(new SourceLocation(service.trim(), method.trim(), line));
  }

  toString(): string {
    return this.line
      ? `${this.service}.${this.method}:${this.line}`
      : `${this.service}.${this.method}`;
  }
}

/**
 * Decision information for tracking processing choices
 */
export class Decision {
  private constructor(
    readonly description: string,
    readonly alternatives: string[],
    readonly reasoning: string,
    readonly timestamp: Date,
  ) {}

  static create(
    description: string,
    alternatives: string[],
    reasoning: string,
  ): Result<Decision, DomainError & { message: string }> {
    if (!description || description.trim().length === 0) {
      return err(createError(
        { kind: "EmptyInput" },
        "Decision description cannot be empty",
      ));
    }
    if (!reasoning || reasoning.trim().length === 0) {
      return err(createError(
        { kind: "EmptyInput" },
        "Decision reasoning cannot be empty",
      ));
    }
    return ok(
      new Decision(
        description.trim(),
        alternatives.slice(), // defensive copy
        reasoning.trim(),
        new Date(),
      ),
    );
  }

  toString(): string {
    const altStr = this.alternatives.length > 0
      ? ` (alternatives: ${this.alternatives.join(", ")})`
      : "";
    return `${this.description}${altStr} - ${this.reasoning}`;
  }
}

/**
 * Processing progress information
 */
export class ProcessingProgress {
  private constructor(
    readonly stage: string,
    readonly currentStep: string,
    readonly completedSteps: string[],
    readonly totalSteps?: number,
  ) {}

  static create(
    stage: string,
    currentStep: string,
    completedSteps: string[] = [],
    totalSteps?: number,
  ): Result<ProcessingProgress, DomainError & { message: string }> {
    if (!stage || stage.trim().length === 0) {
      return err(createError(
        { kind: "EmptyInput" },
        "Stage name cannot be empty",
      ));
    }
    if (!currentStep || currentStep.trim().length === 0) {
      return err(createError(
        { kind: "EmptyInput" },
        "Current step cannot be empty",
      ));
    }
    if (totalSteps !== undefined && totalSteps < 1) {
      return err(createError(
        { kind: "OutOfRange", value: totalSteps, min: 1 },
        "Total steps must be at least 1",
      ));
    }
    return ok(
      new ProcessingProgress(
        stage.trim(),
        currentStep.trim(),
        completedSteps.slice(), // defensive copy
        totalSteps,
      ),
    );
  }

  getCompletionPercentage(): number | undefined {
    if (this.totalSteps === undefined) return undefined;
    return Math.round((this.completedSteps.length / this.totalSteps) * 100);
  }

  toString(): string {
    const progress = this.getCompletionPercentage();
    const progressStr = progress !== undefined ? ` (${progress}%)` : "";
    return `${this.stage}: ${this.currentStep}${progressStr}`;
  }
}

/**
 * Input parameter tracking for error context
 */
export class InputParameters {
  private constructor(readonly parameters: Record<string, unknown>) {}

  static create(
    parameters: Record<string, unknown> = {},
  ): InputParameters {
    // Create defensive copy with serializable values only
    const safeCopy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parameters)) {
      try {
        // Test serializability and truncate large values
        const serialized = JSON.stringify(value);
        safeCopy[key] = serialized.length > 1000
          ? `${serialized.substring(0, 1000)}... (truncated)`
          : value;
      } catch {
        safeCopy[key] = `[Non-serializable ${typeof value}]`;
      }
    }
    return new InputParameters(safeCopy);
  }

  get(key: string): unknown {
    return this.parameters[key];
  }

  has(key: string): boolean {
    return key in this.parameters;
  }

  keys(): string[] {
    return Object.keys(this.parameters);
  }

  toString(): string {
    const keys = this.keys();
    if (keys.length === 0) return "No input parameters";
    if (keys.length <= 3) {
      return keys.map((k) => `${k}=${JSON.stringify(this.parameters[k])}`).join(
        ", ",
      );
    }
    return `${keys.length} parameters: ${keys.slice(0, 3).join(", ")}...`;
  }
}

/**
 * Main Error Context value object
 * Provides structured context for error diagnosis
 */
export class ErrorContext {
  private constructor(
    readonly operation: string,
    readonly location: SourceLocation,
    readonly inputs: InputParameters,
    readonly decisions: Decision[],
    readonly progress: ProcessingProgress | undefined,
    readonly parentContext: ErrorContext | undefined,
    readonly timestamp: Date,
  ) {}

  static create(
    operation: string,
    location: SourceLocation,
  ): Result<ErrorContext, DomainError & { message: string }> {
    if (!operation || operation.trim().length === 0) {
      return err(createError(
        { kind: "EmptyInput" },
        "Operation name cannot be empty",
      ));
    }
    return ok(
      new ErrorContext(
        operation.trim(),
        location,
        InputParameters.create(),
        [],
        undefined,
        undefined,
        new Date(),
      ),
    );
  }

  /**
   * Create new context with additional input parameter
   */
  withInput(key: string, value: unknown): ErrorContext {
    const newParams = { ...this.inputs.parameters, [key]: value };
    return new ErrorContext(
      this.operation,
      this.location,
      InputParameters.create(newParams),
      this.decisions,
      this.progress,
      this.parentContext,
      this.timestamp,
    );
  }

  /**
   * Create new context with additional decision
   */
  withDecision(decision: Decision): ErrorContext {
    return new ErrorContext(
      this.operation,
      this.location,
      this.inputs,
      [...this.decisions, decision],
      this.progress,
      this.parentContext,
      this.timestamp,
    );
  }

  /**
   * Create new context with progress information
   */
  withProgress(progress: ProcessingProgress): ErrorContext {
    return new ErrorContext(
      this.operation,
      this.location,
      this.inputs,
      this.decisions,
      progress,
      this.parentContext,
      this.timestamp,
    );
  }

  /**
   * Create new context with parent context for call chain tracking
   */
  withParent(parent: ErrorContext): ErrorContext {
    return new ErrorContext(
      this.operation,
      this.location,
      this.inputs,
      this.decisions,
      this.progress,
      parent,
      this.timestamp,
    );
  }

  /**
   * Get context chain as array (most recent first)
   */
  getContextChain(): ErrorContext[] {
    const chain: ErrorContext[] = [this];
    let current = this.parentContext;
    while (current) {
      chain.push(current);
      current = current.parentContext;
    }
    return chain;
  }

  /**
   * Generate structured debug information
   */
  getDebugInfo(): Record<string, unknown> {
    return {
      operation: this.operation,
      location: this.location.toString(),
      inputs: this.inputs.toString(),
      decisions: this.decisions.map((d) => d.toString()),
      progress: this.progress?.toString(),
      timestamp: this.timestamp.toISOString(),
      contextDepth: this.getContextChain().length,
    };
  }

  /**
   * Generate human-readable context summary
   */
  toString(): string {
    const parts = [
      `Operation: ${this.operation}`,
      `Location: ${this.location.toString()}`,
    ];

    if (this.inputs.keys().length > 0) {
      parts.push(`Inputs: ${this.inputs.toString()}`);
    }

    if (this.decisions.length > 0) {
      parts.push(`Decisions: ${this.decisions.length} made`);
    }

    if (this.progress) {
      parts.push(`Progress: ${this.progress.toString()}`);
    }

    const depth = this.getContextChain().length;
    if (depth > 1) {
      parts.push(`Context depth: ${depth}`);
    }

    return parts.join(" | ");
  }
}

/**
 * Convenience factory functions for common context patterns
 */
export class ErrorContextFactory {
  /**
   * Create context for pipeline operations
   */
  static forPipeline(
    stage: string,
    method: string,
    line?: number,
  ): Result<ErrorContext, DomainError & { message: string }> {
    const locationResult = SourceLocation.create(
      "PipelineOrchestrator",
      method,
      line,
    );
    if (!locationResult.ok) return locationResult;

    return ErrorContext.create(`Pipeline: ${stage}`, locationResult.data);
  }

  /**
   * Create context for domain service operations
   */
  static forDomainService(
    serviceName: string,
    operation: string,
    method: string,
  ): Result<ErrorContext, DomainError & { message: string }> {
    const locationResult = SourceLocation.create(serviceName, method);
    if (!locationResult.ok) return locationResult;

    return ErrorContext.create(
      `${serviceName}: ${operation}`,
      locationResult.data,
    );
  }

  /**
   * Create context for template operations
   */
  static forTemplate(
    operation: string,
    templatePath: string,
    method: string,
  ): Result<ErrorContext, DomainError & { message: string }> {
    const locationResult = SourceLocation.create("TemplateService", method);
    if (!locationResult.ok) return locationResult;

    const contextResult = ErrorContext.create(
      `Template: ${operation}`,
      locationResult.data,
    );
    if (!contextResult.ok) return contextResult;

    return ok(contextResult.data.withInput("templatePath", templatePath));
  }

  /**
   * Create context for schema operations
   */
  static forSchema(
    operation: string,
    schemaPath: string,
    method: string,
  ): Result<ErrorContext, DomainError & { message: string }> {
    const locationResult = SourceLocation.create("SchemaService", method);
    if (!locationResult.ok) return locationResult;

    const contextResult = ErrorContext.create(
      `Schema: ${operation}`,
      locationResult.data,
    );
    if (!contextResult.ok) return contextResult;

    return ok(contextResult.data.withInput("schemaPath", schemaPath));
  }
}
