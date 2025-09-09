/**
 * Template domain entities following DDD principles
 * Part of Template Management bounded context
 */

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type { MappingRule, TemplateFormat } from "../models/value-objects.ts";
import { StrictStructureMatcher } from "../models/strict-structure-matcher.ts";
import { PropertyPathNavigator } from "../models/property-path.ts";

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

/**
 * Template identifier value object with Smart Constructor pattern
 */
export class TemplateId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<TemplateId, DomainError> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        } as DomainError,
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

/**
 * Template aggregate root
 * Represents a template with mapping rules and processing capabilities
 */
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

  /**
   * Legacy backward compatibility method for tests during migration
   * @deprecated Use create() method that returns Result<Template, Error>
   * This method throws on error for backward compatibility
   */
  static createLegacy(
    id: TemplateId,
    format: TemplateFormat,
    mappingRules: MappingRule[],
    description: string = "",
  ): Template {
    const result = Template.create(id, format, mappingRules, description);
    if (!result.ok) {
      throw new Error(`Template creation failed: ${result.error.message}`);
    }
    return result.data;
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

  applyRules(
    data: Record<string, unknown>,
    mode: TemplateApplicationMode,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    // If strict structure validation is required, perform it first
    switch (mode.kind) {
      case "WithStructuralValidation": {
        const alignmentResult = StrictStructureMatcher
          .validateStructuralAlignment(
            data,
            mode.schemaData,
            mode.templateStructure,
          );

        if (!alignmentResult.ok) {
          // Return error if structures don't match exactly
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "TemplateMappingFailed",
                template: mode.templateStructure,
                source: data,
              },
              `Template structural validation failed: ${alignmentResult.error.message}`,
            ),
          };
        }
        break;
      }
      case "SimpleMapping":
        // No additional validation needed for simple mapping
        break;
    }

    // Apply mapping rules to transform the data
    const result: Record<string, unknown> = {};

    // Apply each mapping rule
    for (const rule of this.mappingRules) {
      const value = rule.apply(data);
      if (value !== undefined) {
        this.setValueByPath(result, rule.getTarget(), value);
      }
    }

    return { ok: true, data: result };
  }

  /**
   * Sets a value in an object using dot notation path
   * Creates nested objects as needed
   *
   * @param obj - Object to set value in
   * @param path - Dot notation path (e.g., "document.metadata.author")
   * @param value - Value to set
   */
  private setValueByPath(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    let current = obj;

    // Navigate to the parent object, creating nested objects as needed
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (
        !(part in current) || typeof current[part] !== "object" ||
        current[part] === null || Array.isArray(current[part])
      ) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    // Set the final value
    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }
}
