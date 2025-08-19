import { Result } from "../shared/result.ts";
import { ValidationError } from "../shared/errors.ts";

export type TemplateFormat = "json" | "yaml" | "handlebars" | "custom";

export class TemplateDefinition {
  private constructor(
    private readonly definition: string,
    private readonly format: TemplateFormat,
  ) {}

  static create(
    definition: string,
    format: TemplateFormat,
  ): Result<TemplateDefinition, ValidationError> {
    if (!definition || definition.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Template definition cannot be empty",
        },
      };
    }

    return {
      ok: true,
      data: new TemplateDefinition(definition.trim(), format),
    };
  }

  getDefinition(): string {
    return this.definition;
  }

  getFormat(): TemplateFormat {
    return this.format;
  }
}

export class Template {
  private constructor(
    private readonly id: string,
    private readonly definition: TemplateDefinition,
    private readonly description?: string,
  ) {}

  static create(
    id: string,
    definition: TemplateDefinition,
    description?: string,
  ): Result<Template, ValidationError> {
    if (!id || id.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Template ID cannot be empty",
        },
      };
    }

    return {
      ok: true,
      data: new Template(id.trim(), definition, description),
    };
  }

  getId(): string {
    return this.id;
  }

  getDefinition(): TemplateDefinition {
    return this.definition;
  }

  getDescription(): string | undefined {
    return this.description;
  }

  render(data: unknown): Result<string, ValidationError> {
    // This would be implemented by specific renderers
    // For now, we return a JSON string
    try {
      return { ok: true, data: JSON.stringify(data, null, 2) };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: `Failed to render template: ${error}`,
        },
      };
    }
  }
}