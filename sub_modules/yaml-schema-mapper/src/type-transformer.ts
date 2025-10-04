/**
 * Type transformation logic
 *
 * Transforms values to match schema types with coercion and validation.
 */

import type { SchemaProperty } from "./types.ts";
import { MappingWarning, WarningCode } from "./types.ts";
import { TypeTransformationError } from "./errors.ts";

/**
 * Transformation result
 */
export interface TransformResult {
  value: unknown;
  warnings: MappingWarning[];
}

/**
 * Transforms a value to match the schema type
 */
export function transformValue(
  value: unknown,
  schemaProperty: SchemaProperty,
  path: string,
  options?: {
    coerceTypes?: boolean;
    warnOnDataLoss?: boolean;
  },
): TransformResult {
  const warnings: MappingWarning[] = [];
  const coerce = options?.coerceTypes ?? true;
  const warnDataLoss = options?.warnOnDataLoss ?? true;

  // Handle null/undefined
  if (value === null || value === undefined) {
    return { value, warnings };
  }

  const schemaType = schemaProperty.type;

  // No type specified - return as is
  if (!schemaType) {
    return { value, warnings };
  }

  // Union types - try each type in order
  if (Array.isArray(schemaType)) {
    for (const type of schemaType) {
      try {
        const result = transformToType(value, type, schemaProperty, path, {
          coerce,
          warnDataLoss,
        });
        warnings.push(...result.warnings);
        return { value: result.value, warnings };
      } catch {
        // Try next type
        continue;
      }
    }
    // No type matched
    throw new TypeTransformationError(
      `Cannot transform value to any of types: ${schemaType.join(", ")}`,
      path,
      { value, schemaType },
    );
  }

  // Single type
  const result = transformToType(value, schemaType, schemaProperty, path, {
    coerce,
    warnDataLoss,
  });
  warnings.push(...result.warnings);
  return { value: result.value, warnings };
}

/**
 * Transforms value to specific type
 */
function transformToType(
  value: unknown,
  type: string,
  schemaProperty: SchemaProperty,
  path: string,
  options: { coerce: boolean; warnDataLoss: boolean },
): TransformResult {
  const warnings: MappingWarning[] = [];

  switch (type) {
    case "boolean":
      return transformToBoolean(value, path, options);

    case "number":
      return transformToNumber(value, path, options);

    case "integer":
      return transformToInteger(value, path, options);

    case "string":
      return transformToString(value, path, options);

    case "array":
      return transformToArray(value, schemaProperty, path, options);

    case "object":
      return transformToObject(value, path, options);

    default:
      // Unknown type - return as is
      return { value, warnings };
  }
}

/**
 * Transform to boolean
 */
function transformToBoolean(
  value: unknown,
  path: string,
  options: { coerce: boolean; warnDataLoss: boolean },
): TransformResult {
  const warnings: MappingWarning[] = [];

  // Already boolean
  if (typeof value === "boolean") {
    return { value, warnings };
  }

  if (!options.coerce) {
    throw new TypeTransformationError(
      `Expected boolean but got ${typeof value}`,
      path,
      { value },
    );
  }

  // Array to boolean - take first element
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new TypeTransformationError(
        "Cannot convert empty array to boolean",
        path,
        { value },
      );
    }
    warnings.push({
      code: WarningCode.TYPE_COERCION,
      message: "Array coerced to boolean (first element)",
      path,
      severity: "info",
      details: {
        originalValue: value,
        transformedValue: value[0],
        suggestion: "Use boolean value directly instead of array",
      },
    });
    const result = transformToBoolean(value[0], path, options);
    warnings.push(...result.warnings);
    return { value: result.value, warnings };
  }

  // String to boolean
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    if (
      lower === "true" || lower === "yes" || lower === "on" || lower === "1"
    ) {
      warnings.push({
        code: WarningCode.TYPE_COERCION,
        message: "String coerced to boolean",
        path,
        severity: "info",
        details: { originalValue: value, transformedValue: true },
      });
      return { value: true, warnings };
    }
    if (
      lower === "false" || lower === "no" || lower === "off" || lower === "0"
    ) {
      warnings.push({
        code: WarningCode.TYPE_COERCION,
        message: "String coerced to boolean",
        path,
        severity: "info",
        details: { originalValue: value, transformedValue: false },
      });
      return { value: false, warnings };
    }
    throw new TypeTransformationError(
      `Cannot convert string "${value}" to boolean`,
      path,
      { value },
    );
  }

  // Number to boolean
  if (typeof value === "number") {
    if (value === 1) {
      warnings.push({
        code: WarningCode.TYPE_COERCION,
        message: "Number coerced to boolean",
        path,
        severity: "info",
        details: { originalValue: value, transformedValue: true },
      });
      return { value: true, warnings };
    }
    if (value === 0) {
      warnings.push({
        code: WarningCode.TYPE_COERCION,
        message: "Number coerced to boolean",
        path,
        severity: "info",
        details: { originalValue: value, transformedValue: false },
      });
      return { value: false, warnings };
    }
    throw new TypeTransformationError(
      `Cannot convert number ${value} to boolean (only 0 and 1 are supported)`,
      path,
      { value },
    );
  }

  throw new TypeTransformationError(
    `Cannot convert ${typeof value} to boolean`,
    path,
    { value },
  );
}

/**
 * Transform to number
 */
function transformToNumber(
  value: unknown,
  path: string,
  options: { coerce: boolean; warnDataLoss: boolean },
): TransformResult {
  const warnings: MappingWarning[] = [];

  // Already number
  if (typeof value === "number") {
    // Handle NaN
    if (Number.isNaN(value)) {
      warnings.push({
        code: WarningCode.NAN_CONVERSION,
        message: "NaN converted to null (JSON incompatible)",
        path,
        severity: "warning",
        details: { originalValue: value, transformedValue: null },
      });
      return { value: null, warnings };
    }
    return { value, warnings };
  }

  if (!options.coerce) {
    throw new TypeTransformationError(
      `Expected number but got ${typeof value}`,
      path,
      { value },
    );
  }

  // Array to number - take first element
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new TypeTransformationError(
        "Cannot convert empty array to number",
        path,
        { value },
      );
    }
    warnings.push({
      code: WarningCode.TYPE_COERCION,
      message: "Array coerced to number (first element)",
      path,
      severity: "info",
      details: { originalValue: value, transformedValue: value[0] },
    });
    const result = transformToNumber(value[0], path, options);
    warnings.push(...result.warnings);
    return { value: result.value, warnings };
  }

  // String to number
  if (typeof value === "string") {
    const trimmed = value.trim();
    const num = parseFloat(trimmed);
    if (Number.isNaN(num)) {
      throw new TypeTransformationError(
        `Cannot convert string "${value}" to number`,
        path,
        { value },
      );
    }
    warnings.push({
      code: WarningCode.TYPE_COERCION,
      message: "String coerced to number",
      path,
      severity: "info",
      details: { originalValue: value, transformedValue: num },
    });
    return { value: num, warnings };
  }

  // Boolean to number
  if (typeof value === "boolean") {
    const num = value ? 1 : 0;
    warnings.push({
      code: WarningCode.TYPE_COERCION,
      message: "Boolean coerced to number",
      path,
      severity: "info",
      details: { originalValue: value, transformedValue: num },
    });
    return { value: num, warnings };
  }

  throw new TypeTransformationError(
    `Cannot convert ${typeof value} to number`,
    path,
    { value },
  );
}

/**
 * Transform to integer
 */
function transformToInteger(
  value: unknown,
  path: string,
  options: { coerce: boolean; warnDataLoss: boolean },
): TransformResult {
  const warnings: MappingWarning[] = [];

  // First convert to number
  const numberResult = transformToNumber(value, path, options);
  warnings.push(...numberResult.warnings);

  if (numberResult.value === null) {
    return { value: null, warnings };
  }

  const num = numberResult.value as number;

  // Already integer
  if (Number.isInteger(num)) {
    return { value: num, warnings };
  }

  // Truncate to integer
  const intValue = num >= 0 ? Math.floor(num) : Math.ceil(num);
  if (options.warnDataLoss) {
    warnings.push({
      code: WarningCode.PRECISION_LOSS,
      message: `Precision loss: ${path} (${num} → ${intValue})`,
      path,
      severity: "warning",
      details: {
        originalValue: num,
        transformedValue: intValue,
        suggestion: "Use integer values if precision is important",
      },
    });
  }

  return { value: intValue, warnings };
}

/**
 * Transform to string
 */
function transformToString(
  value: unknown,
  path: string,
  options: { coerce: boolean; warnDataLoss: boolean },
): TransformResult {
  const warnings: MappingWarning[] = [];

  // Already string
  if (typeof value === "string") {
    return { value, warnings };
  }

  if (!options.coerce) {
    throw new TypeTransformationError(
      `Expected string but got ${typeof value}`,
      path,
      { value },
    );
  }

  // Array to string - take first element
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new TypeTransformationError(
        "Cannot convert empty array to string",
        path,
        { value },
      );
    }
    warnings.push({
      code: WarningCode.TYPE_COERCION,
      message: "Array coerced to string (first element)",
      path,
      severity: "info",
      details: { originalValue: value, transformedValue: value[0] },
    });
    const result = transformToString(value[0], path, options);
    warnings.push(...result.warnings);
    return { value: result.value, warnings };
  }

  // Date to ISO string
  if (value instanceof Date) {
    const isoString = value.toISOString();
    warnings.push({
      code: WarningCode.TYPE_COERCION,
      message: "Date converted to ISO 8601 string",
      path,
      severity: "info",
      details: { originalValue: value, transformedValue: isoString },
    });
    return { value: isoString, warnings };
  }

  // Object/Array to JSON string
  if (typeof value === "object" && value !== null) {
    const jsonString = JSON.stringify(value);
    if (options.warnDataLoss) {
      warnings.push({
        code: WarningCode.DATA_LOSS,
        message: "Complex type serialized to JSON string",
        path,
        severity: "warning",
        details: {
          originalValue: value,
          transformedValue: jsonString,
          suggestion: "Consider using type: object if structure is important",
        },
      });
    }
    return { value: jsonString, warnings };
  }

  // Primitive to string
  const strValue = String(value);
  warnings.push({
    code: WarningCode.TYPE_COERCION,
    message: `${typeof value} coerced to string`,
    path,
    severity: "info",
    details: { originalValue: value, transformedValue: strValue },
  });
  return { value: strValue, warnings };
}

/**
 * Transform to array
 */
function transformToArray(
  value: unknown,
  schemaProperty: SchemaProperty,
  path: string,
  options: { coerce: boolean; warnDataLoss: boolean },
): TransformResult {
  const warnings: MappingWarning[] = [];

  // Already array
  if (Array.isArray(value)) {
    // Transform array elements if items schema is provided
    if (schemaProperty.items && !Array.isArray(schemaProperty.items)) {
      const transformedArray = value.map((item, index) => {
        const itemResult = transformValue(
          item,
          schemaProperty.items as SchemaProperty,
          `${path}[${index}]`,
          {
            coerceTypes: options.coerce,
            warnOnDataLoss: options.warnDataLoss,
          },
        );
        warnings.push(...itemResult.warnings);
        return itemResult.value;
      });
      return { value: transformedArray, warnings };
    }
    return { value, warnings };
  }

  if (!options.coerce) {
    throw new TypeTransformationError(
      `Expected array but got ${typeof value}`,
      path,
      { value },
    );
  }

  // Single value to array
  warnings.push({
    code: WarningCode.TYPE_COERCION,
    message: "Single value wrapped in array",
    path,
    severity: "info",
    details: {
      originalValue: value,
      transformedValue: [value],
      suggestion: "Use array syntax if multiple values are expected",
    },
  });
  return { value: [value], warnings };
}

/**
 * Transform to object
 */
function transformToObject(
  value: unknown,
  path: string,
  _options: { coerce: boolean; warnDataLoss: boolean },
): TransformResult {
  const warnings: MappingWarning[] = [];

  // Already object (and not null, array, or Date)
  if (
    typeof value === "object" && value !== null && !Array.isArray(value) &&
    !(value instanceof Date)
  ) {
    return { value, warnings };
  }

  throw new TypeTransformationError(
    `Cannot convert ${typeof value} to object`,
    path,
    { value },
  );
}
