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
   */
  private static resolveStandardVariable(
    variableName: string,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    const dataResult = context.data.get(variableName);
    if (!dataResult.ok) {
      return ErrorHandler.template({
        operation: "resolveStandardVariable",
        method: "getFromData",
      }).variableResolutionFailed(
        variableName,
        `Variable '${variableName}' not found in data context`,
      );
    }

    return ok(dataResult.data);
  }

  /**
   * Resolves array expansion variable ({@items}).
   * Requires available array data state.
   */
  private static resolveArrayExpansionVariable(
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    if (context.arrayDataState.kind === "available") {
      return ok(context.arrayDataState.data);
    }

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
