/**
 * Type transformation logic
 *
 * Transforms values to match schema types with coercion and validation.
 */

import type { MappingWarning, SchemaProperty } from "./types.ts";
import { WarningCode } from "./types.ts";
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
    allowSafeConversions?: boolean;
    allowSemanticConversions?: boolean;
    semanticConversionRules?: string[];
    invalidConversionAction?: "preserve" | "error" | "fallback";
    warnOnCoercion?: boolean;
  },
): TransformResult {
  const warnings: MappingWarning[] = [];
  const coerce = options?.coerceTypes ?? true;
  const warnDataLoss = options?.warnOnDataLoss ?? true;
  const allowSafeConversions = options?.allowSafeConversions ?? true;
  const allowSemanticConversions = options?.allowSemanticConversions ?? false;
  const semanticConversionRules = options?.semanticConversionRules ?? [];
  const invalidConversionAction = options?.invalidConversionAction ??
    "preserve";
  const warnOnCoercion = options?.warnOnCoercion ?? true;

  const schemaType = schemaProperty.type;

  // Handle null/undefined - but allow string/array types to handle it for semantic conversions
  if (value === null || value === undefined) {
    // For string and array types, let the type transformer handle null (semantic conversions)
    if (
      schemaType === "string" || schemaType === "array" ||
      (Array.isArray(schemaType) &&
        (schemaType.includes("string") || schemaType.includes("array")))
    ) {
      // Continue to type transformation
    } else {
      // For other types, return null/undefined as-is
      return { value, warnings };
    }
  }

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
          allowSafeConversions,
          allowSemanticConversions,
          semanticConversionRules,
          invalidConversionAction,
          warnOnCoercion,
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
    allowSafeConversions,
    allowSemanticConversions,
    semanticConversionRules,
    invalidConversionAction,
    warnOnCoercion,
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
  options: {
    coerce: boolean;
    warnDataLoss: boolean;
    allowSafeConversions?: boolean;
    allowSemanticConversions?: boolean;
    semanticConversionRules?: string[];
    invalidConversionAction?: "preserve" | "error" | "fallback";
    warnOnCoercion?: boolean;
  },
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
 * Get default value for a given type
 */
function getDefaultValueForType(type: string): unknown {
  switch (type) {
    case "boolean":
      return false;
    case "string":
      return "";
    case "number":
    case "integer":
      return 0;
    case "array":
      return [];
    case "object":
      return {};
    case "null":
      return null;
    default:
      return null;
  }
}

/**
 * Transform to boolean
 */
function transformToBoolean(
  value: unknown,
  path: string,
  options: {
    coerce: boolean;
    warnDataLoss: boolean;
    allowSafeConversions?: boolean;
    allowSemanticConversions?: boolean;
    semanticConversionRules?: string[];
    invalidConversionAction?: "preserve" | "error" | "fallback";
    warnOnCoercion?: boolean;
  },
): TransformResult {
  const warnings: MappingWarning[] = [];
  const allowSafeConversions = options?.allowSafeConversions ?? true;
  const allowSemanticConversions = options?.allowSemanticConversions ?? false;
  const semanticConversionRules = options?.semanticConversionRules ?? [];
  const invalidConversionAction = options?.invalidConversionAction ??
    "preserve";
  const warnOnCoercion = options?.warnOnCoercion ?? true;

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

  // Array to boolean
  if (Array.isArray(value)) {
    if (value.length === 0) {
      // Empty array - PRESERVE with warning
      if (invalidConversionAction === "preserve") {
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.INVALID_CONVERSION,
            message: "Cannot convert empty array to boolean",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              suggestion: "Provide a non-empty array or boolean value",
            },
          });
        }
        return { value, warnings };
      } else if (invalidConversionAction === "error") {
        throw new TypeTransformationError(
          "Cannot convert empty array to boolean",
          path,
          { value },
        );
      } else {
        // fallback
        const fallbackValue = getDefaultValueForType("boolean");
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.INVALID_CONVERSION,
            message: "Cannot convert empty array to boolean, using fallback",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              transformedValue: fallbackValue,
            },
          });
        }
        return { value: fallbackValue, warnings };
      }
    }

    // Multi-element array - PRESERVE with warning
    if (value.length > 1) {
      if (invalidConversionAction === "preserve") {
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.AMBIGUOUS_CONVERSION,
            message: "Multi-element array cannot be unwrapped to boolean",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              suggestion: "Fix source data or change schema type to array",
            },
          });
        }
        return { value, warnings };
      } else if (invalidConversionAction === "error") {
        throw new TypeTransformationError(
          "Cannot convert multi-element array to boolean (ambiguous which element to use)",
          path,
          { value },
        );
      } else {
        // fallback
        const fallbackValue = getDefaultValueForType("boolean");
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.AMBIGUOUS_CONVERSION,
            message:
              "Multi-element array cannot be unwrapped to boolean, using fallback",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              transformedValue: fallbackValue,
            },
          });
        }
        return { value: fallbackValue, warnings };
      }
    }

    // Single-element array - safe conversion
    if (allowSafeConversions) {
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.TYPE_COERCION,
          message: "Single-element array unwrapped to boolean",
          path,
          severity: "info",
          details: {
            originalValue: value,
            transformedValue: value[0],
            suggestion: "Use boolean value directly instead of array",
          },
        });
      }
      const result = transformToBoolean(value[0], path, options);
      warnings.push(...result.warnings);
      return { value: result.value, warnings };
    }
  }

  // String to boolean
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();

    // Safe conversions: only "true" and "false"
    if (lower === "true") {
      if (allowSafeConversions && warnOnCoercion) {
        warnings.push({
          code: WarningCode.TYPE_COERCION,
          message: "String parsed to boolean",
          path,
          severity: "info",
          details: { originalValue: value, transformedValue: true },
        });
      }
      return { value: true, warnings };
    }
    if (lower === "false") {
      if (allowSafeConversions && warnOnCoercion) {
        warnings.push({
          code: WarningCode.TYPE_COERCION,
          message: "String parsed to boolean",
          path,
          severity: "info",
          details: { originalValue: value, transformedValue: false },
        });
      }
      return { value: false, warnings };
    }

    // Non-standard strings (yes/no/on/off/1/0) - PRESERVE with warning
    if (invalidConversionAction === "preserve") {
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.INVALID_CONVERSION,
          message:
            `Cannot convert string "${value}" to boolean (only "true"/"false" allowed)`,
          path,
          severity: "warning",
          details: {
            originalValue: value,
            suggestion: 'Use "true" or "false" for safe conversion',
          },
        });
      }
      return { value, warnings };
    } else if (invalidConversionAction === "error") {
      throw new TypeTransformationError(
        `Cannot convert string "${value}" to boolean`,
        path,
        { value },
      );
    } else {
      // fallback
      const fallbackValue = getDefaultValueForType("boolean");
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.INVALID_CONVERSION,
          message:
            `Cannot convert string "${value}" to boolean, using fallback`,
          path,
          severity: "warning",
          details: {
            originalValue: value,
            transformedValue: fallbackValue,
          },
        });
      }
      return { value: fallbackValue, warnings };
    }
  }

  // Number to boolean - semantic conversion
  if (typeof value === "number") {
    const canConvertNumberToBoolean = allowSemanticConversions &&
      semanticConversionRules.includes("number-to-boolean");

    if (canConvertNumberToBoolean && (value === 0 || value === 1)) {
      const boolValue = value === 1;
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.TYPE_COERCION,
          message: "Number coerced to boolean (semantic conversion)",
          path,
          severity: "info",
          details: { originalValue: value, transformedValue: boolValue },
        });
      }
      return { value: boolValue, warnings };
    }

    // Cannot convert - PRESERVE
    if (invalidConversionAction === "preserve") {
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.INVALID_CONVERSION,
          message:
            `Cannot convert number ${value} to boolean (semantic conversion disabled or value not 0/1)`,
          path,
          severity: "warning",
          details: {
            originalValue: value,
            suggestion:
              "Enable semantic conversions with number-to-boolean rule, or use boolean values",
          },
        });
      }
      return { value, warnings };
    } else if (invalidConversionAction === "error") {
      throw new TypeTransformationError(
        `Cannot convert number ${value} to boolean (only 0 and 1 are supported with semantic conversions)`,
        path,
        { value },
      );
    } else {
      // fallback
      const fallbackValue = getDefaultValueForType("boolean");
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.INVALID_CONVERSION,
          message: `Cannot convert number ${value} to boolean, using fallback`,
          path,
          severity: "warning",
          details: {
            originalValue: value,
            transformedValue: fallbackValue,
          },
        });
      }
      return { value: fallbackValue, warnings };
    }
  }

  // Other types - PRESERVE or error
  if (invalidConversionAction === "preserve") {
    if (warnOnCoercion) {
      warnings.push({
        code: WarningCode.INVALID_CONVERSION,
        message: `Cannot convert ${typeof value} to boolean`,
        path,
        severity: "warning",
        details: {
          originalValue: value,
          suggestion:
            "Use boolean value or enable appropriate semantic conversions",
        },
      });
    }
    return { value, warnings };
  } else if (invalidConversionAction === "error") {
    throw new TypeTransformationError(
      `Cannot convert ${typeof value} to boolean`,
      path,
      { value },
    );
  } else {
    // fallback
    const fallbackValue = getDefaultValueForType("boolean");
    if (warnOnCoercion) {
      warnings.push({
        code: WarningCode.INVALID_CONVERSION,
        message: `Cannot convert ${typeof value} to boolean, using fallback`,
        path,
        severity: "warning",
        details: {
          originalValue: value,
          transformedValue: fallbackValue,
        },
      });
    }
    return { value: fallbackValue, warnings };
  }
}

/**
 * Transform to number
 */
function transformToNumber(
  value: unknown,
  path: string,
  options: {
    coerce: boolean;
    warnDataLoss: boolean;
    allowSafeConversions?: boolean;
    allowSemanticConversions?: boolean;
    semanticConversionRules?: string[];
    invalidConversionAction?: "preserve" | "error" | "fallback";
    warnOnCoercion?: boolean;
  },
): TransformResult {
  const warnings: MappingWarning[] = [];
  const allowSafeConversions = options?.allowSafeConversions ?? true;
  const allowSemanticConversions = options?.allowSemanticConversions ?? false;
  const semanticConversionRules = options?.semanticConversionRules ?? [];
  const invalidConversionAction = options?.invalidConversionAction ??
    "preserve";
  const warnOnCoercion = options?.warnOnCoercion ?? true;

  // Already number
  if (typeof value === "number") {
    // Handle NaN - preserve it with warning
    if (Number.isNaN(value)) {
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.NAN_CONVERSION,
          message: "NaN value preserved (may cause JSON serialization issues)",
          path,
          severity: "warning",
          details: {
            originalValue: value,
            suggestion:
              "Replace NaN with null or a valid number for JSON compatibility",
          },
        });
      }
      return { value, warnings };
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

  // Array to number
  if (Array.isArray(value)) {
    if (value.length === 0) {
      // Empty array - PRESERVE with warning
      if (invalidConversionAction === "preserve") {
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.INVALID_CONVERSION,
            message: "Cannot convert empty array to number",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              suggestion: "Provide a non-empty array or number value",
            },
          });
        }
        return { value, warnings };
      } else if (invalidConversionAction === "error") {
        throw new TypeTransformationError(
          "Cannot convert empty array to number",
          path,
          { value },
        );
      } else {
        // fallback
        const fallbackValue = getDefaultValueForType("number");
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.INVALID_CONVERSION,
            message: "Cannot convert empty array to number, using fallback",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              transformedValue: fallbackValue,
            },
          });
        }
        return { value: fallbackValue, warnings };
      }
    }

    // Multi-element array - PRESERVE with warning
    if (value.length > 1) {
      if (invalidConversionAction === "preserve") {
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.AMBIGUOUS_CONVERSION,
            message: "Multi-element array cannot be unwrapped to number",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              suggestion: "Fix source data or change schema type to array",
            },
          });
        }
        return { value, warnings };
      } else if (invalidConversionAction === "error") {
        throw new TypeTransformationError(
          "Cannot convert multi-element array to number (ambiguous which element to use)",
          path,
          { value },
        );
      } else {
        // fallback
        const fallbackValue = getDefaultValueForType("number");
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.AMBIGUOUS_CONVERSION,
            message:
              "Multi-element array cannot be unwrapped to number, using fallback",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              transformedValue: fallbackValue,
            },
          });
        }
        return { value: fallbackValue, warnings };
      }
    }

    // Single-element array - safe conversion
    if (allowSafeConversions) {
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.TYPE_COERCION,
          message: "Single-element array unwrapped to number",
          path,
          severity: "info",
          details: {
            originalValue: value,
            transformedValue: value[0],
            suggestion: "Use number value directly instead of array",
          },
        });
      }
      const result = transformToNumber(value[0], path, options);
      warnings.push(...result.warnings);
      return { value: result.value, warnings };
    }
  }

  // String to number
  if (typeof value === "string") {
    const trimmed = value.trim();
    const num = parseFloat(trimmed);

    // Non-numeric string - PRESERVE with warning
    if (Number.isNaN(num)) {
      if (invalidConversionAction === "preserve") {
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.INVALID_CONVERSION,
            message: `Cannot parse string "${value}" to number`,
            path,
            severity: "warning",
            details: {
              originalValue: value,
              suggestion: "Fix source data or change schema type to string",
            },
          });
        }
        return { value, warnings };
      } else if (invalidConversionAction === "error") {
        throw new TypeTransformationError(
          `Cannot convert string "${value}" to number`,
          path,
          { value },
        );
      } else {
        // fallback
        const fallbackValue = getDefaultValueForType("number");
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.INVALID_CONVERSION,
            message: `Cannot parse string "${value}" to number, using fallback`,
            path,
            severity: "warning",
            details: {
              originalValue: value,
              transformedValue: fallbackValue,
            },
          });
        }
        return { value: fallbackValue, warnings };
      }
    }

    // Valid numeric string - safe conversion
    if (allowSafeConversions && warnOnCoercion) {
      warnings.push({
        code: WarningCode.TYPE_COERCION,
        message: "String parsed to number",
        path,
        severity: "info",
        details: { originalValue: value, transformedValue: num },
      });
    }
    return { value: num, warnings };
  }

  // Boolean to number - semantic conversion
  if (typeof value === "boolean") {
    const canConvertBooleanToNumber = allowSemanticConversions &&
      semanticConversionRules.includes("boolean-to-number");

    if (canConvertBooleanToNumber) {
      const num = value ? 1 : 0;
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.TYPE_COERCION,
          message: "Boolean coerced to number (semantic conversion)",
          path,
          severity: "info",
          details: { originalValue: value, transformedValue: num },
        });
      }
      return { value: num, warnings };
    }

    // Cannot convert - PRESERVE
    if (invalidConversionAction === "preserve") {
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.INVALID_CONVERSION,
          message:
            "Cannot convert boolean to number (semantic conversion disabled)",
          path,
          severity: "warning",
          details: {
            originalValue: value,
            suggestion:
              "Enable semantic conversions with boolean-to-number rule, or use number values",
          },
        });
      }
      return { value, warnings };
    } else if (invalidConversionAction === "error") {
      throw new TypeTransformationError(
        "Cannot convert boolean to number (semantic conversion disabled)",
        path,
        { value },
      );
    } else {
      // fallback
      const fallbackValue = getDefaultValueForType("number");
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.INVALID_CONVERSION,
          message: "Cannot convert boolean to number, using fallback",
          path,
          severity: "warning",
          details: {
            originalValue: value,
            transformedValue: fallbackValue,
          },
        });
      }
      return { value: fallbackValue, warnings };
    }
  }

  // Other types - PRESERVE or error
  if (invalidConversionAction === "preserve") {
    if (warnOnCoercion) {
      warnings.push({
        code: WarningCode.INVALID_CONVERSION,
        message: `Cannot convert ${typeof value} to number`,
        path,
        severity: "warning",
        details: {
          originalValue: value,
          suggestion:
            "Use number value or enable appropriate semantic conversions",
        },
      });
    }
    return { value, warnings };
  } else if (invalidConversionAction === "error") {
    throw new TypeTransformationError(
      `Cannot convert ${typeof value} to number`,
      path,
      { value },
    );
  } else {
    // fallback
    const fallbackValue = getDefaultValueForType("number");
    if (warnOnCoercion) {
      warnings.push({
        code: WarningCode.INVALID_CONVERSION,
        message: `Cannot convert ${typeof value} to number, using fallback`,
        path,
        severity: "warning",
        details: {
          originalValue: value,
          transformedValue: fallbackValue,
        },
      });
    }
    return { value: fallbackValue, warnings };
  }
}

/**
 * Transform to integer
 */
function transformToInteger(
  value: unknown,
  path: string,
  options: {
    coerce: boolean;
    warnDataLoss: boolean;
    allowSafeConversions?: boolean;
    allowSemanticConversions?: boolean;
    semanticConversionRules?: string[];
    invalidConversionAction?: "preserve" | "error" | "fallback";
    warnOnCoercion?: boolean;
  },
): TransformResult {
  const warnings: MappingWarning[] = [];
  const invalidConversionAction = options?.invalidConversionAction ??
    "preserve";
  const warnOnCoercion = options?.warnOnCoercion ?? true;

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

  // Float to integer - PRESERVE with warning (default behavior)
  if (invalidConversionAction === "preserve") {
    if (warnOnCoercion) {
      warnings.push({
        code: WarningCode.VALUE_PRESERVED,
        message: `Float value preserved (precision loss if truncated)`,
        path,
        severity: "warning",
        details: {
          originalValue: num,
          suggestion:
            "Use integer values if precision is important, or change schema type to number",
        },
      });
    }
    return { value: num, warnings };
  } else if (invalidConversionAction === "error") {
    throw new TypeTransformationError(
      `Cannot convert float ${num} to integer (precision loss)`,
      path,
      { value: num },
    );
  } else {
    // fallback - truncate to integer
    const intValue = num >= 0 ? Math.floor(num) : Math.ceil(num);
    if (warnOnCoercion) {
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
}

/**
 * Transform to string
 */
function transformToString(
  value: unknown,
  path: string,
  options: {
    coerce: boolean;
    warnDataLoss: boolean;
    allowSafeConversions?: boolean;
    allowSemanticConversions?: boolean;
    semanticConversionRules?: string[];
    invalidConversionAction?: "preserve" | "error" | "fallback";
    warnOnCoercion?: boolean;
  },
): TransformResult {
  const warnings: MappingWarning[] = [];
  const allowSafeConversions = options?.allowSafeConversions ?? true;
  const allowSemanticConversions = options?.allowSemanticConversions ?? false;
  const semanticConversionRules = options?.semanticConversionRules ?? [];
  const invalidConversionAction = options?.invalidConversionAction ??
    "preserve";
  const warnOnCoercion = options?.warnOnCoercion ?? true;

  // Already string
  if (typeof value === "string") {
    return { value, warnings };
  }

  // Handle null/undefined - semantic conversion
  if (value === null || value === undefined) {
    const canConvertNullToEmptyString = allowSemanticConversions &&
      semanticConversionRules.includes("null-to-empty-string");

    if (canConvertNullToEmptyString) {
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.TYPE_COERCION,
          message:
            "Null/undefined coerced to empty string (semantic conversion)",
          path,
          severity: "info",
          details: { originalValue: value, transformedValue: "" },
        });
      }
      return { value: "", warnings };
    }

    // Cannot convert - PRESERVE
    if (invalidConversionAction === "preserve") {
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.INVALID_CONVERSION,
          message:
            "Cannot convert null/undefined to string (semantic conversion disabled)",
          path,
          severity: "warning",
          details: {
            originalValue: value,
            suggestion:
              "Enable semantic conversions with null-to-empty-string rule, or provide string values",
          },
        });
      }
      return { value, warnings };
    } else if (invalidConversionAction === "error") {
      throw new TypeTransformationError(
        "Cannot convert null/undefined to string (semantic conversion disabled)",
        path,
        { value },
      );
    } else {
      // fallback
      const fallbackValue = getDefaultValueForType("string");
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.INVALID_CONVERSION,
          message: "Cannot convert null/undefined to string, using fallback",
          path,
          severity: "warning",
          details: {
            originalValue: value,
            transformedValue: fallbackValue,
          },
        });
      }
      return { value: fallbackValue, warnings };
    }
  }

  if (!options.coerce) {
    throw new TypeTransformationError(
      `Expected string but got ${typeof value}`,
      path,
      { value },
    );
  }

  // Array to string
  if (Array.isArray(value)) {
    if (value.length === 0) {
      // Empty array - PRESERVE with warning
      if (invalidConversionAction === "preserve") {
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.INVALID_CONVERSION,
            message: "Cannot convert empty array to string",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              suggestion: "Provide a non-empty array or string value",
            },
          });
        }
        return { value, warnings };
      } else if (invalidConversionAction === "error") {
        throw new TypeTransformationError(
          "Cannot convert empty array to string",
          path,
          { value },
        );
      } else {
        // fallback
        const fallbackValue = getDefaultValueForType("string");
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.INVALID_CONVERSION,
            message: "Cannot convert empty array to string, using fallback",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              transformedValue: fallbackValue,
            },
          });
        }
        return { value: fallbackValue, warnings };
      }
    }

    // Multi-element array - PRESERVE with warning
    if (value.length > 1) {
      if (invalidConversionAction === "preserve") {
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.AMBIGUOUS_CONVERSION,
            message: "Multi-element array cannot be unwrapped to string",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              suggestion: "Fix source data or change schema type to array",
            },
          });
        }
        return { value, warnings };
      } else if (invalidConversionAction === "error") {
        throw new TypeTransformationError(
          "Cannot convert multi-element array to string (ambiguous which element to use)",
          path,
          { value },
        );
      } else {
        // fallback
        const fallbackValue = getDefaultValueForType("string");
        if (warnOnCoercion) {
          warnings.push({
            code: WarningCode.AMBIGUOUS_CONVERSION,
            message:
              "Multi-element array cannot be unwrapped to string, using fallback",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              transformedValue: fallbackValue,
            },
          });
        }
        return { value: fallbackValue, warnings };
      }
    }

    // Single-element array - safe conversion
    if (allowSafeConversions) {
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.TYPE_COERCION,
          message: "Single-element array unwrapped to string",
          path,
          severity: "info",
          details: {
            originalValue: value,
            transformedValue: value[0],
            suggestion: "Use string value directly instead of array",
          },
        });
      }
      const result = transformToString(value[0], path, options);
      warnings.push(...result.warnings);
      return { value: result.value, warnings };
    }
  }

  // Date to ISO string - safe conversion
  if (value instanceof Date) {
    if (allowSafeConversions) {
      const isoString = value.toISOString();
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.TYPE_COERCION,
          message: "Date converted to ISO 8601 string",
          path,
          severity: "info",
          details: { originalValue: value, transformedValue: isoString },
        });
      }
      return { value: isoString, warnings };
    }
  }

  // Object/Array to string - use String() conversion (lossy but safe)
  if (typeof value === "object" && value !== null) {
    if (allowSafeConversions) {
      const strValue = String(value);
      if (options.warnDataLoss && warnOnCoercion) {
        warnings.push({
          code: WarningCode.DATA_LOSS,
          message: "Complex type converted to string (data loss)",
          path,
          severity: "warning",
          details: {
            originalValue: value,
            transformedValue: strValue,
            suggestion: "Consider using type: object if structure is important",
          },
        });
      }
      return { value: strValue, warnings };
    } else {
      // Cannot convert without safe conversions
      if (invalidConversionAction === "preserve") {
        if (options.warnDataLoss && warnOnCoercion) {
          warnings.push({
            code: WarningCode.INVALID_CONVERSION,
            message: "Cannot convert complex type to string",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              suggestion:
                "Enable safe conversions or use type: object if structure is important",
            },
          });
        }
        return { value, warnings };
      } else if (invalidConversionAction === "error") {
        throw new TypeTransformationError(
          "Cannot convert complex type to string",
          path,
          { value },
        );
      } else {
        // fallback - stringify
        const strValue = String(value);
        if (options.warnDataLoss && warnOnCoercion) {
          warnings.push({
            code: WarningCode.DATA_LOSS,
            message: "Complex type converted to string (data loss)",
            path,
            severity: "warning",
            details: {
              originalValue: value,
              transformedValue: strValue,
              suggestion:
                "Consider using type: object if structure is important",
            },
          });
        }
        return { value: strValue, warnings };
      }
    }
  }

  // Primitive to string - safe conversion
  if (allowSafeConversions) {
    const strValue = String(value);
    if (warnOnCoercion) {
      warnings.push({
        code: WarningCode.TYPE_COERCION,
        message: `${typeof value} coerced to string`,
        path,
        severity: "info",
        details: { originalValue: value, transformedValue: strValue },
      });
    }
    return { value: strValue, warnings };
  }

  // Cannot convert
  if (invalidConversionAction === "preserve") {
    if (warnOnCoercion) {
      warnings.push({
        code: WarningCode.INVALID_CONVERSION,
        message: `Cannot convert ${typeof value} to string`,
        path,
        severity: "warning",
        details: {
          originalValue: value,
          suggestion: "Use string value or enable safe conversions",
        },
      });
    }
    return { value, warnings };
  } else if (invalidConversionAction === "error") {
    throw new TypeTransformationError(
      `Cannot convert ${typeof value} to string`,
      path,
      { value },
    );
  } else {
    // fallback
    const fallbackValue = getDefaultValueForType("string");
    if (warnOnCoercion) {
      warnings.push({
        code: WarningCode.INVALID_CONVERSION,
        message: `Cannot convert ${typeof value} to string, using fallback`,
        path,
        severity: "warning",
        details: {
          originalValue: value,
          transformedValue: fallbackValue,
        },
      });
    }
    return { value: fallbackValue, warnings };
  }
}

/**
 * Transform to array
 */
function transformToArray(
  value: unknown,
  schemaProperty: SchemaProperty,
  path: string,
  options: {
    coerce: boolean;
    warnDataLoss: boolean;
    allowSafeConversions?: boolean;
    allowSemanticConversions?: boolean;
    semanticConversionRules?: string[];
    invalidConversionAction?: "preserve" | "error" | "fallback";
    warnOnCoercion?: boolean;
  },
): TransformResult {
  const warnings: MappingWarning[] = [];
  const allowSemanticConversions = options?.allowSemanticConversions ?? false;
  const semanticConversionRules = options?.semanticConversionRules ?? [];
  const invalidConversionAction = options?.invalidConversionAction ??
    "preserve";
  const warnOnCoercion = options?.warnOnCoercion ?? true;

  // Handle null/undefined - semantic conversion
  if (value === null || value === undefined) {
    const canConvertNullToEmptyArray = allowSemanticConversions &&
      semanticConversionRules.includes("null-to-empty-array");

    if (canConvertNullToEmptyArray) {
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.TYPE_COERCION,
          message:
            "Null/undefined coerced to empty array (semantic conversion)",
          path,
          severity: "info",
          details: { originalValue: value, transformedValue: [] },
        });
      }
      return { value: [], warnings };
    }

    // Cannot convert - PRESERVE
    if (invalidConversionAction === "preserve") {
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.INVALID_CONVERSION,
          message:
            "Cannot convert null/undefined to array (semantic conversion disabled)",
          path,
          severity: "warning",
          details: {
            originalValue: value,
            suggestion:
              "Enable semantic conversions with null-to-empty-array rule, or provide array values",
          },
        });
      }
      return { value, warnings };
    } else if (invalidConversionAction === "error") {
      throw new TypeTransformationError(
        "Cannot convert null/undefined to array (semantic conversion disabled)",
        path,
        { value },
      );
    } else {
      // fallback
      const fallbackValue = getDefaultValueForType("array");
      if (warnOnCoercion) {
        warnings.push({
          code: WarningCode.INVALID_CONVERSION,
          message: "Cannot convert null/undefined to array, using fallback",
          path,
          severity: "warning",
          details: {
            originalValue: value,
            transformedValue: fallbackValue,
          },
        });
      }
      return { value: fallbackValue, warnings };
    }
  }

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
            allowSafeConversions: options.allowSafeConversions,
            allowSemanticConversions: options.allowSemanticConversions,
            semanticConversionRules: options.semanticConversionRules,
            invalidConversionAction: options.invalidConversionAction,
            warnOnCoercion: options.warnOnCoercion,
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
  _options: {
    coerce: boolean;
    warnDataLoss: boolean;
    allowSafeConversions?: boolean;
    allowSemanticConversions?: boolean;
    semanticConversionRules?: string[];
    invalidConversionAction?: "preserve" | "error" | "fallback";
    warnOnCoercion?: boolean;
  },
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
