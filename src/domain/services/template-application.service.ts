/**
 * Template Application Service
 * Extracted from Template entity for better separation of concerns
 * Handles complex template application logic including rule processing and value substitution
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type {
  PathResolutionResult,
  TemplateApplicationMode,
} from "../types/domain-types.ts";
import { StrictStructureMatcher } from "../models/strict-structure-matcher.ts";
import { PropertyPath } from "../models/property-path.ts";
import { TemplateParsingService } from "./template-parsing.service.ts";

/**
 * Forward declaration for Template entity to avoid circular dependencies
 */
export interface ITemplate {
  getFormat(): { getTemplate(): string };
  getMappingRules(): Array<{
    apply(data: Record<string, unknown>): unknown;
    getTarget(): string;
  }>;
  getPathNavigator(): {
    assign(
      obj: Record<string, unknown>,
      path: PropertyPath,
      value: unknown,
    ): Result<
      {
        kind: "Success" | "PathCreated" | "TypeConflict";
        conflictSegment?: string;
        existingType?: string;
      },
      DomainError & { message: string }
    >;
  };
}

/**
 * Service for applying templates to data with rule processing and value substitution
 * Handles complex orchestration logic separated from template entity
 */
export class TemplateApplicationService {
  private readonly parsingService: TemplateParsingService;

  constructor() {
    this.parsingService = new TemplateParsingService();
  }

  /**
   * Apply template rules to data with specified application mode
   * Main orchestration method for template processing
   */
  applyRules(
    template: ITemplate,
    data: Record<string, unknown>,
    mode: TemplateApplicationMode,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    // Validate structural alignment if required
    const structuralResult = this.validateStructuralAlignment(data, mode);
    if (!structuralResult.ok) {
      return structuralResult;
    }

    // Process template content with placeholders if applicable
    const templateProcessingResult = this.processTemplateContent(
      template,
      data,
    );
    if (templateProcessingResult.processed) {
      return { ok: true, data: templateProcessingResult.result };
    }

    // Apply mapping rules if no template processing occurred
    return this.applyMappingRules(template, data);
  }

  /**
   * Validate structural alignment between data and template structure
   */
  private validateStructuralAlignment(
    data: Record<string, unknown>,
    mode: TemplateApplicationMode,
  ): Result<void, DomainError & { message: string }> {
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

    return { ok: true, data: undefined };
  }

  /**
   * Process template content for placeholder substitution
   */
  private processTemplateContent(
    template: ITemplate,
    data: Record<string, unknown>,
  ): { processed: boolean; result: Record<string, unknown> } {
    const templateContent = template.getFormat().getTemplate();
    const parseResult = this.parsingService.parseTemplateContent(
      templateContent,
    );

    switch (parseResult.kind) {
      case "JsonParsed": {
        const result = this.substituteTemplateValues(
          parseResult.template,
          data,
        );
        return {
          processed: true,
          result: result as Record<string, unknown>,
        };
      }
      case "ParseFailed":
      case "NoPlaceholders":
        // No template processing needed
        return { processed: false, result: {} };
      default: {
        // Exhaustive check
        const _exhaustiveCheck: never = parseResult;
        return { processed: false, result: {} };
      }
    }
  }

  /**
   * Apply mapping rules to transform data
   */
  private applyMappingRules(
    template: ITemplate,
    data: Record<string, unknown>,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    const mappingRules = template.getMappingRules();

    // If no mapping rules are defined, return the data as-is
    if (mappingRules.length === 0) {
      return { ok: true, data };
    }

    const result: Record<string, unknown> = {};

    // Apply mapping rules
    for (const rule of mappingRules) {
      const value = rule.apply(data);
      const target = rule.getTarget();

      // Only set value if it exists in the source data
      if (value !== undefined) {
        const setResult = this.setValueByPath(template, result, target, value);
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
    template: ITemplate,
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
    const pathNavigator = template.getPathNavigator();
    const assignmentResult = pathNavigator.assign(
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
              input: assignmentResult.data.existingType || "unknown",
              expectedFormat: "object",
            },
            `Type conflict at path segment '${assignmentResult.data.conflictSegment}': expected object, got ${assignmentResult.data.existingType}`,
          ),
        };
      default:
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidState",
            expected: "Success, PathCreated, or TypeConflict",
            actual: String(assignmentResult.data.kind),
          }, `Unhandled assignment result: ${assignmentResult.data.kind}`),
        };
    }
  }
}
