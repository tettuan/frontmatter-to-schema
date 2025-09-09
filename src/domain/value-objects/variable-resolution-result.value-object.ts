/**
 * Variable Resolution Result Value Objects
 * Extracted from template-variable-resolver.ts for better domain separation
 * Represents the results of variable resolution operations following DDD principles
 */

/**
 * Variable Resolution Result - Discriminated Union following Totality principle
 */
export type VariableResolutionResult =
  | {
    kind: "Success";
    resolvedValue: string;
  }
  | {
    kind: "DefaultUsed";
    defaultValue: string;
  }
  | {
    kind: "VariableNotFound";
    variable: string;
    availableVariables: string[];
  }
  | {
    kind: "PathNotResolved";
    path: string;
    reason: string;
  }
  | {
    kind: "ConditionalEvaluationFailed";
    condition: string;
    error: string;
  };

/**
 * Template Processing Result - Discriminated Union following Totality principle
 */
export type TemplateProcessingResult =
  | {
    kind: "Success";
    processedTemplate: string;
    resolvedVariables: string[];
  }
  | {
    kind: "PartialSuccess";
    processedTemplate: string;
    resolvedVariables: string[];
    unresolvedVariables: Array<{
      name: string;
      placeholder: string;
      reason: string;
    }>;
  }
  | {
    kind: "ProcessingFailed";
    errors: Array<{
      variable: string;
      error: string;
    }>;
  };

/**
 * Template Processing Error
 */
export interface TemplateProcessingError {
  variable: string;
  error: string;
}
