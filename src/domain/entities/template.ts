// Template Entity following DDD and Totality principles
// Core entity for template processing and transformation

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type { MappingRule, TemplateFormat } from "../models/value-objects.ts";
import type { TemplateId } from "../value-objects/ids.ts";
import {
  PropertyPath,
  PropertyPathNavigator,
} from "../models/property-path.ts";
import { StrictStructureMatcher } from "../models/strict-structure-matcher.ts";
import type { TemplateParsingResult } from "../value-objects/states.ts";

/**
 * Template application mode
 * Discriminated union for different validation strategies
 */
export type TemplateApplicationMode =
  | {
    kind: "WithStructuralValidation";
    schemaData: unknown;
    templateStructure: unknown;
  }
  | { kind: "SimpleMapping" };

/**
 * Template entity
 * Manages template format, mapping rules, and data transformation
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

  /**
   * Create template with validation
   * Returns Result type for proper error handling
   */
  static create(
    id: TemplateId,
    format: TemplateFormat,
    mappingRules: MappingRule[],
    description?: string,
  ): Result<Template, DomainError & { message: string }> {
    const safeDescription = description ?? "";

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
        safeDescription,
        navigatorResult.data,
      ),
    };
  }

  /**
   * @deprecated Use create() with Result type
   * Kept for backward compatibility during migration
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

  /**
   * Apply template rules to data
   * Supports different validation modes
   */
  applyRules(
    data: Record<string, unknown>,
    mode: TemplateApplicationMode,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    // Structural validation if required
    switch (mode.kind) {
      case "WithStructuralValidation": {
        const alignmentResult = StrictStructureMatcher
          .validateStructuralAlignment(
            data,
            mode.schemaData,
            mode.templateStructure,
          );

        if (!alignmentResult.ok) {
          return {
            ok: false,
            error: createDomainError({
              kind: "TemplateMappingFailed",
              template: mode.templateStructure,
              source: mode.schemaData,
            }, "Data structure does not align with template structure"),
          };
        }
        break;
      }
      case "SimpleMapping":
        // No structural validation needed
        break;
    }

    // Process template content
    const templateContent = this.format.getTemplate();
    const parseResult = this.parseTemplateContent(templateContent);

    switch (parseResult.kind) {
      case "JsonParsed": {
        const result = this.substituteTemplateValues(
          parseResult.template,
          data,
        );
        return { ok: true, data: result as Record<string, unknown> };
      }
      case "ParseFailed":
      case "NoPlaceholders":
        // Continue to mapping rules
        break;
    }

    // Apply mapping rules or return data as-is
    if (this.mappingRules.length === 0) {
      return { ok: true, data };
    }

    return this.applyMappingRules(data);
  }

  /**
   * Parse template content to identify structure
   */
  private parseTemplateContent(content: string): TemplateParsingResult {
    // Check for JSON structure with placeholders
    if (content.includes("{") && content.includes("}")) {
      try {
        // Temporarily replace placeholders to validate JSON structure
        const normalized = content.replace(/\{[^}]+\}/g, '"placeholder"');
        const parsed = JSON.parse(normalized);
        return { kind: "JsonParsed", template: parsed };
      } catch {
        return { kind: "ParseFailed", reason: "Invalid JSON structure" };
      }
    }
    return { kind: "NoPlaceholders" };
  }

  /**
   * Substitute template placeholders with actual values
   */
  private substituteTemplateValues(
    template: unknown,
    data: Record<string, unknown>,
  ): unknown {
    if (typeof template === "string") {
      return this.replacePlaceholders(template, data);
    }
    if (Array.isArray(template)) {
      return template.map((item) => this.substituteTemplateValues(item, data));
    }
    if (template && typeof template === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.substituteTemplateValues(value, data);
      }
      return result;
    }
    return template;
  }

  /**
   * Replace placeholders in a string with data values
   */
  private replacePlaceholders(
    template: string,
    data: Record<string, unknown>,
  ): string {
    return template.replace(/\{([^}]+)\}/g, (_, key) => {
      const pathResult = PropertyPath.create(key);
      if (!pathResult.ok) {
        return `{${key}}`;
      }
      const value = this.pathNavigator.navigate(data, pathResult.data);
      return value !== undefined ? String(value) : `{${key}}`;
    });
  }

  /**
   * Apply mapping rules to transform data
   */
  private applyMappingRules(
    data: Record<string, unknown>,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    const result: Record<string, unknown> = {};

    for (const rule of this.mappingRules) {
      const sourcePathResult = PropertyPath.create(rule.getSource());
      if (!sourcePathResult.ok) {
        continue; // Skip invalid paths
      }
      const value = this.pathNavigator.navigate(data, sourcePathResult.data);
      if (value !== undefined) {
        const targetPath = rule.getTarget();
        this.setNestedValue(result, targetPath, value);
      }
    }

    return { ok: true, data: result };
  }

  /**
   * Set a value at a nested path in an object
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }
}
