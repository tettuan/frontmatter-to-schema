/**
 * Schema-based Frontmatter Extractor
 * Extracts frontmatter data according to schema definitions
 * Follows Totality principles with discriminated unions and Result types
 */

import { isObject } from "../shared/type-guards.ts";
import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { ResultHandlerService } from "../services/result-handler-service.ts";

// Totality-compliant schema property extractor result
export type SchemaExtractionResult = {
  kind: "StringValue";
  value: string;
} | {
  kind: "ObjectValue";
  properties: Record<string, SchemaExtractionResult>;
} | {
  kind: "ArrayValue";
  elements: unknown[];
} | {
  kind: "NotPresent";
};

// Totality-compliant extracted data using discriminated unions
export type ExtractedVersion = {
  kind: "Present";
  value: string;
} | {
  kind: "NotPresent";
};

export type ExtractedDescription = {
  kind: "Present";
  value: string;
} | {
  kind: "NotPresent";
};

export type ExtractedTools = {
  kind: "Present";
  availableConfigs: { kind: "Present"; values: string[] } | {
    kind: "NotPresent";
  };
  commands: { kind: "Present"; values: unknown[] } | { kind: "NotPresent" };
} | {
  kind: "NotPresent";
};

/**
 * Extract according to schema structure
 * @param frontmatterData - The parsed frontmatter data
 * @param schema - The JSON schema object
 * @returns Result containing extracted data or error
 */
export function extractAccordingToSchema(
  frontmatterData: Record<string, unknown>,
  schema: Record<string, unknown>,
): Result<
  Record<string, SchemaExtractionResult>,
  DomainError & { message: string }
> {
  try {
    const result: Record<string, SchemaExtractionResult> = {};

    // Check each property in the schema
    for (const [schemaKey, schemaValue] of Object.entries(schema)) {
      if (schemaKey === "$schema") continue; // Skip meta properties

      // Extract based on frontmatter presence and schema type
      result[schemaKey] = extractSchemaProperty(
        frontmatterData,
        schemaKey,
        schemaValue,
      );
    }

    return { ok: true, data: result };
  } catch (error) {
    return ResultHandlerService.createError(
      createDomainError(
        {
          kind: "ProcessingStageError",
          stage: "schema extraction",
          error: {
            kind: "InvalidResponse",
            service: "schema-extractor",
            response: String(error),
          },
        },
        `Schema extraction failed: ${error}`,
      ),
      {
        operation: "extractAccordingToSchema",
        component: "SchemaExtractor",
      },
    );
  }
}

/**
 * Extract a single schema property using Totality patterns
 */
function extractSchemaProperty(
  frontmatterData: Record<string, unknown>,
  schemaKey: string,
  schemaValue: unknown,
): SchemaExtractionResult {
  // If the frontmatter has a matching key, use it
  if (frontmatterData[schemaKey] !== undefined) {
    const value = frontmatterData[schemaKey];
    if (typeof value === "string") {
      return { kind: "StringValue", value };
    }
    if (Array.isArray(value)) {
      return { kind: "ArrayValue", elements: value };
    }
    if (isObject(value)) {
      const properties: Record<string, SchemaExtractionResult> = {};
      for (const [key, val] of Object.entries(value)) {
        if (typeof val === "string") {
          properties[key] = { kind: "StringValue", value: val };
        } else {
          properties[key] = { kind: "NotPresent" };
        }
      }
      return { kind: "ObjectValue", properties };
    }
  }

  // Check if schema defines structure for missing values
  if (isObject(schemaValue)) {
    if (
      schemaValue.type === "object" && schemaValue.properties &&
      isObject(schemaValue.properties)
    ) {
      // Create object structure with NotPresent values
      const properties: Record<string, SchemaExtractionResult> = {};
      for (const nestedKey of Object.keys(schemaValue.properties)) {
        properties[nestedKey] = { kind: "NotPresent" };
      }
      return { kind: "ObjectValue", properties };
    }
    if (schemaValue.type === "array") {
      return { kind: "ArrayValue", elements: [] };
    }
    if (schemaValue.type === "string") {
      return { kind: "NotPresent" };
    }
  }

  return { kind: "NotPresent" };
}

/**
 * Extract version from frontmatter
 */
export function extractVersion(
  frontmatterData: Record<string, unknown>,
  pattern?: string,
): ExtractedVersion {
  if (frontmatterData.version === undefined) {
    return { kind: "NotPresent" };
  }

  const version = frontmatterData.version;
  if (typeof version !== "string") {
    return { kind: "NotPresent" };
  }

  // Handle pattern validation if provided
  if (pattern) {
    try {
      const regex = new RegExp(pattern);
      if (regex.test(version)) {
        return { kind: "Present", value: version };
      }
      return { kind: "NotPresent" };
    } catch {
      // Invalid regex pattern
      return { kind: "NotPresent" };
    }
  }

  return { kind: "Present", value: version };
}

/**
 * Extract description from frontmatter
 */
export function extractDescription(
  frontmatterData: Record<string, unknown>,
): ExtractedDescription {
  if (frontmatterData.description === undefined) {
    return { kind: "NotPresent" };
  }

  const description = frontmatterData.description;
  if (typeof description === "string") {
    return { kind: "Present", value: description };
  }

  return { kind: "NotPresent" };
}

/**
 * Extract tools from frontmatter
 */
export function extractTools(
  frontmatterData: Record<string, unknown>,
): ExtractedTools {
  if (frontmatterData.tools === undefined) {
    return { kind: "NotPresent" };
  }

  const tools = frontmatterData.tools;
  if (!isObject(tools)) {
    return { kind: "NotPresent" };
  }

  // Extract configs
  const availableConfigs = extractConfigs(tools);

  // Extract commands
  const commands = extractCommands(tools);

  return {
    kind: "Present",
    availableConfigs,
    commands,
  };
}

/**
 * Extract configs from tools data
 */
function extractConfigs(
  toolsData: Record<string, unknown>,
): { kind: "Present"; values: string[] } | { kind: "NotPresent" } {
  if (toolsData.availableConfigs === undefined) {
    return { kind: "NotPresent" };
  }

  const configs = toolsData.availableConfigs;
  if (!Array.isArray(configs)) {
    return { kind: "NotPresent" };
  }

  const validConfigs: string[] = [];
  for (const config of configs) {
    if (typeof config === "string") {
      validConfigs.push(config);
    }
  }

  return validConfigs.length > 0
    ? { kind: "Present", values: validConfigs }
    : { kind: "NotPresent" };
}

/**
 * Extract commands from tools data
 */
function extractCommands(
  toolsData: Record<string, unknown>,
): { kind: "Present"; values: unknown[] } | { kind: "NotPresent" } {
  if (toolsData.commands === undefined) {
    return { kind: "NotPresent" };
  }

  const commands = toolsData.commands;
  if (!Array.isArray(commands)) {
    return { kind: "NotPresent" };
  }

  return { kind: "Present", values: commands };
}
