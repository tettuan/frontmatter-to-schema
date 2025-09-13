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
  | { readonly kind: "ParseError"; readonly input: string }
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
  | {
    readonly kind: "InvalidFormat";
    readonly format: string;
    readonly value: string;
  };

export type SchemaError =
  | { readonly kind: "SchemaNotFound"; readonly path: string }
  | { readonly kind: "InvalidSchema"; readonly message: string }
  | {
    readonly kind: "RefResolutionFailed";
    readonly ref: string;
    readonly message: string;
  }
  | { readonly kind: "CircularReference"; readonly refs: string[] }
  | { readonly kind: "InvalidTemplate"; readonly template: string };

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
  | { readonly kind: "InvalidFormat"; readonly format: string };

export type AggregationError =
  | { readonly kind: "InvalidExpression"; readonly expression: string }
  | { readonly kind: "PathNotFound"; readonly path: string }
  | { readonly kind: "AggregationFailed"; readonly message: string };

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

export type DomainError =
  | ValidationError
  | SchemaError
  | FrontmatterError
  | TemplateError
  | AggregationError
  | FileSystemError;

export interface ErrorWithMessage {
  readonly message: string;
}

export const createError = <T extends DomainError>(
  error: T,
  customMessage?: string,
): T & ErrorWithMessage => ({
  ...error,
  message: customMessage || getDefaultMessage(error),
});

const getDefaultMessage = (error: DomainError): string => {
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
    case "InvalidFormat":
      return `Invalid ${error.format} format: ${
        "value" in error ? error.value : ""
      }`;
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
    case "InvalidExpression":
      return `Invalid expression: ${error.expression}`;
    case "PathNotFound":
      return `Path not found in data: ${error.path}`;
    case "AggregationFailed":
      return `Aggregation failed: ${error.message}`;
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
    default: {
      const _exhaustive: never = error;
      return `Unknown error: ${JSON.stringify(_exhaustive)}`;
    }
  }
};
