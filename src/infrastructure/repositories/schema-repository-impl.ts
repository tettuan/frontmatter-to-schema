/**
 * Schema Repository Implementation
 * Handles loading, validation and caching of schemas
 * Follows Totality principles with Result types and Smart Constructors
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import { SchemaRefResolver } from "../../domain/config/schema-ref-resolver.ts";
import type { FileSystemRepository } from "../../domain/repositories/file-system-repository.ts";
import { VERSION_CONFIG } from "../../config/version.ts";
import type { ConfigPath } from "../../domain/models/value-objects.ts";
import {
  Schema,
  SchemaId,
  SchemaVersion,
} from "../../domain/models/entities.ts";
import { SchemaDefinition } from "../../domain/models/value-objects.ts";
import type { SchemaRepository } from "../../domain/services/interfaces.ts";

// Type guard helper following Totality principle
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Type guard for string extraction
function getStringProperty(
  obj: Record<string, unknown>,
  key: string,
  defaultValue = "",
): string {
  const value = obj[key];
  return typeof value === "string" ? value : defaultValue;
}

export class SchemaRepositoryImpl implements SchemaRepository {
  private readonly refResolver: SchemaRefResolver;
  private readonly schemaCache: Map<string, Schema> = new Map();

  constructor(fileSystemRepository: FileSystemRepository) {
    this.refResolver = new SchemaRefResolver(fileSystemRepository, ".");
  }

  validate(schema: Schema): Result<void, DomainError & { message: string }> {
    // Validate schema has required properties
    if (!schema.getId() || !schema.getDefinition() || !schema.getVersion()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "MissingRequiredField",
          fields: ["id", "definition", "version"],
        }, "Invalid schema structure"),
      };
    }

    return { ok: true, data: undefined };
  }

  async load(
    path: ConfigPath,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    const schemaPath = path.getValue();

    // Check cache first
    const cached = this.schemaCache.get(schemaPath);
    if (cached) {
      return { ok: true, data: cached };
    }

    try {
      // Read file content
      const content = await this.readSchemaFile(schemaPath);
      if (!content.ok) {
        return content;
      }

      // Parse and resolve schema
      const schemaData = await this.parseAndResolveSchema(
        content.data,
        schemaPath,
      );
      if (!schemaData.ok) {
        return schemaData;
      }

      // Create Schema entity
      const schema = this.createSchemaEntity(
        schemaData.data,
        schemaPath,
      );
      if (!schema.ok) {
        return schema;
      }

      // Cache the schema
      this.schemaCache.set(schemaPath, schema.data);

      return schema;
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: schemaPath,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  private async readSchemaFile(
    schemaPath: string,
  ): Promise<Result<string, DomainError & { message: string }>> {
    try {
      const content = await Deno.readTextFile(schemaPath);
      return { ok: true, data: content };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({
            kind: "FileNotFound",
            path: schemaPath,
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: schemaPath,
          details: error instanceof Error ? error.message : "Unknown error",
        }, `Failed to read schema file: ${schemaPath}`),
      };
    }
  }

  private async parseAndResolveSchema(
    content: string,
    schemaPath: string,
  ): Promise<
    Result<Record<string, unknown>, DomainError & { message: string }>
  > {
    try {
      const parsedSchema = JSON.parse(content);

      // Resolve $ref references recursively
      const resolvedResult = await this.refResolver.resolveSchema(
        parsedSchema,
        schemaPath,
      );
      if (!resolvedResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: schemaPath,
            details: `Failed to resolve $ref: ${resolvedResult.error.message}`,
          }),
        };
      }

      if (!isRecord(resolvedResult.data)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: typeof resolvedResult.data,
            expectedFormat: "object",
          }, "Schema data must be an object"),
        };
      }

      return { ok: true, data: resolvedResult.data };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: schemaPath,
          details: `Invalid JSON: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }),
      };
    }
  }

  private createSchemaEntity(
    data: Record<string, unknown>,
    schemaPath: string,
  ): Result<Schema, DomainError & { message: string }> {
    const idResult = SchemaId.create(
      getStringProperty(data, "id", "default-schema"),
    );
    if (!idResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: schemaPath,
          details: "Invalid schema ID",
        }),
      };
    }

    const definitionResult = SchemaDefinition.create(
      data,
      getStringProperty(
        data,
        "version",
        VERSION_CONFIG.DEFAULT_SCHEMA_VERSION,
      ),
    );
    if (!definitionResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: schemaPath,
          details: "Invalid schema definition",
        }),
      };
    }

    const versionResult = SchemaVersion.create(
      getStringProperty(
        data,
        "version",
        VERSION_CONFIG.DEFAULT_SCHEMA_VERSION,
      ),
    );
    if (!versionResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: schemaPath,
          details: "Invalid schema version",
        }),
      };
    }

    const schemaResult = Schema.create(
      idResult.data,
      definitionResult.data,
      versionResult.data,
      getStringProperty(data, "description", ""),
    );

    if (!schemaResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: schemaPath,
          details: "Failed to create schema entity",
        }, "Schema creation failed"),
      };
    }

    return { ok: true, data: schemaResult.data };
  }
}
