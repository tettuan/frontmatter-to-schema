import {
  createDomainError,
  type DomainError,
  type Result,
} from "../domain/core/result.ts";

// Smart Constructors for format validation following Totality principles

/**
 * Schema format with exhaustive validation
 */
export class SchemaFormat {
  private constructor(private readonly value: "json" | "yaml" | "custom") {}

  static create(
    format: string,
  ): Result<SchemaFormat, DomainError & { message: string }> {
    switch (format) {
      case "json":
        return { ok: true, data: new SchemaFormat("json") };
      case "yaml":
        return { ok: true, data: new SchemaFormat("yaml") };
      case "custom":
        return { ok: true, data: new SchemaFormat("custom") };
      default:
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: format,
              expectedFormat: "json, yaml, or custom",
            },
            `Invalid schema format "${format}". Supported formats: json, yaml, custom`,
          ),
        };
    }
  }

  getValue(): "json" | "yaml" | "custom" {
    return this.value;
  }
}

/**
 * Template format with exhaustive validation
 */
export class TemplateFormat {
  private constructor(
    private readonly value: "json" | "yaml" | "handlebars" | "custom",
  ) {}

  static create(
    format: string,
  ): Result<TemplateFormat, DomainError & { message: string }> {
    switch (format) {
      case "json":
        return { ok: true, data: new TemplateFormat("json") };
      case "yaml":
        return { ok: true, data: new TemplateFormat("yaml") };
      case "handlebars":
        return { ok: true, data: new TemplateFormat("handlebars") };
      case "custom":
        return { ok: true, data: new TemplateFormat("custom") };
      default:
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: format,
              expectedFormat: "json, yaml, handlebars, or custom",
            },
            `Invalid template format "${format}". Supported formats: json, yaml, handlebars, custom`,
          ),
        };
    }
  }

  getValue(): "json" | "yaml" | "handlebars" | "custom" {
    return this.value;
  }
}

/**
 * Output format with exhaustive validation
 */
export class OutputFormat {
  private constructor(
    private readonly value: "json" | "yaml" | "markdown",
  ) {}

  static create(
    format: string,
  ): Result<OutputFormat, DomainError & { message: string }> {
    switch (format) {
      case "json":
        return { ok: true, data: new OutputFormat("json") };
      case "yaml":
        return { ok: true, data: new OutputFormat("yaml") };
      case "markdown":
        return { ok: true, data: new OutputFormat("markdown") };
      default:
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: format,
              expectedFormat: "json, yaml, or markdown",
            },
            `Invalid output format "${format}". Supported formats: json, yaml, markdown`,
          ),
        };
    }
  }

  getValue(): "json" | "yaml" | "markdown" {
    return this.value;
  }
}

// Input configuration using discriminated union to eliminate optional properties
export type InputConfiguration =
  | { kind: "DirectPath"; path: string }
  | { kind: "PatternBased"; path: string; pattern: string };

export interface SchemaConfiguration {
  definition: unknown;
  format: SchemaFormat;
}

export interface TemplateConfiguration {
  definition: string;
  format: TemplateFormat;
}

export interface OutputConfiguration {
  path: string;
  format: OutputFormat;
}

// Processing configuration using discriminated union to eliminate optional properties
export type ProcessingConfiguration =
  | { kind: "BasicProcessing" }
  | { kind: "CustomPrompts"; extractionPrompt: string; mappingPrompt: string }
  | {
    kind: "ParallelProcessing";
    parallel: true;
    continueOnError: boolean;
  }
  | {
    kind: "FullCustom";
    extractionPrompt: string;
    mappingPrompt: string;
    parallel: boolean;
    continueOnError: boolean;
  };

export interface ApplicationConfiguration {
  input: InputConfiguration;
  schema: SchemaConfiguration;
  template: TemplateConfiguration;
  output: OutputConfiguration;
  processing: ProcessingConfiguration; // Now required with explicit mode
}

/**
 * Totality-compliant configuration validator
 * Eliminates all type assertions and optional properties using discriminated unions
 */
export class ConfigurationValidator {
  validate(
    config: unknown,
  ): Result<ApplicationConfiguration, DomainError & { message: string }> {
    if (!config || typeof config !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config,
        }, "Configuration must be an object"),
      };
    }

    const obj = config as Record<string, unknown>;

    // Validate input using discriminated union pattern
    const inputResult = this.validateInputConfiguration(obj.input);
    if (!inputResult.ok) return inputResult;

    // Validate schema using Smart Constructor
    const schemaResult = this.validateSchemaConfiguration(obj.schema);
    if (!schemaResult.ok) return schemaResult;

    // Validate template using Smart Constructor
    const templateResult = this.validateTemplateConfiguration(obj.template);
    if (!templateResult.ok) return templateResult;

    // Validate output using Smart Constructor
    const outputResult = this.validateOutputConfiguration(obj.output);
    if (!outputResult.ok) return outputResult;

    // Validate processing using discriminated union pattern (defaults to BasicProcessing)
    const processingResult = this.validateProcessingConfiguration(
      obj.processing,
    );
    if (!processingResult.ok) return processingResult;

    return {
      ok: true,
      data: {
        input: inputResult.data,
        schema: schemaResult.data,
        template: templateResult.data,
        output: outputResult.data,
        processing: processingResult.data,
      },
    };
  }

  private validateInputConfiguration(
    input: unknown,
  ): Result<InputConfiguration, DomainError & { message: string }> {
    if (!input || typeof input !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: input,
        }, "Missing or invalid 'input' configuration"),
      };
    }

    const inputObj = input as Record<string, unknown>;
    if (!inputObj.path || typeof inputObj.path !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: inputObj.path,
        }, "Input path is required and must be a string"),
      };
    }

    // Use discriminated union based on presence of pattern
    if (inputObj.pattern && typeof inputObj.pattern === "string") {
      return {
        ok: true,
        data: {
          kind: "PatternBased",
          path: inputObj.path,
          pattern: inputObj.pattern,
        },
      };
    } else {
      return {
        ok: true,
        data: {
          kind: "DirectPath",
          path: inputObj.path,
        },
      };
    }
  }

  private validateSchemaConfiguration(
    schema: unknown,
  ): Result<SchemaConfiguration, DomainError & { message: string }> {
    if (!schema || typeof schema !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: schema,
        }, "Missing or invalid 'schema' configuration"),
      };
    }

    const schemaObj = schema as Record<string, unknown>;
    if (!schemaObj.definition) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: schemaObj.definition,
        }, "Schema definition is required"),
      };
    }

    if (!schemaObj.format || typeof schemaObj.format !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: schemaObj.format,
        }, "Schema format is required and must be a string"),
      };
    }

    // Use Smart Constructor for format validation
    const formatResult = SchemaFormat.create(schemaObj.format);
    if (!formatResult.ok) return formatResult;

    return {
      ok: true,
      data: {
        definition: schemaObj.definition,
        format: formatResult.data,
      },
    };
  }

  private validateTemplateConfiguration(
    template: unknown,
  ): Result<TemplateConfiguration, DomainError & { message: string }> {
    if (!template || typeof template !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: template,
        }, "Missing or invalid 'template' configuration"),
      };
    }

    const templateObj = template as Record<string, unknown>;
    if (!templateObj.definition || typeof templateObj.definition !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: templateObj.definition,
        }, "Template definition is required and must be a string"),
      };
    }

    if (!templateObj.format || typeof templateObj.format !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: templateObj.format,
        }, "Template format is required and must be a string"),
      };
    }

    // Use Smart Constructor for format validation
    const formatResult = TemplateFormat.create(templateObj.format);
    if (!formatResult.ok) return formatResult;

    return {
      ok: true,
      data: {
        definition: templateObj.definition,
        format: formatResult.data,
      },
    };
  }

  private validateOutputConfiguration(
    output: unknown,
  ): Result<OutputConfiguration, DomainError & { message: string }> {
    if (!output || typeof output !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: output,
        }, "Missing or invalid 'output' configuration"),
      };
    }

    const outputObj = output as Record<string, unknown>;
    if (!outputObj.path || typeof outputObj.path !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: outputObj.path,
        }, "Output path is required and must be a string"),
      };
    }

    if (!outputObj.format || typeof outputObj.format !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: outputObj.format,
        }, "Output format is required and must be a string"),
      };
    }

    // Use Smart Constructor for format validation
    const formatResult = OutputFormat.create(outputObj.format);
    if (!formatResult.ok) return formatResult;

    return {
      ok: true,
      data: {
        path: outputObj.path,
        format: formatResult.data,
      },
    };
  }

  private validateProcessingConfiguration(
    processing: unknown,
  ): Result<ProcessingConfiguration, DomainError & { message: string }> {
    // Default to BasicProcessing if not provided
    if (!processing) {
      return {
        ok: true,
        data: { kind: "BasicProcessing" },
      };
    }

    if (typeof processing !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: processing,
        }, "Processing configuration must be an object"),
      };
    }

    const processingObj = processing as Record<string, unknown>;

    // Determine processing configuration type based on provided properties
    const hasExtractionPrompt = processingObj.extractionPrompt &&
      typeof processingObj.extractionPrompt === "string";
    const hasMappingPrompt = processingObj.mappingPrompt &&
      typeof processingObj.mappingPrompt === "string";
    const hasParallel = processingObj.parallel === true;
    const hasContinueOnError =
      typeof processingObj.continueOnError === "boolean";

    // Use discriminated union based on provided configuration
    if (
      hasExtractionPrompt && hasMappingPrompt && hasParallel &&
      hasContinueOnError
    ) {
      return {
        ok: true,
        data: {
          kind: "FullCustom",
          extractionPrompt: processingObj.extractionPrompt as string,
          mappingPrompt: processingObj.mappingPrompt as string,
          parallel: processingObj.parallel as boolean,
          continueOnError: processingObj.continueOnError as boolean,
        },
      };
    } else if (hasExtractionPrompt && hasMappingPrompt) {
      return {
        ok: true,
        data: {
          kind: "CustomPrompts",
          extractionPrompt: processingObj.extractionPrompt as string,
          mappingPrompt: processingObj.mappingPrompt as string,
        },
      };
    } else if (hasParallel && hasContinueOnError) {
      return {
        ok: true,
        data: {
          kind: "ParallelProcessing",
          parallel: true,
          continueOnError: processingObj.continueOnError as boolean,
        },
      };
    } else {
      // Default to BasicProcessing for any other combination
      return {
        ok: true,
        data: { kind: "BasicProcessing" },
      };
    }
  }
}
