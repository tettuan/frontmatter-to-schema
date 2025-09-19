import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { SchemaPath } from "../../domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../domain/schema/value-objects/schema-definition.ts";
import { ValidationRules } from "../../domain/schema/value-objects/validation-rules.ts";
import { SchemaCache } from "../../infrastructure/caching/schema-cache.ts";

/**
 * File system interface for schema operations
 * Following DDD principles - infrastructure abstraction
 */
export interface SchemaFileSystem {
  read(
    path: string,
  ):
    | Promise<Result<string, DomainError & { message: string }>>
    | Result<string, DomainError & { message: string }>;
}

/**
 * Schema Coordinator - Application Service
 *
 * Responsible for orchestrating schema-related operations
 * Following DDD principles:
 * - Single responsibility: Schema loading and management coordination
 * - Clean boundaries: Uses domain services and infrastructure adapters
 * - Totality: All methods return Result<T,E>
 */
export class SchemaCoordinator {
  constructor(
    private readonly fileSystem: SchemaFileSystem,
    private readonly schemaCache: SchemaCache,
  ) {}

  /**
   * Smart Constructor for SchemaCoordinator
   * Following Totality principles by returning Result<T,E>
   */
  static create(
    fileSystem: SchemaFileSystem,
    schemaCache: SchemaCache,
  ): Result<SchemaCoordinator, DomainError & { message: string }> {
    // Validate dependencies
    if (!fileSystem) {
      return err(createError({
        kind: "InitializationError",
        message: "SchemaFileSystem is required",
      }));
    }
    if (!schemaCache) {
      return err(createError({
        kind: "InitializationError",
        message: "SchemaCache is required",
      }));
    }

    return ok(new SchemaCoordinator(fileSystem, schemaCache));
  }

  /**
   * Load schema with caching support
   * Extracted from PipelineOrchestrator.loadSchema()
   * Following Totality principles - total function returning Result<T,E>
   */
  async loadSchema(
    schemaPath: string,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    // Try to get from cache first
    const cacheResult = await this.schemaCache.get(schemaPath);
    if (cacheResult.ok && cacheResult.data) {
      // Cache hit - create Schema entity from cached definition
      const pathResult = SchemaPath.create(schemaPath);
      if (!pathResult.ok) {
        return pathResult;
      }

      const schemaResult = Schema.create(pathResult.data, cacheResult.data);
      if (schemaResult.ok) {
        return schemaResult;
      }
      // If Schema creation fails, continue with fresh load
    }

    // Cache miss or error - load from file system
    const contentResult = await Promise.resolve(
      this.fileSystem.read(schemaPath),
    );
    if (!contentResult.ok) {
      return contentResult;
    }

    try {
      const schemaData = JSON.parse(contentResult.data);

      // Create schema path using smart constructor
      const pathResult = SchemaPath.create(schemaPath);
      if (!pathResult.ok) {
        return pathResult;
      }

      // Create schema definition using smart constructor
      const definitionResult = SchemaDefinition.create(schemaData);
      if (!definitionResult.ok) {
        return definitionResult;
      }

      // Cache the schema definition for future use
      const setCacheResult = await this.schemaCache.set(
        schemaPath,
        definitionResult.data,
      );
      if (!setCacheResult.ok) {
        // Cache set error - continue but note the issue
        // In production, this might warrant logging
      }

      // Create schema entity using smart constructor
      return Schema.create(pathResult.data, definitionResult.data);
    } catch (error) {
      return err(createError({
        kind: "InvalidSchema",
        message: `Failed to parse schema: ${error}`,
      }));
    }
  }

  /**
   * Get validation rules from a loaded schema
   * Following DDD - coordination of domain operations
   */
  getValidationRules(
    schema: Schema,
  ): Result<ValidationRules, DomainError & { message: string }> {
    return schema.getValidationRules();
  }

  /**
   * Load schema and extract validation rules in one operation
   * Common use case coordination
   */
  async loadSchemaAndGetValidationRules(
    schemaPath: string,
  ): Promise<
    Result<{
      schema: Schema;
      validationRules: ValidationRules;
    }, DomainError & { message: string }>
  > {
    const schemaResult = await this.loadSchema(schemaPath);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    const schema = schemaResult.data;
    const validationRulesResult = this.getValidationRules(schema);
    if (!validationRulesResult.ok) {
      return validationRulesResult;
    }

    return ok({
      schema,
      validationRules: validationRulesResult.data,
    });
  }

  /**
   * Load and process schema - alias for loadSchema for compatibility
   */
  async loadAndProcessSchema(
    schemaPath: string,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    return await this.loadSchema(schemaPath);
  }
}
