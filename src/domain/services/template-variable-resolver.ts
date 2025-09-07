/**
 * TemplateVariableResolver Domain Service
 *
 * Implements totality principle for template variable identification,
 * validation, and substitution with explicit error handling.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { ResultHandlerService } from "./result-handler-service.ts";
import {
  PropertyPath,
  PropertyPathNavigator,
} from "../models/property-path.ts";

/**
 * Template Variable Types - Discriminated Union following Totality principle
 */
export type TemplateVariable =
  | {
    kind: "SimpleVariable";
    name: string;
    placeholder: string;
    defaultValue?: string;
  }
  | {
    kind: "PathVariable";
    name: string;
    path: PropertyPath;
    placeholder: string;
    defaultValue?: string;
  }
  | {
    kind: "ConditionalVariable";
    name: string;
    condition: string;
    trueValue: string;
    falseValue: string;
    placeholder: string;
  };

/**
 * Variable Resolution Result - Discriminated Union following Totality principle
 */
export type VariableResolutionResult =
  | { kind: "Success"; resolvedValue: string }
  | { kind: "VariableNotFound"; variable: string; availableVariables: string[] }
  | { kind: "PathNotResolved"; variable: string; path: string; reason: string }
  | { kind: "DefaultUsed"; variable: string; defaultValue: string }
  | {
    kind: "ConditionalEvaluationFailed";
    variable: string;
    condition: string;
    error: string;
  };

/**
 * Template Processing Result - Discriminated Union following Totality principle
 */
export type TemplateProcessingResult =
  | { kind: "Success"; processedTemplate: string; resolvedVariables: string[] }
  | {
    kind: "PartialSuccess";
    processedTemplate: string;
    resolvedVariables: string[];
    unresolvedVariables: TemplateVariable[];
  }
  | {
    kind: "ProcessingFailed";
    errors: Array<{ variable: string; error: string }>;
  };

/**
 * TemplateVariableResolver Domain Service
 * Handles all template variable operations following totality principles
 */
export class TemplateVariableResolver {
  private readonly pathNavigator: PropertyPathNavigator;

  private constructor(pathNavigator: PropertyPathNavigator) {
    this.pathNavigator = pathNavigator;
  }

  /**
   * Smart Constructor for TemplateVariableResolver
   */
  static create(): Result<
    TemplateVariableResolver,
    DomainError & { message: string }
  > {
    return ResultHandlerService.map(
      PropertyPathNavigator.create(),
      (navigator) => new TemplateVariableResolver(navigator),
      {
        operation: "create",
        component: "TemplateVariableResolver",
        expectedType: "PropertyPathNavigator",
      },
    );
  }

  /**
   * Extract variables from template content
   * Supports patterns: {{variableName}}, {{path.to.value}}, {{condition ? trueValue : falseValue}}
   */
  extractVariables(
    templateContent: string,
  ): Result<TemplateVariable[], DomainError & { message: string }> {
    if (!templateContent || templateContent.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "templateContent",
        }, "Template content cannot be empty"),
      };
    }

    const variables: TemplateVariable[] = [];
    const variablePattern = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = variablePattern.exec(templateContent)) !== null) {
      const placeholder = match[0]; // Full {{...}} string
      const content = match[1].trim();

      const variableResult = this.parseVariableContent(content, placeholder);
      if (!variableResult.ok) {
        return variableResult;
      }

      // Check for duplicate variables
      const existingVariable = variables.find((v) =>
        v.placeholder === placeholder
      );
      if (!existingVariable) {
        variables.push(variableResult.data);
      }
    }

    return { ok: true, data: variables };
  }

  /**
   * Resolve variables in template using provided data
   */
  resolveVariables(
    templateContent: string,
    data: Record<string, unknown>,
    options: {
      allowPartialResolution?: boolean;
      useDefaults?: boolean;
    } = {},
  ): Result<TemplateProcessingResult, DomainError & { message: string }> {
    const { allowPartialResolution = false, useDefaults = true } = options;

    // Extract variables first
    const variablesResult = this.extractVariables(templateContent);
    if (!variablesResult.ok) {
      return variablesResult;
    }

    const variables = variablesResult.data;
    let processedTemplate = templateContent;
    const resolvedVariables: string[] = [];
    const unresolvedVariables: TemplateVariable[] = [];
    const errors: Array<{ variable: string; error: string }> = [];

    // Process each variable
    for (const variable of variables) {
      const resolutionResult = this.resolveVariable(
        variable,
        data,
        useDefaults,
      );

      if (!resolutionResult.ok) {
        errors.push({
          variable: variable.name,
          error: resolutionResult.error.message,
        });
        continue;
      }

      switch (resolutionResult.data.kind) {
        case "Success":
        case "DefaultUsed":
          processedTemplate = processedTemplate.replace(
            new RegExp(this.escapeRegExp(variable.placeholder), "g"),
            resolutionResult.data.kind === "Success"
              ? resolutionResult.data.resolvedValue
              : resolutionResult.data.defaultValue,
          );
          resolvedVariables.push(variable.name);
          break;

        case "VariableNotFound":
        case "PathNotResolved":
        case "ConditionalEvaluationFailed":
          unresolvedVariables.push(variable);
          if (!allowPartialResolution) {
            errors.push({
              variable: variable.name,
              error: this.getResolutionErrorMessage(resolutionResult.data),
            });
          }
          break;

        default: {
          // Exhaustive check - TypeScript will error if we miss a case
          const _exhaustiveCheck: never = resolutionResult.data;
          errors.push({
            variable: variable.name,
            error: `Unhandled resolution result: ${String(_exhaustiveCheck)}`,
          });
        }
      }
    }

    // Determine result type
    if (errors.length > 0 && !allowPartialResolution) {
      return {
        ok: true,
        data: {
          kind: "ProcessingFailed",
          errors,
        },
      };
    }

    if (unresolvedVariables.length > 0) {
      return {
        ok: true,
        data: {
          kind: "PartialSuccess",
          processedTemplate,
          resolvedVariables,
          unresolvedVariables,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: "Success",
        processedTemplate,
        resolvedVariables,
      },
    };
  }

  /**
   * Parse variable content to determine variable type
   */
  private parseVariableContent(
    content: string,
    placeholder: string,
  ): Result<TemplateVariable, DomainError & { message: string }> {
    // Check for conditional variable (contains ? and :)
    if (content.includes("?") && content.includes(":")) {
      return this.parseConditionalVariable(content, placeholder);
    }

    // Check for path variable (contains dots)
    if (content.includes(".")) {
      return this.parsePathVariable(content, placeholder);
    }

    // Default to simple variable
    return this.parseSimpleVariable(content, placeholder);
  }

  /**
   * Parse simple variable: {{variableName}} or {{variableName|defaultValue}}
   */
  private parseSimpleVariable(
    content: string,
    placeholder: string,
  ): Result<TemplateVariable, DomainError & { message: string }> {
    const parts = content.split("|");
    const name = parts[0].trim();
    const defaultValue = parts[1]?.trim();

    if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: content,
          expectedFormat: "validVariableName",
        }, `Invalid variable name: ${name}`),
      };
    }

    return {
      ok: true,
      data: {
        kind: "SimpleVariable",
        name,
        placeholder,
        defaultValue,
      },
    };
  }

  /**
   * Parse path variable: {{path.to.value}} or {{path.to.value|defaultValue}}
   */
  private parsePathVariable(
    content: string,
    placeholder: string,
  ): Result<TemplateVariable, DomainError & { message: string }> {
    const parts = content.split("|");
    const pathString = parts[0].trim();
    const defaultValue = parts[1]?.trim();

    return ResultHandlerService.map(
      PropertyPath.create(pathString),
      (path): TemplateVariable => ({
        kind: "PathVariable",
        name: pathString.replace(/\./g, "_"),
        path,
        placeholder,
        defaultValue,
      }),
      {
        operation: "parsePathVariable",
        component: "TemplateVariableResolver",
        input: pathString,
        expectedType: "PropertyPath",
      },
    );
  }

  /**
   * Parse conditional variable: {{condition ? trueValue : falseValue}}
   */
  private parseConditionalVariable(
    content: string,
    placeholder: string,
  ): Result<TemplateVariable, DomainError & { message: string }> {
    const questionMarkIndex = content.indexOf("?");
    const colonIndex = content.lastIndexOf(":");

    if (
      questionMarkIndex === -1 || colonIndex === -1 ||
      questionMarkIndex >= colonIndex
    ) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: content,
          expectedFormat: "condition ? trueValue : falseValue",
        }, "Invalid conditional variable format"),
      };
    }

    const condition = content.substring(0, questionMarkIndex).trim();
    const trueValue = content.substring(questionMarkIndex + 1, colonIndex)
      .trim();
    const falseValue = content.substring(colonIndex + 1).trim();

    if (!condition || !trueValue || !falseValue) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: content,
          expectedFormat: "condition ? trueValue : falseValue",
        }, "Conditional variable parts cannot be empty"),
      };
    }

    return {
      ok: true,
      data: {
        kind: "ConditionalVariable",
        name: `conditional_${condition.replace(/[^a-zA-Z0-9_]/g, "_")}`,
        condition,
        trueValue,
        falseValue,
        placeholder,
      },
    };
  }

  /**
   * Resolve single variable against data
   */
  private resolveVariable(
    variable: TemplateVariable,
    data: Record<string, unknown>,
    useDefaults: boolean,
  ): Result<VariableResolutionResult, DomainError & { message: string }> {
    switch (variable.kind) {
      case "SimpleVariable":
        return this.resolveSimpleVariable(variable, data, useDefaults);
      case "PathVariable":
        return this.resolvePathVariable(variable, data, useDefaults);
      case "ConditionalVariable":
        return this.resolveConditionalVariable(variable, data);
      default: {
        // Exhaustive check - TypeScript will error if we miss a case
        const _exhaustiveCheck: never = variable;
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidState",
            expected: "SimpleVariable, PathVariable, or ConditionalVariable",
            actual: String(_exhaustiveCheck),
          }, `Unhandled variable type: ${String(_exhaustiveCheck)}`),
        };
      }
    }
  }

  /**
   * Resolve simple variable
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
          kind: "Success",
          resolvedValue: String(value),
        },
      };
    }

    if (useDefaults && variable.defaultValue !== undefined) {
      return {
        ok: true,
        data: {
          kind: "DefaultUsed",
          variable: variable.name,
          defaultValue: variable.defaultValue,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: "VariableNotFound",
        variable: variable.name,
        availableVariables: Object.keys(data),
      },
    };
  }

  /**
   * Resolve path variable
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
      case "Success":
        return {
          ok: true,
          data: {
            kind: "Success",
            resolvedValue: String(navigationResult.data.value),
          },
        };

      case "PathNotFound":
      case "TypeMismatch":
        if (useDefaults && variable.defaultValue !== undefined) {
          return {
            ok: true,
            data: {
              kind: "DefaultUsed",
              variable: variable.name,
              defaultValue: variable.defaultValue,
            },
          };
        }

        return {
          ok: true,
          data: {
            kind: "PathNotResolved",
            variable: variable.name,
            path: variable.path.getPath(),
            reason: navigationResult.data.kind === "PathNotFound"
              ? `Path segment '${navigationResult.data.missingSegment}' not found`
              : `Type mismatch at segment '${navigationResult.data.segment}'`,
          },
        };

      default: {
        // Exhaustive check - TypeScript will error if we miss a case
        const _exhaustiveCheck: never = navigationResult.data;
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidState",
            expected: "Success, PathNotFound, or TypeMismatch",
            actual: String(_exhaustiveCheck),
          }, `Unhandled navigation result: ${String(_exhaustiveCheck)}`),
        };
      }
    }
  }

  /**
   * Resolve conditional variable (simplified implementation)
   */
  private resolveConditionalVariable(
    variable: TemplateVariable & { kind: "ConditionalVariable" },
    data: Record<string, unknown>,
  ): Result<VariableResolutionResult, DomainError & { message: string }> {
    // Simplified condition evaluation - check if condition exists in data and is truthy
    const conditionValue = data[variable.condition];
    const isTrue = Boolean(conditionValue);

    return {
      ok: true,
      data: {
        kind: "Success",
        resolvedValue: isTrue ? variable.trueValue : variable.falseValue,
      },
    };
  }

  /**
   * Get error message for resolution result
   */
  private getResolutionErrorMessage(result: VariableResolutionResult): string {
    switch (result.kind) {
      case "VariableNotFound":
        return `Variable '${result.variable}' not found. Available: ${
          result.availableVariables.join(", ")
        }`;
      case "PathNotResolved":
        return `Path '${result.path}' could not be resolved: ${result.reason}`;
      case "ConditionalEvaluationFailed":
        return `Conditional evaluation failed for '${result.variable}': ${result.error}`;
      default:
        return "Unknown resolution error";
    }
  }

  /**
   * Escape special regex characters for string replacement
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

/**
 * Type guards for discriminated union results
 */
export function isSimpleVariable(
  variable: TemplateVariable,
): variable is TemplateVariable & { kind: "SimpleVariable" } {
  return variable.kind === "SimpleVariable";
}

export function isPathVariable(
  variable: TemplateVariable,
): variable is TemplateVariable & { kind: "PathVariable" } {
  return variable.kind === "PathVariable";
}

export function isConditionalVariable(
  variable: TemplateVariable,
): variable is TemplateVariable & { kind: "ConditionalVariable" } {
  return variable.kind === "ConditionalVariable";
}

export function isResolutionSuccess(
  result: VariableResolutionResult,
): result is { kind: "Success"; resolvedValue: string } {
  return result.kind === "Success";
}

export function isVariableNotFound(
  result: VariableResolutionResult,
): result is {
  kind: "VariableNotFound";
  variable: string;
  availableVariables: string[];
} {
  return result.kind === "VariableNotFound";
}

export function isProcessingSuccess(
  result: TemplateProcessingResult,
): result is {
  kind: "Success";
  processedTemplate: string;
  resolvedVariables: string[];
} {
  return result.kind === "Success";
}
