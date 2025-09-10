/**
 * FrontmatterValidator Domain Service
 *
 * Validates frontmatter data against schema rules following DDD and Totality principles
 * Integrates with Schema Context validation rules and provides domain-specific validation logic
 * Uses value objects and returns Result<T,E> for all operations
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import type { FrontmatterData } from "../../value-objects/frontmatter-data.ts";
import type {
  ValidationRule,
  ValidationRules,
} from "../../value-objects/validation-rules.ts";

/**
 * Validation result for individual field
 */
export interface FieldValidationResult {
  readonly fieldName: string;
  readonly isValid: boolean;
  readonly errorMessage?: string;
}

/**
 * Comprehensive validation result
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly fieldResults: ReadonlyArray<FieldValidationResult>;
  readonly errors: ReadonlyArray<string>;
}

/**
 * FrontmatterValidator domain service for validating frontmatter data
 * Follows Totality principles - all functions are total and return Result<T,E>
 */
export class FrontmatterValidator {
  private constructor() {}

  /**
   * Smart Constructor for FrontmatterValidator
   * @returns Result containing FrontmatterValidator
   */
  static create(): Result<
    FrontmatterValidator,
    DomainError & { message: string }
  > {
    return {
      ok: true,
      data: new FrontmatterValidator(),
    };
  }

  /**
   * Validate frontmatter data against schema validation rules
   * @param data - FrontmatterData to validate
   * @param rules - ValidationRules from Schema Context
   * @returns Result containing validation success or detailed errors
   */
  validateAgainstRules(
    data: FrontmatterData,
    rules: ValidationRules,
  ): Result<ValidationResult, DomainError & { message: string }> {
    if (data.isEmpty()) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Cannot validate empty frontmatter data",
        ),
      };
    }

    if (rules.isEmpty()) {
      // No rules to validate against - consider this valid
      return {
        ok: true,
        data: {
          isValid: true,
          fieldResults: [],
          errors: [],
        },
      };
    }

    const fieldResults: FieldValidationResult[] = [];
    const errors: string[] = [];

    // Validate each rule
    for (const rule of rules.getRules()) {
      const fieldResult = this.validateFieldAgainstRule(data, rule);
      fieldResults.push(fieldResult);

      if (!fieldResult.isValid && fieldResult.errorMessage) {
        errors.push(fieldResult.errorMessage);
      }
    }

    const isValid = errors.length === 0;

    return {
      ok: true,
      data: {
        isValid,
        fieldResults,
        errors,
      },
    };
  }

  /**
   * Validate required fields are present in frontmatter data
   * @param data - FrontmatterData to validate
   * @param requiredFields - Array of required field names
   * @returns Result containing validation success or errors
   */
  validateRequiredFields(
    data: FrontmatterData,
    requiredFields: string[],
  ): Result<ValidationResult, DomainError & { message: string }> {
    if (data.isEmpty() && requiredFields.length > 0) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Cannot validate required fields on empty frontmatter data",
        ),
      };
    }

    const fieldResults: FieldValidationResult[] = [];
    const errors: string[] = [];

    for (const fieldName of requiredFields) {
      const hasField = data.hasField(fieldName);

      if (hasField) {
        // Check if field has a non-null, non-undefined value
        const fieldResult = data.getField(fieldName);
        if (fieldResult.ok) {
          const value = fieldResult.data;
          const isNonEmpty = value !== null && value !== undefined &&
            value !== "";

          fieldResults.push({
            fieldName,
            isValid: isNonEmpty,
            errorMessage: isNonEmpty
              ? undefined
              : `Required field '${fieldName}' is empty`,
          });

          if (!isNonEmpty) {
            errors.push(`Required field '${fieldName}' is empty`);
          }
        } else {
          fieldResults.push({
            fieldName,
            isValid: false,
            errorMessage: `Required field '${fieldName}' is missing`,
          });
          errors.push(`Required field '${fieldName}' is missing`);
        }
      } else {
        fieldResults.push({
          fieldName,
          isValid: false,
          errorMessage: `Required field '${fieldName}' is missing`,
        });
        errors.push(`Required field '${fieldName}' is missing`);
      }
    }

    const isValid = errors.length === 0;

    return {
      ok: true,
      data: {
        isValid,
        fieldResults,
        errors,
      },
    };
  }

  /**
   * Validate field types according to expected types
   * @param data - FrontmatterData to validate
   * @param typeRules - Array of type validation rules
   * @returns Result containing validation success or errors
   */
  validateFieldTypes(
    data: FrontmatterData,
    typeRules: Array<{ fieldName: string; expectedType: string }>,
  ): Result<ValidationResult, DomainError & { message: string }> {
    if (data.isEmpty() && typeRules.length > 0) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Cannot validate field types on empty frontmatter data",
        ),
      };
    }

    const fieldResults: FieldValidationResult[] = [];
    const errors: string[] = [];

    for (const typeRule of typeRules) {
      const { fieldName, expectedType } = typeRule;

      if (!data.hasField(fieldName)) {
        // Field is missing - this might be handled by required field validation
        fieldResults.push({
          fieldName,
          isValid: true, // Type validation passes if field is missing
        });
        continue;
      }

      const fieldResult = data.getField(fieldName);
      if (!fieldResult.ok) {
        fieldResults.push({
          fieldName,
          isValid: false,
          errorMessage:
            `Cannot access field '${fieldName}' for type validation`,
        });
        errors.push(`Cannot access field '${fieldName}' for type validation`);
        continue;
      }

      const value = fieldResult.data;
      const actualType = this.getValueType(value);
      const isValidType = this.isTypeCompatible(actualType, expectedType);

      fieldResults.push({
        fieldName,
        isValid: isValidType,
        errorMessage: isValidType
          ? undefined
          : `Field '${fieldName}' expected type '${expectedType}' but got '${actualType}'`,
      });

      if (!isValidType) {
        errors.push(
          `Field '${fieldName}' expected type '${expectedType}' but got '${actualType}'`,
        );
      }
    }

    const isValid = errors.length === 0;

    return {
      ok: true,
      data: {
        isValid,
        fieldResults,
        errors,
      },
    };
  }

  /**
   * Validate a single field against a validation rule
   * @param data - FrontmatterData containing the field
   * @param rule - ValidationRule to apply
   * @returns Field validation result
   */
  private validateFieldAgainstRule(
    data: FrontmatterData,
    rule: ValidationRule,
  ): FieldValidationResult {
    const fieldName = rule.name;

    // Check if field exists
    if (!data.hasField(fieldName)) {
      // Check if field is required
      if (rule.severity === "error" || rule.params?.required === true) {
        return {
          fieldName,
          isValid: false,
          errorMessage: `Required field '${fieldName}' is missing`,
        };
      }
      // Optional field missing is valid
      return {
        fieldName,
        isValid: true,
      };
    }

    // Get field value
    const fieldResult = data.getField(fieldName);
    if (!fieldResult.ok) {
      return {
        fieldName,
        isValid: false,
        errorMessage:
          `Cannot access field '${fieldName}': ${fieldResult.error.message}`,
      };
    }

    const value = fieldResult.data;

    // Apply rule-specific validation
    switch (rule.type) {
      case "required":
        return this.validateRequired(fieldName, value);

      case "type":
        return this.validateType(
          fieldName,
          value,
          rule.params?.expectedType as string,
        );

      case "format":
        return this.validateFormat(fieldName, value, rule.params);

      case "length":
        return this.validateLength(fieldName, value, rule.params);

      case "range":
        return this.validateRange(fieldName, value, rule.params);

      case "enum":
        return this.validateEnum(
          fieldName,
          value,
          rule.params?.values as unknown[],
        );

      case "pattern":
        return this.validatePattern(
          fieldName,
          value,
          rule.params?.pattern as string,
        );

      case "custom":
        return this.validateCustom(fieldName, value, rule);

      default:
        return {
          fieldName,
          isValid: false,
          errorMessage: `Unknown validation rule type: ${rule.type}`,
        };
    }
  }

  /**
   * Validate required field
   */
  private validateRequired(
    fieldName: string,
    value: unknown,
  ): FieldValidationResult {
    const isValid = value !== null && value !== undefined && value !== "";
    return {
      fieldName,
      isValid,
      errorMessage: isValid
        ? undefined
        : `Required field '${fieldName}' is empty`,
    };
  }

  /**
   * Validate field type
   */
  private validateType(
    fieldName: string,
    value: unknown,
    expectedType: string,
  ): FieldValidationResult {
    if (!expectedType) {
      return {
        fieldName,
        isValid: false,
        errorMessage:
          `Type validation for '${fieldName}' missing expectedType parameter`,
      };
    }

    const actualType = this.getValueType(value);
    const isValid = this.isTypeCompatible(actualType, expectedType);

    return {
      fieldName,
      isValid,
      errorMessage: isValid
        ? undefined
        : `Field '${fieldName}' expected type '${expectedType}' but got '${actualType}'`,
    };
  }

  /**
   * Validate format constraints
   */
  private validateFormat(
    fieldName: string,
    value: unknown,
    params: Record<string, unknown> | undefined,
  ): FieldValidationResult {
    if (typeof value !== "string") {
      return {
        fieldName,
        isValid: false,
        errorMessage:
          `Format validation for '${fieldName}' requires string value`,
      };
    }

    const format = params?.format as string;
    if (!format) {
      return {
        fieldName,
        isValid: true, // No format specified
      };
    }

    // Basic format validation
    let isValid = true;
    let errorMessage: string | undefined;

    switch (format) {
      case "email":
        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        errorMessage = isValid
          ? undefined
          : `Field '${fieldName}' must be a valid email address`;
        break;

      case "url":
        try {
          new URL(value);
          isValid = true;
        } catch {
          isValid = false;
          errorMessage = `Field '${fieldName}' must be a valid URL`;
        }
        break;

      case "date":
        isValid = !isNaN(Date.parse(value));
        errorMessage = isValid
          ? undefined
          : `Field '${fieldName}' must be a valid date`;
        break;

      default:
        isValid = true; // Unknown format, assume valid
    }

    return {
      fieldName,
      isValid,
      errorMessage,
    };
  }

  /**
   * Validate length constraints
   */
  private validateLength(
    fieldName: string,
    value: unknown,
    params: Record<string, unknown> | undefined,
  ): FieldValidationResult {
    if (typeof value !== "string") {
      return {
        fieldName,
        isValid: false,
        errorMessage:
          `Length validation for '${fieldName}' requires string value`,
      };
    }

    const minLength = params?.minLength as number;
    const maxLength = params?.maxLength as number;
    const length = value.length;

    if (minLength !== undefined && length < minLength) {
      return {
        fieldName,
        isValid: false,
        errorMessage:
          `Field '${fieldName}' must be at least ${minLength} characters long`,
      };
    }

    if (maxLength !== undefined && length > maxLength) {
      return {
        fieldName,
        isValid: false,
        errorMessage:
          `Field '${fieldName}' must be at most ${maxLength} characters long`,
      };
    }

    return {
      fieldName,
      isValid: true,
    };
  }

  /**
   * Validate range constraints
   */
  private validateRange(
    fieldName: string,
    value: unknown,
    params: Record<string, unknown> | undefined,
  ): FieldValidationResult {
    if (typeof value !== "number") {
      return {
        fieldName,
        isValid: false,
        errorMessage:
          `Range validation for '${fieldName}' requires numeric value`,
      };
    }

    const min = params?.min as number;
    const max = params?.max as number;

    if (min !== undefined && value < min) {
      return {
        fieldName,
        isValid: false,
        errorMessage: `Field '${fieldName}' must be at least ${min}`,
      };
    }

    if (max !== undefined && value > max) {
      return {
        fieldName,
        isValid: false,
        errorMessage: `Field '${fieldName}' must be at most ${max}`,
      };
    }

    return {
      fieldName,
      isValid: true,
    };
  }

  /**
   * Validate enum constraints
   */
  private validateEnum(
    fieldName: string,
    value: unknown,
    values: unknown[],
  ): FieldValidationResult {
    if (!values || !Array.isArray(values)) {
      return {
        fieldName,
        isValid: false,
        errorMessage:
          `Enum validation for '${fieldName}' missing values parameter`,
      };
    }

    const isValid = values.includes(value);
    return {
      fieldName,
      isValid,
      errorMessage: isValid
        ? undefined
        : `Field '${fieldName}' must be one of: ${
          values.map((v) => JSON.stringify(v)).join(", ")
        }`,
    };
  }

  /**
   * Validate pattern constraints
   */
  private validatePattern(
    fieldName: string,
    value: unknown,
    pattern: string,
  ): FieldValidationResult {
    if (typeof value !== "string") {
      return {
        fieldName,
        isValid: false,
        errorMessage:
          `Pattern validation for '${fieldName}' requires string value`,
      };
    }

    if (!pattern) {
      return {
        fieldName,
        isValid: false,
        errorMessage:
          `Pattern validation for '${fieldName}' missing pattern parameter`,
      };
    }

    try {
      const regex = new RegExp(pattern);
      const isValid = regex.test(value);
      return {
        fieldName,
        isValid,
        errorMessage: isValid
          ? undefined
          : `Field '${fieldName}' does not match required pattern: ${pattern}`,
      };
    } catch (error) {
      return {
        fieldName,
        isValid: false,
        errorMessage: `Invalid regex pattern for '${fieldName}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Validate custom rules
   */
  private validateCustom(
    fieldName: string,
    _value: unknown,
    _rule: ValidationRule,
  ): FieldValidationResult {
    // For now, custom validation passes
    // In production, this would use a plugin system or custom validation functions
    return {
      fieldName,
      isValid: true,
      errorMessage: undefined,
    };
  }

  /**
   * Get the type of a value
   */
  private getValueType(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }

  /**
   * Check if actual type is compatible with expected type
   */
  private isTypeCompatible(actualType: string, expectedType: string): boolean {
    if (actualType === expectedType) return true;

    // Handle some common type compatibility cases
    switch (expectedType) {
      case "number":
        return actualType === "number";
      case "string":
        return actualType === "string";
      case "boolean":
        return actualType === "boolean";
      case "array":
        return actualType === "array";
      case "object":
        return actualType === "object";
      default:
        return false;
    }
  }
}
