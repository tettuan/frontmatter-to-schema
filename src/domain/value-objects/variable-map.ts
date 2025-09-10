/**
 * VariableMap Value Object
 *
 * Represents a validated mapping of variables to values for template processing
 * Follows Totality principles with Smart Constructor pattern
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";

/**
 * Variable value types as discriminated union
 */
export type VariableValue =
  | string
  | number
  | boolean
  | null
  | VariableValue[]
  | { [key: string]: VariableValue };

/**
 * Variable metadata interface
 */
export interface VariableInfo {
  readonly value: VariableValue;
  readonly type: string;
  readonly required?: boolean;
  readonly description?: string;
  readonly defaultValue?: VariableValue;
}

/**
 * VariableMap value object with validation
 * Ensures variable mappings are valid and type-safe
 */
export class VariableMap {
  private constructor(
    private readonly variables: ReadonlyMap<string, VariableInfo>,
  ) {}

  /**
   * Smart Constructor for VariableMap
   * Validates variable names and values
   */
  static create(
    variables: Record<string, VariableValue> | Map<string, VariableValue>,
  ): Result<VariableMap, DomainError & { message: string }> {
    const variableMap = new Map<string, VariableInfo>();

    // Convert input to iterable entries
    const entries = variables instanceof Map
      ? variables.entries()
      : Object.entries(variables);

    for (const [name, value] of entries) {
      // Validate variable name
      const nameValidation = VariableMap.validateVariableName(name);
      if (!nameValidation.ok) {
        return nameValidation;
      }

      // Validate variable value
      const valueValidation = VariableMap.validateVariableValue(value);
      if (!valueValidation.ok) {
        return valueValidation;
      }

      // Create variable info
      const variableInfo: VariableInfo = {
        value,
        type: VariableMap.getValueType(value),
      };

      variableMap.set(name, variableInfo);
    }

    return {
      ok: true,
      data: new VariableMap(variableMap),
    };
  }

  /**
   * Create from variable info objects
   */
  static createFromInfo(
    variables: Record<string, VariableInfo> | Map<string, VariableInfo>,
  ): Result<VariableMap, DomainError & { message: string }> {
    const variableMap = new Map<string, VariableInfo>();

    // Convert input to iterable entries
    const entries = variables instanceof Map
      ? variables.entries()
      : Object.entries(variables);

    for (const [name, info] of entries) {
      // Validate variable name
      const nameValidation = VariableMap.validateVariableName(name);
      if (!nameValidation.ok) {
        return nameValidation;
      }

      // Validate variable info
      const infoValidation = VariableMap.validateVariableInfo(info);
      if (!infoValidation.ok) {
        return infoValidation;
      }

      variableMap.set(name, { ...info });
    }

    return {
      ok: true,
      data: new VariableMap(variableMap),
    };
  }

  /**
   * Validate variable name
   */
  private static validateVariableName(
    name: string,
  ): Result<void, DomainError & { message: string }> {
    if (!name || name.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Variable name cannot be empty",
        ),
      };
    }

    const trimmedName = name.trim();

    // Check for valid identifier pattern
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedName)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: trimmedName,
            expectedFormat: "valid identifier (letters, numbers, underscore)",
          },
          "Variable name must be a valid identifier",
        ),
      };
    }

    // Check length
    if (trimmedName.length > 100) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "TooLong",
            value: trimmedName,
            maxLength: 100,
          },
          "Variable name exceeds maximum length of 100 characters",
        ),
      };
    }

    return { ok: true, data: undefined };
  }

  /**
   * Validate variable value
   */
  private static validateVariableValue(
    value: VariableValue,
  ): Result<void, DomainError & { message: string }> {
    // Check for circular references in objects
    try {
      JSON.stringify(value);
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "SerializationError",
            data: String(value),
            format: "JSON",
          },
          `Variable value contains circular reference: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }

    return { ok: true, data: undefined };
  }

  /**
   * Validate variable info
   */
  private static validateVariableInfo(
    info: VariableInfo,
  ): Result<void, DomainError & { message: string }> {
    // Validate value
    const valueValidation = VariableMap.validateVariableValue(info.value);
    if (!valueValidation.ok) {
      return valueValidation;
    }

    // Validate type string
    if (!info.type || info.type.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: info.type || "",
            expectedFormat: "non-empty type string",
          },
          "Variable type must be a non-empty string",
        ),
      };
    }

    // Validate description if provided
    if (info.description !== undefined) {
      if (typeof info.description !== "string") {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(info.description),
              expectedFormat: "string",
            },
            "Variable description must be a string",
          ),
        };
      }
    }

    // Validate default value if provided
    if (info.defaultValue !== undefined) {
      const defaultValidation = VariableMap.validateVariableValue(
        info.defaultValue,
      );
      if (!defaultValidation.ok) {
        return defaultValidation;
      }
    }

    return { ok: true, data: undefined };
  }

  /**
   * Get the type of a variable value
   */
  private static getValueType(value: VariableValue): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
    return typeof value;
  }

  /**
   * Create empty variable map
   */
  static createEmpty(): VariableMap {
    return new VariableMap(new Map());
  }

  /**
   * Get all variable names
   */
  getVariableNames(): string[] {
    return Array.from(this.variables.keys()).sort();
  }

  /**
   * Get variable value by name
   */
  getValue(
    name: string,
  ): Result<VariableValue, DomainError & { message: string }> {
    const info = this.variables.get(name);
    if (!info) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "NotFound",
            resource: "variable",
            name,
          },
          `Variable not found: ${name}`,
        ),
      };
    }
    return { ok: true, data: info.value };
  }

  /**
   * Get variable info by name
   */
  getVariableInfo(
    name: string,
  ): Result<VariableInfo, DomainError & { message: string }> {
    const info = this.variables.get(name);
    if (!info) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "NotFound",
            resource: "variable",
            name,
          },
          `Variable not found: ${name}`,
        ),
      };
    }
    return { ok: true, data: { ...info } };
  }

  /**
   * Check if variable exists
   */
  hasVariable(name: string): boolean {
    return this.variables.has(name);
  }

  /**
   * Get variable count
   */
  count(): number {
    return this.variables.size;
  }

  /**
   * Check if map is empty
   */
  isEmpty(): boolean {
    return this.variables.size === 0;
  }

  /**
   * Get variables by type
   */
  getVariablesByType(type: string): Array<[string, VariableInfo]> {
    const result: Array<[string, VariableInfo]> = [];
    for (const [name, info] of this.variables) {
      if (info.type === type) {
        result.push([name, { ...info }]);
      }
    }
    return result;
  }

  /**
   * Get required variables
   */
  getRequiredVariables(): Array<[string, VariableInfo]> {
    const result: Array<[string, VariableInfo]> = [];
    for (const [name, info] of this.variables) {
      if (info.required === true) {
        result.push([name, { ...info }]);
      }
    }
    return result;
  }

  /**
   * Convert to plain object (values only)
   */
  toObject(): Record<string, VariableValue> {
    const result: Record<string, VariableValue> = {};
    for (const [name, info] of this.variables) {
      result[name] = info.value;
    }
    return result;
  }

  /**
   * Convert to full info object
   */
  toInfoObject(): Record<string, VariableInfo> {
    const result: Record<string, VariableInfo> = {};
    for (const [name, info] of this.variables) {
      result[name] = { ...info };
    }
    return result;
  }

  /**
   * Merge with another variable map
   */
  merge(
    other: VariableMap,
    overwrite = false,
  ): Result<VariableMap, DomainError & { message: string }> {
    const mergedVariables = new Map(this.variables);

    for (const [name, info] of other.variables) {
      if (mergedVariables.has(name) && !overwrite) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: name,
              expectedFormat: "unique variable name",
            },
            `Variable name conflict: ${name} (use overwrite=true to replace)`,
          ),
        };
      }
      mergedVariables.set(name, { ...info });
    }

    return {
      ok: true,
      data: new VariableMap(mergedVariables),
    };
  }

  /**
   * Filter variables by predicate
   */
  filter(
    predicate: (name: string, info: VariableInfo) => boolean,
  ): Result<VariableMap, DomainError & { message: string }> {
    const filteredVariables = new Map<string, VariableInfo>();

    for (const [name, info] of this.variables) {
      if (predicate(name, info)) {
        filteredVariables.set(name, { ...info });
      }
    }

    return {
      ok: true,
      data: new VariableMap(filteredVariables),
    };
  }

  /**
   * Transform variable values
   */
  transform(
    transformer: (name: string, value: VariableValue) => VariableValue,
  ): Result<VariableMap, DomainError & { message: string }> {
    const transformedVariables = new Map<string, VariableInfo>();

    for (const [name, info] of this.variables) {
      const transformedValue = transformer(name, info.value);

      // Validate transformed value
      const validation = VariableMap.validateVariableValue(transformedValue);
      if (!validation.ok) {
        return validation;
      }

      transformedVariables.set(name, {
        ...info,
        value: transformedValue,
        type: VariableMap.getValueType(transformedValue),
      });
    }

    return {
      ok: true,
      data: new VariableMap(transformedVariables),
    };
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `VariableMap(${this.variables.size} variables)`;
  }
}
