/**
 * Template Variable Type Discriminated Union
 *
 * Implements Totality principles by replacing optional properties with tagged unions.
 * Provides exhaustive pattern matching for template variable handling.
 *
 * Design Philosophy:
 * - Total functions: All cases explicitly handled
 * - Type safety: Compile-time verification of exhaustive matching
 * - Domain modeling: Accurate representation of business rules
 */

import {
  ARRAY_EXPANSION_MARKER,
  SPECIAL_VARIABLE_PREFIX as _SPECIAL_VARIABLE_PREFIX,
} from "../constants/template-variable-constants.ts";

/**
 * Discriminated union representing all possible template variable types.
 * Replaces partial pattern matching with exhaustive type-safe patterns.
 */
export type TemplateVariableType =
  | StandardVariable
  | ArrayExpansionVariable
  | SpecialProcessorVariable;

/**
 * Standard template variable: {variableName}
 */
export interface StandardVariable {
  readonly kind: "StandardVariable";
  readonly name: string;
}

/**
 * Array expansion variable: {@items}
 * Special case for dynamic array insertion in templates.
 */
export interface ArrayExpansionVariable {
  readonly kind: "ArrayExpansionVariable";
  readonly marker: typeof ARRAY_EXPANSION_MARKER;
}

/**
 * Special processor variable: {@processor}
 * For future extensibility of special processing markers.
 */
export interface SpecialProcessorVariable {
  readonly kind: "SpecialProcessorVariable";
  readonly marker: string;
}

/**
 * Type guard for StandardVariable
 */
export function isStandardVariable(
  variable: TemplateVariableType,
): variable is StandardVariable {
  return variable.kind === "StandardVariable";
}

/**
 * Type guard for ArrayExpansionVariable
 */
export function isArrayExpansionVariable(
  variable: TemplateVariableType,
): variable is ArrayExpansionVariable {
  return variable.kind === "ArrayExpansionVariable";
}

/**
 * Type guard for SpecialProcessorVariable
 */
export function isSpecialProcessorVariable(
  variable: TemplateVariableType,
): variable is SpecialProcessorVariable {
  return variable.kind === "SpecialProcessorVariable";
}

/**
 * Factory functions for creating template variables with type safety.
 */
export const TemplateVariableType = {
  /**
   * Creates a standard variable instance.
   */
  standard(name: string): StandardVariable {
    return {
      kind: "StandardVariable",
      name,
    };
  },

  /**
   * Creates an array expansion variable instance.
   */
  arrayExpansion(): ArrayExpansionVariable {
    return {
      kind: "ArrayExpansionVariable",
      marker: ARRAY_EXPANSION_MARKER,
    };
  },

  /**
   * Creates a special processor variable instance.
   */
  specialProcessor(marker: string): SpecialProcessorVariable {
    return {
      kind: "SpecialProcessorVariable",
      marker,
    };
  },
} as const;

/**
 * Pattern matching helper for exhaustive handling of template variable types.
 * Ensures all cases are handled at compile time.
 */
export function matchTemplateVariableType<R>(
  variable: TemplateVariableType,
  cases: {
    StandardVariable: (variable: StandardVariable) => R;
    ArrayExpansionVariable: (variable: ArrayExpansionVariable) => R;
    SpecialProcessorVariable: (variable: SpecialProcessorVariable) => R;
  },
): R {
  switch (variable.kind) {
    case "StandardVariable":
      return cases.StandardVariable(variable);
    case "ArrayExpansionVariable":
      return cases.ArrayExpansionVariable(variable);
    case "SpecialProcessorVariable":
      return cases.SpecialProcessorVariable(variable);
  }
}
