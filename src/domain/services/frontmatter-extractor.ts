/**
 * Frontmatter Extraction Domain Service
 * Extracts frontmatter data according to a provided schema
 * Follows Totality principles: no partial functions, discriminated unions, Result types
 */

import { isObject } from "../shared/type-guards.ts";
import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { ResultHandlerService } from "./result-handler-service.ts";
import {
  parseSimpleYamlFormat,
  parseYamlFrontmatter,
} from "../extractors/yaml-extractor.ts";
import {
  extractAccordingToSchema as extractAccordingToSchemaImpl,
  extractDescription as extractDescriptionImpl,
  type ExtractedDescription,
  type ExtractedTools,
  type ExtractedVersion,
  extractTools as extractToolsImpl,
  extractVersion as extractVersionImpl,
  type SchemaExtractionResult,
} from "../extractors/schema-extractor.ts";

// Re-export types from extractor modules
export type { ExtractedFrontmatter } from "../extractors/extractor-factory.ts";
export type {
  ExtractedDescription,
  ExtractedTools,
  ExtractedVersion,
  SchemaExtractionResult,
} from "../extractors/schema-extractor.ts";

// Totality-compliant schema definition using discriminated unions
type SchemaVersionRule = {
  kind: "WithPattern";
  type: string;
  description: string;
  pattern: string;
} | {
  kind: "WithoutPattern";
  type: string;
  description: string;
};

type SchemaDescriptionRule = {
  kind: "Required";
  type: string;
  description: string;
};

type SchemaConfigRule = {
  kind: "WithEnum";
  type: string;
  description: string;
  allowedValues: string[];
} | {
  kind: "WithoutEnum";
  type: string;
  description: string;
};

type SchemaCommandRule = {
  kind: "WithReference";
  type: string;
  description: string;
  reference: string;
} | {
  kind: "WithoutReference";
  type: string;
  description: string;
};

type SchemaToolsRule = {
  kind: "Present";
  type: string;
  description: string;
  availableConfigs: SchemaConfigRule;
  commands: SchemaCommandRule;
  required: string[];
  additionalProperties: boolean;
};

// Smart constructor for schema definition
export class SchemaDefinition {
  private constructor(
    private readonly versionRule: SchemaVersionRule | undefined,
    private readonly descriptionRule: SchemaDescriptionRule | undefined,
    private readonly toolsRule: SchemaToolsRule | undefined,
  ) {}

  static create(
    rawSchema: unknown,
  ): Result<SchemaDefinition, DomainError & { message: string }> {
    if (!isObject(rawSchema)) {
      return ResultHandlerService.createError(
        createDomainError(
          {
            kind: "InvalidFormat",
            input: String(rawSchema),
            expectedFormat: "object",
          },
          "Schema must be an object",
        ),
        {
          operation: "create",
          component: "SchemaDefinition",
        },
      );
    }

    let versionRule: SchemaVersionRule | undefined;
    let descriptionRule: SchemaDescriptionRule | undefined;
    let toolsRule: SchemaToolsRule | undefined;

    // Parse version rule
    if (rawSchema.version && isObject(rawSchema.version)) {
      const version = rawSchema.version;
      if (
        typeof version.type === "string" &&
        typeof version.description === "string"
      ) {
        if (typeof version.pattern === "string") {
          versionRule = {
            kind: "WithPattern",
            type: version.type,
            description: version.description,
            pattern: version.pattern,
          };
        } else {
          versionRule = {
            kind: "WithoutPattern",
            type: version.type,
            description: version.description,
          };
        }
      }
    }

    // Parse description rule
    if (rawSchema.description && isObject(rawSchema.description)) {
      const desc = rawSchema.description;
      if (
        typeof desc.type === "string" && typeof desc.description === "string"
      ) {
        descriptionRule = {
          kind: "Required",
          type: desc.type,
          description: desc.description,
        };
      }
    }

    // Parse tools rule (simplified for demonstration)
    if (rawSchema.tools && isObject(rawSchema.tools)) {
      const tools = rawSchema.tools;
      if (
        typeof tools.type === "string" && typeof tools.description === "string"
      ) {
        // This is a simplified implementation - full parsing would be more complex
        toolsRule = {
          kind: "Present",
          type: tools.type,
          description: tools.description,
          availableConfigs: {
            kind: "WithoutEnum",
            type: "array",
            description: "configs",
          },
          commands: {
            kind: "WithoutReference",
            type: "array",
            description: "commands",
          },
          required: [],
          additionalProperties: false,
        };
      }
    }

    return {
      ok: true,
      data: new SchemaDefinition(versionRule, descriptionRule, toolsRule),
    };
  }

  getVersionRule(): SchemaVersionRule | undefined {
    return this.versionRule;
  }

  getDescriptionRule(): SchemaDescriptionRule | undefined {
    return this.descriptionRule;
  }

  getToolsRule(): SchemaToolsRule | undefined {
    return this.toolsRule;
  }
}

export class ExtractedData {
  private constructor(
    private readonly version: ExtractedVersion,
    private readonly description: ExtractedDescription,
    private readonly tools: ExtractedTools,
  ) {}

  static create(
    version: ExtractedVersion,
    description: ExtractedDescription,
    tools: ExtractedTools,
  ): ExtractedData {
    return new ExtractedData(version, description, tools);
  }

  getVersion(): ExtractedVersion {
    return this.version;
  }

  getDescription(): ExtractedDescription {
    return this.description;
  }

  getTools(): ExtractedTools {
    return this.tools;
  }
}

/**
 * Extract frontmatter data according to the provided schema
 * Totality-compliant: returns Result type and uses discriminated unions
 * @param frontmatterData - The parsed frontmatter YAML object
 * @param schemaDefinition - The schema definition
 * @returns Result containing either extracted data or error
 */
export function extractFrontmatterToSchema(
  frontmatterData: Record<string, unknown>,
  schemaDefinition: SchemaDefinition,
): Result<ExtractedData, DomainError & { message: string }> {
  try {
    // Extract version
    const version = extractVersion(
      frontmatterData,
      schemaDefinition.getVersionRule(),
    );
    const description = extractDescription(
      frontmatterData,
      schemaDefinition.getDescriptionRule(),
    );
    const tools = extractTools(
      frontmatterData,
      schemaDefinition.getToolsRule(),
    );

    const extractedData = ExtractedData.create(version, description, tools);

    return { ok: true, data: extractedData };
  } catch (error) {
    return ResultHandlerService.createError(
      createDomainError(
        {
          kind: "ProcessingStageError",
          stage: "frontmatter extraction",
          error: {
            kind: "InvalidResponse",
            service: "extractor",
            response: String(error),
          },
        },
        `Frontmatter extraction failed: ${error}`,
      ),
      {
        operation: "extractFrontmatterToSchema",
        component: "FrontmatterExtractor",
      },
    );
  }
}

/**
 * Extract version from frontmatter using Totality patterns
 */
function extractVersion(
  frontmatterData: Record<string, unknown>,
  versionRule: SchemaVersionRule | undefined,
): ExtractedVersion {
  if (!versionRule) {
    return { kind: "NotPresent" };
  }

  // Use pattern from rule if it exists
  const pattern = versionRule.kind === "WithPattern"
    ? versionRule.pattern
    : undefined;
  return extractVersionImpl(frontmatterData, pattern);
}

/**
 * Extract description from frontmatter using Totality patterns
 */
function extractDescription(
  frontmatterData: Record<string, unknown>,
  descriptionRule: SchemaDescriptionRule | undefined,
): ExtractedDescription {
  if (!descriptionRule) {
    return { kind: "NotPresent" };
  }

  return extractDescriptionImpl(frontmatterData);
}

/**
 * Extract tools from frontmatter using Totality patterns
 */
function extractTools(
  frontmatterData: Record<string, unknown>,
  toolsRule: SchemaToolsRule | undefined,
): ExtractedTools {
  if (!toolsRule) {
    return { kind: "NotPresent" };
  }

  return extractToolsImpl(frontmatterData);
}

/**
 * Parse YAML frontmatter and extract according to schema
 * @param yamlContent - The raw YAML frontmatter content
 * @param schema - The JSON schema definition
 * @returns Result containing either extracted data or error
 */
export function parseFrontmatterAndExtract(
  yamlContent: string,
  schema: SchemaDefinition,
): Result<ExtractedData, DomainError & { message: string }> {
  // Use YAML extractor module
  const parseResult = parseYamlFrontmatter(yamlContent);
  if (!parseResult.ok) {
    return parseResult;
  }

  return extractFrontmatterToSchema(parseResult.data, schema);
}

/**
 * Main extraction function as specified in the task
 * Totality-compliant version using discriminated unions instead of null
 * @param frontmatterYaml - The frontmatter YAML string (e.g., "title:プロジェクト全体の深掘り調査と修正タスク洗い出し")
 * @param schema - The JSON schema object
 * @returns Result containing either extracted data or error
 */
export function extractAccordingToSchema(
  frontmatterYaml: string,
  schema: Record<string, unknown>,
): Result<
  Record<string, SchemaExtractionResult>,
  DomainError & { message: string }
> {
  // Parse the simple YAML format
  const parseResult = parseSimpleYamlFormat(frontmatterYaml);
  if (!parseResult.ok) {
    return parseResult;
  }

  // Extract according to schema using the schema extractor module
  return extractAccordingToSchemaImpl(parseResult.data, schema);
}

// BACKWARD COMPATIBILITY LAYER - TO BE DEPRECATED
// These functions provide compatibility with the old API during migration

/**
 * @deprecated Use SchemaDefinition.create() instead
 * Backward compatibility wrapper for legacy schema format
 */
export function createLegacySchemaDefinition(
  schema: Record<string, unknown>,
): SchemaDefinition {
  const result = SchemaDefinition.create(schema);
  if (!result.ok) {
    throw new Error(`Invalid schema: ${result.error.message}`);
  }
  return result.data;
}

/**
 * @deprecated Use the new Result-based API instead
 * Backward compatibility wrapper for extractFrontmatterToSchema
 */
export function extractFrontmatterToSchemaLegacy(
  frontmatterData: Record<string, unknown>,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const schemaDefinition = createLegacySchemaDefinition(schema);
  const result = extractFrontmatterToSchema(frontmatterData, schemaDefinition);

  if (!result.ok) {
    // Return legacy format with null values on error
    return {
      version: null,
      description: null,
      tools: null,
    };
  }

  const data = result.data;

  // Convert new discriminated union format back to legacy null-based format
  const version = data.getVersion();
  const description = data.getDescription();
  const tools = data.getTools();

  return {
    version: version.kind === "Present" ? version.value : null,
    description: description.kind === "Present" ? description.value : null,
    tools: tools.kind === "Present"
      ? {
        availableConfigs: tools.availableConfigs.kind === "Present"
          ? tools.availableConfigs.values
          : null,
        commands: tools.commands.kind === "Present"
          ? tools.commands.values
          : null,
      }
      : null,
  };
}

/**
 * @deprecated Use the new Result-based API instead
 * Backward compatibility wrapper for extractAccordingToSchema
 */
export function extractAccordingToSchemaLegacy(
  frontmatterYaml: string,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const result = extractAccordingToSchema(frontmatterYaml, schema);

  if (!result.ok) {
    // Return legacy format with null values on error
    const legacyResult: Record<string, unknown> = {};
    for (const key of Object.keys(schema)) {
      if (key !== "$schema") {
        legacyResult[key] = null;
      }
    }
    return legacyResult;
  }

  // Convert new discriminated union format back to legacy null-based format
  const legacyResult: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result.data)) {
    switch (value.kind) {
      case "StringValue":
        legacyResult[key] = value.value;
        break;
      case "ObjectValue": {
        const obj: Record<string, unknown> = {};
        for (const [propKey, propValue] of Object.entries(value.properties)) {
          obj[propKey] = propValue.kind === "StringValue"
            ? propValue.value
            : null;
        }
        legacyResult[key] = obj;
        break;
      }
      case "ArrayValue":
        legacyResult[key] = value.elements.length > 0 ? value.elements : null;
        break;
      case "NotPresent":
        legacyResult[key] = null;
        break;
    }
  }

  return legacyResult;
}

/**
 * @deprecated Use the new Result-based API instead
 * Backward compatibility wrapper for parseFrontmatterAndExtract
 */
export function parseFrontmatterAndExtractLegacy(
  yamlContent: string,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const schemaDefinition = createLegacySchemaDefinition(schema);
  const result = parseFrontmatterAndExtract(yamlContent, schemaDefinition);

  if (!result.ok) {
    // Return legacy format with null values on error
    return {
      version: null,
      description: null,
      tools: null,
    };
  }

  const data = result.data;
  const version = data.getVersion();
  const description = data.getDescription();
  const tools = data.getTools();

  // Convert new discriminated union format back to legacy null-based format
  return {
    version: version.kind === "Present" ? version.value : null,
    description: description.kind === "Present" ? description.value : null,
    tools: tools.kind === "Present"
      ? {
        availableConfigs: tools.availableConfigs.kind === "Present"
          ? tools.availableConfigs.values
          : null,
        commands: tools.commands.kind === "Present"
          ? tools.commands.values
          : null,
      }
      : null,
  };
}
