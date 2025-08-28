import type { DomainError, Result } from "../core/result.ts";
import type { Schema } from "../models/domain-models.ts";

export interface ValidationResult {
  isValid: boolean;
  errors: DomainError[];
  validatedData: unknown;
}

export class SchemaValidator {
  /**
   * Type guard for Record<string, unknown>
   */
  private isRecordObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /**
   * Type guard for string array
   */
  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === "string");
  }
  validate(
    data: unknown,
    schema: Schema,
  ): Result<unknown, DomainError> {
    // This is a simplified validator
    // In production, this would use a proper JSON Schema validator
    const schemaDefinition = schema.getDefinition().getDefinition();

    if (typeof schemaDefinition !== "object" || schemaDefinition === null) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: String(schemaDefinition),
          expectedFormat: "object",
        },
      };
    }

    // Validate schema definition is a proper object
    if (!this.isRecordObject(schemaDefinition)) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: String(schemaDefinition),
          expectedFormat: "object",
        },
      };
    }

    // For now, we'll do basic type checking
    const result = this.validateObject(data, schemaDefinition);

    if (!result.ok) {
      return result;
    }

    return { ok: true, data: result.data };
  }

  private validateObject(
    data: unknown,
    schema: Record<string, unknown>,
  ): Result<unknown, DomainError> {
    if (typeof data !== "object" || data === null) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: String(data),
          expectedFormat: "object",
        },
      };
    }

    // We already validated data is an object above
    const dataObj = data as Record<string, unknown>;
    
    // Safely extract properties with type validation
    const properties = this.isRecordObject(schema["properties"]) 
      ? schema["properties"] 
      : undefined;
    
    // Safely extract required fields with type validation
    const required = this.isStringArray(schema["required"]) 
      ? schema["required"] 
      : undefined;

    // Check required fields
    if (required) {
      for (const field of required) {
        if (!(field in dataObj)) {
          return {
            ok: false,
            error: { kind: "NotFound", resource: "field", name: field },
          };
        }
      }
    }

    // Validate properties
    if (properties) {
      const validatedData: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(dataObj)) {
        if (key in properties) {
          const fieldSchemaValue = properties[key];
          if (!this.isRecordObject(fieldSchemaValue)) {
            return {
              ok: false,
              error: {
                kind: "InvalidFormat",
                input: String(fieldSchemaValue),
                expectedFormat: "object schema",
              },
            };
          }
          const fieldSchema = fieldSchemaValue;
          const validationResult = this.validateField(value, fieldSchema, key);

          if (!validationResult.ok) {
            return validationResult;
          }

          validatedData[key] = validationResult.data;
        } else if (schema["additionalProperties"] === false) {
          return {
            ok: false,
            error: { kind: "NotConfigured", component: key },
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
  ): Result<unknown, DomainError> {
    const typeValue = schema["type"];
    const type = typeof typeValue === "string" ? typeValue : undefined;

    if (!type) {
      return { ok: true, data: value };
    }

    switch (type) {
      case "string":
        if (typeof value !== "string") {
          return {
            ok: false,
            error: {
              kind: "InvalidFormat",
              input: String(value),
              expectedFormat: "string",
            },
          };
        }
        break;

      case "number":
      case "integer":
        if (typeof value !== "number") {
          return {
            ok: false,
            error: {
              kind: "InvalidFormat",
              input: String(value),
              expectedFormat: "number",
            },
          };
        }
        break;

      case "boolean":
        if (typeof value !== "boolean") {
          return {
            ok: false,
            error: {
              kind: "InvalidFormat",
              input: String(value),
              expectedFormat: "boolean",
            },
          };
        }
        break;

      case "array": {
        if (!Array.isArray(value)) {
          return {
            ok: false,
            error: {
              kind: "InvalidFormat",
              input: String(value),
              expectedFormat: "array",
            },
          };
        }

        // Validate array items if schema is provided
        const itemsValue = schema["items"];
        const items = this.isRecordObject(itemsValue) ? itemsValue : undefined;
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
      }

      case "object":
        return this.validateObject(value, schema);
    }

    return { ok: true, data: value };
  }
}
