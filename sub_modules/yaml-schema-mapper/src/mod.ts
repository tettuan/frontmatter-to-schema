/**
 * YAML Schema Mapper - Public API
 *
 * Transforms raw YAML frontmatter data into schema-compliant data structures.
 *
 * @module
 *
 * @example
 * ```typescript
 * import { mapDataToSchema } from "jsr:@scope/yaml-schema-mapper";
 *
 * const result = mapDataToSchema({
 *   schema: {
 *     type: "object",
 *     properties: {
 *       input_file: {
 *         type: "boolean",
 *         "x-map-from": "file"
 *       }
 *     }
 *   },
 *   data: {
 *     file: [false]
 *   },
 *   options: {
 *     coerceTypes: true
 *   }
 * });
 *
 * if (result.isOk()) {
 *   const mapped = result.unwrap();
 *   console.log(mapped.data); // {input_file: false}
 * }
 * ```
 */

import type { MapperConfig, MapperResult } from "./types.ts";
import { MapperError } from "./errors.ts";
import { Result } from "./result.ts";
import { mapYamlToSchema } from "./yaml-mapper.ts";

// Re-export types
export type {
  JsonSchema,
  MapperConfig,
  MapperOptions,
  MapperResult,
  MappingWarning,
  SchemaProperty,
  TransformationMetadata,
  WarningDetails,
  WarningSeverity,
} from "./types.ts";
export { WarningCode } from "./types.ts";

// Re-export errors
export {
  CircularReferenceError,
  MapperError,
  PropertyMappingError,
  SchemaError,
  TypeTransformationError,
  ValidationError,
} from "./errors.ts";

// Re-export Result type
export { Result } from "./result.ts";

/**
 * Main API function to map data to schema
 *
 * @param config - Mapper configuration containing schema, data, and options
 * @returns Result containing MapperResult on success or MapperError on failure
 *
 * @example
 * ```typescript
 * const result = mapDataToSchema({
 *   schema: {
 *     type: "object",
 *     properties: {
 *       title: { type: "string" },
 *       count: { type: "number" }
 *     },
 *     required: ["title"]
 *   },
 *   data: {
 *     title: "Example",
 *     count: "42"
 *   },
 *   options: {
 *     coerceTypes: true,
 *     validateTypes: true
 *   }
 * });
 *
 * if (result.isOk()) {
 *   const { data, warnings, metadata } = result.unwrap();
 *   console.log(data); // { title: "Example", count: 42 }
 *   console.log(warnings); // [{code: "TYPE_COERCION", ...}]
 * } else {
 *   const error = result.unwrapError();
 *   console.error(error.message);
 * }
 * ```
 */
export function mapDataToSchema(
  config: MapperConfig,
): Result<MapperResult, MapperError> {
  try {
    const result = mapYamlToSchema(config);
    return Result.ok(result);
  } catch (error) {
    if (error instanceof MapperError) {
      return Result.error(error);
    }
    return Result.error(
      new MapperError(
        String(error),
        "UNKNOWN_ERROR",
      ),
    );
  }
}
