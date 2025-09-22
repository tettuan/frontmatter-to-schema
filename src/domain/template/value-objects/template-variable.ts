/**
 * Template Variable Smart Constructor
 *
 * Implements Totality principles through constrained value types.
 * Replaces scattered string validation with centralized type-safe creation.
 *
 * Design Philosophy:
 * - Smart Constructor pattern: Private constructor + static factory
 * - Result types: All operations return Result<T, E>
 * - Validation consolidation: Single point of template variable validation
 */

import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import {
  ARRAY_EXPANSION_MARKER,
  ARRAY_EXPANSION_PLACEHOLDER,
  ERROR_MESSAGES,
  SPECIAL_VARIABLE_PREFIX,
  TEMPLATE_VARIABLE_PATTERNS,
} from "../constants/template-variable-constants.ts";
import { TemplateVariableType } from "./template-variable-type.ts";

/**
 * Template Variable value object with constrained construction.
 * Ensures all template variables are valid and type-safe.
 */
export class TemplateVariable {
  private constructor(
    private readonly _type: TemplateVariableType,
    private readonly _originalPattern: string,
  ) {}

  /**
   * Gets the template variable type.
   */
  get type(): TemplateVariableType {
    return this._type;
  }

  /**
   * Gets the original pattern that created this variable.
   */
  get originalPattern(): string {
    return this._originalPattern;
  }

  /**
   * Gets the variable name for display purposes.
   */
  get displayName(): string {
    switch (this._type.kind) {
      case "StandardVariable":
        return this._type.name;
      case "ArrayExpansionVariable":
        return this._type.marker;
      case "SpecialProcessorVariable":
        return this._type.marker;
      default: {
        // This should never happen due to exhaustive matching
        const _exhaustiveCheck: never = this._type;
        // Following Totality principles: return safe fallback instead of throwing
        return `[UNKNOWN_TYPE:${JSON.stringify(_exhaustiveCheck)}]`;
      }
    }
  }

  /**
   * Checks if this is an array expansion variable.
   */
  get isArrayExpansion(): boolean {
    return this._type.kind === "ArrayExpansionVariable";
  }

  /**
   * Checks if this is a standard variable.
   */
  get isStandard(): boolean {
    return this._type.kind === "StandardVariable";
  }

  /**
   * Checks if this is a special processor variable.
   */
  get isSpecialProcessor(): boolean {
    return this._type.kind === "SpecialProcessorVariable";
  }

  /**
   * Creates a TemplateVariable from a variable name (without braces).
   * Performs validation and type classification.
   */
  static create(
    variableName: string,
  ): Result<TemplateVariable, TemplateError & { message: string }> {
    if (!variableName || variableName.trim().length === 0) {
      return ErrorHandler.template({
        operation: "create",
        method: "validateVariableName",
      }).variableNotFound(variableName || "[empty]");
    }

    const trimmed = variableName.trim();

    // Check for array expansion marker
    if (trimmed === ARRAY_EXPANSION_MARKER) {
      return ok(
        new TemplateVariable(
          TemplateVariableType.arrayExpansion(),
          `{${trimmed}}`,
        ),
      );
    }

    // Check for special processor variables
    if (trimmed.startsWith(SPECIAL_VARIABLE_PREFIX)) {
      return ok(
        new TemplateVariable(
          TemplateVariableType.specialProcessor(trimmed),
          `{${trimmed}}`,
        ),
      );
    }

    // Validate standard variable name
    if (!this.isValidVariableName(trimmed)) {
      return ErrorHandler.template({
        operation: "create",
        method: "validatePattern",
      }).invalid(ERROR_MESSAGES.INVALID_VARIABLE_PATTERN(trimmed));
    }

    return ok(
      new TemplateVariable(
        TemplateVariableType.standard(trimmed),
        `{${trimmed}}`,
      ),
    );
  }

  /**
   * Creates a TemplateVariable from a template placeholder (with braces).
   * Example: "{variableName}" or "{@items}"
   */
  static fromPlaceholder(
    placeholder: string,
  ): Result<TemplateVariable, TemplateError & { message: string }> {
    if (!placeholder || placeholder.trim().length === 0) {
      return ErrorHandler.template({
        operation: "fromPlaceholder",
        method: "validateInput",
      }).variableNotFound(placeholder || "[empty]");
    }

    const trimmed = placeholder.trim();

    // Extract variable name from braces
    const match = trimmed.match(/^\{([^}]+)\}$/);
    if (!match) {
      return ErrorHandler.template({
        operation: "fromPlaceholder",
        method: "parseFormat",
      }).invalid("Invalid placeholder format, expected {variableName}");
    }

    const variableName = match[1];
    const result = this.create(variableName);

    if (!result.ok) {
      return result;
    }

    // Update original pattern to match input
    return ok(
      new TemplateVariable(
        result.data._type,
        trimmed,
      ),
    );
  }

  /**
   * Creates the array expansion variable specifically.
   * Convenience method for the common {@items} case.
   */
  static arrayExpansion(): TemplateVariable {
    return new TemplateVariable(
      TemplateVariableType.arrayExpansion(),
      ARRAY_EXPANSION_PLACEHOLDER,
    );
  }

  /**
   * Validates if a variable name follows standard naming conventions.
   */
  private static isValidVariableName(name: string): boolean {
    // Allow alphanumeric, underscore, dot notation for nested properties
    return /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(name);
  }

  /**
   * Extracts all template variables from a template string.
   */
  static extractFromTemplate(
    template: string,
  ): Result<TemplateVariable[], TemplateError & { message: string }> {
    const variables: TemplateVariable[] = [];
    const placeholders = new Set<string>();

    // Find all variable patterns
    const patterns = [
      TEMPLATE_VARIABLE_PATTERNS.STANDARD,
      TEMPLATE_VARIABLE_PATTERNS.ARRAY_EXPANSION,
      TEMPLATE_VARIABLE_PATTERNS.SPECIAL_PROCESSOR,
    ];

    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex state
      while ((match = pattern.exec(template)) !== null) {
        placeholders.add(match[0]);
      }
    }

    // Create TemplateVariable instances
    for (const placeholder of placeholders) {
      const result = this.fromPlaceholder(placeholder);
      if (!result.ok) {
        return result;
      }
      variables.push(result.data);
    }

    return ok(variables);
  }

  /**
   * Equality comparison for template variables.
   */
  equals(other: TemplateVariable): boolean {
    return this._originalPattern === other._originalPattern &&
      this._type.kind === other._type.kind;
  }

  /**
   * String representation for debugging.
   */
  toString(): string {
    return `TemplateVariable(${this._type.kind}: ${this._originalPattern})`;
  }
}

/**
 * Type alias for better readability in function signatures.
 */
export type TemplateVariableResult = Result<
  TemplateVariable,
  TemplateError & { message: string }
>;
export type TemplateVariableArrayResult = Result<
  TemplateVariable[],
  TemplateError & { message: string }
>;
