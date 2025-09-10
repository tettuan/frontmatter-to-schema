/**
 * VariableMap Value Object
 *
 * Represents a validated mapping of variables to values for template processing
 * Follows Totality principles with Smart Constructor pattern
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import { VariableValidator } from "../services/variable-validator.ts";
import { VariableResolver } from "../services/variable-resolver.ts";

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
   * Validates variable names and values using domain services
   */
  static create(
    variables: Record<string, VariableValue> | Map<string, VariableValue>,
  ): Result<VariableMap, DomainError & { message: string }> {
    const variableMap = new Map<string, VariableInfo>();

    const entries = variables instanceof Map
      ? Array.from(variables.entries())
      : Object.entries(variables);

    for (const [name, value] of entries) {
      // Validate variable name using domain service
      const nameValidation = VariableValidator.validateVariableName(name);
      if (!nameValidation.ok) {
        return nameValidation;
      }

      // Validate variable value using domain service
      const valueValidation = VariableValidator.validateVariableValue(value);
      if (!valueValidation.ok) {
        return valueValidation;
      }

      // Create variable info using resolver service
      const info = VariableResolver.createVariableInfo(value);
      variableMap.set(name, info);
    }

    return {
      ok: true,
      data: new VariableMap(variableMap),
    };
  }

  /**
   * Create VariableMap from VariableInfo objects
   */
  static createFromInfo(
    variables: Record<string, VariableInfo> | Map<string, VariableInfo>,
  ): Result<VariableMap, DomainError & { message: string }> {
    const variableMap = new Map<string, VariableInfo>();

    const entries = variables instanceof Map
      ? Array.from(variables.entries())
      : Object.entries(variables);

    for (const [name, info] of entries) {
      // Validate variable name using domain service
      const nameValidation = VariableValidator.validateVariableName(name);
      if (!nameValidation.ok) {
        return nameValidation;
      }

      // Validate variable info using domain service
      const infoValidation = VariableValidator.validateVariableInfo(info);
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
   * Create an empty VariableMap
   */
  static createEmpty(): VariableMap {
    return new VariableMap(new Map());
  }

  /**
   * Get variable value by name
   */
  get(name: string): VariableValue | undefined {
    return this.variables.get(name)?.value;
  }

  /**
   * Get variable info by name
   */
  getInfo(name: string): VariableInfo | undefined {
    const info = this.variables.get(name);
    return info ? { ...info } : undefined;
  }

  /**
   * Check if variable exists
   */
  has(name: string): boolean {
    return this.variables.has(name);
  }

  /**
   * Get all variable names
   */
  getNames(): string[] {
    return Array.from(this.variables.keys()).sort();
  }

  /**
   * Get all variable values
   */
  getValues(): VariableValue[] {
    return Array.from(this.variables.values()).map((info) => info.value);
  }

  /**
   * Get number of variables
   */
  size(): number {
    return this.variables.size;
  }

  /**
   * Check if map is empty
   */
  isEmpty(): boolean {
    return this.variables.size === 0;
  }

  /**
   * Get variables by type using resolver service
   */
  getVariablesByType(type: string): Array<[string, VariableInfo]> {
    return VariableResolver.getVariablesByType(this.variables, type);
  }

  /**
   * Get all entries as array
   */
  entries(): Array<[string, VariableInfo]> {
    return Array.from(this.variables.entries()).map(([name, info]) => [
      name,
      { ...info },
    ]);
  }

  /**
   * Convert to plain JavaScript object
   */
  toObject(): Record<string, VariableValue> {
    return VariableResolver.toPlainObject(this.variables);
  }

  /**
   * Convert to Map
   */
  toMap(): Map<string, VariableValue> {
    const result = new Map<string, VariableValue>();
    for (const [name, info] of this.variables) {
      result.set(name, info.value);
    }
    return result;
  }

  /**
   * Merge with another VariableMap using resolver service
   */
  merge(
    other: VariableMap,
    overwrite = false,
  ): Result<VariableMap, DomainError & { message: string }> {
    const mergeResult = VariableResolver.mergeVariables(
      this.variables,
      other.variables,
      overwrite,
    );

    if (!mergeResult.ok) {
      return mergeResult;
    }

    return {
      ok: true,
      data: new VariableMap(mergeResult.data),
    };
  }

  /**
   * Filter variables using resolver service
   */
  filter(
    predicate: (name: string, info: VariableInfo) => boolean,
  ): Result<VariableMap, DomainError & { message: string }> {
    const filteredVariables = VariableResolver.filterVariables(
      this.variables,
      predicate,
    );

    return {
      ok: true,
      data: new VariableMap(filteredVariables),
    };
  }

  /**
   * Transform variables using resolver service
   */
  transform(
    transformer: (name: string, value: VariableValue) => VariableValue,
  ): Result<VariableMap, DomainError & { message: string }> {
    const transformResult = VariableResolver.transformVariables(
      this.variables,
      transformer,
    );

    if (!transformResult.ok) {
      return transformResult;
    }

    return {
      ok: true,
      data: new VariableMap(transformResult.data),
    };
  }

  /**
   * Resolve variable with default fallback using resolver service
   */
  resolve(
    name: string,
    defaultValue?: VariableValue,
  ): VariableValue | undefined {
    return VariableResolver.resolveVariableWithDefault(
      this.variables,
      name,
      defaultValue,
    );
  }

  /**
   * Get missing required variables using resolver service
   */
  getMissingRequired(): string[] {
    return VariableResolver.getMissingRequiredVariables(this.variables);
  }

  /**
   * Validate all required variables are present using resolver service
   */
  validateRequired(): Result<void, DomainError & { message: string }> {
    return VariableResolver.validateRequiredVariables(this.variables);
  }

  /**
   * Create a new variable map with additional variables
   */
  with(
    name: string,
    value: VariableValue,
    options?: {
      required?: boolean;
      description?: string;
      defaultValue?: VariableValue;
    },
  ): Result<VariableMap, DomainError & { message: string }> {
    // Validate the new variable
    const nameValidation = VariableValidator.validateVariableName(name);
    if (!nameValidation.ok) {
      return nameValidation;
    }

    const valueValidation = VariableValidator.validateVariableValue(value);
    if (!valueValidation.ok) {
      return valueValidation;
    }

    // Create new variable map with the additional variable
    const newVariables = new Map(this.variables);
    const info = VariableResolver.createVariableInfo(value, options);
    newVariables.set(name, info);

    return {
      ok: true,
      data: new VariableMap(newVariables),
    };
  }

  /**
   * Create a new variable map without specified variables
   */
  without(names: string[]): VariableMap {
    const filteredVariables = VariableResolver.filterVariables(
      this.variables,
      (name) => !names.includes(name),
    );

    return new VariableMap(filteredVariables);
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `VariableMap(${this.size()} variables)`;
  }

  /**
   * Get variables with their types
   */
  getTypedVariables(): Array<[string, VariableValue, string]> {
    return Array.from(this.variables.entries()).map(([name, info]) => [
      name,
      info.value,
      info.type,
    ]);
  }

  // Backward compatibility methods for existing tests
  /**
   * @deprecated Use size() instead
   */
  count(): number {
    return this.size();
  }

  /**
   * @deprecated Use has() instead
   */
  hasVariable(name: string): boolean {
    return this.has(name);
  }

  /**
   * @deprecated Use get() instead
   */
  getValue(
    name: string,
  ): Result<VariableValue, DomainError & { message: string }> {
    if (!this.has(name)) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "NotFound", resource: "variable", name },
          `Variable '${name}' not found`,
        ),
      };
    }
    const value = this.get(name);
    // Since has(name) returned true, value cannot be undefined
    return { ok: true, data: value! };
  }

  /**
   * @deprecated Use getInfo() instead
   */
  getVariableInfo(
    name: string,
  ): Result<VariableInfo, DomainError & { message: string }> {
    const info = this.getInfo(name);
    if (info === undefined) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "NotFound", resource: "variable", name },
          `Variable '${name}' not found`,
        ),
      };
    }
    return { ok: true, data: info };
  }

  /**
   * @deprecated Use getNames() instead
   */
  getVariableNames(): string[] {
    return this.getNames();
  }

  /**
   * @deprecated Use filter() with required predicate instead
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
   * @deprecated Use entries() instead
   */
  toInfoObject(): Record<string, VariableInfo> {
    const result: Record<string, VariableInfo> = {};
    for (const [name, info] of this.variables) {
      result[name] = { ...info };
    }
    return result;
  }
}
