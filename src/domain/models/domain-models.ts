/**
 * Consolidated domain models for schema and template
 * Reduces file count by combining related models
 */

import type { Result } from "../core/result.ts";
import type { ValidationError } from "../shared/errors.ts";

// ============= Schema Models =============

export type SchemaFormat = "json" | "yaml" | "custom";

export class SchemaDefinition {
  private constructor(
    private readonly definition: unknown,
    private readonly format: SchemaFormat,
  ) {}

  static create(
    definition: unknown,
    format: SchemaFormat,
  ): Result<SchemaDefinition, ValidationError & { message: string }> {
    if (!definition) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Schema definition cannot be empty",
        } as ValidationError & { message: string },
      };
    }

    if (
      typeof definition !== "object" || definition === null ||
      Array.isArray(definition)
    ) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Schema definition must be a plain object",
        } as ValidationError & { message: string },
      };
    }

    return { ok: true, data: new SchemaDefinition(definition, format) };
  }

  getDefinition(): unknown {
    return this.definition;
  }

  getFormat(): SchemaFormat {
    return this.format;
  }

  validate(
    data: unknown,
  ): Result<boolean, ValidationError & { message: string }> {
    // Basic validation - reject null/undefined
    if (data === null || data === undefined) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Data to validate cannot be null or undefined",
        } as ValidationError & { message: string },
      };
    }

    // For now, just return true for any non-null data
    // In a real implementation, we'd validate against the JSON Schema
    return { ok: true, data: true };
  }
}

export class Schema {
  private constructor(
    private readonly id: string,
    private readonly definition: SchemaDefinition,
    private readonly description?: string,
  ) {}

  static create(
    id: string,
    definition: SchemaDefinition,
    description?: string,
  ): Result<Schema, ValidationError> {
    if (!id || id.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Schema ID cannot be empty",
        },
      };
    }

    return {
      ok: true,
      data: new Schema(id.trim(), definition, description),
    };
  }

  getId(): string {
    return this.id;
  }

  getDefinition(): SchemaDefinition {
    return this.definition;
  }

  getDescription(): string | undefined {
    return this.description;
  }

  validate(
    data: unknown,
  ): Result<boolean, ValidationError & { message: string }> {
    return this.definition.validate(data);
  }
}

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
