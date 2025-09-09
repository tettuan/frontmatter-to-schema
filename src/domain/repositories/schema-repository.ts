/**
 * Schema Repository Interface
 * Defines contract for schema management
 * Follows DDD principles with Repository pattern
 */

import type { DomainError, Result } from "../core/result.ts";
import type { Schema } from "../models/entities.ts";

/**
 * Repository interface for schema management
 */
export interface SchemaRepository {
  /**
   * Load schema from file
   * @param schemaPath - Path to schema file
   * @returns Result containing Schema or error
   */
  load(
    schemaPath: string,
  ): Promise<Result<Schema, DomainError & { message: string }>>;

  /**
   * Save schema to file
   * @param schemaPath - Path to save schema
   * @param schema - Schema to save
   * @returns Result indicating success or error
   */
  save(
    schemaPath: string,
    schema: Schema,
  ): Promise<Result<void, DomainError & { message: string }>>;

  /**
   * Validate schema
   * @param schema - Schema to validate
   * @returns Result indicating validity
   */
  validate(
    schema: Schema,
  ): Result<void, DomainError & { message: string }>;
}
