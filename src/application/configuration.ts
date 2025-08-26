import type { Result } from "../domain/core/result.ts";
import {
  type ConfigurationError,
  createConfigurationError,
} from "../domain/shared/errors.ts";

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
  ): Result<ApplicationConfiguration, ConfigurationError> {
    if (!config || typeof config !== "object") {
      return {
        ok: false,
        error: createConfigurationError("Configuration must be an object"),
      };
    }

    const obj = config as Record<string, unknown>;

    // Validate input
    if (!obj.input || typeof obj.input !== "object") {
      return {
        ok: false,
        error: createConfigurationError(
          "Missing or invalid 'input' configuration",
        ),
      };
    }
    const input = obj.input as Record<string, unknown>;
    if (!input.path || typeof input.path !== "string") {
      return {
        ok: false,
        error: createConfigurationError(
          "Input path is required and must be a string",
          "input.path",
        ),
      };
    }

    // Validate schema
    if (!obj.schema || typeof obj.schema !== "object") {
      return {
        ok: false,
        error: createConfigurationError(
          "Missing or invalid 'schema' configuration",
        ),
      };
    }
    const schema = obj.schema as Record<string, unknown>;
    if (!schema.definition) {
      return {
        ok: false,
        error: createConfigurationError(
          "Schema definition is required",
          "schema.definition",
        ),
      };
    }
    if (!schema.format || typeof schema.format !== "string") {
      return {
        ok: false,
        error: createConfigurationError(
          "Schema format is required",
          "schema.format",
        ),
      };
    }

    // Validate template
    if (!obj.template || typeof obj.template !== "object") {
      return {
        ok: false,
        error: createConfigurationError(
          "Missing or invalid 'template' configuration",
        ),
      };
    }
    const template = obj.template as Record<string, unknown>;
    if (!template.definition || typeof template.definition !== "string") {
      return {
        ok: false,
        error: createConfigurationError(
          "Template definition is required and must be a string",
          "template.definition",
        ),
      };
    }
    if (!template.format || typeof template.format !== "string") {
      return {
        ok: false,
        error: createConfigurationError(
          "Template format is required",
          "template.format",
        ),
      };
    }

    // Validate output
    if (!obj.output || typeof obj.output !== "object") {
      return {
        ok: false,
        error: createConfigurationError(
          "Missing or invalid 'output' configuration",
        ),
      };
    }
    const output = obj.output as Record<string, unknown>;
    if (!output.path || typeof output.path !== "string") {
      return {
        ok: false,
        error: createConfigurationError(
          "Output path is required and must be a string",
          "output.path",
        ),
      };
    }
    if (!output.format || typeof output.format !== "string") {
      return {
        ok: false,
        error: createConfigurationError(
          "Output format is required",
          "output.format",
        ),
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
