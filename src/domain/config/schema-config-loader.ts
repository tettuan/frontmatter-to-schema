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
import type { FileSystemRepository } from "../repositories/file-system-repository.ts";

/**
 * Schema configuration loader for external schema files
 * Now uses dependency injection for file system operations
 */
export class SchemaConfigLoader {
  private schemaCache: Map<string, unknown> = new Map();
  private refResolver: SchemaRefResolver;

  constructor(
    private readonly fileSystem: FileSystemRepository,
    private readonly basePath: string = "./configs/schemas",
  ) {
    this.refResolver = new SchemaRefResolver(basePath);
  }

  /**
   * Factory method for backward compatibility
   * @deprecated Use constructor with FileSystemRepository instead
   */
  static create(
    fileSystem: FileSystemRepository,
    basePath?: string,
  ): SchemaConfigLoader {
    return new SchemaConfigLoader(fileSystem, basePath);
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
    // Use injected FileSystemRepository instead of direct Deno API
    const readResult = await this.fileSystem.readFile(path);

    if (!readResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          readResult.error,
          `Failed to read schema file: ${path}`,
        ),
      };
    }

    try {
      const schema = JSON.parse(readResult.data);

      // Resolve $ref references recursively
      const resolvedResult = await this.refResolver.resolveSchema(schema, path);
      if (!resolvedResult.ok) {
        return resolvedResult;
      }

      return { ok: true, data: resolvedResult.data };
    } catch (error) {
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
// Note: This function now requires a FileSystemRepository to be provided
// For backward compatibility, you can pass undefined if file system access is not needed
export const getSchemaConfigLoader = (
  fileSystem?: FileSystemRepository,
  basePath?: string,
): SchemaConfigLoader => {
  // If no fileSystem provided, create a stub that returns errors
  const stubFileSystem: FileSystemRepository = fileSystem || {
    readFile: () =>
      Promise.resolve({
        ok: false,
        error: createDomainError({ kind: "FileNotFound" as const, path: "" }),
      }),
    writeFile: () =>
      Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "WriteError" as const,
          path: "",
          details: "No filesystem provided",
        }),
      }),
    ensureDirectory: () =>
      Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "WriteError" as const,
          path: "",
          details: "No filesystem provided",
        }),
      }),
    exists: () => Promise.resolve({ ok: true, data: false }),
    findFiles: async function* () {},
  };
  return new SchemaConfigLoader(stubFileSystem, basePath);
};
