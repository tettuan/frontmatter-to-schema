import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { TemplatePath } from "../value-objects/template-path.ts";
import { VariableMapping } from "../value-objects/variable-mapping.ts";
import {
  TemplateFormatConfig,
  TemplateFormatType,
} from "../value-objects/template-format-config.ts";

export type OutputFormat = TemplateFormatType;

/**
 * Template configuration state using discriminated union pattern
 * Eliminates optional formatConfig in favor of explicit states
 */
export type TemplateConfigurationState =
  | {
    kind: "default";
    config: TemplateFormatConfig;
  }
  | {
    kind: "custom";
    config: TemplateFormatConfig;
  };

export class Template {
  private constructor(
    private readonly path: TemplatePath,
    private readonly content: unknown,
    private readonly format: OutputFormat,
    private readonly variables: VariableMapping,
    private readonly configurationState: TemplateConfigurationState,
  ) {}

  /**
   * Create template with default configuration
   */
  static createWithDefaultConfig(
    path: TemplatePath,
    content: unknown,
  ): Result<Template, TemplateError & { message: string }> {
    const configResult = TemplateFormatConfig.default();
    if (!configResult.ok) {
      return configResult;
    }

    const configState: TemplateConfigurationState = {
      kind: "default",
      config: configResult.data,
    };
    return Template.createInternal(path, content, configState);
  }

  /**
   * Create template with custom configuration
   */
  static createWithCustomConfig(
    path: TemplatePath,
    content: unknown,
    formatConfig: TemplateFormatConfig,
  ): Result<Template, TemplateError & { message: string }> {
    const configState: TemplateConfigurationState = {
      kind: "custom",
      config: formatConfig,
    };
    return Template.createInternal(path, content, configState);
  }

  /**
   * Internal template creation logic shared by all factory methods
   */
  private static createInternal(
    path: TemplatePath,
    content: unknown,
    configurationState: TemplateConfigurationState,
  ): Result<Template, TemplateError & { message: string }> {
    if (!content) {
      return ErrorHandler.template({
        operation: "createInternal",
        method: "validateContent",
      }).invalid("Template content is empty");
    }

    const format = determineFormat(content, path, configurationState.config);
    const variablesResult = VariableMapping.create(content);
    if (!variablesResult.ok) {
      return variablesResult;
    }

    return ok(
      new Template(
        path,
        content,
        format,
        variablesResult.data,
        configurationState,
      ),
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

  /**
   * Get the configuration state (replaces direct formatConfig access)
   */
  getConfigurationState(): TemplateConfigurationState {
    return this.configurationState;
  }

  /**
   * Get the format configuration from the current state
   */
  getFormatConfig(): TemplateFormatConfig {
    return this.configurationState.config;
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
      this.configurationState,
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
    const detectedFormatResult = config.detectFormatFromContent(content);
    if (detectedFormatResult.ok) {
      return detectedFormatResult.data;
    }
    // Continue to fallback if detection fails (following graceful degradation)
  }

  // Path-based detection as fallback
  if (config.isPathBasedDetectionEnabled()) {
    const pathFormat = path.getFormat();
    if (pathFormat === "yaml") return "yaml";
  }

  // Use configured default instead of hardcoded "json"
  return config.getDefaultFormat();
}
