/**
 * @fileoverview Unified Error Handler - DDD & Totality-based error management
 * @description Eliminates 576 duplicate error creation patterns through centralized service
 */

import { err, Result } from "../types/result.ts";
import {
  AggregationError,
  createEnhancedError,
  createError,
  DomainError,
  ErrorWithContext,
  ErrorWithMessage,
  FileSystemError,
  FrontmatterError,
  PerformanceError,
  SchemaError,
  SystemError,
  TemplateError,
  ValidationError,
} from "../types/errors.ts";
import { ErrorContext, ErrorContextFactory } from "../types/error-context.ts";

/**
 * Domain type enumeration for context detection
 */
export type DomainType =
  | "schema"
  | "frontmatter"
  | "template"
  | "aggregation"
  | "filesystem"
  | "system"
  | "performance"
  | "validation";

/**
 * Simplified context for error builder initialization
 */
export interface SimpleErrorContext {
  readonly operation?: string;
  readonly method?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Helper type for flexible error returns
 */
type ErrorResult<T extends DomainError> = Result<
  never,
  T & (ErrorWithContext | ErrorWithMessage)
>;

/**
 * Unified Error Handler - Main aggregate root for error operations
 * Implements DDD principles with domain-specific error builders
 */
export class UnifiedErrorHandler {
  private static instance: UnifiedErrorHandler | null = null;

  private constructor() {}

  /**
   * Singleton pattern following Totality principles
   */
  static getInstance(): UnifiedErrorHandler {
    if (!UnifiedErrorHandler.instance) {
      UnifiedErrorHandler.instance = new UnifiedErrorHandler();
    }
    return UnifiedErrorHandler.instance;
  }

  /**
   * Domain-specific error builders with fluent interface
   */
  schema(simpleContext?: SimpleErrorContext): SchemaErrorBuilder {
    const contextResult = this.createDomainContext("schema", simpleContext);
    return new SchemaErrorBuilder(
      contextResult.ok ? contextResult.data : undefined,
    );
  }

  validation(simpleContext?: SimpleErrorContext): ValidationErrorBuilder {
    const contextResult = this.createDomainContext("validation", simpleContext);
    return new ValidationErrorBuilder(
      contextResult.ok ? contextResult.data : undefined,
    );
  }

  frontmatter(simpleContext?: SimpleErrorContext): FrontmatterErrorBuilder {
    const contextResult = this.createDomainContext(
      "frontmatter",
      simpleContext,
    );
    return new FrontmatterErrorBuilder(
      contextResult.ok ? contextResult.data : undefined,
    );
  }

  template(simpleContext?: SimpleErrorContext): TemplateErrorBuilder {
    const contextResult = this.createDomainContext("template", simpleContext);
    return new TemplateErrorBuilder(
      contextResult.ok ? contextResult.data : undefined,
    );
  }

  aggregation(simpleContext?: SimpleErrorContext): AggregationErrorBuilder {
    const contextResult = this.createDomainContext(
      "aggregation",
      simpleContext,
    );
    return new AggregationErrorBuilder(
      contextResult.ok ? contextResult.data : undefined,
    );
  }

  filesystem(simpleContext?: SimpleErrorContext): FileSystemErrorBuilder {
    const contextResult = this.createDomainContext("filesystem", simpleContext);
    return new FileSystemErrorBuilder(
      contextResult.ok ? contextResult.data : undefined,
    );
  }

  system(simpleContext?: SimpleErrorContext): SystemErrorBuilder {
    const contextResult = this.createDomainContext("system", simpleContext);
    return new SystemErrorBuilder(
      contextResult.ok ? contextResult.data : undefined,
    );
  }

  performance(simpleContext?: SimpleErrorContext): PerformanceErrorBuilder {
    const contextResult = this.createDomainContext(
      "performance",
      simpleContext,
    );
    return new PerformanceErrorBuilder(
      contextResult.ok ? contextResult.data : undefined,
    );
  }

  /**
   * Create domain context using ErrorContextFactory
   */
  private createDomainContext(
    domain: DomainType,
    simpleContext?: SimpleErrorContext,
  ): Result<ErrorContext, DomainError & { message: string }> {
    const serviceName = this.getServiceNameForDomain(domain);
    const operation = simpleContext?.operation ?? `${domain} operation`;
    const method = simpleContext?.method ?? "unknown";

    return ErrorContextFactory.forDomainService(serviceName, operation, method);
  }

  /**
   * Map domain types to service names
   */
  private getServiceNameForDomain(domain: DomainType): string {
    switch (domain) {
      case "schema":
        return "SchemaService";
      case "validation":
        return "ValidationService";
      case "frontmatter":
        return "FrontmatterService";
      case "template":
        return "TemplateService";
      case "aggregation":
        return "AggregationService";
      case "filesystem":
        return "FileSystemService";
      case "system":
        return "SystemService";
      case "performance":
        return "PerformanceService";
      default:
        return "UnknownService";
    }
  }
}

/**
 * Base error builder with common functionality
 */
abstract class BaseErrorBuilder<T extends DomainError> {
  protected context?: ErrorContext;

  constructor(context?: ErrorContext) {
    this.context = context;
  }

  /**
   * Create error with context if available, otherwise simple error
   */
  protected createError<E extends T>(
    error: E,
    customMessage?: string,
  ): ErrorResult<E> {
    if (this.context) {
      return err(createEnhancedError(error, this.context, customMessage));
    }
    return err(createError(error, customMessage));
  }

  /**
   * Create simple error without context
   */
  protected createSimpleError<E extends T>(
    error: E,
    customMessage?: string,
  ): Result<never, E & ErrorWithMessage> {
    return err(createError(error, customMessage));
  }
}

/**
 * Schema Error Builder - Smart constructors for schema domain
 */
export class SchemaErrorBuilder extends BaseErrorBuilder<SchemaError> {
  notFound(path: string): ErrorResult<SchemaError> {
    return this.createError({ kind: "SchemaNotFound", path });
  }

  invalid(message: string): ErrorResult<SchemaError> {
    return this.createError({ kind: "InvalidSchema", message });
  }

  invalidSchema(message: string): ErrorResult<SchemaError> {
    return this.createError({ kind: "InvalidSchema", message });
  }

  refResolutionFailed(ref: string, message: string): ErrorResult<SchemaError> {
    return this.createError({ kind: "RefResolutionFailed", ref, message });
  }

  circularReference(refs: string[]): ErrorResult<SchemaError> {
    return this.createError({ kind: "CircularReference", refs });
  }

  invalidTemplate(template: string): ErrorResult<SchemaError> {
    return this.createError({ kind: "InvalidTemplate", template });
  }

  templateNotDefined(): ErrorResult<SchemaError> {
    return this.createError({ kind: "TemplateNotDefined" });
  }

  frontmatterPartNotFound(): ErrorResult<SchemaError> {
    return this.createError({ kind: "FrontmatterPartNotFound" });
  }

  propertyNotFound(path: string): ErrorResult<SchemaError> {
    return this.createError({ kind: "PropertyNotFound", path });
  }

  refNotDefined(): ErrorResult<SchemaError> {
    return this.createError({ kind: "RefNotDefined" });
  }

  itemsNotDefined(): ErrorResult<SchemaError> {
    return this.createError({ kind: "ItemsNotDefined" });
  }

  enumNotDefined(): ErrorResult<SchemaError> {
    return this.createError({ kind: "EnumNotDefined" });
  }

  propertiesNotDefined(): ErrorResult<SchemaError> {
    return this.createError({ kind: "PropertiesNotDefined" });
  }

  typeNotDefined(): ErrorResult<SchemaError> {
    return this.createError({ kind: "TypeNotDefined" });
  }
}

/**
 * Validation Error Builder - Smart constructors for validation domain
 */
export class ValidationErrorBuilder extends BaseErrorBuilder<ValidationError> {
  outOfRange(
    value: unknown,
    min?: number,
    max?: number,
  ): ErrorResult<ValidationError> {
    return this.createError({ kind: "OutOfRange", value, min, max });
  }

  invalidRegex(pattern: string): ErrorResult<ValidationError> {
    return this.createError({ kind: "InvalidRegex", pattern });
  }

  patternMismatch(
    value: string,
    pattern: string,
  ): ErrorResult<ValidationError> {
    return this.createError({ kind: "PatternMismatch", value, pattern });
  }

  parseError(input: string, field?: string): ErrorResult<ValidationError> {
    return this.createError({ kind: "ParseError", input, field });
  }

  emptyInput(): ErrorResult<ValidationError> {
    return this.createError({ kind: "EmptyInput" });
  }

  tooLong(value: string, maxLength: number): ErrorResult<ValidationError> {
    return this.createError({ kind: "TooLong", value, maxLength });
  }

  invalidType(expected: string, actual: string): ErrorResult<ValidationError> {
    return this.createError({ kind: "InvalidType", expected, actual });
  }

  missingRequired(field: string): ErrorResult<ValidationError> {
    return this.createError({ kind: "MissingRequired", field });
  }

  configNotFound(path: string, field?: string): ErrorResult<ValidationError> {
    return this.createError({ kind: "ConfigNotFound", path, field });
  }

  invalidFormat(
    format: string,
    value?: string,
    field?: string,
    customMessage?: string,
  ): ErrorResult<ValidationError> {
    return this.createError(
      { kind: "InvalidFormat", format, value, field },
      customMessage,
    );
  }

  fieldNotFound(path: string, message?: string): ErrorResult<ValidationError> {
    return this.createError({ kind: "FieldNotFound", path }, message);
  }

  invalidStructure(
    field: string,
    message?: string,
  ): ErrorResult<ValidationError> {
    return this.createError({ kind: "InvalidStructure", field }, message);
  }

  validationRuleNotFound(path: string): ErrorResult<ValidationError> {
    return this.createError({ kind: "ValidationRuleNotFound", path });
  }
}

/**
 * Frontmatter Error Builder - Smart constructors for frontmatter domain
 */
export class FrontmatterErrorBuilder
  extends BaseErrorBuilder<FrontmatterError> {
  extractionFailed(message: string): ErrorResult<FrontmatterError> {
    return this.createError({ kind: "ExtractionFailed", message });
  }

  invalidYaml(message: string): ErrorResult<FrontmatterError> {
    return this.createError({ kind: "InvalidYaml", message });
  }

  noFrontmatter(): ErrorResult<FrontmatterError> {
    return this.createError({ kind: "NoFrontmatter" });
  }

  malformedFrontmatter(content: string): ErrorResult<FrontmatterError> {
    return this.createError({ kind: "MalformedFrontmatter", content });
  }
}

/**
 * Template Error Builder - Smart constructors for template domain
 */
export class TemplateErrorBuilder extends BaseErrorBuilder<TemplateError> {
  notFound(path: string): ErrorResult<TemplateError> {
    return this.createError({ kind: "TemplateNotFound", path });
  }

  invalid(message: string): ErrorResult<TemplateError> {
    return this.createError({ kind: "InvalidTemplate", message });
  }

  variableNotFound(variable: string): ErrorResult<TemplateError> {
    return this.createError({ kind: "VariableNotFound", variable });
  }

  renderFailed(message: string): ErrorResult<TemplateError> {
    return this.createError({ kind: "RenderFailed", message });
  }

  invalidFormat(format: string): ErrorResult<TemplateError> {
    return this.createError({ kind: "InvalidFormat", format });
  }
  structureInvalid(
    template: string,
    issue: string,
  ): ErrorResult<TemplateError> {
    return this.createError({
      kind: "TemplateStructureInvalid",
      template,
      issue,
    });
  }

  dataCompositionFailed(reason: string): ErrorResult<TemplateError> {
    return this.createError({ kind: "DataCompositionFailed", reason });
  }

  variableResolutionFailed(
    variable: string,
    reason: string,
  ): ErrorResult<TemplateError> {
    return this.createError({
      kind: "VariableResolutionFailed",
      variable,
      reason,
    });
  }
}

/**
 * Aggregation Error Builder - Smart constructors for aggregation domain
 */
export class AggregationErrorBuilder
  extends BaseErrorBuilder<AggregationError> {
  invalidExpression(expression: string): ErrorResult<AggregationError> {
    return this.createError({ kind: "InvalidExpression", expression });
  }

  pathNotFound(path: string): ErrorResult<AggregationError> {
    return this.createError({ kind: "PathNotFound", path });
  }

  aggregationFailed(message: string): ErrorResult<AggregationError> {
    return this.createError({ kind: "AggregationFailed", message });
  }

  mergeFailed(message: string): ErrorResult<AggregationError> {
    return this.createError({ kind: "MergeFailed", message });
  }
}

/**
 * FileSystem Error Builder - Smart constructors for filesystem domain
 */
export class FileSystemErrorBuilder extends BaseErrorBuilder<FileSystemError> {
  fileNotFound(path: string): ErrorResult<FileSystemError> {
    return this.createError({ kind: "FileNotFound", path });
  }

  readFailed(path: string, message: string): ErrorResult<FileSystemError> {
    return this.createError({ kind: "ReadFailed", path, message });
  }

  writeFailed(path: string, message: string): ErrorResult<FileSystemError> {
    return this.createError({ kind: "WriteFailed", path, message });
  }

  invalidPath(path: string): ErrorResult<FileSystemError> {
    return this.createError({ kind: "InvalidPath", path });
  }

  permissionDenied(path: string): ErrorResult<FileSystemError> {
    return this.createError({ kind: "PermissionDenied", path });
  }
}

/**
 * System Error Builder - Smart constructors for system domain
 */
export class SystemErrorBuilder extends BaseErrorBuilder<SystemError> {
  initializationError(message: string): ErrorResult<SystemError> {
    return this.createError({ kind: "InitializationError", message });
  }

  configurationError(message: string): ErrorResult<SystemError> {
    return this.createError({ kind: "ConfigurationError", message });
  }

  memoryBoundsViolation(content: string): ErrorResult<SystemError> {
    return this.createError({ kind: "MemoryBoundsViolation", content });
  }
}

/**
 * Performance Error Builder - Smart constructors for performance domain
 */
export class PerformanceErrorBuilder
  extends BaseErrorBuilder<PerformanceError> {
  benchmarkError(content: string): ErrorResult<PerformanceError> {
    return this.createError({ kind: "BenchmarkError", content });
  }

  performanceViolation(content: string): ErrorResult<PerformanceError> {
    return this.createError({ kind: "PerformanceViolation", content });
  }

  memoryBoundsExceeded(content: string): ErrorResult<PerformanceError> {
    return this.createError({ kind: "MemoryBoundsExceeded", content });
  }

  circuitBreakerOpen(content: string): ErrorResult<PerformanceError> {
    return this.createError({ kind: "CircuitBreakerOpen", content });
  }
}

// Export singleton instance as default
export const ErrorHandler = UnifiedErrorHandler.getInstance();
