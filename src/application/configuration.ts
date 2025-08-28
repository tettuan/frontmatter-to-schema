import {
  createDomainError,
  type DomainError,
  type Result,
} from "../domain/core/result.ts";

export interface InputConfiguration {
  path: string;
  pattern?: string;
}

export interface SchemaConfiguration {
  definition: unknown;
  format: "json" | "yaml" | "custom";
}

export interface TemplateConfiguration {
  definition: string;
  format: "json" | "yaml" | "handlebars" | "custom";
}

export interface OutputConfiguration {
  path: string;
  format: "json" | "yaml" | "markdown";
}

export interface ProcessingConfiguration {
  extractionPrompt?: string;
  mappingPrompt?: string;
  parallel?: boolean;
  continueOnError?: boolean;
}

export interface ApplicationConfiguration {
  input: InputConfiguration;
  schema: SchemaConfiguration;
  template: TemplateConfiguration;
  output: OutputConfiguration;
  processing?: ProcessingConfiguration;
}

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

    // Validate input
    if (!obj.input || typeof obj.input !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: obj.input,
        }, "Missing or invalid 'input' configuration"),
      };
    }
    const input = obj.input as Record<string, unknown>;
    if (!input.path || typeof input.path !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: input.path,
        }, "Input path is required and must be a string"),
      };
    }

    // Validate schema
    if (!obj.schema || typeof obj.schema !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: obj.schema,
        }, "Missing or invalid 'schema' configuration"),
      };
    }
    const schema = obj.schema as Record<string, unknown>;
    if (!schema.definition) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: schema.definition,
        }, "Schema definition is required"),
      };
    }
    if (!schema.format || typeof schema.format !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: schema.format,
        }, "Schema format is required"),
      };
    }

    // Validate template
    if (!obj.template || typeof obj.template !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: obj.template,
        }, "Missing or invalid 'template' configuration"),
      };
    }
    const template = obj.template as Record<string, unknown>;
    if (!template.definition || typeof template.definition !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: template.definition,
        }, "Template definition is required and must be a string"),
      };
    }
    if (!template.format || typeof template.format !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: template.format,
        }, "Template format is required"),
      };
    }

    // Validate output
    if (!obj.output || typeof obj.output !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: obj.output,
        }, "Missing or invalid 'output' configuration"),
      };
    }
    const output = obj.output as Record<string, unknown>;
    if (!output.path || typeof output.path !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: output.path,
        }, "Output path is required and must be a string"),
      };
    }
    if (!output.format || typeof output.format !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: output.format,
        }, "Output format is required"),
      };
    }

    // Build validated configuration
    const validatedConfig: ApplicationConfiguration = {
      input: {
        path: input.path as string,
        pattern: input.pattern as string | undefined,
      },
      schema: {
        definition: schema.definition,
        format: schema.format as "json" | "yaml" | "custom",
      },
      template: {
        definition: template.definition as string,
        format: template.format as "json" | "yaml" | "handlebars" | "custom",
      },
      output: {
        path: output.path as string,
        format: output.format as "json" | "yaml" | "markdown",
      },
    };

    // Optional processing configuration
    if (obj.processing && typeof obj.processing === "object") {
      const processing = obj.processing as Record<string, unknown>;
      validatedConfig.processing = {
        extractionPrompt: processing.extractionPrompt as string | undefined,
        mappingPrompt: processing.mappingPrompt as string | undefined,
        parallel: processing.parallel as boolean | undefined,
        continueOnError: processing.continueOnError as boolean | undefined,
      };
    }

    return { ok: true, data: validatedConfig };
  }
}
