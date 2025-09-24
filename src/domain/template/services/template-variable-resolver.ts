/**
 * Template Variable Resolver Service
 *
 * Centralizes template variable resolution logic following DDD and Totality principles.
 * Replaces scattered variable handling with unified service approach.
 *
 * Design Philosophy:
 * - Domain Service pattern: Encapsulates complex business logic
 * - Functional cohesion: Related variable operations grouped together
 * - Result types: All operations return Result<T, E> for total functions
 */

import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { TemplateVariable } from "../value-objects/template-variable.ts";
import { matchTemplateVariableType } from "../value-objects/template-variable-type.ts";
import {
  ARRAY_EXPANSION_MARKER,
  ERROR_MESSAGES,
} from "../constants/template-variable-constants.ts";

/**
 * Array data state for template variable resolution.
 */
export type ArrayDataState =
  | { readonly kind: "available"; readonly data: unknown[] }
  | { readonly kind: "not-available" };

/**
 * Context for template variable resolution.
 */
export interface VariableResolutionContext {
  readonly data: FrontmatterData;
  readonly arrayDataState: ArrayDataState;
  readonly hierarchyRoot?: string;
}

/**
 * Template Variable Resolver Service
 * Provides unified variable resolution with type safety and error handling.
 */
export class TemplateVariableResolver {
  /**
   * Resolves a template variable within the given context.
   * Implements exhaustive pattern matching for all variable types.
   */
  static resolveVariable(
    variable: TemplateVariable,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    return matchTemplateVariableType(variable.type, {
      StandardVariable: (standardVar) =>
        this.resolveStandardVariable(standardVar.name, context),
      ArrayExpansionVariable: (_arrayVar) =>
        this.resolveArrayExpansionVariable(context),
      SpecialProcessorVariable: (specialVar) =>
        this.resolveSpecialProcessorVariable(specialVar.marker, context),
    });
  }

  /**
   * Resolves a standard template variable from data context.
   * Handles both simple variables and hierarchical dot-notation variables.
   */
  private static resolveStandardVariable(
    variableName: string,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    console.log(`[DEBUG] Resolving variable: ${variableName}`);
    console.log(
      `[DEBUG] Available data keys:`,
      Object.keys(context.data.getData()),
    );

    // Handle hierarchical variables (e.g., "id.full")
    if (variableName.includes(".")) {
      return this.resolveHierarchicalVariable(variableName, context);
    }

    // Handle simple variables
    const dataResult = context.data.get(variableName);
    if (!dataResult.ok) {
      console.log(
        `[DEBUG] Variable '${variableName}' not found in data context`,
      );
      console.log(
        `[DEBUG] Full data context:`,
        JSON.stringify(context.data.getData(), null, 2),
      );
      return ErrorHandler.template({
        operation: "resolveStandardVariable",
        method: "getFromData",
      }).variableResolutionFailed(
        variableName,
        `Variable '${variableName}' not found in data context`,
      );
    }

    console.log(
      `[DEBUG] Variable '${variableName}' resolved to:`,
      JSON.stringify(dataResult.data, null, 2),
    );
    return ok(dataResult.data);
  }

  /**
   * Resolves hierarchical template variables using DDD + Totality principles.
   * Handles dot-notation variables by attempting direct path resolution first,
   * then fallback transformation patterns.
   */
  private static resolveHierarchicalVariable(
    variableName: string,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    console.log(`[DEBUG] Resolving hierarchical variable: ${variableName}`);

    // First attempt: Direct path resolution (e.g., data contains {"id": {"full": "value"}})
    const directResult = context.data.get(variableName);
    if (directResult.ok) {
      console.log(
        `[DEBUG] Direct path resolution successful for ${variableName}`,
      );
      return directResult;
    }

    // Second attempt: Smart transformation for common patterns
    // Handle "id.full" when data contains {"id": "value"} - transform to hierarchical structure
    const pathParts = variableName.split(".");
    if (pathParts.length === 2) {
      const [baseName, property] = pathParts;
      return this.resolveTransformedHierarchicalVariable(
        baseName,
        property,
        context,
      );
    }

    console.log(
      `[DEBUG] Hierarchical variable '${variableName}' could not be resolved`,
    );
    return ErrorHandler.template({
      operation: "resolveHierarchicalVariable",
      method: "pathResolution",
    }).variableResolutionFailed(
      variableName,
      `Hierarchical variable '${variableName}' not found and no transformation pattern matched`,
    );
  }

  /**
   * Transforms flat data structure to support hierarchical variable access.
   * Implements domain-specific transformation logic following Totality principles.
   */
  private static resolveTransformedHierarchicalVariable(
    baseName: string,
    property: string,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    console.log(
      `[DEBUG] Attempting transformation for ${baseName}.${property}`,
    );

    // Get base value from flat structure
    const baseResult = context.data.get(baseName);
    if (!baseResult.ok) {
      return ErrorHandler.template({
        operation: "resolveTransformedHierarchicalVariable",
        method: "getBaseValue",
      }).variableResolutionFailed(
        baseName,
        `Base variable '${baseName}' not found for hierarchical access`,
      );
    }

    // Apply domain-specific transformation patterns
    const transformedValue = this.applyHierarchicalTransformation(
      baseResult.data,
      property,
      baseName,
    );

    if (transformedValue !== null) {
      console.log(
        `[DEBUG] Transformation successful: ${baseName}.${property} = ${transformedValue}`,
      );
      return ok(transformedValue);
    }

    return ErrorHandler.template({
      operation: "resolveTransformedHierarchicalVariable",
      method: "applyTransformation",
    }).variableResolutionFailed(
      `${baseName}.${property}`,
      `Could not transform '${baseName}' value for property '${property}'`,
    );
  }

  /**
   * Applies domain-specific transformation logic for hierarchical variable access.
   * Following DDD principles, this encapsulates business rules for data transformation.
   */
  private static applyHierarchicalTransformation(
    baseValue: unknown,
    property: string,
    baseName: string,
  ): unknown {
    // Pattern 1: "id.full" -> use the base value directly as the "full" representation
    if (baseName === "id" && property === "full") {
      console.log(
        `[DEBUG] Applying id.full transformation: ${baseValue} -> ${baseValue}`,
      );
      return baseValue;
    }

    // Pattern 2: For other properties, check if base value contains the property
    if (typeof baseValue === "object" && baseValue !== null) {
      const obj = baseValue as Record<string, unknown>;
      if (property in obj) {
        return obj[property];
      }
    }

    // Pattern 3: Property-specific transformations
    switch (property) {
      case "full":
        // For "full" property, return the base value as-is (common pattern for IDs)
        return baseValue;
      case "short":
        // For "short" property, attempt to abbreviate string values
        if (typeof baseValue === "string") {
          return baseValue.substring(0, 8);
        }
        return baseValue;
      default:
        console.log(
          `[DEBUG] No transformation pattern for ${baseName}.${property}`,
        );
        return null;
    }
  }

  /**
   * Resolves array expansion variable ({@items}).
   * Requires available array data state.
   */
  private static resolveArrayExpansionVariable(
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    console.log("[DEBUG] @items resolver - arrayDataState:", {
      kind: context.arrayDataState.kind,
      data: context.arrayDataState.kind === "available"
        ? JSON.stringify(context.arrayDataState.data, null, 2)
        : "N/A",
    });

    if (context.arrayDataState.kind === "available") {
      console.log(
        "[DEBUG] @items resolver - returning data:",
        JSON.stringify(context.arrayDataState.data, null, 2),
      );
      return ok(context.arrayDataState.data);
    }

    console.log("[DEBUG] @items resolver - array data not available");
    return ErrorHandler.template({
      operation: "resolveArrayExpansionVariable",
      method: "checkArrayDataState",
    }).variableResolutionFailed(
      ARRAY_EXPANSION_MARKER,
      ERROR_MESSAGES.ARRAY_MARKER_NOT_SUPPORTED(ARRAY_EXPANSION_MARKER),
    );
  }

  /**
   * Resolves special processor variables (future extensibility).
   * Currently only supports @items; others are treated as unsupported.
   */
  private static resolveSpecialProcessorVariable(
    marker: string,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    // Handle the special case of @items as a processor variable
    if (marker === ARRAY_EXPANSION_MARKER) {
      return this.resolveArrayExpansionVariable(context);
    }

    // All other special processors are currently unsupported
    return ErrorHandler.template({
      operation: "resolveSpecialProcessorVariable",
      method: "checkUnsupportedMarker",
    }).variableResolutionFailed(
      marker,
      ERROR_MESSAGES.ARRAY_MARKER_NOT_SUPPORTED(marker),
    );
  }

  /**
   * Resolves a variable by name (legacy support).
   * Converts string-based resolution to type-safe approach.
   */
  static resolveVariableByName(
    variableName: string,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    const variableResult = TemplateVariable.create(variableName);
    if (!variableResult.ok) {
      return variableResult;
    }

    return this.resolveVariable(variableResult.data, context);
  }

  /**
   * Checks if a variable name should be processed.
   * Replaces hardcoded string checks with type-safe logic.
   */
  static shouldProcessVariable(variableName: string): boolean {
    const variableResult = TemplateVariable.create(variableName);
    if (!variableResult.ok) {
      return false;
    }

    const variable = variableResult.data;

    // Process standard variables and array expansion variables
    // Skip special processor variables (except @items)
    return matchTemplateVariableType(variable.type, {
      StandardVariable: () => true,
      ArrayExpansionVariable: () => true,
      SpecialProcessorVariable: (specialVar) =>
        specialVar.marker === ARRAY_EXPANSION_MARKER,
    });
  }

  /**
   * Creates an array data context from array data.
   */
  static createArrayDataContext(arrayData?: unknown[]): ArrayDataState {
    if (arrayData && Array.isArray(arrayData)) {
      return { kind: "available", data: arrayData };
    }
    return { kind: "not-available" };
  }

  /**
   * Creates a variable resolution context.
   */
  static createContext(
    data: FrontmatterData,
    arrayData?: unknown[],
    hierarchyRoot?: string,
  ): VariableResolutionContext {
    return {
      data,
      arrayDataState: this.createArrayDataContext(arrayData),
      hierarchyRoot,
    };
  }
}
