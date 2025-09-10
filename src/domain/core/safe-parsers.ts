/**
 * Safe parser utilities for eliminating type assertions
 * Provides Result-based parsing with comprehensive error handling
 */

import { createDomainError, type DomainError, type Result } from "./result.ts";
import { toRecord } from "./type-guards.ts";

/**
 * Safe JSON parser with validation
 */
export function parseJSON(
  input: string,
  context?: string,
): Result<Record<string, unknown>, DomainError & { message: string }> {
  try {
    const parsed = JSON.parse(input);
    return toRecord(
      parsed,
      context ? `JSON parsing in ${context}` : "JSON parsing",
    );
  } catch (error) {
    return {
      ok: false,
      error: createDomainError({
        kind: "ParseError",
        input: input.length > 100 ? `${input.substring(0, 100)}...` : input,
        parser: "JSON",
        details: error instanceof Error ? error.message : String(error),
      }, `Failed to parse JSON${context ? ` in ${context}` : ""}`),
    };
  }
}

/**
 * Safe YAML parser with validation (with pre-imported YAML module)
 */
export function parseYAMLWithModule(
  input: string,
  yamlModule: { parse: (input: string) => unknown },
  context?: string,
): Result<Record<string, unknown>, DomainError & { message: string }> {
  try {
    const parsed = yamlModule.parse(input);
    return toRecord(
      parsed,
      context ? `YAML parsing in ${context}` : "YAML parsing",
    );
  } catch (error) {
    return {
      ok: false,
      error: createDomainError({
        kind: "ParseError",
        input: input.length > 100 ? `${input.substring(0, 100)}...` : input,
        parser: "YAML",
        details: error instanceof Error ? error.message : String(error),
      }, `Failed to parse YAML${context ? ` in ${context}` : ""}`),
    };
  }
}

/**
 * Safe TOML parser with validation (with pre-imported TOML module)
 */
export function parseTOMLWithModule(
  input: string,
  tomlModule: { parse: (input: string) => unknown },
  context?: string,
): Result<Record<string, unknown>, DomainError & { message: string }> {
  try {
    const parsed = tomlModule.parse(input);
    return toRecord(
      parsed,
      context ? `TOML parsing in ${context}` : "TOML parsing",
    );
  } catch (error) {
    return {
      ok: false,
      error: createDomainError({
        kind: "ParseError",
        input: input.length > 100 ? `${input.substring(0, 100)}...` : input,
        parser: "TOML",
        details: error instanceof Error ? error.message : String(error),
      }, `Failed to parse TOML${context ? ` in ${context}` : ""}`),
    };
  }
}

/**
 * Safe object property extraction with array support
 */
export function getArrayProperty(
  obj: unknown,
  key: string,
  context?: string,
): Result<unknown[], DomainError> {
  const recordResult = toRecord(obj, context);
  if (!recordResult.ok) {
    return recordResult;
  }

  const property = recordResult.data[key];
  if (property === undefined) {
    return {
      ok: false,
      error: createDomainError({
        kind: "MissingRequiredField",
        fields: [key],
      }, `Property '${key}' not found${context ? ` in ${context}` : ""}`),
    };
  }

  if (!Array.isArray(property)) {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "InvalidFormat",
          input: String(property),
          expectedFormat: "array",
        },
        `Property '${key}' expected to be array${
          context ? ` in ${context}` : ""
        }, got ${typeof property}`,
      ),
    };
  }

  return { ok: true, data: property };
}

/**
 * Safe array element access
 */
export function getArrayElement(
  array: unknown,
  index: number,
  context?: string,
): Result<unknown, DomainError> {
  if (!Array.isArray(array)) {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "InvalidFormat",
          input: String(array),
          expectedFormat: "array",
        },
        `Expected array${context ? ` in ${context}` : ""}, got ${typeof array}`,
      ),
    };
  }

  if (index < 0 || index >= array.length) {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "OutOfRange",
          value: index,
          min: 0,
          max: array.length - 1,
        },
        `Array index ${index} out of range [0, ${array.length - 1}]${
          context ? ` in ${context}` : ""
        }`,
      ),
    };
  }

  return { ok: true, data: array[index] };
}

/**
 * Safe string property extraction
 */
export function getStringProperty(
  obj: unknown,
  key: string,
  context?: string,
): Result<string, DomainError> {
  const recordResult = toRecord(obj, context);
  if (!recordResult.ok) {
    return recordResult;
  }

  const property = recordResult.data[key];
  if (typeof property !== "string") {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "InvalidFormat",
          input: String(property),
          expectedFormat: "string",
        },
        `Property '${key}' expected to be string${
          context ? ` in ${context}` : ""
        }, got ${typeof property}`,
      ),
    };
  }

  return { ok: true, data: property };
}

/**
 * Safe number property extraction
 */
export function getNumberProperty(
  obj: unknown,
  key: string,
  context?: string,
): Result<number, DomainError> {
  const recordResult = toRecord(obj, context);
  if (!recordResult.ok) {
    return recordResult;
  }

  const property = recordResult.data[key];
  if (typeof property !== "number" || isNaN(property)) {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "InvalidFormat",
          input: String(property),
          expectedFormat: "number",
        },
        `Property '${key}' expected to be number${
          context ? ` in ${context}` : ""
        }, got ${typeof property}`,
      ),
    };
  }

  return { ok: true, data: property };
}

/**
 * Safe boolean property extraction
 */
export function getBooleanProperty(
  obj: unknown,
  key: string,
  context?: string,
): Result<boolean, DomainError> {
  const recordResult = toRecord(obj, context);
  if (!recordResult.ok) {
    return recordResult;
  }

  const property = recordResult.data[key];
  if (typeof property !== "boolean") {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "InvalidFormat",
          input: String(property),
          expectedFormat: "boolean",
        },
        `Property '${key}' expected to be boolean${
          context ? ` in ${context}` : ""
        }, got ${typeof property}`,
      ),
    };
  }

  return { ok: true, data: property };
}
