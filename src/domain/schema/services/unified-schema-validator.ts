/**
 * Unified Schema Validator Service
 *
 * Consolidates schema validation logic into a single service
 * following DDD bounded context principles and Totality patterns.
 *
 * Replaces multiple validator implementations with a single,
 * cohesive validation service.
 */

import type { DomainError, Result } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";

/**
 * Schema validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  path: string;
  message: string;
  rule: string;
  value?: unknown;
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

/**
 * Schema definition for validation
 */
export interface SchemaDefinition {
  type: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  items?: SchemaProperty;
  enum?: unknown[];
  const?: unknown;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

/**
 * Schema property definition
 */
export interface SchemaProperty {
  type?: string | string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  pattern?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  items?: SchemaProperty;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

/**
 * Unified Schema Validator Service
 *
 * Provides comprehensive schema validation for data structures
 * using JSON Schema-like validation rules.
 */
export class UnifiedSchemaValidator {
  /**
   * Validate data against a schema
   */
  validate(
    data: unknown,
    schema: SchemaDefinition,
  ): Result<ValidationResult, DomainError & { message: string }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      this.validateValue(data, schema, "", errors, warnings);

      return {
        ok: true,
        data: {
          valid: errors.length === 0,
          errors,
          warnings,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "SchemaValidationFailed",
            schema,
            data,
          },
          `Schema validation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Validate a value against a schema property
   */
  private validateValue(
    value: unknown,
    schema: SchemaProperty | SchemaDefinition,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Type validation
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      const actualType = this.getType(value);

      if (
        !types.includes(actualType) &&
        !(actualType === "null" && types.includes("null"))
      ) {
        errors.push({
          path,
          message: `Expected type ${types.join(" or ")}, got ${actualType}`,
          rule: "type",
          value,
        });
        return;
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(", ")}`,
        rule: "enum",
        value,
      });
    }

    // Const validation
    if (schema.const !== undefined && value !== schema.const) {
      errors.push({
        path,
        message: `Value must be exactly: ${schema.const}`,
        rule: "const",
        value,
      });
    }

    // String validations
    if (typeof value === "string") {
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          errors.push({
            path,
            message: `String does not match pattern: ${schema.pattern}`,
            rule: "pattern",
            value,
          });
        }
      }

      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({
          path,
          message: `String length must be at least ${schema.minLength}`,
          rule: "minLength",
          value,
        });
      }

      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({
          path,
          message: `String length must be at most ${schema.maxLength}`,
          rule: "maxLength",
          value,
        });
      }
    }

    // Number validations
    if (typeof value === "number") {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
          path,
          message: `Value must be at least ${schema.minimum}`,
          rule: "minimum",
          value,
        });
      }

      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
          path,
          message: `Value must be at most ${schema.maximum}`,
          rule: "maximum",
          value,
        });
      }
    }

    // Array validations
    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push({
          path,
          message: `Array must have at least ${schema.minItems} items`,
          rule: "minItems",
          value,
        });
      }

      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push({
          path,
          message: `Array must have at most ${schema.maxItems} items`,
          rule: "maxItems",
          value,
        });
      }

      if (schema.items) {
        value.forEach((item, index) => {
          this.validateValue(
            item,
            schema.items!,
            `${path}[${index}]`,
            errors,
            warnings,
          );
        });
      }
    }

    // Object validations
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;

      // Required properties
      if (schema.required) {
        for (const required of schema.required) {
          if (!(required in obj)) {
            errors.push({
              path: path ? `${path}.${required}` : required,
              message: `Required property is missing`,
              rule: "required",
            });
          }
        }
      }

      // Property validations
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in obj) {
            this.validateValue(
              obj[key],
              propSchema,
              path ? `${path}.${key}` : key,
              errors,
              warnings,
            );
          }
        }
      }

      // Additional properties check
      if (
        "additionalProperties" in schema &&
        schema.additionalProperties === false
      ) {
        const allowedKeys = Object.keys(schema.properties || {});
        const extraKeys = Object.keys(obj).filter((key) =>
          !allowedKeys.includes(key)
        );

        if (extraKeys.length > 0) {
          warnings.push({
            path,
            message: `Unexpected properties: ${extraKeys.join(", ")}`,
            suggestion: "Remove unexpected properties or update schema",
          });
        }
      }
    }
  }

  /**
   * Get the type of a value
   */
  private getType(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }

  /**
   * Validate with $ref resolution
   */
  validateWithRefs(
    data: unknown,
    schema: SchemaDefinition,
    definitions: Record<string, SchemaDefinition>,
  ): Result<ValidationResult, DomainError & { message: string }> {
    // Resolve $ref references in schema
    const resolvedSchema = this.resolveRefs(
      schema,
      definitions,
    ) as SchemaDefinition;
    return this.validate(data, resolvedSchema);
  }

  /**
   * Resolve $ref references in schema
   */
  private resolveRefs(
    schema: unknown,
    definitions: Record<string, SchemaDefinition>,
  ): unknown {
    if (typeof schema !== "object" || schema === null) {
      return schema;
    }

    if (typeof schema === "object" && schema !== null && "$ref" in schema) {
      const ref = (schema as Record<string, unknown>)["$ref"] as string;
      const refPath = ref.replace("#/definitions/", "");
      if (definitions[refPath]) {
        return this.resolveRefs(definitions[refPath], definitions);
      }
      return schema;
    }

    const resolved: Record<string, unknown> | unknown[] = Array.isArray(schema)
      ? []
      : {};

    if (typeof schema === "object" && schema !== null) {
      for (const [key, value] of Object.entries(schema)) {
        if (Array.isArray(resolved)) {
          resolved.push(this.resolveRefs(value, definitions));
        } else {
          resolved[key] = this.resolveRefs(value, definitions);
        }
      }
    }

    return resolved;
  }
}
