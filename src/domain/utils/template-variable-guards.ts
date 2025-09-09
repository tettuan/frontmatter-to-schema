/**
 * Template Variable Type Guards
 * Extracted from template-variable-resolver.ts for better domain separation
 * Provides type guards for discriminated union results following Totality principles
 */

import type { TemplateVariable } from "../value-objects/template-variable.value-object.ts";
import type {
  TemplateProcessingResult,
  VariableResolutionResult,
} from "../value-objects/variable-resolution-result.value-object.ts";

/**
 * Type guards for Template Variable discriminated unions
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

/**
 * Type guards for Variable Resolution Result discriminated unions
 */
export function isResolutionSuccess(
  result: VariableResolutionResult,
): result is { kind: "Success"; resolvedValue: string } {
  return result.kind === "Success";
}

export function isDefaultUsed(
  result: VariableResolutionResult,
): result is { kind: "DefaultUsed"; defaultValue: string } {
  return result.kind === "DefaultUsed";
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

export function isPathNotResolved(
  result: VariableResolutionResult,
): result is {
  kind: "PathNotResolved";
  path: string;
  reason: string;
} {
  return result.kind === "PathNotResolved";
}

export function isConditionalEvaluationFailed(
  result: VariableResolutionResult,
): result is {
  kind: "ConditionalEvaluationFailed";
  condition: string;
  error: string;
} {
  return result.kind === "ConditionalEvaluationFailed";
}

/**
 * Type guards for Template Processing Result discriminated unions
 */
export function isProcessingSuccess(
  result: TemplateProcessingResult,
): result is {
  kind: "Success";
  processedTemplate: string;
  resolvedVariables: string[];
} {
  return result.kind === "Success";
}

export function isPartialSuccess(
  result: TemplateProcessingResult,
): result is {
  kind: "PartialSuccess";
  processedTemplate: string;
  resolvedVariables: string[];
  unresolvedVariables: Array<{
    name: string;
    placeholder: string;
    reason: string;
  }>;
} {
  return result.kind === "PartialSuccess";
}

export function isProcessingFailed(
  result: TemplateProcessingResult,
): result is {
  kind: "ProcessingFailed";
  errors: Array<{
    variable: string;
    error: string;
  }>;
} {
  return result.kind === "ProcessingFailed";
}
