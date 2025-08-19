import { Result } from "../shared/result.ts";
import { ValidationError, createValidationError } from "../shared/errors.ts";
import { Schema } from "../models/schema.ts";

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  validatedData: unknown;
}

export class SchemaValidator {
  validate(
    data: unknown,
    schema: Schema,
  ): Result<unknown, ValidationError> {
    // This is a simplified validator
    // In production, this would use a proper JSON Schema validator
    const schemaDefinition = schema.getDefinition().getDefinition();
    
    if (typeof schemaDefinition !== "object" || schemaDefinition === null) {
      return {
        ok: false,
        error: createValidationError("Invalid schema definition"),
      };
    }

    // For now, we'll do basic type checking
    const result = this.validateObject(
      data,
      schemaDefinition as Record<string, unknown>,
    );

    if (!result.ok) {
      return result;
    }

    return { ok: true, data: result.data };
  }

  private validateObject(
    data: unknown,
    schema: Record<string, unknown>,
  ): Result<unknown, ValidationError> {
    if (typeof data !== "object" || data === null) {
      return {
        ok: false,
        error: createValidationError("Expected object, got " + typeof data),
      };
    }

    const dataObj = data as Record<string, unknown>;
    const properties = schema["properties"] as Record<string, unknown> | undefined;
    const required = schema["required"] as string[] | undefined;

    // Check required fields
    if (required) {
      for (const field of required) {
        if (!(field in dataObj)) {
          return {
            ok: false,
            error: createValidationError(
              `Missing required field: ${field}`,
              field,
            ),
          };
        }
      }
    }

    // Validate properties
    if (properties) {
      const validatedData: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(dataObj)) {
        if (key in properties) {
          const fieldSchema = properties[key] as Record<string, unknown>;
          const validationResult = this.validateField(value, fieldSchema, key);
          
          if (!validationResult.ok) {
            return validationResult;
          }
          
          validatedData[key] = validationResult.data;
        } else if (schema["additionalProperties"] === false) {
          return {
            ok: false,
            error: createValidationError(
              `Unexpected field: ${key}`,
              key,
            ),
          };
        } else {
          validatedData[key] = value;
        }
      }

      return { ok: true, data: validatedData };
    }

    return { ok: true, data };
  }

  private validateField(
    value: unknown,
    schema: Record<string, unknown>,
    fieldName: string,
  ): Result<unknown, ValidationError> {
    const type = schema["type"] as string | undefined;

    if (!type) {
      return { ok: true, data: value };
    }

    switch (type) {
      case "string":
        if (typeof value !== "string") {
          return {
            ok: false,
            error: createValidationError(
              `Field ${fieldName} must be a string`,
              fieldName,
              value,
            ),
          };
        }
        break;

      case "number":
      case "integer":
        if (typeof value !== "number") {
          return {
            ok: false,
            error: createValidationError(
              `Field ${fieldName} must be a number`,
              fieldName,
              value,
            ),
          };
        }
        break;

      case "boolean":
        if (typeof value !== "boolean") {
          return {
            ok: false,
            error: createValidationError(
              `Field ${fieldName} must be a boolean`,
              fieldName,
              value,
            ),
          };
        }
        break;

      case "array":
        if (!Array.isArray(value)) {
          return {
            ok: false,
            error: createValidationError(
              `Field ${fieldName} must be an array`,
              fieldName,
              value,
            ),
          };
        }
        
        // Validate array items if schema is provided
        const items = schema["items"] as Record<string, unknown> | undefined;
        if (items) {
          const validatedArray: unknown[] = [];
          for (let i = 0; i < value.length; i++) {
            const itemResult = this.validateField(
              value[i],
              items,
              `${fieldName}[${i}]`,
            );
            if (!itemResult.ok) {
              return itemResult;
            }
            validatedArray.push(itemResult.data);
          }
          return { ok: true, data: validatedArray };
        }
        break;

      case "object":
        return this.validateObject(value, schema);
    }

    return { ok: true, data: value };
  }
}