import { defaultSchemaExtensionRegistry } from "../../schema/value-objects/schema-extension-registry.ts";

export type ValidationError =
  | {
    readonly kind: "OutOfRange";
    readonly value: unknown;
    readonly min?: number;
    readonly max?: number;
  }
  | { readonly kind: "InvalidRegex"; readonly pattern: string }
  | {
    readonly kind: "PatternMismatch";
    readonly value: string;
    readonly pattern: string;
  }
  | {
    readonly kind: "ParseError";
    readonly input: string;
    readonly field?: string;
  }
  | { readonly kind: "EmptyInput" }
  | {
    readonly kind: "TooLong";
    readonly value: string;
    readonly maxLength: number;
  }
  | {
    readonly kind: "InvalidType";
    readonly expected: string;
    readonly actual: string;
  }
  | { readonly kind: "MissingRequired"; readonly field: string }
  | { readonly kind: "TooManyArguments"; readonly field: string }
  | {
    readonly kind: "InvalidFormat";
    readonly format: string;
    readonly value?: string;
    readonly field?: string;
  }
  | { readonly kind: "FieldNotFound"; readonly path: string }
  | { readonly kind: "ValidationRuleNotFound"; readonly path: string }
  | { readonly kind: "DuplicateValue"; readonly field: string }
  | {
    readonly kind: "ConfigNotFound";
    readonly path: string;
    readonly field?: string;
  }
  | { readonly kind: "ConfigReadError"; readonly field: string }
  | { readonly kind: "InvalidStructure"; readonly field: string }
  | { readonly kind: "UnknownError"; readonly field: string };

export type SchemaError =
  | { readonly kind: "SchemaNotFound"; readonly path: string }
  | { readonly kind: "InvalidSchema"; readonly message: string }
  | {
    readonly kind: "RefResolutionFailed";
    readonly ref: string;
    readonly message: string;
  }
  | { readonly kind: "CircularReference"; readonly refs: string[] }
  | { readonly kind: "InvalidTemplate"; readonly template: string }
  | { readonly kind: "TemplateNotDefined" }
  | { readonly kind: "TemplateItemsNotDefined" }
  | { readonly kind: "TemplateFormatNotDefined" }
  | { readonly kind: "InvalidTemplateFormat" }
  | { readonly kind: "JMESPathFilterNotDefined" }
  | {
    readonly kind: "JMESPathCompilationFailed";
    readonly expression: string;
    readonly message: string;
  }
  | {
    readonly kind: "JMESPathExecutionFailed";
    readonly expression: string;
    readonly message: string;
  }
  | {
    readonly kind: "InvalidJMESPathResult";
    readonly expression: string;
    readonly result: unknown;
  }
  | { readonly kind: "FrontmatterPartNotFound" }
  | { readonly kind: "SchemaNotResolved" }
  | { readonly kind: "TypeNotDefined" }
  | { readonly kind: "PropertiesNotDefined" }
  | { readonly kind: "RefNotDefined" }
  | { readonly kind: "DerivedFromNotDefined" }
  | { readonly kind: "ExtractFromNotDefined" }
  | { readonly kind: "ItemsNotDefined" }
  | { readonly kind: "EnumNotDefined" }
  | { readonly kind: "PropertyNotFound"; readonly path: string };

export type FrontmatterError =
  | { readonly kind: "ExtractionFailed"; readonly message: string }
  | { readonly kind: "InvalidYaml"; readonly message: string }
  | { readonly kind: "NoFrontmatter" }
  | { readonly kind: "MalformedFrontmatter"; readonly content: string };

export type TemplateError =
  | { readonly kind: "TemplateNotFound"; readonly path: string }
  | { readonly kind: "InvalidTemplate"; readonly message: string }
  | { readonly kind: "VariableNotFound"; readonly variable: string }
  | { readonly kind: "RenderFailed"; readonly message: string }
  | { readonly kind: "InvalidFormat"; readonly format: string }
  | {
    readonly kind: "TemplateStructureInvalid";
    readonly template: string;
    readonly issue: string;
  }
  | {
    readonly kind: "VariableResolutionFailed";
    readonly variable: string;
    readonly reason: string;
  }
  | { readonly kind: "DataCompositionFailed"; readonly reason: string };

export type AggregationError =
  | { readonly kind: "InvalidExpression"; readonly expression: string }
  | { readonly kind: "PathNotFound"; readonly path: string }
  | { readonly kind: "AggregationFailed"; readonly message: string }
  | { readonly kind: "MergeFailed"; readonly message: string };

export type FileSystemError =
  | { readonly kind: "FileNotFound"; readonly path: string }
  | {
    readonly kind: "ReadFailed";
    readonly path: string;
    readonly message: string;
  }
  | {
    readonly kind: "WriteFailed";
    readonly path: string;
    readonly message: string;
  }
  | { readonly kind: "InvalidPath"; readonly path: string }
  | { readonly kind: "PermissionDenied"; readonly path: string };

export type SystemError =
  | { readonly kind: "InitializationError"; readonly message: string }
  | { readonly kind: "ConfigurationError"; readonly message: string };

export type PerformanceError =
  | { readonly kind: "BenchmarkError"; readonly content: string }
  | { readonly kind: "PerformanceViolation"; readonly content: string }
  | { readonly kind: "MemoryMonitorError"; readonly content: string }
  | { readonly kind: "InvalidMemoryComparison"; readonly content: string }
  | { readonly kind: "MemoryBoundsViolation"; readonly content: string }
  | { readonly kind: "InsufficientData"; readonly content: string }
  | { readonly kind: "TestScenarioError"; readonly content: string }
  | { readonly kind: "PipelineExecutionError"; readonly content: string }
  | { readonly kind: "DirectoryCreationError"; readonly content: string }
  | { readonly kind: "FileWriteError"; readonly content: string }
  | { readonly kind: "SchemaWriteError"; readonly content: string }
  | { readonly kind: "TemplateWriteError"; readonly content: string }
  | { readonly kind: "CleanupError"; readonly content: string }
  | { readonly kind: "CircuitBreakerError"; readonly content: string }
  | { readonly kind: "ComplexityThresholdExceeded"; readonly content: string }
  | { readonly kind: "CircuitBreakerOpen"; readonly content: string }
  | { readonly kind: "StreamingTimeout"; readonly content: string }
  | { readonly kind: "StreamingError"; readonly content: string }
  | { readonly kind: "MemoryBoundsExceeded"; readonly content: string };

export type DomainError =
  | ValidationError
  | SchemaError
  | FrontmatterError
  | TemplateError
  | AggregationError
  | FileSystemError
  | SystemError
  | PerformanceError;

export interface ErrorWithMessage {
  readonly message: string;
}

export interface ErrorWithContext {
  readonly message: string;
  readonly context: import("./error-context.ts").ErrorContext;
}

export const createError = <T extends DomainError>(
  error: T,
  customMessage?: string,
): T & ErrorWithMessage => ({
  ...error,
  message: customMessage || getDefaultMessage(error),
});

export const createContextualError = <T extends DomainError>(
  error: T,
  context: import("./error-context.ts").ErrorContext,
  customMessage?: string,
): T & ErrorWithContext => ({
  ...error,
  message: customMessage || getDefaultMessage(error),
  context,
});

// Enhanced error creation with automatic context inclusion
export const createEnhancedError = <T extends DomainError>(
  error: T,
  context: import("./error-context.ts").ErrorContext,
  customMessage?: string,
): T & ErrorWithContext => {
  const baseMessage = customMessage || getDefaultMessage(error);
  const contextInfo = context.toString();
  const enhancedMessage = `${baseMessage} | Context: ${contextInfo}`;

  return {
    ...error,
    message: enhancedMessage,
    context,
  };
};

const getDefaultMessage = (error: DomainError): string => {
  // 全域性デバッグ: error.kind別の完全性確認
  const _errorKindDebugInfo = {
    errorKind: error.kind,
    totalErrorTypes: 58, // DomainErrorの全型数
    exhaustivenessCheck: "required",
    partialFunctionRisk: "eliminated",
  };

  switch (error.kind) {
    case "OutOfRange":
      return `Value ${error.value} is out of range ${error.min ?? "?"}-${
        error.max ?? "?"
      }`;
    case "InvalidRegex":
      return `Invalid regex pattern: ${error.pattern}`;
    case "PatternMismatch":
      return `Value "${error.value}" does not match pattern ${error.pattern}`;
    case "ParseError":
      return `Cannot parse "${error.input}"`;
    case "EmptyInput":
      return "Input cannot be empty";
    case "TooLong":
      return `Value "${error.value}" exceeds maximum length of ${error.maxLength}`;
    case "InvalidType":
      return `Expected type ${error.expected}, got ${error.actual}`;
    case "MissingRequired":
      return `Required field "${error.field}" is missing`;
    case "TooManyArguments":
      return `Too many arguments provided for ${error.field}`;
    case "InvalidFormat":
      return `Invalid ${error.format} format: ${
        "value" in error ? error.value : ""
      }`;
    case "FieldNotFound":
      return `Field not found: ${error.path}`;
    case "ValidationRuleNotFound":
      return `Validation rule not found for path: ${error.path}`;
    case "DuplicateValue":
      return `Duplicate value found in field: ${error.field}`;
    case "ConfigNotFound":
      return `Configuration not found: ${error.path}`;
    case "ConfigReadError":
      return `Configuration read error in field: ${error.field}`;
    case "InvalidStructure":
      return `Invalid structure in field: ${error.field}`;
    case "UnknownError":
      return `Unknown error in field: ${error.field}`;
    case "SchemaNotFound":
      return `Schema not found: ${error.path}`;
    case "InvalidSchema":
      return `Invalid schema: ${error.message}`;
    case "RefResolutionFailed":
      return `Failed to resolve $ref "${error.ref}": ${error.message}`;
    case "CircularReference":
      return `Circular reference detected: ${error.refs.join(" -> ")}`;
    case "InvalidTemplate":
      return `Invalid template: ${
        "template" in error ? error.template : error.message
      }`;
    case "TemplateNotDefined":
      return "Schema does not define a template path";
    case "FrontmatterPartNotFound":
      return "No frontmatter-part directive found in schema";
    case "SchemaNotResolved":
      return "Schema references have not been resolved";
    case "TypeNotDefined":
      return "Schema does not define a type";
    case "PropertiesNotDefined":
      return "Schema does not define properties";
    case "RefNotDefined":
      return "Schema does not define a $ref";
    case "DerivedFromNotDefined":
      return `Schema does not define ${defaultSchemaExtensionRegistry.getDerivedFromKey().getValue()}`;
    case "ExtractFromNotDefined":
      return `Schema does not define ${defaultSchemaExtensionRegistry.getExtractFromKey().getValue()}`;
    case "ItemsNotDefined":
      return "Schema does not define items";
    case "PropertyNotFound":
      return `Property not found at path: ${error.path}`;
    case "TemplateItemsNotDefined":
      return `Schema does not define ${defaultSchemaExtensionRegistry.getTemplateItemsKey().getValue()} directive`;
    case "TemplateFormatNotDefined":
      return "Schema does not define x-template-format directive";
    case "InvalidTemplateFormat":
      return "Invalid template format specified";
    case "JMESPathFilterNotDefined":
      return `Schema does not define ${defaultSchemaExtensionRegistry.getJmespathFilterKey().getValue()} directive`;
    case "JMESPathCompilationFailed":
      return `JMESPath expression compilation failed: ${error.expression} - ${error.message}`;
    case "JMESPathExecutionFailed":
      return `JMESPath expression execution failed: ${error.expression} - ${error.message}`;
    case "InvalidJMESPathResult":
      return `Invalid JMESPath result for expression: ${error.expression}`;
    case "EnumNotDefined":
      return "Schema is not an enum type";
    case "ExtractionFailed":
      return `Frontmatter extraction failed: ${error.message}`;
    case "InvalidYaml":
      return `Invalid YAML: ${error.message}`;
    case "NoFrontmatter":
      return "No frontmatter found in document";
    case "MalformedFrontmatter":
      return `Malformed frontmatter: ${error.content}`;
    case "TemplateNotFound":
      return `Template not found: ${error.path}`;
    case "VariableNotFound":
      return `Variable not found: ${error.variable}`;
    case "RenderFailed":
      return `Template render failed: ${error.message}`;
    case "TemplateStructureInvalid":
      return `Invalid template structure in ${error.template}: ${error.issue}`;
    case "VariableResolutionFailed":
      return `Failed to resolve variable ${error.variable}: ${error.reason}`;
    case "DataCompositionFailed":
      return `Data composition failed: ${error.reason}`;
    case "InvalidExpression":
      return `Invalid expression: ${error.expression}`;
    case "PathNotFound":
      return `Path not found in data: ${error.path}`;
    case "AggregationFailed":
      return `Aggregation failed: ${error.message}`;
    case "MergeFailed":
      return `Merge failed: ${error.message}`;
    case "FileNotFound":
      return `File not found: ${error.path}`;
    case "ReadFailed":
      return `Failed to read file ${error.path}: ${error.message}`;
    case "WriteFailed":
      return `Failed to write file ${error.path}: ${error.message}`;
    case "InvalidPath":
      return `Invalid path: ${error.path}`;
    case "PermissionDenied":
      return `Permission denied: ${error.path}`;
    case "InitializationError":
      return `Initialization error: ${error.message}`;
    case "ConfigurationError":
      return `Configuration error: ${error.message}`;
    case "BenchmarkError":
      return `Benchmark error: ${error.content}`;
    case "PerformanceViolation":
      return `Performance violation: ${error.content}`;
    case "MemoryMonitorError":
      return `Memory monitor error: ${error.content}`;
    case "InvalidMemoryComparison":
      return `Invalid memory comparison: ${error.content}`;
    case "MemoryBoundsViolation":
      return `Memory bounds violation: ${error.content}`;
    case "InsufficientData":
      return `Insufficient data: ${error.content}`;
    case "TestScenarioError":
      return `Test scenario error: ${error.content}`;
    case "PipelineExecutionError":
      return `Pipeline execution error: ${error.content}`;
    case "DirectoryCreationError":
      return `Directory creation error: ${error.content}`;
    case "FileWriteError":
      return `File write error: ${error.content}`;
    case "SchemaWriteError":
      return `Schema write error: ${error.content}`;
    case "TemplateWriteError":
      return `Template write error: ${error.content}`;
    case "CleanupError":
      return `Cleanup error: ${error.content}`;
    case "CircuitBreakerError":
      return `Circuit breaker error: ${error.content}`;
    case "ComplexityThresholdExceeded":
      return `Complexity threshold exceeded: ${error.content}`;
    case "CircuitBreakerOpen":
      return `Circuit breaker open: ${error.content}`;
    case "StreamingTimeout":
      return `Streaming timeout: ${error.content}`;
    case "StreamingError":
      return `Streaming error: ${error.content}`;
    case "MemoryBoundsExceeded":
      return `Memory bounds exceeded: ${error.content}`;
    default: {
      // 全域性保証: 到達不可能な分岐 - TypeScriptコンパイル時エラーで保証
      const _exhaustive: never = error;
      // デバッグ情報: この分岐に到達した場合は型安全性の破綻を意味する
      console.error(
        "[TOTALITY-VIOLATION] Unreachable error type detected:",
        error,
      );
      return `Unknown error: ${JSON.stringify(_exhaustive)}`;
    }
  }
};
