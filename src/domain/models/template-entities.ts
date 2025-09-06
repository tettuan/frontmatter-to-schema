// Template-related entities following DDD principles

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type { MappingRule, TemplateFormat } from "./value-objects.ts";
import { StrictStructureMatcher } from "./strict-structure-matcher.ts";
import { PropertyPath, PropertyPathNavigator } from "./property-path.ts";

// Discriminated union for path resolution results
export type PathResolutionResult = {
  kind: "Found";
  value: unknown;
} | {
  kind: "NotFound";
  path: string;
};

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

// TemplateId value object
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

// Template entity
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
      default: {
        // Exhaustive check - TypeScript will error if we miss a case
        const _exhaustiveCheck: never = mode;
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidState",
              expected: "WithStructuralValidation or SimpleMapping",
              actual: String(_exhaustiveCheck),
            },
            `Unhandled template application mode: ${String(_exhaustiveCheck)}`,
          ),
        };
      }
    }

    // If template has content with placeholders like {field}, apply substitution
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
        // Continue to mapping rules processing
        break;
    }

    // If no mapping rules are defined, return the data as-is only if structure validation passed
    if (this.mappingRules.length === 0) {
      return { ok: true, data };
    }

    const result: Record<string, unknown> = {};

    // Apply mapping rules only if structural alignment is confirmed
    for (const rule of this.mappingRules) {
      const value = rule.apply(data);
      const target = rule.getTarget();

      // Only set value if it exists in the source data (no fallbacks or defaults)
      // Note: undefined is a valid return from MappingRule.apply() indicating missing source data
      if (value !== undefined) {
        const setResult = this.setValueByPath(result, target, value);
        if (!setResult.ok) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "TemplateMappingFailed",
                template: target,
                source: data,
              },
              `Failed to set value at path '${target}': ${setResult.error.message}`,
            ),
          };
        }
      }
    }

    return { ok: true, data: result };
  }

  /**
   * Parse template content and determine if it's JSON with placeholders
   */
  private parseTemplateContent(templateContent: string): TemplateParsingResult {
    // Check for placeholder patterns like {field} or {path.to.field}
    const hasPlaceholders = templateContent &&
      /\{[a-zA-Z_][\w.]*\}/.test(templateContent);

    if (!hasPlaceholders) {
      return { kind: "NoPlaceholders" };
    }

    try {
      const templateObj = JSON.parse(templateContent);
      if (
        templateObj && typeof templateObj === "object" &&
        !Array.isArray(templateObj)
      ) {
        return {
          kind: "JsonParsed",
          template: templateObj as Record<string, unknown>,
        };
      }
      return { kind: "ParseFailed", reason: "Parsed JSON is not an object" };
    } catch (error) {
      return {
        kind: "ParseFailed",
        reason: `JSON parse error: ${String(error)}`,
      };
    }
  }

  /**
   * Recursively substitute template placeholders with actual values from data
   */
  private substituteTemplateValues(
    template: unknown,
    data: Record<string, unknown>,
  ): unknown {
    if (typeof template === "string") {
      // Replace placeholders in strings
      return template.replace(/\{([^}]+)\}/g, (match, key) => {
        const pathResult = this.getValueByPath(data, key.trim());
        return pathResult.kind === "Found" ? String(pathResult.value) : match;
      });
    }

    if (Array.isArray(template)) {
      // Process arrays recursively
      return template.map((item) => this.substituteTemplateValues(item, data));
    }

    if (template && typeof template === "object") {
      // Process objects recursively
      const result: Record<string, unknown> = {};
      for (
        const [key, value] of Object.entries(
          template as Record<string, unknown>,
        )
      ) {
        result[key] = this.substituteTemplateValues(value, data);
      }
      return result;
    }

    // Return primitives as-is
    return template;
  }

  /**
   * Get value from data object by path (supports nested paths like "options.input")
   * Returns Result type following Totality principle
   */
  private getValueByPath(
    data: Record<string, unknown>,
    path: string,
  ): PathResolutionResult {
    const keys = path.split(".");
    let current: unknown = data;

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return { kind: "NotFound", path };
      }
    }

    return { kind: "Found", value: current };
  }

  /**
   * Set value by path using PropertyPathNavigator for totality compliance
   * Returns Result type instead of void to handle all error cases explicitly
   */
  private setValueByPath(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): Result<void, DomainError & { message: string }> {
    // Create PropertyPath with validation
    const propertyPathResult = PropertyPath.create(path);
    if (!propertyPathResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: path,
          expectedFormat: "valid.property.path",
        }, `Invalid property path: ${propertyPathResult.error.message}`),
      };
    }

    // Use PropertyPathNavigator for safe assignment
    const assignmentResult = this.pathNavigator.assign(
      obj,
      propertyPathResult.data,
      value,
    );

    if (!assignmentResult.ok) {
      return assignmentResult;
    }

    // Handle specific assignment results
    switch (assignmentResult.data.kind) {
      case "Success":
      case "PathCreated":
        // Both are successful outcomes
        return { ok: true, data: undefined };
      case "TypeConflict":
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: assignmentResult.data.existingType,
              expectedFormat: "object",
            },
            `Type conflict at path segment '${assignmentResult.data.conflictSegment}': expected object, got ${assignmentResult.data.existingType}`,
          ),
        };
      default: {
        // Exhaustive check - TypeScript will error if we miss a case
        const _exhaustiveCheck: never = assignmentResult.data;
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidState",
            expected: "Success, PathCreated, or TypeConflict",
            actual: String(_exhaustiveCheck),
          }, `Unhandled assignment result: ${String(_exhaustiveCheck)}`),
        };
      }
    }
  }
}
