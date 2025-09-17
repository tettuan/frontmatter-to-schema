import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { TemplatePath } from "../value-objects/template-path.ts";
import { VariableMapping } from "../value-objects/variable-mapping.ts";
import {
  TemplateFormatConfig,
  TemplateFormatType,
} from "../value-objects/template-format-config.ts";

export type OutputFormat = TemplateFormatType;

export class Template {
  private constructor(
    private readonly path: TemplatePath,
    private readonly content: unknown,
    private readonly format: OutputFormat,
    private readonly variables: VariableMapping,
    private readonly formatConfig: TemplateFormatConfig = TemplateFormatConfig
      .default(),
  ) {}

  static create(
    path: TemplatePath,
    content: unknown,
    formatConfig?: TemplateFormatConfig,
  ): Result<Template, TemplateError & { message: string }> {
    if (!content) {
      return err(createError({
        kind: "InvalidTemplate",
        message: "Template content is empty",
      }));
    }

    const config = formatConfig || TemplateFormatConfig.default();
    const format = determineFormat(content, path, config);
    const variablesResult = VariableMapping.create(content);
    if (!variablesResult.ok) {
      return variablesResult;
    }

    return ok(
      new Template(path, content, format, variablesResult.data, config),
    );
  }

  getPath(): TemplatePath {
    return this.path;
  }

  getContent(): unknown {
    return this.content;
  }

  getFormat(): OutputFormat {
    return this.format;
  }

  getVariables(): VariableMapping {
    return this.variables;
  }

  hasArrayVariables(): boolean {
    return this.variables.getArrayVariables().length > 0;
  }

  hasDynamicVariables(): boolean {
    return this.variables.getDynamicVariables().length > 0;
  }

  withFormat(format: OutputFormat): Template {
    return new Template(
      this.path,
      this.content,
      format,
      this.variables,
      this.formatConfig,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function determineFormat(
  content: unknown,
  path: TemplatePath,
  config: TemplateFormatConfig,
): OutputFormat {
  // Content-based detection using domain configuration
  if (isRecord(content)) {
    const detectedFormat = config.detectFormatFromContent(content);
    if (detectedFormat) {
      return detectedFormat;
    }
  }

  // Path-based detection as fallback
  if (config.isPathBasedDetectionEnabled()) {
    const pathFormat = path.getFormat();
    if (pathFormat === "yaml") return "yaml";
  }

  // Use configured default instead of hardcoded "json"
  return config.getDefaultFormat();
}
