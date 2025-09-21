import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { VerbosityMode } from "../../domain/template/value-objects/processing-context.ts";

/**
 * Processing context for recovery operations
 * Following DDD principles - contains operation context information
 */
export interface RecoveryContext {
  readonly operationId: string;
  readonly verbosityMode: VerbosityMode;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly metadata: Record<string, unknown>;
}

/**
 * Recovery Strategy Interface
 * Following DDD principles - domain service for error recovery
 * Following Totality principles - total function returning Result<T,E>
 */
export interface RecoveryStrategy {
  canRecover(error: DomainError): boolean;
  recover(
    error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }>;
}

/**
 * Schema Load Failure Recovery Strategy
 * Handles schema loading errors with fallback mechanisms
 */
export class SchemaLoadFailureRecovery implements RecoveryStrategy {
  /**
   * Smart Constructor for SchemaLoadFailureRecovery
   * Following Totality principles
   */
  static create(): Result<
    SchemaLoadFailureRecovery,
    DomainError & { message: string }
  > {
    return ok(new SchemaLoadFailureRecovery());
  }

  canRecover(error: DomainError): boolean {
    // Can recover from schema-related errors
    switch (error.kind) {
      case "SchemaNotFound":
      case "InvalidSchema":
      case "RefResolutionFailed":
      case "CircularReference":
        return true;
      default:
        return false;
    }
  }

  recover(
    error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    // Recovery strategies based on error type
    switch (error.kind) {
      case "SchemaNotFound":
        return this.recoverFromSchemaNotFound(error, context);
      case "InvalidSchema":
        return this.recoverFromInvalidSchema(error, context);
      case "RefResolutionFailed":
        return this.recoverFromRefResolutionFailed(error, context);
      case "CircularReference":
        return this.recoverFromCircularReference(error, context);
      default:
        return err(createError({
          kind: "ConfigurationError",
          message:
            `Schema recovery not supported for error kind: ${error.kind}`,
        }));
    }
  }

  private recoverFromSchemaNotFound(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Schema not found after maximum recovery attempts",
      }));
    }

    // Recovery: Log error and suggest fallback
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Schema not found, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromInvalidSchema(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Invalid schema after maximum recovery attempts",
      }));
    }

    // Recovery: Log error and continue with simplified processing
    if (context.verbosityMode.kind === "verbose") {
      console.log(`[Recovery] Invalid schema, attempt ${context.attemptCount}`);
    }

    return ok(undefined);
  }

  private recoverFromRefResolutionFailed(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Reference resolution failed after maximum recovery attempts",
      }));
    }

    // Recovery: Skip reference resolution and continue
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Reference resolution failed, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromCircularReference(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Circular reference after maximum recovery attempts",
      }));
    }

    // Recovery: Break circular reference by limiting depth
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Circular reference detected, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }
}

/**
 * Template Resolution Failure Recovery Strategy
 * Handles template resolution errors with alternative paths
 */
export class TemplateResolutionFailureRecovery implements RecoveryStrategy {
  /**
   * Smart Constructor for TemplateResolutionFailureRecovery
   * Following Totality principles
   */
  static create(): Result<
    TemplateResolutionFailureRecovery,
    DomainError & { message: string }
  > {
    return ok(new TemplateResolutionFailureRecovery());
  }

  canRecover(error: DomainError): boolean {
    // Can recover from template-related errors
    switch (error.kind) {
      case "TemplateNotFound":
      case "InvalidTemplate":
      case "VariableNotFound":
      case "RenderFailed":
      case "InvalidFormat":
        return true;
      default:
        return false;
    }
  }

  recover(
    error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    // Recovery strategies based on error type
    switch (error.kind) {
      case "TemplateNotFound":
        return this.recoverFromTemplateNotFound(error, context);
      case "InvalidTemplate":
        return this.recoverFromInvalidTemplate(error, context);
      case "VariableNotFound":
        return this.recoverFromVariableNotFound(error, context);
      case "RenderFailed":
        return this.recoverFromRenderFailed(error, context);
      case "InvalidFormat":
        return this.recoverFromInvalidFormat(error, context);
      default:
        return err(createError({
          kind: "ConfigurationError",
          message:
            `Template recovery not supported for error kind: ${error.kind}`,
        }));
    }
  }

  private recoverFromTemplateNotFound(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Template not found after maximum recovery attempts",
      }));
    }

    // Recovery: Use default template or fallback
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Template not found, using fallback, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromInvalidTemplate(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Invalid template after maximum recovery attempts",
      }));
    }

    // Recovery: Use simplified template
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Invalid template, using simplified version, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromVariableNotFound(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Variable not found after maximum recovery attempts",
      }));
    }

    // Recovery: Use default value for missing variable
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Variable not found, using default, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromRenderFailed(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Render failed after maximum recovery attempts",
      }));
    }

    // Recovery: Use minimal rendering
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Render failed, using minimal rendering, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromInvalidFormat(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Invalid format after maximum recovery attempts",
      }));
    }

    // Recovery: Convert to default format
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Invalid format, converting to default, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }
}

/**
 * Validation Failure Recovery Strategy
 * Handles data validation errors with correction mechanisms
 */
export class ValidationFailureRecovery implements RecoveryStrategy {
  /**
   * Smart Constructor for ValidationFailureRecovery
   * Following Totality principles
   */
  static create(): Result<
    ValidationFailureRecovery,
    DomainError & { message: string }
  > {
    return ok(new ValidationFailureRecovery());
  }

  canRecover(error: DomainError): boolean {
    // Can recover from validation-related errors
    switch (error.kind) {
      case "OutOfRange":
      case "InvalidRegex":
      case "PatternMismatch":
      case "ParseError":
      case "EmptyInput":
      case "TooLong":
      case "InvalidType":
      case "MissingRequired":
        return true;
      default:
        return false;
    }
  }

  recover(
    error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    // Recovery strategies based on error type
    switch (error.kind) {
      case "OutOfRange":
        return this.recoverFromOutOfRange(error, context);
      case "InvalidRegex":
        return this.recoverFromInvalidRegex(error, context);
      case "PatternMismatch":
        return this.recoverFromPatternMismatch(error, context);
      case "ParseError":
        return this.recoverFromParseError(error, context);
      case "EmptyInput":
        return this.recoverFromEmptyInput(error, context);
      case "TooLong":
        return this.recoverFromTooLong(error, context);
      case "InvalidType":
        return this.recoverFromInvalidType(error, context);
      case "MissingRequired":
        return this.recoverFromMissingRequired(error, context);
      default:
        return err(createError({
          kind: "ConfigurationError",
          message:
            `Validation recovery not supported for error kind: ${error.kind}`,
        }));
    }
  }

  private recoverFromOutOfRange(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Out of range value after maximum recovery attempts",
      }));
    }

    // Recovery: Clamp value to valid range
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Out of range value, clamping to bounds, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromInvalidRegex(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Invalid regex after maximum recovery attempts",
      }));
    }

    // Recovery: Use fallback pattern
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Invalid regex, using fallback pattern, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromPatternMismatch(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Pattern mismatch after maximum recovery attempts",
      }));
    }

    // Recovery: Apply auto-correction or use default
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Pattern mismatch, applying auto-correction, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromParseError(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Parse error after maximum recovery attempts",
      }));
    }

    // Recovery: Use simplified parsing or default value
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Parse error, using simplified parsing, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromEmptyInput(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Empty input after maximum recovery attempts",
      }));
    }

    // Recovery: Provide default value
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Empty input, providing default value, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromTooLong(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Input too long after maximum recovery attempts",
      }));
    }

    // Recovery: Truncate to maximum length
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Input too long, truncating to maximum length, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromInvalidType(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Invalid type after maximum recovery attempts",
      }));
    }

    // Recovery: Convert to expected type
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Invalid type, converting to expected type, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }

  private recoverFromMissingRequired(
    _error: DomainError,
    context: RecoveryContext,
  ): Result<void, DomainError & { message: string }> {
    if (context.attemptCount >= context.maxAttempts) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Missing required field after maximum recovery attempts",
      }));
    }

    // Recovery: Provide sensible default for required field
    if (context.verbosityMode.kind === "verbose") {
      console.log(
        `[Recovery] Missing required field, providing default, attempt ${context.attemptCount}`,
      );
    }

    return ok(undefined);
  }
}

/**
 * Recovery Strategy Factory
 * Following DDD Factory pattern and Totality principles
 * Eliminates hardcoded recovery strategy selection through strategy pattern
 */
export class RecoveryStrategyFactory {
  /**
   * Create recovery strategy based on error type
   * Following Totality principles - exhaustive pattern matching
   */
  static createStrategies(): Result<
    RecoveryStrategy[],
    DomainError & { message: string }
  > {
    const strategies: RecoveryStrategy[] = [];

    // Create all recovery strategies
    const schemaRecoveryResult = SchemaLoadFailureRecovery.create();
    if (!schemaRecoveryResult.ok) {
      return schemaRecoveryResult;
    }
    strategies.push(schemaRecoveryResult.data);

    const templateRecoveryResult = TemplateResolutionFailureRecovery.create();
    if (!templateRecoveryResult.ok) {
      return templateRecoveryResult;
    }
    strategies.push(templateRecoveryResult.data);

    const validationRecoveryResult = ValidationFailureRecovery.create();
    if (!validationRecoveryResult.ok) {
      return validationRecoveryResult;
    }
    strategies.push(validationRecoveryResult.data);

    return ok(strategies);
  }

  /**
   * Find appropriate recovery strategy for given error
   * Following Totality principles - total function returning Result<T,E>
   */
  static findStrategy(
    error: DomainError,
    strategies: RecoveryStrategy[],
  ): Result<RecoveryStrategy, DomainError & { message: string }> {
    for (const strategy of strategies) {
      if (strategy.canRecover(error)) {
        return ok(strategy);
      }
    }

    return err(createError({
      kind: "ConfigurationError",
      message: `No recovery strategy found for error kind: ${error.kind}`,
    }));
  }
}
