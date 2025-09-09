// Template application service following DDD principles

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";
import type {
  Template,
  TemplateApplicationMode,
  TemplateParsingResult,
} from "../entities/template-core.ts";
import { StrictStructureMatcher } from "../../../domain/models/strict-structure-matcher.ts";
import { TemplatePathUtils } from "./path-utils.ts";

export class TemplateApplicationService {
  constructor() {}

  static create(): TemplateApplicationService {
    return new TemplateApplicationService();
  }

  /**
   * Apply template rules to data with specified mode
   */
  applyRules(
    template: Template,
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
    const templateContent = template.getFormat().getTemplate();
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
    if (template.getMappingRules().length === 0) {
      return { ok: true, data };
    }

    const result: Record<string, unknown> = {};

    // Apply mapping rules only if structural alignment is confirmed
    for (const rule of template.getMappingRules()) {
      const value = rule.apply(data);
      const target = rule.getTarget();

      // Only set value if it exists in the source data (no fallbacks or defaults)
      // Note: undefined is a valid return from MappingRule.apply() indicating missing source data
      if (value !== undefined) {
        const setResult = TemplatePathUtils.setValueByPath(
          template,
          result,
          target,
          value,
        );
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
        const pathResult = TemplatePathUtils.getValueByPath(data, key.trim());
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
}
