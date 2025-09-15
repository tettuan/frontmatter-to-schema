import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { TemplatePath } from "../value-objects/template-path.ts";
import { VariableMapping } from "../value-objects/variable-mapping.ts";

export type OutputFormat = "json" | "yaml" | "markdown";

export class Template {
  private constructor(
    private readonly path: TemplatePath,
    private readonly content: unknown,
    private readonly format: OutputFormat,
    private readonly variables: VariableMapping,
  ) {}

  static create(
    path: TemplatePath,
    content: unknown,
  ): Result<Template, TemplateError & { message: string }> {
    if (!content) {
      return err(createError({
        kind: "InvalidTemplate",
        message: "Template content is empty",
      }));
    }

    const format = determineFormat(content, path);
    const variablesResult = VariableMapping.create(content);
    if (!variablesResult.ok) {
      return variablesResult;
    }

    return ok(new Template(path, content, format, variablesResult.data));
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
    return new Template(this.path, this.content, format, this.variables);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function determineFormat(content: unknown, path: TemplatePath): OutputFormat {
  if (isRecord(content)) {
    if (content.format_type === "yaml") return "yaml";
    if (content.format_type === "markdown") return "markdown";
    if (content.format_type === "json") return "json";
  }

  const pathFormat = path.getFormat();
  if (pathFormat === "yaml") return "yaml";
  return "json";
}
