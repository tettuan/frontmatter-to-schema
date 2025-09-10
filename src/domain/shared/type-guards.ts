/**
 * Type Guard Utilities
 *
 * Provides safe type checking functions to replace unsafe type assertions.
 * Follows the Totality principle by returning Result types with proper error handling.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

/**
 * Checks if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Safely converts unknown value to Record<string, unknown> with validation
 */
export function asObjectRecord(
  value: unknown,
  context?: string,
): Result<Record<string, unknown>, DomainError> {
  if (isObject(value)) {
    return { ok: true, data: value };
  }

  return {
    ok: false,
    error: createDomainError(
      {
        kind: "InvalidFormat",
        input: typeof value,
        expectedFormat: "object",
      },
      `Expected object but got ${typeof value}${
        context ? ` in ${context}` : ""
      }`,
    ),
  };
}

/**
 * Safely extracts object properties with type validation
 */
export function getObjectProperty(
  obj: Record<string, unknown>,
  key: string,
  context?: string,
): Result<unknown, DomainError> {
  if (key in obj) {
    return { ok: true, data: obj[key] };
  }

  return {
    ok: false,
    error: createDomainError(
      {
        kind: "NotFound",
        resource: "property",
        name: key,
      },
      `Property '${key}' not found${context ? ` in ${context}` : ""}`,
    ),
  };
}

/**
 * Safely extracts object property as another object
 */
export function getObjectPropertyAsObject(
  obj: Record<string, unknown>,
  key: string,
  context?: string,
): Result<Record<string, unknown>, DomainError> {
  const propertyResult = getObjectProperty(obj, key, context);
  if (!propertyResult.ok) {
    return propertyResult;
  }
  return asObjectRecord(propertyResult.data, `${context || "object"}.${key}`);
}

/**
 * Validates that a value can be used as template mapping result
 */
export function validateMappingResult(
  value: unknown,
  context?: string,
): Result<Record<string, unknown>, DomainError> {
  if (value === null || value === undefined) {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "EmptyInput",
          field: context || "mapping result",
        },
        `Mapping result cannot be null or undefined${
          context ? ` in ${context}` : ""
        }`,
      ),
    };
  }

  return asObjectRecord(value, context || "mapping result");
}

/**
 * Safely processes JSON parsing results
 */
export function validateJsonParseResult(
  value: unknown,
  context?: string,
): Result<Record<string, unknown>, DomainError> {
  if (
    typeof value === "string" || typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return {
      ok: false,
      error: createDomainError(
        { kind: "InvalidFormat", input: "", expectedFormat: "" },
        `Expected JSON object but got primitive ${typeof value}${
          context ? ` in ${context}` : ""
        }`,
      ),
    };
  }

  return asObjectRecord(value, context || "JSON parse result");
}

/**
 * Type guard for checking if value has string keys (object-like)
 */
export function hasStringKeys(
  value: unknown,
): value is Record<string, unknown> {
  if (!isObject(value)) {
    return false;
  }

  // Verify all keys are strings (which they should be in JavaScript objects)
  return Object.keys(value).every((key) => typeof key === "string");
}

/**
 * Safely accesses nested object properties
 */
export function safeObjectTraversal(
  obj: unknown,
  path: string[],
  context?: string,
): Result<unknown, DomainError> {
  let current = obj;

  for (let i = 0; i < path.length; i++) {
    const part = path[i];
    const currentContext = `${context || "object"}${
      path.slice(0, i + 1).join(".")
    }`;

    if (!isObject(current)) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "InvalidFormat", input: "", expectedFormat: "" },
          `Expected object at path '${
            path.slice(0, i).join(".")
          }' but got ${typeof current} in ${currentContext}`,
        ),
      };
    }

    if (!(part in current)) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "InvalidFormat", input: "", expectedFormat: "" },
          `Property '${part}' not found at path '${
            path.slice(0, i).join(".")
          }' in ${currentContext}`,
        ),
      };
    }

    current = current[part];
  }

  return { ok: true, data: current };
}

/**
 * Validates array of objects
 */
export function validateObjectArray(
  value: unknown,
  context?: string,
): Result<Record<string, unknown>[], DomainError> {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      error: createDomainError(
        { kind: "InvalidFormat", input: "", expectedFormat: "" },
        `Expected array but got ${typeof value}${
          context ? ` in ${context}` : ""
        }`,
      ),
    };
  }

  const validatedItems: Record<string, unknown>[] = [];

  for (let i = 0; i < value.length; i++) {
    const itemResult = asObjectRecord(value[i], `${context || "array"}[${i}]`);
    if (!itemResult.ok) {
      return itemResult;
    }
    validatedItems.push(itemResult.data);
  }

  return { ok: true, data: validatedItems };
}
