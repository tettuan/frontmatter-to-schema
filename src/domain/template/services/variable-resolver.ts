/**
 * VariableResolver Domain Service
 *
 * Handles variable resolution, transformation, merging, and filtering operations
 * Encapsulates complex variable manipulation logic
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import type {
  VariableInfo,
  VariableValue,
} from "../value-objects/variable-map.ts";
import { VariableValidator } from "./variable-validator.ts";

/**
 * Domain service for variable resolution and transformation
 * Handles complex operations on variable collections
 */
export class VariableResolver {
  /**
   * Merge two variable maps with conflict resolution
   */
  static mergeVariables(
    primary: ReadonlyMap<string, VariableInfo>,
    secondary: ReadonlyMap<string, VariableInfo>,
    overwrite = false,
  ): Result<Map<string, VariableInfo>, DomainError & { message: string }> {
    const mergedVariables = new Map(primary);

    for (const [name, info] of secondary) {
      if (mergedVariables.has(name) && !overwrite) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: name,
              expectedFormat: "unique variable name",
            },
            `Variable '${name}' already exists. Use overwrite=true to replace it.`,
          ),
        };
      }

      mergedVariables.set(name, { ...info });
    }

    return { ok: true, data: mergedVariables };
  }

  /**
   * Filter variables based on predicate function
   */
  static filterVariables(
    variables: ReadonlyMap<string, VariableInfo>,
    predicate: (name: string, info: VariableInfo) => boolean,
  ): Map<string, VariableInfo> {
    const filteredVariables = new Map<string, VariableInfo>();

    for (const [name, info] of variables) {
      if (predicate(name, info)) {
        filteredVariables.set(name, { ...info });
      }
    }

    return filteredVariables;
  }

  /**
   * Transform variables using a transformation function
   */
  static transformVariables(
    variables: ReadonlyMap<string, VariableInfo>,
    transformer: (name: string, value: VariableValue) => VariableValue,
  ): Result<Map<string, VariableInfo>, DomainError & { message: string }> {
    const transformedVariables = new Map<string, VariableInfo>();

    for (const [name, info] of variables) {
      try {
        const transformedValue = transformer(name, info.value);

        // Validate the transformed value
        const validation = VariableValidator.validateVariableValue(
          transformedValue,
        );
        if (!validation.ok) {
          return validation;
        }

        transformedVariables.set(name, {
          ...info,
          value: transformedValue,
          type: VariableValidator.getValueType(transformedValue),
        });
      } catch (error) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: name,
              expectedFormat: "transformable variable",
            },
            `Failed to transform variable '${name}': ${String(error)}`,
          ),
        };
      }
    }

    return { ok: true, data: transformedVariables };
  }

  /**
   * Get variables by type
   */
  static getVariablesByType(
    variables: ReadonlyMap<string, VariableInfo>,
    type: string,
  ): Array<[string, VariableInfo]> {
    const result: Array<[string, VariableInfo]> = [];

    for (const [name, info] of variables) {
      if (info.type === type) {
        result.push([name, { ...info }]);
      }
    }

    return result;
  }

  /**
   * Resolve variable with default fallback
   */
  static resolveVariableWithDefault(
    variables: ReadonlyMap<string, VariableInfo>,
    name: string,
    defaultValue?: VariableValue,
  ): VariableValue | undefined {
    const info = variables.get(name);

    if (info !== undefined) {
      // Variable exists, return its value or its defined default
      if (info.value !== undefined && info.value !== null) {
        return info.value;
      }

      if (info.defaultValue !== undefined) {
        return info.defaultValue;
      }
    }

    // Variable doesn't exist, return the provided default
    return defaultValue;
  }

  /**
   * Get required variables that are missing values
   */
  static getMissingRequiredVariables(
    variables: ReadonlyMap<string, VariableInfo>,
  ): string[] {
    const missing: string[] = [];

    for (const [name, info] of variables) {
      if (info.required && (info.value === null || info.value === undefined)) {
        missing.push(name);
      }
    }

    return missing;
  }

  /**
   * Validate all required variables are present
   */
  static validateRequiredVariables(
    variables: ReadonlyMap<string, VariableInfo>,
  ): Result<void, DomainError & { message: string }> {
    const missing = VariableResolver.getMissingRequiredVariables(variables);

    if (missing.length > 0) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: missing.join(", "),
            expectedFormat: "required variables with values",
          },
          `Missing required variables: ${missing.join(", ")}`,
        ),
      };
    }

    return { ok: true, data: undefined };
  }

  /**
   * Convert variables to plain object
   */
  static toPlainObject(
    variables: ReadonlyMap<string, VariableInfo>,
  ): Record<string, VariableValue> {
    const result: Record<string, VariableValue> = {};

    for (const [name, info] of variables) {
      result[name] = info.value;
    }

    return result;
  }

  /**
   * Create variable info from value
   */
  static createVariableInfo(
    value: VariableValue,
    options?: {
      required?: boolean;
      description?: string;
      defaultValue?: VariableValue;
    },
  ): VariableInfo {
    return {
      value,
      type: VariableValidator.getValueType(value),
      required: options?.required,
      description: options?.description,
      defaultValue: options?.defaultValue,
    };
  }

  /**
   * Deep clone variable value
   */
  static cloneVariableValue(value: VariableValue): VariableValue {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => VariableResolver.cloneVariableValue(item));
    }

    const cloned: { [key: string]: VariableValue } = {};
    for (const [key, val] of Object.entries(value)) {
      cloned[key] = VariableResolver.cloneVariableValue(val);
    }

    return cloned;
  }
}
