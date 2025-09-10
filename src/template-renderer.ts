import type { DomainError, ProcessingConfig, Result } from "./types.ts";

export interface TemplateData {
  readonly aggregatedData: Record<string, unknown>;
}

export class TemplateRenderer {
  private constructor() {}

  static create(): Result<TemplateRenderer, DomainError> {
    return { ok: true, data: new TemplateRenderer() };
  }

  async render(
    templateConfig: ProcessingConfig["template"],
    data: TemplateData,
  ): Promise<Result<string, DomainError>> {
    try {
      // Read template file
      const templateContent = await Deno.readTextFile(templateConfig.path);

      // Render based on format
      switch (templateConfig.format) {
        case "json":
          return this.renderJson(templateContent, data);
        case "yaml":
          return this.renderYaml(templateContent, data);
        case "xml":
          return this.renderXml(templateContent, data);
        case "custom":
          return this.renderCustom(templateContent, data);
        default:
          return {
            ok: false,
            error: {
              kind: "TemplateRenderFailed",
              template: templateConfig.path,
              data: data.aggregatedData,
            },
          };
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ReadError",
          path: templateConfig.path,
          details: String(error),
        },
      };
    }
  }

  private renderJson(
    template: string,
    data: TemplateData,
  ): Result<string, DomainError> {
    try {
      // Simple template variable replacement
      const rendered = this.replaceVariables(template, data.aggregatedData);

      // Validate JSON output
      JSON.parse(rendered);

      return { ok: true, data: rendered };
    } catch (_error) {
      return {
        ok: false,
        error: {
          kind: "TemplateRenderFailed",
          template: template.slice(0, 100),
          data: data.aggregatedData,
        },
      };
    }
  }

  private renderYaml(
    template: string,
    data: TemplateData,
  ): Result<string, DomainError> {
    try {
      const rendered = this.replaceVariables(template, data.aggregatedData);
      return { ok: true, data: rendered };
    } catch (_error) {
      return {
        ok: false,
        error: {
          kind: "TemplateRenderFailed",
          template: template.slice(0, 100),
          data: data.aggregatedData,
        },
      };
    }
  }

  private renderXml(
    template: string,
    data: TemplateData,
  ): Result<string, DomainError> {
    try {
      const rendered = this.replaceVariables(template, data.aggregatedData);
      return { ok: true, data: rendered };
    } catch (_error) {
      return {
        ok: false,
        error: {
          kind: "TemplateRenderFailed",
          template: template.slice(0, 100),
          data: data.aggregatedData,
        },
      };
    }
  }

  private renderCustom(
    template: string,
    data: TemplateData,
  ): Result<string, DomainError> {
    try {
      const rendered = this.replaceVariables(template, data.aggregatedData);
      return { ok: true, data: rendered };
    } catch (_error) {
      return {
        ok: false,
        error: {
          kind: "TemplateRenderFailed",
          template: template.slice(0, 100),
          data: data.aggregatedData,
        },
      };
    }
  }

  private replaceVariables(
    template: string,
    data: Record<string, unknown>,
  ): string {
    let result = template;

    // Simple variable replacement: {{variableName}}
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      const replacement = this.valueToString(value);
      result = result.replace(new RegExp(placeholder, "g"), replacement);
    }

    return result;
  }

  private valueToString(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  }
}
