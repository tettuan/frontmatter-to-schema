/**
 * Schema validation logic
 *
 * Validates transformed data against JSON Schema constraints.
 */

import type { JsonSchema, SchemaProperty } from "./types.ts";
import { ValidationError } from "./errors.ts";

/**
 * Validates value against schema property
 */
export function validateValue(
  value: unknown,
  schemaProperty: SchemaProperty,
  path: string,
): void {
  // Null/undefined handling
  if (value === null || value === undefined) {
    return; // Let required validation handle this
  }

  // Type validation
  if (schemaProperty.type) {
    validateType(value, schemaProperty.type, path);
  }

  // Enum validation
  if (schemaProperty.enum) {
    validateEnum(value, schemaProperty.enum, path);
  }

  // Pattern validation (for strings)
  if (schemaProperty.pattern && typeof value === "string") {
    validatePattern(value, schemaProperty.pattern, path);
  }

  // Number constraints
  if (typeof value === "number") {
    if (schemaProperty.minimum !== undefined) {
      validateMinimum(value, schemaProperty.minimum, path);
    }
    if (schemaProperty.maximum !== undefined) {
      validateMaximum(value, schemaProperty.maximum, path);
    }
  }

  // String constraints
  if (typeof value === "string") {
    if (schemaProperty.minLength !== undefined) {
      validateMinLength(value, schemaProperty.minLength, path);
    }
    if (schemaProperty.maxLength !== undefined) {
      validateMaxLength(value, schemaProperty.maxLength, path);
    }
  }

  // Array validation
  if (Array.isArray(value) && schemaProperty.items) {
    validateArrayItems(value, schemaProperty.items, path);
  }
}

/**
 * Validates required properties
 */
export function validateRequired(
  data: Record<string, unknown>,
  schema: JsonSchema,
  path: string = "",
): void {
  if (!schema.required || schema.required.length === 0) {
    return;
  }

  const missingProps: string[] = [];

  for (const requiredProp of schema.required) {
    if (!(requiredProp in data) || data[requiredProp] === undefined) {
      missingProps.push(requiredProp);
    }
  }

  if (missingProps.length > 0) {
    const fullPath = path ? `${path}.${missingProps[0]}` : missingProps[0];
    throw new ValidationError(
      `Missing required property: ${missingProps[0]}`,
      fullPath,
      {
        required: schema.required,
        available: Object.keys(data),
        missing: missingProps,
      },
    );
  }
}

/**
 * Validates type
 */
function validateType(
  value: unknown,
  schemaType: string | string[],
  path: string,
): void {
  const types = Array.isArray(schemaType) ? schemaType : [schemaType];
  const actualType = getActualType(value);

  const matches = types.some((type) => {
    if (type === "null") return value === null;
    if (type === "array") return Array.isArray(value);
    if (type === "integer") {
      return typeof value === "number" && Number.isInteger(value);
    }
    if (type === "number") {
      // number type accepts both integer and float
      return typeof value === "number";
    }
    return actualType === type;
  });

  if (!matches) {
    throw new ValidationError(
      `Type mismatch: expected ${types.join(" | ")}, got ${actualType}`,
      path,
      { expected: types, actual: actualType, value },
    );
  }
}

/**
 * Gets the actual type of a value
 */
function getActualType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  return typeof value;
}

/**
 * Validates enum
 */
function validateEnum(
  value: unknown,
  enumValues: unknown[],
  path: string,
): void {
  const matches = enumValues.some((enumValue) =>
    JSON.stringify(enumValue) === JSON.stringify(value)
  );

  if (!matches) {
    throw new ValidationError(
      `Invalid enum value: ${JSON.stringify(value)}`,
      path,
      { value, allowed: enumValues },
    );
  }
}

/**
 * Validates pattern (regex)
 */
function validatePattern(value: string, pattern: string, path: string): void {
  const regex = new RegExp(pattern);
  if (!regex.test(value)) {
    throw new ValidationError(
      `Pattern validation failed`,
      path,
      { value, pattern },
    );
  }
}

/**
 * Validates minimum value
 */
function validateMinimum(value: number, minimum: number, path: string): void {
  if (value < minimum) {
    throw new ValidationError(
      `Value ${value} is less than minimum ${minimum}`,
      path,
      { value, minimum },
    );
  }
}

/**
 * Validates maximum value
 */
function validateMaximum(value: number, maximum: number, path: string): void {
  if (value > maximum) {
    throw new ValidationError(
      `Value ${value} is greater than maximum ${maximum}`,
      path,
      { value, maximum },
    );
  }
}

/**
 * Validates minimum length
 */
function validateMinLength(
  value: string,
  minLength: number,
  path: string,
): void {
  if (value.length < minLength) {
    throw new ValidationError(
      `String length ${value.length} is less than minimum ${minLength}`,
      path,
      { value, length: value.length, minLength },
    );
  }
}

/**
 * Validates maximum length
 */
function validateMaxLength(
  value: string,
  maxLength: number,
  path: string,
): void {
  if (value.length > maxLength) {
    throw new ValidationError(
      `String length ${value.length} is greater than maximum ${maxLength}`,
      path,
      { value, length: value.length, maxLength },
    );
  }
}

/**
 * Validates array items
 */
function validateArrayItems(
  value: unknown[],
  itemsSchema: SchemaProperty | SchemaProperty[],
  path: string,
): void {
  if (Array.isArray(itemsSchema)) {
    // Tuple validation
    value.forEach((item, index) => {
      if (index < itemsSchema.length) {
        validateValue(item, itemsSchema[index], `${path}[${index}]`);
      }
    });
  } else {
    // Array items validation
    value.forEach((item, index) => {
      validateValue(item, itemsSchema, `${path}[${index}]`);
    });
  }
}
