/**
 * Registry Schema Service
 *
 * Handles CLI registry schema creation and management following SRP.
 * Extracted from BuildRegistryUseCase to reduce AI complexity.
 * Applies Smart Constructor pattern and Totality principle.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { Schema, SchemaId } from "../models/entities.ts";
import { SchemaDefinition, SchemaVersion } from "../models/value-objects.ts";
import { DEFAULT_VALUES, SCHEMA_IDS } from "../constants/index.ts";
import { COMMAND_FIELD_METADATA } from "../constants/command-fields.ts";

/**
 * Service responsible for CLI registry schema management
 * Following AI Complexity Control Framework - focused on schema concerns
 */
export class RegistrySchemaService {
  /**
   * Create default CLI schema for registry building
   * Extracted from BuildRegistryUseCase.createDefaultCliSchema() lines 196-262
   * Applies Smart Constructor pattern with Result types
   */
  createDefaultCliSchema(): Result<
    Schema,
    DomainError & { message: string }
  > {
    // Create schema ID using Smart Constructor
    const schemaId = SchemaId.create(SCHEMA_IDS.CLI_REGISTRY);
    if (!schemaId.ok) {
      return {
        ok: false,
        error: createDomainError(schemaId.error, "Failed to create schema ID"),
      };
    }

    // Create schema version using Smart Constructor
    const schemaVersion = SchemaVersion.create(DEFAULT_VALUES.SCHEMA_VERSION);
    if (!schemaVersion.ok) {
      return {
        ok: false,
        error: createDomainError(
          schemaVersion.error,
          "Failed to create schema version",
        ),
      };
    }

    // Build schema definition from command field metadata
    const { properties, required } = this.buildSchemaProperties();

    const cliSchemaDefinition = {
      type: "object" as const,
      properties,
      required,
    };

    // Create schema definition using Smart Constructor
    const schemaDefinition = SchemaDefinition.create(
      cliSchemaDefinition,
      DEFAULT_VALUES.SCHEMA_VERSION,
    );
    if (!schemaDefinition.ok) {
      return {
        ok: false,
        error: createDomainError(
          schemaDefinition.error,
          "Failed to create schema definition",
        ),
      };
    }

    // Create final schema using Smart Constructor
    const schema = Schema.create(
      schemaId.data,
      schemaDefinition.data,
      schemaVersion.data,
      "Schema for CLI command registry building from prompt frontmatter",
    );

    return { ok: true, data: schema };
  }

  /**
   * Build schema properties from command field metadata
   * Extracted for clarity and single responsibility
   */
  private buildSchemaProperties(): {
    properties: Record<string, unknown>;
    required: string[];
  } {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    // Build properties from field metadata using Totality principle
    for (const [field, metadata] of Object.entries(COMMAND_FIELD_METADATA)) {
      properties[field] = {
        type: metadata.type,
        description: metadata.description,
      };

      if (metadata.required) {
        required.push(field);
      }
    }

    return { properties, required };
  }
}
