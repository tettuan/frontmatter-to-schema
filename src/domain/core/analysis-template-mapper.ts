/**
 * Template Mapper Implementation
 *
 * Handles transformation from source to target using templates with
 * robust error handling and Totality-based discriminated unions.
 */

import { createDomainError, type Result } from "./result.ts";
import type { AnalysisError } from "./result.ts";
import type { TemplateDefinition } from "./types.ts";
import type {
  TemplateMapper as AbstractTemplateMapper,
} from "./abstractions.ts";
import type {
  InternalTemplateMapper,
  MappingRulesResult,
  TemplateParsingResult,
} from "./analysis-interfaces.ts";

/**
 * Template Mapper Implementation
 * Handles transformation from source to target using templates
 */
export class RobustTemplateMapper<TSource, TTarget>
  implements
    AbstractTemplateMapper<TSource, TTarget>,
    InternalTemplateMapper<TSource, TTarget> {
  // Implementation of external TemplateMapper interface from abstractions.ts
  map(
    _source: TSource,
    template: TTarget,
    _schema?: unknown,
  ): Promise<TTarget> {
    // Check if template has TemplateDefinition structure
    if (this.isTemplateDefinition(template)) {
      // If template has structure property, return as-is
      if (template.structure) {
        return Promise.resolve(template as TTarget);
      }

      // If template has variables but no structure, create structure from variables
      if (template.variables && !template.structure) {
        const result = {
          ...template,
          structure: { ...template.variables },
        };
        // Safe to cast after transformation
        return Promise.resolve(result as TTarget);
      }
    }

    // Default: return template as-is
    return Promise.resolve(template);
  }

  /**
   * Type guard to check if value is a TemplateDefinition
   */
  private isTemplateDefinition(
    value: unknown,
  ): value is TemplateDefinition {
    return (
      typeof value === "object" &&
      value !== null &&
      ("structure" in value || "variables" in value)
    );
  }

  // Implementation of internal TemplateMapper interface (this file)
  mapInternal(
    source: TSource,
    template: TemplateDefinition,
  ): Result<TTarget, AnalysisError & { message: string }> {
    if (!source) {
      return {
        ok: false,
        error: createDomainError({
          kind: "TemplateMappingFailed",
          template: template.template || template,
          source,
        }),
      };
    }

    try {
      // Basic template mapping - can be enhanced with complex transformation rules
      const mappedResult = this.transformWithTemplate(source, template);
      return { ok: true, data: mappedResult };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "TemplateMappingFailed",
          template: template.template || template,
          source,
        }),
      };
    }
  }

  private transformWithTemplate(
    source: TSource,
    template: TemplateDefinition,
  ): TTarget {
    // Parse template using Totality patterns
    const parsingResult = this.parseTemplateDefinition(template);

    // Start with template structure as base
    const templateStructure = this.extractTemplateStructure(parsingResult);
    const result: Record<string, unknown> = { ...templateStructure };

    // Handle FrontMatterContent instances by extracting their data
    let sourceObj: Record<string, unknown>;
    if (
      source && typeof source === "object" && "toJSON" in source &&
      typeof (source as { toJSON?: () => unknown }).toJSON === "function"
    ) {
      // This is a FrontMatterContent instance
      sourceObj = (source as { toJSON: () => Record<string, unknown> })
        .toJSON();
    } else if (typeof source === "object" && source !== null) {
      sourceObj = source as Record<string, unknown>;
    } else {
      return result as TTarget;
    }

    // Apply mapping rules using discriminated union pattern
    this.applyMappingRules(parsingResult.mappingRules, sourceObj, result);

    // Merge any remaining properties from source, overriding template defaults
    for (const [key, value] of Object.entries(sourceObj)) {
      result[key] = value;
    }

    return result as TTarget;
  }

  /**
   * Parse template definition using Totality patterns
   */
  private parseTemplateDefinition(
    template: TemplateDefinition,
  ): TemplateParsingResult {
    try {
      // If template.template is a string that looks like JSON, try to parse it
      if (
        typeof template.template === "string" &&
        template.template.startsWith("{")
      ) {
        const parsedTemplate = JSON.parse(template.template);
        return {
          kind: "Parsed",
          structure: parsedTemplate.structure || {},
          mappingRules: this.extractMappingRules(
            parsedTemplate.mappingRules || template.mappingRules,
          ),
        };
      } else {
        // Use template structure directly, or merge with variables for simple string templates
        let structure = template.structure || {};

        // For simple string templates like "default", use variables directly
        if (
          typeof template.template === "string" &&
          Object.keys(structure).length === 0 && template.variables
        ) {
          structure = { ...template.variables };
        }

        return {
          kind: "Parsed",
          structure,
          mappingRules: this.extractMappingRules(template.mappingRules),
        };
      }
    } catch {
      // If parsing fails, use template as-is
      let fallbackStructure = template.structure || {};

      // Fallback: use variables directly if available
      if (template.variables && Object.keys(fallbackStructure).length === 0) {
        fallbackStructure = { ...template.variables };
      }

      return {
        kind: "ParseFailed",
        fallbackStructure,
        mappingRules: this.extractMappingRules(template.mappingRules),
      };
    }
  }

  /**
   * Extract mapping rules using discriminated union pattern
   */
  private extractMappingRules(
    rules: Record<string, string> | undefined,
  ): MappingRulesResult {
    if (rules && typeof rules === "object") {
      return { kind: "Present", rules };
    }
    return { kind: "NotPresent" };
  }

  /**
   * Extract template structure from parsing result
   */
  private extractTemplateStructure(
    parsingResult: TemplateParsingResult,
  ): Record<string, unknown> {
    switch (parsingResult.kind) {
      case "Parsed":
        return parsingResult.structure;
      case "ParseFailed":
        return parsingResult.fallbackStructure;
    }
  }

  /**
   * Apply mapping rules using discriminated union pattern
   */
  private applyMappingRules(
    mappingRulesResult: MappingRulesResult,
    sourceObj: Record<string, unknown>,
    result: Record<string, unknown>,
  ): void {
    switch (mappingRulesResult.kind) {
      case "Present":
        for (
          const [targetKey, sourceKey] of Object.entries(
            mappingRulesResult.rules,
          )
        ) {
          const sourceKeyStr = sourceKey as string;
          if (sourceKeyStr in sourceObj) {
            // Support dot notation for nested properties (simplified)
            if (targetKey.includes(".")) {
              // For now, just set direct properties
              const keys = targetKey.split(".");
              if (keys.length === 2) {
                if (!result[keys[0]]) result[keys[0]] = {};
                (result[keys[0]] as Record<string, unknown>)[keys[1]] =
                  sourceObj[sourceKeyStr];
              }
            } else {
              result[targetKey] = sourceObj[sourceKeyStr];
            }
          }
        }
        break;
      case "NotPresent":
        // No mapping rules to apply
        break;
    }
  }
}
