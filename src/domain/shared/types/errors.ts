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
  }
  | { readonly kind: "FieldNotFound"; readonly path: string }
  | { readonly kind: "ValidationRuleNotFound"; readonly path: string };

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
  | { readonly kind: "FrontmatterPartNotFound" }
  | { readonly kind: "SchemaNotResolved" }
  | { readonly kind: "TypeNotDefined" }
  | { readonly kind: "PropertiesNotDefined" }
  | { readonly kind: "RefNotDefined" }
  | { readonly kind: "DerivedFromNotDefined" }
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
    case "FieldNotFound":
      return `Field not found: ${error.path}`;
    case "ValidationRuleNotFound":
      return `Validation rule not found for path: ${error.path}`;
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
      return "Schema does not define x-derived-from";
    case "ItemsNotDefined":
      return "Schema does not define items";
    case "PropertyNotFound":
      return `Property not found at path: ${error.path}`;
    case "TemplateItemsNotDefined":
      return "Schema does not define x-template-items directive";
    case "TemplateFormatNotDefined":
      return "Schema does not define x-template-format directive";
    case "InvalidTemplateFormat":
      return "Invalid template format specified";
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
