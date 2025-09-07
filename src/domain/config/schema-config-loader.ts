/**
 * Schema Configuration Loader - Load external schema definitions
 * Following prohibit-hardcoding regulations
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";
import { SCHEMA_IDS } from "../constants/index.ts";
import { SchemaRefResolver } from "./schema-ref-resolver.ts";

/**
 * Schema configuration loader for external schema files
 */
export class SchemaConfigLoader {
  private static instance: SchemaConfigLoader | null = null;
  private schemaCache: Map<string, unknown> = new Map();
  private refResolver: SchemaRefResolver;

  private constructor(
    private readonly basePath: string = "./configs/schemas",
  ) {
    this.refResolver = new SchemaRefResolver(basePath);
  }

  /**
   * Get singleton instance
   */
  static getInstance(basePath?: string): SchemaConfigLoader {
    if (!SchemaConfigLoader.instance) {
      SchemaConfigLoader.instance = new SchemaConfigLoader(basePath);
    }
    return SchemaConfigLoader.instance;
  }

  /**
   * Load CLI registry schema from external file
   */
  async loadCliRegistrySchema(): Promise<
    Result<unknown, DomainError & { message: string }>
  > {
    const cacheKey = SCHEMA_IDS.CLI_REGISTRY;

    // Check cache first
    if (this.schemaCache.has(cacheKey)) {
      return { ok: true, data: this.schemaCache.get(cacheKey) };
    }

    const schemaPath = `${this.basePath}/cli-registry.json`;
    const result = await this.loadSchemaFromFile(schemaPath);

    if (result.ok) {
      this.schemaCache.set(cacheKey, result.data);
    }

    return result;
  }

  /**
   * Load schema from file path with $ref resolution
   */
  async loadSchemaFromFile(
    path: string,
  ): Promise<Result<unknown, DomainError & { message: string }>> {
    try {
      const content = await Deno.readTextFile(path);
      const schema = JSON.parse(content);
      
      // Resolve $ref references recursively
      const resolvedResult = await this.refResolver.resolveSchema(schema, path);
      if (!resolvedResult.ok) {
        return resolvedResult;
      }
      
      return { ok: true, data: resolvedResult.data };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({
            kind: "FileNotFound",
            path,
          }, `Schema file not found: ${path}`),
        };
      }

      if (error instanceof SyntaxError) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ParseError",
            input: path,
            details: error.message,
          }, `Failed to parse schema file: ${path}`),
        };
      }

      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path,
          details: error instanceof Error ? error.message : String(error),
        }, `Failed to read schema file: ${path}`),
      };
    }
  }

  /**
   * Load custom schema by name
   */
  async loadSchemaByName(
    name: string,
  ): Promise<Result<unknown, DomainError & { message: string }>> {
    // Check cache first
    if (this.schemaCache.has(name)) {
      return { ok: true, data: this.schemaCache.get(name) };
    }

    const schemaPath = `${this.basePath}/${name}.json`;
    const result = await this.loadSchemaFromFile(schemaPath);

    if (result.ok) {
      this.schemaCache.set(name, result.data);
    }

    return result;
  }

  /**
   * Clear schema cache (useful for testing or reloading)
   */
  clearCache(): void {
    this.schemaCache.clear();
  }

  /**
   * Get cached schema
   */
  getCachedSchema(key: string): unknown | undefined {
    return this.schemaCache.get(key);
  }
}

// Export convenience function
export const getSchemaConfigLoader = (
  basePath?: string,
): SchemaConfigLoader => {
  return SchemaConfigLoader.getInstance(basePath);
};
