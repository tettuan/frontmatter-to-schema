/**
 * CLI argument value objects with Smart Constructor pattern
 * Eliminates type assertions and provides validation for CLI inputs
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";

/**
 * Validated configuration file path
 */
export class ConfigPath {
  private constructor(readonly value: string) {}

  static create(input: unknown): Result<ConfigPath, DomainError> {
    if (typeof input !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: String(input),
          parser: "ConfigPath",
          details: "Expected string value for config path",
        }),
      };
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "config",
        }),
      };
    }

    return { ok: true, data: new ConfigPath(trimmed) };
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Validated input file or directory path
 */
export class InputPath {
  private constructor(readonly value: string) {}

  static create(input: unknown): Result<InputPath, DomainError> {
    if (typeof input !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: String(input),
          parser: "InputPath",
          details: "Expected string value for input path",
        }),
      };
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "input",
        }),
      };
    }

    return { ok: true, data: new InputPath(trimmed) };
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Validated schema file path
 */
export class SchemaPath {
  private constructor(readonly value: string) {}

  static create(input: unknown): Result<SchemaPath, DomainError> {
    if (typeof input !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: String(input),
          parser: "SchemaPath",
          details: "Expected string value for schema path",
        }),
      };
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "schema",
        }),
      };
    }

    return { ok: true, data: new SchemaPath(trimmed) };
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Validated template file path
 */
export class TemplatePath {
  private constructor(readonly value: string) {}

  static create(input: unknown): Result<TemplatePath, DomainError> {
    if (typeof input !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: String(input),
          parser: "TemplatePath",
          details: "Expected string value for template path",
        }),
      };
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "template",
        }),
      };
    }

    return { ok: true, data: new TemplatePath(trimmed) };
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Validated output file path
 */
export class OutputPath {
  private constructor(readonly value: string) {}

  static create(input: unknown): Result<OutputPath, DomainError> {
    if (typeof input !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: String(input),
          parser: "OutputPath",
          details: "Expected string value for output path",
        }),
      };
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "output",
        }),
      };
    }

    return { ok: true, data: new OutputPath(trimmed) };
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Validated CLI arguments with all required paths
 */
export interface ValidatedCliArguments {
  configPath?: ConfigPath;
  inputPath?: InputPath;
  schemaPath?: SchemaPath;
  templatePath?: TemplatePath;
  outputPath?: OutputPath;
  help?: boolean;
  verbose?: boolean;
}

/**
 * CLI Arguments validator - converts raw parseArgs output to validated value objects
 */
export class CliArgumentsValidator {
  static validate(
    args: Record<string, unknown>,
  ): Result<ValidatedCliArguments, DomainError> {
    const validated: ValidatedCliArguments = {};

    // Validate config path if provided
    if (args.config !== undefined) {
      const configResult = ConfigPath.create(args.config);
      if (!configResult.ok) {
        return configResult;
      }
      validated.configPath = configResult.data;
    }

    // Validate input path if provided
    if (args.input !== undefined) {
      const inputResult = InputPath.create(args.input);
      if (!inputResult.ok) {
        return inputResult;
      }
      validated.inputPath = inputResult.data;
    }

    // Validate schema path if provided
    if (args.schema !== undefined) {
      const schemaResult = SchemaPath.create(args.schema);
      if (!schemaResult.ok) {
        return schemaResult;
      }
      validated.schemaPath = schemaResult.data;
    }

    // Validate template path if provided
    if (args.template !== undefined) {
      const templateResult = TemplatePath.create(args.template);
      if (!templateResult.ok) {
        return templateResult;
      }
      validated.templatePath = templateResult.data;
    }

    // Validate output path if provided
    if (args.output !== undefined) {
      const outputResult = OutputPath.create(args.output);
      if (!outputResult.ok) {
        return outputResult;
      }
      validated.outputPath = outputResult.data;
    }

    // Boolean flags are safe as-is
    validated.help = Boolean(args.help);
    validated.verbose = Boolean(args.verbose);

    return { ok: true, data: validated };
  }
}
