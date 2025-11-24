/**
 * Pattern Collector Module
 *
 * Collects properties from a source object that match a regex pattern.
 * Used by x-collect-pattern directive.
 */

import { CollectPatternConfig, MappingWarning, WarningCode } from "./types.ts";

/**
 * Result of pattern collection
 */
export interface CollectPatternResult {
  data:
    | Array<{ key: string; value: unknown }>
    | Record<string, unknown>
    | string[]
    | unknown[];
  warnings: MappingWarning[];
}

/**
 * Resolves a dot-notation path to a value in data
 */
function resolvePath(
  data: Record<string, unknown>,
  path: string,
): unknown {
  const parts = path.split(".");
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Collects properties matching a pattern from source data
 */
export function collectByPattern(
  data: Record<string, unknown>,
  config: CollectPatternConfig,
  propertyPath: string,
): CollectPatternResult {
  const warnings: MappingWarning[] = [];
  const format = config.format || "key-value";

  // Validate required fields (should be validated before calling, but guard for safety)
  if (!config.source || !config.pattern) {
    return { data: [], warnings };
  }

  // Resolve source path
  const sourceData = resolvePath(data, config.source);

  if (sourceData === undefined) {
    warnings.push({
      code: WarningCode.COLLECT_PATTERN_SOURCE_NOT_FOUND,
      message: `Source path '${config.source}' not found in data`,
      path: propertyPath,
      severity: "warning",
      details: {
        reason: `Cannot collect from non-existent path: ${config.source}`,
      },
    });
    return { data: [], warnings };
  }

  if (
    sourceData === null || typeof sourceData !== "object" ||
    Array.isArray(sourceData)
  ) {
    warnings.push({
      code: WarningCode.COLLECT_PATTERN_SOURCE_NOT_OBJECT,
      message: `Source path '${config.source}' is not an object`,
      path: propertyPath,
      severity: "warning",
      details: {
        reason: `Expected object at ${config.source}, got ${
          Array.isArray(sourceData) ? "array" : typeof sourceData
        }`,
      },
    });
    return { data: [], warnings };
  }

  // Validate and compile regex
  let regex: RegExp;
  try {
    regex = new RegExp(config.pattern);
  } catch (error) {
    warnings.push({
      code: WarningCode.COLLECT_PATTERN_INVALID_REGEX,
      message: `Invalid regex pattern: ${config.pattern}`,
      path: propertyPath,
      severity: "error",
      details: {
        reason: error instanceof Error ? error.message : String(error),
      },
    });
    return { data: [], warnings };
  }

  // Collect matching properties
  const matches: Array<{ key: string; value: unknown }> = [];
  const sourceObj = sourceData as Record<string, unknown>;

  for (const [key, value] of Object.entries(sourceObj)) {
    if (regex.test(key)) {
      matches.push({ key, value });
    }
  }

  // Sort by key for consistent output
  matches.sort((a, b) => a.key.localeCompare(b.key));

  // Format output based on format option
  let result:
    | Array<{ key: string; value: unknown }>
    | Record<string, unknown>
    | string[]
    | unknown[];

  switch (format) {
    case "object": {
      const obj: Record<string, unknown> = {};
      for (const { key, value } of matches) {
        obj[key] = value;
      }
      result = obj;
      break;
    }
    case "keys":
      result = matches.map((m) => m.key);
      break;
    case "values":
      result = matches.map((m) => m.value);
      break;
    case "key-value":
    default:
      result = matches;
      break;
  }

  return { data: result, warnings };
}
