/**
 * Custom error classes for JSON template processing
 */

export class JsonTemplateError extends Error {
  readonly code: string;
  readonly templatePath?: string;
  readonly variablePath?: string;
  readonly originalError?: Error;

  constructor(
    message: string,
    code: string,
    templatePath?: string,
    variablePath?: string,
    originalError?: Error,
  ) {
    super(message);
    this.name = "JsonTemplateError";
    this.code = code;
    this.templatePath = templatePath;
    this.variablePath = variablePath;
    this.originalError = originalError;
  }
}

export class TemplateNotFoundError extends JsonTemplateError {
  constructor(templatePath: string) {
    super(
      `Template file not found: ${templatePath}`,
      "TEMPLATE_NOT_FOUND",
      templatePath,
    );
    this.name = "TemplateNotFoundError";
  }
}

export class VariableNotFoundError extends JsonTemplateError {
  constructor(variablePath: string, templatePath?: string) {
    super(
      `Variable not found: ${variablePath}`,
      "VARIABLE_NOT_FOUND",
      templatePath,
      variablePath,
    );
    this.name = "VariableNotFoundError";
  }
}

export class InvalidJsonError extends JsonTemplateError {
  constructor(templatePath: string, originalError: Error) {
    super(
      `Invalid JSON after template processing: ${originalError.message}`,
      "INVALID_JSON",
      templatePath,
      undefined,
      originalError,
    );
    this.name = "InvalidJsonError";
  }
}

export class TemplateReadError extends JsonTemplateError {
  constructor(templatePath: string, originalError: Error) {
    super(
      `Failed to read template file: ${originalError.message}`,
      "TEMPLATE_READ_ERROR",
      templatePath,
      undefined,
      originalError,
    );
    this.name = "TemplateReadError";
  }
}
