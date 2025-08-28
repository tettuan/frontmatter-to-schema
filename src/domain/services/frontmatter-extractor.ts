/**
 * Frontmatter Extraction Function
 * Extracts frontmatter data according to a provided schema
 */

import { isObject } from "../shared/type-guards.ts";

interface SchemaDefinition {
  version?: {
    type: string;
    description: string;
    pattern?: string;
  };
  description?: {
    type: string;
    description: string;
  };
  tools?: {
    type: string;
    description: string;
    properties?: {
      availableConfigs?: {
        type: string;
        description: string;
        items?: {
          type: string;
          enum?: string[];
        };
      };
      commands?: {
        type: string;
        description: string;
        items?: {
          $ref?: string;
        };
      };
    };
    required?: string[];
    additionalProperties?: boolean;
  };
}

interface ExtractedData {
  version: string | null;
  description: string | null;
  tools: {
    availableConfigs: string[] | null;
    commands: unknown[] | null;
  } | null;
}

/**
 * Extract frontmatter data according to the provided schema
 * @param frontmatterData - The parsed frontmatter YAML object
 * @param schema - The JSON schema definition
 * @returns Extracted data matching the schema structure
 */
export function extractFrontmatterToSchema(
  frontmatterData: Record<string, unknown>,
  schema: SchemaDefinition,
): ExtractedData {
  const result: ExtractedData = {
    version: null,
    description: null,
    tools: null,
  };

  // Extract version if present in frontmatter
  if (schema.version && frontmatterData.version !== undefined) {
    const version = frontmatterData.version;
    if (typeof version === "string") {
      // Validate pattern if specified
      if (schema.version.pattern) {
        const pattern = new RegExp(schema.version.pattern);
        if (pattern.test(version)) {
          result.version = version;
        }
      } else {
        result.version = version;
      }
    }
  }

  // Extract description if present in frontmatter
  if (schema.description && frontmatterData.description !== undefined) {
    const description = frontmatterData.description;
    if (typeof description === "string") {
      result.description = description;
    }
  }

  // Extract tools if present in frontmatter
  if (schema.tools && frontmatterData.tools !== undefined) {
    const tools = frontmatterData.tools;
    if (isObject(tools)) {
      result.tools = {
        availableConfigs: null,
        commands: null,
      };

      // Extract availableConfigs
      if (
        schema.tools.properties?.availableConfigs &&
        tools.availableConfigs !== undefined
      ) {
        const configs = tools.availableConfigs;
        if (Array.isArray(configs)) {
          const validConfigs: string[] = [];
          for (const config of configs) {
            if (typeof config === "string") {
              // Check enum constraint if specified
              const enumValues = schema.tools.properties.availableConfigs.items
                ?.enum;
              if (enumValues) {
                if (enumValues.includes(config)) {
                  validConfigs.push(config);
                }
              } else {
                validConfigs.push(config);
              }
            }
          }
          if (validConfigs.length > 0) {
            result.tools.availableConfigs = validConfigs;
          }
        }
      }

      // Extract commands
      if (
        schema.tools.properties?.commands && tools.commands !== undefined
      ) {
        const commands = tools.commands;
        if (Array.isArray(commands)) {
          result.tools.commands = commands;
        }
      }
    }
  }

  return result;
}

/**
 * Parse YAML frontmatter and extract according to schema
 * @param yamlContent - The raw YAML frontmatter content
 * @param schema - The JSON schema definition
 * @returns JSON object with extracted data
 */
export function parseFrontmatterAndExtract(
  yamlContent: string,
  schema: SchemaDefinition,
): ExtractedData {
  // Simple YAML parsing for the given example
  const frontmatterData: Record<string, unknown> = {};

  // Parse simple key-value pairs from YAML
  const lines = yamlContent.split("\n");
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, "");
      frontmatterData[key] = cleanValue;
    }
  }

  return extractFrontmatterToSchema(frontmatterData, schema);
}

/**
 * Main extraction function as specified in the task
 * @param frontmatterYaml - The frontmatter YAML string (e.g., "title:プロジェクト全体の深掘り調査と修正タスク洗い出し")
 * @param schema - The JSON schema object
 * @returns JSON object containing the extracted data
 */
export function extractAccordingToSchema(
  frontmatterYaml: string,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  // Parse the frontmatter
  const frontmatterData: Record<string, unknown> = {};

  // Handle the specific format from the task (e.g., "title:プロジェクト全体の深掘り調査と修正タスク洗い出し")
  const parts = frontmatterYaml.split(":");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join(":").trim();
    frontmatterData[key] = value;
  }

  // Extract according to schema structure
  const result: Record<string, unknown> = {};

  // Check each property in the schema
  for (const [schemaKey, schemaValue] of Object.entries(schema)) {
    if (schemaKey === "$schema") continue; // Skip meta properties

    // Initialize with null for missing required fields
    result[schemaKey] = null;

    // If the frontmatter has a matching key, use it
    if (frontmatterData[schemaKey] !== undefined) {
      result[schemaKey] = frontmatterData[schemaKey];
    } else {
      // Check if it's an object with nested properties
      if (isObject(schemaValue)) {
        if (schemaValue.type === "object" && schemaValue.properties) {
          // Initialize nested object with null values
          const nestedObj: Record<string, unknown> = {};
          // Safely access properties if it's an object
          const properties = schemaValue.properties;
          if (isObject(properties)) {
            for (const nestedKey of Object.keys(properties)) {
              nestedObj[nestedKey] = null;
            }
          }
          result[schemaKey] = nestedObj;
        } else if (schemaValue.type === "array") {
          result[schemaKey] = null;
        } else if (schemaValue.type === "string") {
          result[schemaKey] = null;
        }
      }
    }
  }

  return result;
}
