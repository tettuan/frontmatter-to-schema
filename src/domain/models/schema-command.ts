/**
 * Schema-Driven Command Value Object
 *
 * Implements schema-driven field extraction for commands,
 * eliminating hardcoded command structure (c1, c2, c3).
 *
 * Following Totality principles with Result types and Smart Constructors.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { DEFAULT_COMMAND_FIELDS } from "../constants/command-fields.ts";

/**
 * Command field mapping from schema
 * Maps logical field names to actual field names in data
 */
export interface CommandFieldMapping {
  domain: string; // Maps to c1 or custom field
  action: string; // Maps to c2 or custom field
  target: string; // Maps to c3 or custom field
  title?: string;
  description?: string;
  usage?: string;
  options?: string;
}

/**
 * Default field mapping using legacy c1, c2, c3
 */
const DEFAULT_FIELD_MAPPING: CommandFieldMapping = {
  domain: DEFAULT_COMMAND_FIELDS.DOMAIN,
  action: DEFAULT_COMMAND_FIELDS.ACTION,
  target: DEFAULT_COMMAND_FIELDS.TARGET,
  title: DEFAULT_COMMAND_FIELDS.TITLE,
  description: DEFAULT_COMMAND_FIELDS.DESCRIPTION,
  usage: DEFAULT_COMMAND_FIELDS.USAGE,
  options: DEFAULT_COMMAND_FIELDS.OPTIONS,
};

/**
 * Extract field mapping from schema definition
 */
export function extractFieldMappingFromSchema(
  schema: unknown,
): CommandFieldMapping {
  // If no schema provided, use defaults
  if (!schema) {
    return DEFAULT_FIELD_MAPPING;
  }

  // Extract properties from schema
  if (typeof schema === "object" && schema !== null && "properties" in schema) {
    const properties =
      (schema as { properties: Record<string, unknown> }).properties;

    // Build mapping based on schema properties
    const mapping: CommandFieldMapping = { ...DEFAULT_FIELD_MAPPING };

    // Look for command field indicators in property descriptions
    for (const [fieldName, fieldDef] of Object.entries(properties)) {
      if (
        typeof fieldDef === "object" && fieldDef !== null &&
        "description" in fieldDef
      ) {
        const description = String(
          (fieldDef as { description: string }).description,
        ).toLowerCase();

        if (
          description.includes("domain") || description.includes("category")
        ) {
          mapping.domain = fieldName;
        } else if (
          description.includes("action") || description.includes("directive")
        ) {
          mapping.action = fieldName;
        } else if (
          description.includes("target") || description.includes("layer")
        ) {
          mapping.target = fieldName;
        } else if (description.includes("title")) {
          mapping.title = fieldName;
        } else if (description.includes("description")) {
          mapping.description = fieldName;
        } else if (description.includes("usage")) {
          mapping.usage = fieldName;
        } else if (description.includes("option")) {
          mapping.options = fieldName;
        }
      }
    }

    return mapping;
  }

  return DEFAULT_FIELD_MAPPING;
}

/**
 * Schema-driven Command Value Object
 * Encapsulates command data with schema-aware field extraction
 */
export class SchemaCommand {
  private constructor(
    private readonly data: Record<string, unknown>,
    private readonly fieldMapping: CommandFieldMapping,
  ) {}

  /**
   * Create command from data using schema-driven field extraction
   */
  static create(
    data: unknown,
    schema?: unknown,
  ): Result<SchemaCommand, DomainError & { message: string }> {
    // Validate input is an object
    if (typeof data !== "object" || data === null) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(data),
            expectedFormat: "object",
          },
          "Command data must be an object",
        ),
      };
    }

    const commandData = data as Record<string, unknown>;
    const fieldMapping = extractFieldMappingFromSchema(schema);

    // Validate required fields exist
    const requiredFields = [
      fieldMapping.domain,
      fieldMapping.action,
      fieldMapping.target,
    ];
    const missingFields = requiredFields.filter((field) =>
      !(field in commandData) ||
      commandData[field] === undefined ||
      commandData[field] === null ||
      commandData[field] === ""
    );

    if (missingFields.length > 0) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "MissingRequiredField", fields: missingFields },
          `Missing required command fields: ${missingFields.join(", ")}`,
        ),
      };
    }

    // Validate field types
    for (const field of requiredFields) {
      if (typeof commandData[field] !== "string") {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(commandData[field]),
              expectedFormat: "string",
            },
            `Command field ${field} must be a string`,
          ),
        };
      }
    }

    return { ok: true, data: new SchemaCommand(commandData, fieldMapping) };
  }

  /**
   * Create command from legacy c1, c2, c3 structure
   */
  static fromLegacy(
    c1: string,
    c2: string,
    c3: string,
    additionalData?: Record<string, unknown>,
  ): Result<SchemaCommand, DomainError & { message: string }> {
    const data = {
      [DEFAULT_COMMAND_FIELDS.DOMAIN]: c1,
      [DEFAULT_COMMAND_FIELDS.ACTION]: c2,
      [DEFAULT_COMMAND_FIELDS.TARGET]: c3,
      ...additionalData,
    };

    return SchemaCommand.create(data);
  }

  /**
   * Get domain component (formerly c1)
   */
  getDomain(): string {
    return String(this.data[this.fieldMapping.domain]);
  }

  /**
   * Get action component (formerly c2)
   */
  getAction(): string {
    return String(this.data[this.fieldMapping.action]);
  }

  /**
   * Get target component (formerly c3)
   */
  getTarget(): string {
    return String(this.data[this.fieldMapping.target]);
  }

  /**
   * Get title if available
   */
  getTitle(): string | undefined {
    if (this.fieldMapping.title && this.fieldMapping.title in this.data) {
      return String(this.data[this.fieldMapping.title]);
    }
    return undefined;
  }

  /**
   * Get description if available
   */
  getDescription(): string | undefined {
    if (
      this.fieldMapping.description &&
      this.fieldMapping.description in this.data
    ) {
      return String(this.data[this.fieldMapping.description]);
    }
    return undefined;
  }

  /**
   * Get usage if available
   */
  getUsage(): string | undefined {
    if (this.fieldMapping.usage && this.fieldMapping.usage in this.data) {
      return String(this.data[this.fieldMapping.usage]);
    }
    return undefined;
  }

  /**
   * Get options if available
   */
  getOptions(): Record<string, unknown> | undefined {
    if (this.fieldMapping.options && this.fieldMapping.options in this.data) {
      const options = this.data[this.fieldMapping.options];
      if (typeof options === "object" && options !== null) {
        return options as Record<string, unknown>;
      }
    }
    return undefined;
  }

  /**
   * Get full command identifier
   */
  getIdentifier(): string {
    return `${this.getDomain()}.${this.getAction()}.${this.getTarget()}`;
  }

  /**
   * Export to legacy format for backward compatibility
   */
  toLegacy(): { c1: string; c2: string; c3: string; [key: string]: unknown } {
    return {
      c1: this.getDomain(),
      c2: this.getAction(),
      c3: this.getTarget(),
      ...this.getAdditionalData(),
    };
  }

  /**
   * Get all data as plain object
   */
  toObject(): Record<string, unknown> {
    return { ...this.data };
  }

  /**
   * Get additional data beyond core command fields
   */
  private getAdditionalData(): Record<string, unknown> {
    const coreFields = new Set([
      this.fieldMapping.domain,
      this.fieldMapping.action,
      this.fieldMapping.target,
    ]);

    const additional: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.data)) {
      if (!coreFields.has(key)) {
        additional[key] = value;
      }
    }
    return additional;
  }

  /**
   * Check if command matches a pattern
   */
  matches(
    pattern: { domain?: string; action?: string; target?: string },
  ): boolean {
    if (pattern.domain && this.getDomain() !== pattern.domain) {
      return false;
    }
    if (pattern.action && this.getAction() !== pattern.action) {
      return false;
    }
    if (pattern.target && this.getTarget() !== pattern.target) {
      return false;
    }
    return true;
  }
}
