// Template domain entities following DDD principles

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";
import type {
  MappingRule,
  TemplateFormat,
} from "../../../domain/models/value-objects.ts";
import { PropertyPathNavigator } from "../../../domain/models/property-path.ts";
import { UnifiedTemplateRenderer } from "../services/unified-template-renderer.ts";

// Discriminated union for template parsing results
export type TemplateParsingResult = {
  kind: "JsonParsed";
  template: Record<string, unknown>;
} | {
  kind: "ParseFailed";
  reason: string;
} | {
  kind: "NoPlaceholders";
};

// Discriminated union for template application modes following totality principle
export type TemplateApplicationMode =
  | {
    kind: "WithStructuralValidation";
    schemaData: unknown;
    templateStructure: unknown;
  }
  | { kind: "SimpleMapping" };

export class TemplateId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<TemplateId, DomainError> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }),
      };
    }
    return { ok: true, data: new TemplateId(value) };
  }

  getValue(): string {
    return this.value;
  }

  equals(other: TemplateId): boolean {
    return this.value === other.value;
  }
}

export class Template {
  private readonly pathNavigator: PropertyPathNavigator;

  private constructor(
    private readonly id: TemplateId,
    private readonly format: TemplateFormat,
    private readonly mappingRules: MappingRule[],
    private readonly description: string,
    pathNavigator: PropertyPathNavigator,
  ) {
    this.pathNavigator = pathNavigator;
  }

  static create(
    id: TemplateId,
    format: TemplateFormat,
    mappingRules: MappingRule[],
    description: string = "",
  ): Result<Template, DomainError & { message: string }> {
    // Initialize PropertyPathNavigator service
    const navigatorResult = PropertyPathNavigator.create();
    if (!navigatorResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "NotConfigured",
            component: "PropertyPathNavigator",
          },
          `Failed to initialize PropertyPathNavigator: ${navigatorResult.error.message}`,
        ),
      };
    }
    return {
      ok: true,
      data: new Template(
        id,
        format,
        mappingRules,
        description,
        navigatorResult.data,
      ),
    };
  }

  getId(): TemplateId {
    return this.id;
  }

  getFormat(): TemplateFormat {
    return this.format;
  }

  getMappingRules(): MappingRule[] {
    return this.mappingRules;
  }

  getDescription(): string {
    return this.description;
  }

  /**
   * Get the path navigator for this template
   * This is used by the template application service
   */
  getPathNavigator(): PropertyPathNavigator {
    return this.pathNavigator;
  }

  /**
   * Backward compatibility method for applyRules
   * @deprecated Use UnifiedTemplateRenderer.render() for new code
   * This method provides backward compatibility during migration
   */
  applyRules(
    data: Record<string, unknown>,
    _mode: TemplateApplicationMode,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    const renderer = new UnifiedTemplateRenderer();
    // Convert mapping rules to template structure
    const templateStructure: Record<string, unknown> = {};
    for (const rule of this.getMappingRules()) {
      const source = rule.getSource();
      const target = rule.getTarget();
      if (source && target) {
        templateStructure[target] = `{{${source}}}`;
      }
    }
    const templateString = JSON.stringify(templateStructure);
    const result = renderer.render(templateString, data);

    if (!result.ok) {
      return result;
    }

    // Parse the rendered result back to object
    try {
      const parsed = JSON.parse(result.data.content);
      return { ok: true, data: parsed };
    } catch {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: result.data.content,
          expectedFormat: "JSON object",
        }),
      };
    }
  }
}
