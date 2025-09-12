/**
 * VariableValidator Domain Service
 *
 * Validates variable names, values, and metadata according to business rules
 * Follows Totality principles with Result<T, E> return types
 * FIXED: Eliminates hardcoding violations with configurable validation patterns
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import type {
  VariableInfo,
  VariableValue,
} from "../value-objects/variable-map.ts";
import {
  DEFAULT_NAME_LENGTH_LIMIT,
  VARIABLE_DESCRIPTION_LENGTH_LIMIT,
} from "../../shared/constants.ts";
import {
  ValidationConfig,
  type ValidationContext,
} from "../value-objects/validation-config.ts";

/**
 * Domain service for variable validation
 * Encapsulates all validation logic for variable names, values, and metadata
 * FIXED: Uses configurable validation to eliminate hardcoding violations
 */
export class VariableValidator {
  private static defaultConfig: ValidationConfig = ValidationConfig
    .createDefault();

  /**
   * Set global validation configuration
   * Allows external configuration to override default patterns
   */
  static setConfiguration(config: ValidationConfig): void {
    VariableValidator.defaultConfig = config;
  }

  /**
   * Get current validation configuration
   */
  static getConfiguration(): ValidationConfig {
    return VariableValidator.defaultConfig;
  }

  /**
   * Validate variable name according to configurable business rules
   * FIXED: Eliminates hardcoded regex pattern, supports multiple validation contexts
   */
  static validateVariableName(
    name: string,
    context?: ValidationContext,
    config?: ValidationConfig,
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
    const validationConfig = config ?? VariableValidator.defaultConfig;

    // FIXED: Use configurable validation pattern instead of hardcoded regex
    if (!validationConfig.validateName(trimmedName, context)) {
      const expectedFormat = validationConfig.getValidationDescription(context);
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: trimmedName,
            expectedFormat,
          },
          `Variable name must conform to ${expectedFormat} rules`,
        ),
      };
    }

    // FIXED: Reserved keyword validation is now handled by ValidationConfig

    // Check for reasonable length using Smart Constructor
    if (DEFAULT_NAME_LENGTH_LIMIT.isExceeded(trimmedName)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "TooLong",
            value: trimmedName,
            maxLength: DEFAULT_NAME_LENGTH_LIMIT.getValue(),
          },
          "Variable name is too long",
        ),
      };
    }

    return { ok: true, data: undefined };
  }

  /**
   * Validate variable value for JSON serialization and circular references
   */
  static validateVariableValue(
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
          `Variable value contains circular reference: ${String(error)}`,
        ),
      };
    }

    // Validate specific value types
    if (value !== null && typeof value === "object") {
      if (Array.isArray(value)) {
        // Validate array elements
        for (let i = 0; i < value.length; i++) {
          const elementValidation = VariableValidator.validateVariableValue(
            value[i],
          );
          if (!elementValidation.ok) {
            return {
              ok: false,
              error: createDomainError(
                {
                  kind: "InvalidFormat",
                  input: `array[${i}]`,
                  expectedFormat: "valid array element",
                },
                `Invalid array element at index ${i}: ${elementValidation.error.message}`,
              ),
            };
          }
        }
      } else {
        // Validate object properties
        for (const [key, val] of Object.entries(value)) {
          // FIXED: Use configurable validation for object keys
          const keyValidation = VariableValidator.validateVariableName(
            key,
            "mixed",
          );
          if (!keyValidation.ok) {
            return {
              ok: false,
              error: createDomainError(
                {
                  kind: "InvalidFormat",
                  input: key,
                  expectedFormat: "valid object key",
                },
                `Invalid object key '${key}': ${keyValidation.error.message}`,
              ),
            };
          }

          const valueValidation = VariableValidator.validateVariableValue(val);
          if (!valueValidation.ok) {
            return {
              ok: false,
              error: createDomainError(
                {
                  kind: "InvalidFormat",
                  input: `object.${key}`,
                  expectedFormat: "valid object value",
                },
                `Invalid object value for key '${key}': ${valueValidation.error.message}`,
              ),
            };
          }
        }
      }
    }

    return { ok: true, data: undefined };
  }

  /**
   * Validate variable info structure and metadata
   */
  static validateVariableInfo(
    info: VariableInfo,
  ): Result<void, DomainError & { message: string }> {
    // Validate value
    const valueValidation = VariableValidator.validateVariableValue(info.value);
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
              expectedFormat: "string description",
            },
            "Variable description must be a string",
          ),
        };
      }

      if (VARIABLE_DESCRIPTION_LENGTH_LIMIT.isExceeded(info.description)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "TooLong",
              value: info.description,
              maxLength: VARIABLE_DESCRIPTION_LENGTH_LIMIT.getValue(),
            },
            "Variable description is too long",
          ),
        };
      }
    }

    // Validate default value if provided
    if (info.defaultValue !== undefined) {
      const defaultValidation = VariableValidator.validateVariableValue(
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
  static getValueType(value: VariableValue): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
    return typeof value;
  }

  /**
   * Validate variable type compatibility
   */
  static validateTypeCompatibility(
    value: VariableValue,
    expectedType: string,
  ): Result<void, DomainError & { message: string }> {
    const actualType = VariableValidator.getValueType(value);

    if (actualType !== expectedType) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: actualType,
            expectedFormat: expectedType,
          },
          `Variable value type '${actualType}' does not match expected type '${expectedType}'`,
        ),
      };
    }

    return { ok: true, data: undefined };
  }
}
