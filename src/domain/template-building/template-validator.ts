import {
  TemplateValueSet,
  Result,
  success,
  failure
} from '../template-shared/value-objects.ts';

/**
 * Validation rules for template fields
 */
export interface TemplateFieldRule {
  name: string;
  required: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  customValidator?: (value: unknown) => Result<void, Error>;
}

/**
 * Template validation schema
 */
export interface TemplateSchema {
  fields: TemplateFieldRule[];
  allowExtraFields?: boolean;
}

/**
 * Domain service for validating template values
 */
export class TemplateValidator {
  /**
   * Validates values against template requirements
   */
  validate(
    valueSet: TemplateValueSet,
    schema?: TemplateSchema
  ): Result<void, TemplateValidationError> {
    // If no schema provided, basic validation only
    if (!schema) {
      return this.performBasicValidation(valueSet);
    }

    // Check required fields
    for (const rule of schema.fields) {
      if (rule.required && !(rule.name in valueSet.values)) {
        return failure(new TemplateValidationError(
          `Required field '${rule.name}' is missing`
        ));
      }

      if (rule.name in valueSet.values) {
        const fieldValidation = this.validateField(
          valueSet.values[rule.name],
          rule
        );
        if (!fieldValidation.ok) {
          return fieldValidation;
        }
      }
    }

    // Check for extra fields if not allowed
    if (!schema.allowExtraFields) {
      const allowedFields = new Set(schema.fields.map(f => f.name));
      for (const key of Object.keys(valueSet.values)) {
        if (!allowedFields.has(key)) {
          return failure(new TemplateValidationError(
            `Unexpected field '${key}' is not allowed`
          ));
        }
      }
    }

    return success(undefined);
  }

  /**
   * Performs basic validation without schema
   */
  private performBasicValidation(valueSet: TemplateValueSet): Result<void, TemplateValidationError> {
    // Check values object exists
    if (!valueSet.values) {
      return failure(new TemplateValidationError('Values object is missing'));
    }

    // Check if values is an object
    if (typeof valueSet.values !== 'object' || Array.isArray(valueSet.values)) {
      return failure(new TemplateValidationError('Values must be an object'));
    }

    // Check for circular references
    try {
      JSON.stringify(valueSet.values);
    } catch (error) {
      return failure(new TemplateValidationError(
        'Values contain circular references or non-serializable data'
      ));
    }

    return success(undefined);
  }

  /**
   * Validates a single field against its rule
   */
  private validateField(
    value: unknown,
    rule: TemplateFieldRule
  ): Result<void, TemplateValidationError> {
    // Type validation
    if (rule.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rule.type) {
        return failure(new TemplateValidationError(
          `Field '${rule.name}' must be of type ${rule.type}, got ${actualType}`
        ));
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        return failure(new TemplateValidationError(
          `Field '${rule.name}' must have at least ${rule.minLength} characters`
        ));
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        return failure(new TemplateValidationError(
          `Field '${rule.name}' must have at most ${rule.maxLength} characters`
        ));
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        return failure(new TemplateValidationError(
          `Field '${rule.name}' does not match required pattern`
        ));
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return failure(new TemplateValidationError(
          `Field '${rule.name}' must be at least ${rule.min}`
        ));
      }
      if (rule.max !== undefined && value > rule.max) {
        return failure(new TemplateValidationError(
          `Field '${rule.name}' must be at most ${rule.max}`
        ));
      }
    }

    // Custom validation
    if (rule.customValidator) {
      const customResult = rule.customValidator(value);
      if (!customResult.ok) {
        return failure(new TemplateValidationError(
          `Field '${rule.name}' failed custom validation: ${customResult.error.message}`
        ));
      }
    }

    return success(undefined);
  }
}

/**
 * Template validation error
 */
export class TemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateValidationError';
  }
}