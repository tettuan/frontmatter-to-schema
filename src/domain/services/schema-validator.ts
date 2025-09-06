import type { DomainError, Result } from "../core/result.ts";
import type { Schema } from "../models/entities.ts";

// Totality-compliant validation result using discriminated unions
export type ValidationResult = {
  kind: "Valid";
  data: unknown;
} | {
  kind: "Invalid";
  error: DomainError;
};

// Schema property extraction results using discriminated unions
type SchemaPropertyExtraction = {
  kind: "Present";
  value: Record<string, unknown>;
} | {
  kind: "NotPresent";
};

type RequiredFieldsExtraction = {
  kind: "Present";
  fields: string[];
} | {
  kind: "NotPresent";
};

type TypeSpecification = {
  kind: "Specified";
  type: string;
} | {
  kind: "NotSpecified";
};

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
    return Array.isArray(value) &&
      value.every((item) => typeof item === "string");
  }
  validate(
    data: unknown,
    schema: Schema,
  ): Result<unknown, DomainError> {
    // This is a simplified validator
    // In production, this would use a proper JSON Schema validator
    const schemaDefinition = schema.getDefinition().getRawDefinition();

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

    // Extract properties using Totality patterns
    const properties = this.extractProperties(schema);
    const required = this.extractRequiredFields(schema);

    // Check required fields using discriminated union pattern
    switch (required.kind) {
      case "Present":
        for (const field of required.fields) {
          if (!(field in dataObj)) {
            return {
              ok: false,
              error: { kind: "NotFound", resource: "field", name: field },
            };
          }
        }
        break;
      case "NotPresent":
        // No required fields to validate
        break;
    }

    // Validate properties using discriminated union pattern
    switch (properties.kind) {
      case "Present": {
        const validatedData: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(dataObj)) {
          if (key in properties.value) {
            const fieldSchemaValue = properties.value[key];
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
            const validationResult = this.validateField(
              value,
              fieldSchema,
              key,
            );

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
      case "NotPresent":
        // No properties schema to validate against
        break;
    }

    return { ok: true, data };
  }

  private validateField(
    value: unknown,
    schema: Record<string, unknown>,
    fieldName: string,
  ): Result<unknown, DomainError> {
    const typeSpec = this.extractTypeSpecification(schema);

    switch (typeSpec.kind) {
      case "NotSpecified":
        // No type validation required
        return { ok: true, data: value };
      case "Specified":
        return this.validateByType(value, typeSpec.type, schema, fieldName);
    }
  }

  private validateByType(
    value: unknown,
    type: string,
    schema: Record<string, unknown>,
    fieldName: string,
  ): Result<unknown, DomainError> {
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

  /**
   * Extract properties schema using Totality patterns
   */
  private extractProperties(
    schema: Record<string, unknown>,
  ): SchemaPropertyExtraction {
    const propertiesValue = schema["properties"];
    if (this.isRecordObject(propertiesValue)) {
      return { kind: "Present", value: propertiesValue };
    }
    return { kind: "NotPresent" };
  }

  /**
   * Extract required fields using Totality patterns
   */
  private extractRequiredFields(
    schema: Record<string, unknown>,
  ): RequiredFieldsExtraction {
    const requiredValue = schema["required"];
    if (this.isStringArray(requiredValue)) {
      return { kind: "Present", fields: requiredValue };
    }
    return { kind: "NotPresent" };
  }

  /**
   * Extract type specification using Totality patterns
   */
  private extractTypeSpecification(
    schema: Record<string, unknown>,
  ): TypeSpecification {
    const typeValue = schema["type"];
    if (typeof typeValue === "string") {
      return { kind: "Specified", type: typeValue };
    }
    return { kind: "NotSpecified" };
  }
}
