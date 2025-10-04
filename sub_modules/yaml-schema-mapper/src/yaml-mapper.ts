/**
 * Core YAML Schema Mapper implementation
 *
 * Orchestrates property mapping, type transformation, and validation
 * to transform raw YAML data into schema-compliant structures.
 */

import type {
  JsonSchema,
  MapperConfig,
  MapperResult,
  MappingWarning,
  SchemaProperty,
  TransformationMetadata,
} from "./types.ts";
import { WarningCode } from "./types.ts";
import { CircularReferenceError, MapperError } from "./errors.ts";
import { mapProperty, validatePropertyName } from "./property-mapper.ts";
import { transformValue } from "./type-transformer.ts";
import { validateRequired, validateValue } from "./validator.ts";

/**
 * Default mapper options
 */
const DEFAULT_OPTIONS = {
  strict: false,
  validateTypes: true,
  coerceTypes: true,
  maxDepth: 20,
  warnOnDataLoss: true,
  unicodeNormalization: "none" as const,
};

/**
 * Maps raw YAML data to schema-compliant data
 */
export function mapYamlToSchema(
  config: MapperConfig,
): MapperResult {
  const options = { ...DEFAULT_OPTIONS, ...config.options };
  const warnings: MappingWarning[] = [];
  const metadata: TransformationMetadata = {
    propertiesMapped: 0,
    typesCoerced: 0,
    propertiesDropped: 0,
  };

  // Validate schema
  if (!config.schema || typeof config.schema !== "object") {
    throw new MapperError(
      "Invalid schema: must be an object",
      "INVALID_SCHEMA",
    );
  }

  // Map data
  const result = mapObject(
    config.data,
    config.schema,
    "",
    warnings,
    metadata,
    options,
    new Set(),
    0,
  );

  // Validate required properties
  if (options.validateTypes) {
    try {
      validateRequired(result, config.schema, "");
    } catch (error) {
      if (error instanceof MapperError) {
        warnings.push({
          code: WarningCode.PROPERTY_NOT_IN_SCHEMA,
          message: error.message,
          path: error.path || "",
          severity: "error",
          details: error.details,
        });
      } else {
        throw error;
      }
    }
  }

  return {
    data: result,
    warnings,
    metadata,
  };
}

/**
 * Maps an object recursively
 */
function mapObject(
  data: Record<string, unknown>,
  schema: JsonSchema,
  path: string,
  warnings: MappingWarning[],
  metadata: TransformationMetadata,
  options: Required<NonNullable<MapperConfig["options"]>>,
  visitedObjects: Set<unknown>,
  depth: number,
): Record<string, unknown> {
  // Check for circular references
  if (visitedObjects.has(data)) {
    throw new CircularReferenceError(path, depth);
  }

  // Check depth limit
  if (depth > options.maxDepth) {
    warnings.push({
      code: WarningCode.DEPTH_LIMIT,
      message: `Nesting depth exceeds recommended limit`,
      path,
      severity: "warning",
      details: {
        currentDepth: depth,
        maxDepth: options.maxDepth,
        suggestion: "Consider flattening data structure",
      },
    });
  }

  const visited = new Set(visitedObjects);
  visited.add(data);

  const result: Record<string, unknown> = {};
  const schemaProperties = schema.properties || {};
  const inputKeys = Object.keys(data);

  // Map schema properties
  for (const [schemaKey, schemaProperty] of Object.entries(schemaProperties)) {
    // Validate property name
    const nameWarnings = validatePropertyName(schemaKey);
    warnings.push(...nameWarnings);

    // Map property
    const mappingResult = mapProperty(
      inputKeys,
      schemaKey,
      schemaProperty,
      { unicodeNormalization: options.unicodeNormalization },
    );

    warnings.push(...mappingResult.warnings);

    if (!mappingResult.result) {
      // Property not found in input - skip (required validation will catch this)
      continue;
    }

    const { inputKey } = mappingResult.result;
    const inputValue = data[inputKey];
    const currentPath = path ? `${path}.${schemaKey}` : schemaKey;

    metadata.propertiesMapped++;

    try {
      // Transform value
      const transformResult = transformValue(
        inputValue,
        schemaProperty,
        currentPath,
        {
          coerceTypes: options.coerceTypes,
          warnOnDataLoss: options.warnOnDataLoss,
        },
      );

      warnings.push(...transformResult.warnings);

      // Count type coercions
      const typeCoercionWarnings = transformResult.warnings.filter(
        (w) => w.code === WarningCode.TYPE_COERCION,
      );
      metadata.typesCoerced += typeCoercionWarnings.length;

      let transformedValue = transformResult.value;

      // Recursively map nested objects
      if (
        schemaProperty.type === "object" &&
        schemaProperty.properties &&
        typeof transformedValue === "object" &&
        transformedValue !== null &&
        !Array.isArray(transformedValue)
      ) {
        transformedValue = mapObject(
          transformedValue as Record<string, unknown>,
          {
            type: "object",
            properties: schemaProperty.properties,
            required: schemaProperty.required,
            additionalProperties: schemaProperty.additionalProperties,
          },
          currentPath,
          warnings,
          metadata,
          options,
          visited,
          depth + 1,
        );
      }

      // Recursively map array of objects
      if (
        schemaProperty.type === "array" &&
        schemaProperty.items &&
        !Array.isArray(schemaProperty.items) &&
        (schemaProperty.items as SchemaProperty).type === "object" &&
        Array.isArray(transformedValue)
      ) {
        const itemSchema = schemaProperty.items as SchemaProperty;
        transformedValue = (transformedValue as unknown[]).map(
          (item, index) => {
            if (
              typeof item === "object" &&
              item !== null &&
              !Array.isArray(item) &&
              itemSchema.properties
            ) {
              return mapObject(
                item as Record<string, unknown>,
                {
                  type: "object",
                  properties: itemSchema.properties,
                  required: itemSchema.required,
                  additionalProperties: itemSchema.additionalProperties,
                },
                `${currentPath}[${index}]`,
                warnings,
                metadata,
                options,
                visited,
                depth + 1,
              );
            }
            return item;
          },
        );
      }

      // Validate value
      if (options.validateTypes) {
        try {
          validateValue(transformedValue, schemaProperty, currentPath);
        } catch (error) {
          if (error instanceof MapperError) {
            warnings.push({
              code: WarningCode.PROPERTY_NOT_IN_SCHEMA,
              message: error.message,
              path: error.path || currentPath,
              severity: "error",
              details: error.details,
            });
            continue; // Skip invalid value
          } else {
            throw error;
          }
        }
      }

      result[schemaKey] = transformedValue;
    } catch (error) {
      if (error instanceof MapperError) {
        warnings.push({
          code: WarningCode.PROPERTY_NOT_IN_SCHEMA,
          message: error.message,
          path: error.path || currentPath,
          severity: "error",
          details: error.details,
        });
      } else {
        throw error;
      }
    }
  }

  // Handle additional properties
  const mappedInputKeys = new Set(
    Object.values(schemaProperties).flatMap((prop) => {
      const mapFrom = prop["x-map-from"];
      if (!mapFrom) return [];
      return Array.isArray(mapFrom) ? mapFrom : [mapFrom];
    }),
  );

  for (const inputKey of inputKeys) {
    if (
      !Object.keys(schemaProperties).includes(inputKey) &&
      !mappedInputKeys.has(inputKey)
    ) {
      if (options.strict || schema.additionalProperties === false) {
        warnings.push({
          code: WarningCode.ADDITIONAL_PROPERTY,
          message: `Additional property '${inputKey}' will be dropped`,
          path: path ? `${path}.${inputKey}` : inputKey,
          severity: options.strict ? "error" : "warning",
          details: {
            suggestion:
              "Define property in schema or set additionalProperties: true",
          },
        });
        metadata.propertiesDropped++;
      } else {
        // Include additional properties as-is
        result[inputKey] = data[inputKey];
      }
    }
  }

  return result;
}
