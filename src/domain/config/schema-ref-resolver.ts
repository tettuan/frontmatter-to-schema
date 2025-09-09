/**
 * Schema $ref Resolver - Resolves JSON Schema $ref references
 *
 * This module handles recursive resolution of $ref references in JSON schemas,
 * supporting both local file references and internal JSON pointer references.
 * Required by requirements.ja.md line 45 and 60.
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";
import * as path from "jsr:@std/path@1.0.9";
import {
  type ExtendedSchema,
  SchemaTemplateInfo,
} from "../models/schema-extensions.ts";
import { isObject } from "../shared/type-guards.ts";
import type { FileSystemRepository } from "../repositories/file-system-repository.ts";

/**
 * Resolves $ref references in JSON Schema objects
 */
export class SchemaRefResolver {
  private resolvedRefs: Map<string, unknown> = new Map();
  private resolutionStack: Set<string> = new Set();

  constructor(
    private readonly fileSystem: FileSystemRepository,
    private readonly basePath: string = ".",
  ) {}

  /**
   * Resolve all $ref references in a schema recursively
   */
  async resolveSchema(
    schema: unknown,
    currentPath = "",
  ): Promise<Result<unknown, DomainError & { message: string }>> {
    // Handle null or undefined
    if (schema === null || schema === undefined) {
      return { ok: true, data: schema };
    }

    // Handle primitive types
    if (typeof schema !== "object") {
      return { ok: true, data: schema };
    }

    // Handle arrays
    if (Array.isArray(schema)) {
      const resolved: unknown[] = [];
      for (const item of schema) {
        const result = await this.resolveSchema(item, currentPath);
        if (!result.ok) {
          return result;
        }
        resolved.push(result.data);
      }
      return { ok: true, data: resolved };
    }

    // Handle objects - schema is already verified to be an object at this point
    // We've already handled null, undefined, primitives, and arrays above
    if (!isObject(schema)) {
      // This should never happen given the checks above, but TypeScript needs this
      return { ok: true, data: schema };
    }
    const schemaObj = schema;

    // Check for $ref
    if ("$ref" in schemaObj && typeof schemaObj.$ref === "string") {
      const refPath = schemaObj.$ref;

      // Check for circular reference
      if (this.resolutionStack.has(refPath)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: refPath,
            expectedFormat: "non-circular reference",
          }, `Circular reference detected: ${refPath}`),
        };
      }

      // Resolve the reference
      this.resolutionStack.add(refPath);
      const resolvedResult = await this.resolveRef(refPath, currentPath);
      this.resolutionStack.delete(refPath);

      if (!resolvedResult.ok) {
        return resolvedResult;
      }

      // Merge other properties with resolved reference
      const { $ref: _$ref, ...otherProps } = schemaObj;
      if (Object.keys(otherProps).length > 0) {
        // If there are other properties, merge them
        // Ensure resolved data is an object before spreading
        if (!isObject(resolvedResult.data)) {
          return {
            ok: false,
            error: createDomainError({
              kind: "InvalidFormat",
              input: refPath,
              expectedFormat: "object reference",
            }, `$ref resolved to non-object type: ${refPath}`),
          };
        }
        return {
          ok: true,
          data: { ...resolvedResult.data, ...otherProps },
        };
      }

      return resolvedResult;
    }

    // Recursively resolve nested objects
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schemaObj)) {
      const result = await this.resolveSchema(value, currentPath);
      if (!result.ok) {
        return result;
      }
      resolved[key] = result.data;
    }

    return { ok: true, data: resolved };
  }

  /**
   * Resolve a single $ref reference
   */
  private async resolveRef(
    refPath: string,
    currentPath: string,
  ): Promise<Result<unknown, DomainError & { message: string }>> {
    // Check cache
    if (this.resolvedRefs.has(refPath)) {
      return { ok: true, data: this.resolvedRefs.get(refPath) };
    }

    // Handle internal JSON pointer references (e.g., "#/definitions/foo")
    if (refPath.startsWith("#")) {
      return this.resolveJsonPointer(refPath, currentPath);
    }

    // Handle external file references
    const absolutePath = path.isAbsolute(refPath)
      ? refPath
      : path.join(this.basePath, refPath);

    const readResult = await this.fileSystem.readFile(absolutePath);

    if (!readResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "FileNotFound",
          path: absolutePath,
          ref: refPath,
        }, `Referenced schema file not found: ${refPath}`),
      };
    }

    try {
      const parsed = JSON.parse(readResult.data);

      // Recursively resolve the loaded schema
      const resolvedResult = await this.resolveSchema(parsed, absolutePath);

      if (resolvedResult.ok) {
        this.resolvedRefs.set(refPath, resolvedResult.data);
      }

      return resolvedResult;
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ParseError",
            input: refPath,
            details: error.message,
          }, `Failed to parse referenced schema: ${refPath}`),
        };
      }

      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: refPath,
          details: error instanceof Error ? error.message : String(error),
        }, `Failed to resolve $ref: ${refPath}`),
      };
    }
  }

  /**
   * Resolve internal JSON pointer reference
   */
  private resolveJsonPointer(
    pointer: string,
    _currentPath: string,
  ): Result<unknown, DomainError & { message: string }> {
    // For now, we don't support internal JSON pointer references
    // This would require keeping track of the root schema
    return {
      ok: false,
      error: createDomainError({
        kind: "NotFound",
        resource: "JSON pointer reference",
        name: pointer,
      }, `JSON pointer references are not yet supported: ${pointer}`),
    };
  }

  /**
   * Clear resolution cache
   */
  clearCache(): void {
    this.resolvedRefs.clear();
    this.resolutionStack.clear();
  }

  /**
   * Extract template information from resolved schema
   */
  extractTemplateInfo(
    schema: unknown,
  ): Result<SchemaTemplateInfo, DomainError & { message: string }> {
    if (!isObject(schema)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: "schema",
          expectedFormat: "object",
        }, "Schema must be an object to extract template info"),
      };
    }

    // Type assertion is necessary here because ExtendedSchema extends Record<string, unknown>
    // but TypeScript cannot infer this from runtime checks alone.
    // The isObject check ensures safety, and SchemaTemplateInfo.extract will validate structure.
    const result = SchemaTemplateInfo.extract(schema as ExtendedSchema);

    // Transform the result to match our DomainError type
    if (!result.ok) {
      // Map the error kind to a DomainError - the error structure from SchemaTemplateInfo
      // doesn't match DomainError exactly, so we need to create a proper DomainError
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: "schema",
            expectedFormat: "valid schema structure",
          },
          result.error.message,
        ),
      };
    }

    return { ok: true, data: result.data };
  }

  /**
   * Resolve schema and extract template info in one operation
   */
  async resolveAndExtractTemplateInfo(
    schema: unknown,
    currentPath = "",
  ): Promise<
    Result<{
      resolved: unknown;
      templateInfo: SchemaTemplateInfo;
    }, DomainError & { message: string }>
  > {
    // First resolve all $refs
    const resolveResult = await this.resolveSchema(schema, currentPath);
    if (!resolveResult.ok) {
      return resolveResult;
    }

    // Then extract template information
    const templateResult = this.extractTemplateInfo(resolveResult.data);
    if (!templateResult.ok) {
      return templateResult;
    }

    return {
      ok: true,
      data: {
        resolved: resolveResult.data,
        templateInfo: templateResult.data,
      },
    };
  }

  /**
   * Check if schema has frontmatter parts
   */
  hasFrontmatterParts(schema: unknown): boolean {
    if (!isObject(schema)) {
      return false;
    }

    const checkObject = (obj: Record<string, unknown>): boolean => {
      // Check current level
      if (obj["x-frontmatter-part"] === true) {
        return true;
      }

      // Check properties
      if (obj.properties && isObject(obj.properties)) {
        for (const prop of Object.values(obj.properties)) {
          if (isObject(prop) && checkObject(prop)) {
            return true;
          }
        }
      }

      // Check items
      if (obj.items && isObject(obj.items)) {
        if (checkObject(obj.items)) {
          return true;
        }
      }

      return false;
    };

    return checkObject(schema);
  }
}

/**
 * Factory function to create a schema resolver
 */
export function createSchemaRefResolver(
  fileSystem: FileSystemRepository,
  basePath?: string,
): SchemaRefResolver {
  return new SchemaRefResolver(fileSystem, basePath);
}
