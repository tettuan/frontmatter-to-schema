/**
 * Type guards for safe runtime type checking
 * Replaces unsafe type assertions with validated checks
 */

import { createDomainError, type DomainError, type Result } from "./result.ts";

/**
 * Type guard for Record<string, unknown>
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

/**
 * Safe conversion to Record<string, unknown> with validation
 */
export function toRecord(
  value: unknown,
  context?: string,
): Result<Record<string, unknown>, DomainError & { message: string }> {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "InvalidFormat",
          input: String(value),
          expectedFormat: "Record<string, unknown>",
        },
        `Expected object type${
          context ? ` in ${context}` : ""
        }, got ${typeof value}`,
      ),
    };
  }
  return { ok: true, data: value };
}

/**
 * Type guard for objects with a specific property
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> {
  return isRecord(obj) && key in obj;
}

/**
 * Safe property access with validation
 */
export function getProperty(
  obj: unknown,
  key: string,
  context?: string,
): Result<unknown, DomainError> {
  if (!hasProperty(obj, key)) {
    return {
      ok: false,
      error: createDomainError({
        kind: "MissingRequiredField",
        fields: [key],
      }, `Property '${key}' not found${context ? ` in ${context}` : ""}`),
    };
  }
  return { ok: true, data: obj[key] };
}

/**
 * Type guard for objects with a 'kind' property (discriminated unions)
 */
export function hasKindProperty(value: unknown): value is { kind: unknown } {
  return hasProperty(value, "kind");
}

/**
 * Safe kind extraction for discriminated unions
 */
export function getKind(
  value: unknown,
  context?: string,
): Result<unknown, DomainError> {
  if (!hasKindProperty(value)) {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "MissingRequiredField",
          fields: ["kind"],
        },
        `Expected object with 'kind' property${
          context ? ` in ${context}` : ""
        }`,
      ),
    };
  }
  return { ok: true, data: value.kind };
}

/**
 * Type guard for objects with config property
 */
export function hasConfigProperty(
  value: unknown,
): value is { config: unknown } {
  return hasProperty(value, "config");
}

/**
 * Safe config extraction
 */
export function getConfig(
  value: unknown,
  context?: string,
): Result<Record<string, unknown>, DomainError> {
  if (!hasConfigProperty(value)) {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "MissingRequiredField",
          fields: ["config"],
        },
        `Expected object with 'config' property${
          context ? ` in ${context}` : ""
        }`,
      ),
    };
  }

  return toRecord(value.config, `${context}.config`);
}

/**
 * Type guard for objects with supports property
 */
export function hasSupportsProperty(
  value: unknown,
): value is { supports: unknown } {
  return hasProperty(value, "supports");
}

/**
 * Safe supports extraction
 */
export function getSupports(
  value: unknown,
  context?: string,
): Result<Record<string, unknown>, DomainError> {
  if (!hasSupportsProperty(value)) {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "MissingRequiredField",
          fields: ["supports"],
        },
        `Expected object with 'supports' property${
          context ? ` in ${context}` : ""
        }`,
      ),
    };
  }

  return toRecord(value.supports, `${context}.supports`);
}

/**
 * Type guard for objects with schema property
 */
export function hasSchemaProperty(
  value: unknown,
): value is { schema: unknown } {
  return hasProperty(value, "schema");
}

/**
 * Safe schema extraction as Record
 */
export function getSchemaAsRecord(
  value: unknown,
  context?: string,
): Result<Record<string, unknown>, DomainError> {
  if (!hasSchemaProperty(value)) {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "MissingRequiredField",
          fields: ["schema"],
        },
        `Expected object with 'schema' property${
          context ? ` in ${context}` : ""
        }`,
      ),
    };
  }

  return toRecord(value.schema, `${context}.schema`);
}

/**
 * Type guard for objects with options property
 */
export function hasOptionsProperty(
  value: unknown,
): value is { options: unknown } {
  return hasProperty(value, "options");
}

/**
 * Safe options extraction
 */
export function getOptions(
  value: unknown,
  context?: string,
): Result<Record<string, unknown>, DomainError> {
  const optionsResult = hasOptionsProperty(value)
    ? { ok: true as const, data: value.options }
    : {
      ok: false as const,
      error: createDomainError(
        {
          kind: "MissingRequiredField",
          fields: ["options"],
        },
        `Expected object with 'options' property${
          context ? ` in ${context}` : ""
        }`,
      ),
    };

  if (!optionsResult.ok) {
    return optionsResult;
  }

  return toRecord(optionsResult.data, `${context}.options`);
}

/**
 * Safe nested property access with path traversal
 */
export function getNestedProperty(
  obj: unknown,
  path: string[],
  context?: string,
): Result<unknown, DomainError> {
  let current = obj;

  for (const segment of path) {
    const recordResult = toRecord(
      current,
      `${context}.${path.slice(0, path.indexOf(segment) + 1).join(".")}`,
    );
    if (!recordResult.ok) {
      return recordResult;
    }

    if (!(segment in recordResult.data)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "MissingRequiredField",
            fields: [segment],
          },
          `Property '${segment}' not found in path '${path.join(".")}'${
            context ? ` in ${context}` : ""
          }`,
        ),
      };
    }

    current = recordResult.data[segment];
  }

  return { ok: true, data: current };
}
