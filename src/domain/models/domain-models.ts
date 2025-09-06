/**
 * Consolidated domain models for templates
 * Schema models have been moved to entities.ts and value-objects.ts for proper DDD separation
 */

import type { DomainError, Result } from "../core/result.ts";

// Note: SchemaFormat type preserved for backward compatibility during migration
export type SchemaFormat = "json" | "yaml" | "custom";

// ============= Template Models =============

export type TemplateFormat = "json" | "yaml" | "handlebars" | "custom";

export class TemplateDefinition {
  private constructor(
    private readonly definition: string,
    private readonly format: TemplateFormat,
  ) {}

  static create(
    definition: string,
    format: TemplateFormat,
  ): Result<TemplateDefinition, DomainError> {
    if (!definition || definition.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyInput", field: "definition" },
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
  ): Result<Template, DomainError> {
    if (!id || id.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyInput", field: "id" },
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

  render(data: unknown): Result<string, DomainError> {
    // This would be implemented by specific renderers
    // For now, we return a JSON string
    try {
      return { ok: true, data: JSON.stringify(data, null, 2) };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ParseError",
          input: String(data),
          details: String(error),
        },
      };
    }
  }
}
