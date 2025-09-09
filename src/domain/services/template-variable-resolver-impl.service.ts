/**
 * Template Variable Resolver Implementation Service
 * Extracted from template-variable-resolver.ts for better domain separation
 * Handles resolution of variables against data following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";
import type { PropertyPathNavigator } from "../models/property-path.ts";
import type { TemplateVariable } from "../value-objects/template-variable.value-object.ts";
import type { VariableResolutionResult } from "../value-objects/variable-resolution-result.value-object.ts";
import {
  PATH_NAVIGATION_KINDS,
  RESOLUTION_RESULT_KINDS,
} from "./template-resolution-constants.ts";
import {
  isConditionalVariable,
  isPathVariable,
  isSimpleVariable,
} from "../utils/template-variable-guards.ts";

/**
 * Template Variable Resolver Implementation Service - Resolves variables against data
 */
export class TemplateVariableResolverImpl {
  constructor(
    private readonly pathNavigator: PropertyPathNavigator,
  ) {}

  /**
   * Resolve a single variable against provided data
   */
  resolveVariable(
    variable: TemplateVariable,
    data: Record<string, unknown>,
    useDefaults: boolean,
  ): Result<VariableResolutionResult, DomainError & { message: string }> {
    if (isSimpleVariable(variable)) {
      return this.resolveSimpleVariable(variable, data, useDefaults);
    }

    if (isPathVariable(variable)) {
      return this.resolvePathVariable(variable, data, useDefaults);
    }

    if (isConditionalVariable(variable)) {
      return this.resolveConditionalVariable(variable, data, useDefaults);
    }

    // Exhaustive check - TypeScript will error if we miss a case
    const _exhaustiveCheck: never = variable;
    return {
      ok: false,
      error: createDomainError({
        kind: "InvalidState",
        expected: "known variable kind",
        actual: String(_exhaustiveCheck),
      }),
    };
  }

  /**
   * Resolve simple variable from data
   */
  private resolveSimpleVariable(
    variable: TemplateVariable & { kind: "SimpleVariable" },
    data: Record<string, unknown>,
    useDefaults: boolean,
  ): Result<VariableResolutionResult, DomainError & { message: string }> {
    if (variable.name in data) {
      const value = data[variable.name];
      return {
        ok: true,
        data: {
          kind: RESOLUTION_RESULT_KINDS.SUCCESS,
          resolvedValue: String(value),
        },
      };
    }

    if (useDefaults && variable.defaultValue !== undefined) {
      return {
        ok: true,
        data: {
          kind: RESOLUTION_RESULT_KINDS.DEFAULT_USED,
          defaultValue: variable.defaultValue,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: RESOLUTION_RESULT_KINDS.VARIABLE_NOT_FOUND,
        variable: variable.name,
        availableVariables: Object.keys(data),
      },
    };
  }

  /**
   * Resolve path variable using PropertyPathNavigator
   */
  private resolvePathVariable(
    variable: TemplateVariable & { kind: "PathVariable" },
    data: Record<string, unknown>,
    useDefaults: boolean,
  ): Result<VariableResolutionResult, DomainError & { message: string }> {
    const navigationResult = this.pathNavigator.navigate(data, variable.path);
    if (!navigationResult.ok) {
      return navigationResult;
    }

    switch (navigationResult.data.kind) {
      case PATH_NAVIGATION_KINDS.SUCCESS:
        return {
          ok: true,
          data: {
            kind: RESOLUTION_RESULT_KINDS.SUCCESS,
            resolvedValue: String(navigationResult.data.value),
          },
        };

      case "PathNotFound":
      case "TypeMismatch":
        if (useDefaults && variable.defaultValue !== undefined) {
          return {
            ok: true,
            data: {
              kind: RESOLUTION_RESULT_KINDS.DEFAULT_USED,
              defaultValue: variable.defaultValue,
            },
          };
        }

        return {
          ok: true,
          data: {
            kind: RESOLUTION_RESULT_KINDS.PATH_NOT_RESOLVED,
            path: variable.path.toString(),
            reason: navigationResult.data.kind,
          },
        };

      default: {
        // Exhaustive check
        const _exhaustiveCheck: never = navigationResult.data;
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidState",
            expected: "known navigation result",
            actual: String(_exhaustiveCheck),
          }),
        };
      }
    }
  }

  /**
   * Resolve conditional variable
   */
  private resolveConditionalVariable(
    variable: TemplateVariable & { kind: "ConditionalVariable" },
    data: Record<string, unknown>,
    _useDefaults: boolean,
  ): Result<VariableResolutionResult, DomainError & { message: string }> {
    try {
      // Simple condition evaluation - checks if property exists and is truthy
      const conditionResult = this.evaluateCondition(variable.condition, data);

      return {
        ok: true,
        data: {
          kind: RESOLUTION_RESULT_KINDS.SUCCESS,
          resolvedValue: conditionResult
            ? variable.trueValue
            : variable.falseValue,
        },
      };
    } catch (error) {
      return {
        ok: true,
        data: {
          kind: RESOLUTION_RESULT_KINDS.CONDITIONAL_EVALUATION_FAILED,
          condition: variable.condition,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Simple condition evaluation for safety
   * Only supports property existence and truthiness checks
   */
  private evaluateCondition(
    condition: string,
    data: Record<string, unknown>,
  ): boolean {
    // Simple implementation - just check if the property exists and is truthy
    const propertyName = condition.trim();

    if (propertyName in data) {
      const value = data[propertyName];
      return Boolean(value);
    }

    return false;
  }

  /**
   * Get error message for resolution result
   */
  getResolutionErrorMessage(result: VariableResolutionResult): string {
    switch (result.kind) {
      case "VariableNotFound":
        return `Variable '${result.variable}' not found. Available: ${
          result.availableVariables.join(", ")
        }`;

      case "PathNotResolved":
        return `Path '${result.path}' could not be resolved: ${result.reason}`;

      case "ConditionalEvaluationFailed":
        return `Conditional '${result.condition}' evaluation failed: ${result.error}`;

      default:
        return "Unknown resolution error";
    }
  }
}
