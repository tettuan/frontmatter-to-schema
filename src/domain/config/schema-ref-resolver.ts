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

/**
 * Resolves $ref references in JSON Schema objects
 */
export class SchemaRefResolver {
  private resolvedRefs: Map<string, unknown> = new Map();
  private resolutionStack: Set<string> = new Set();

  constructor(
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

    // Handle objects
    const schemaObj = schema as Record<string, unknown>;

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
      const { $ref, ...otherProps } = schemaObj;
      if (Object.keys(otherProps).length > 0) {
        // If there are other properties, merge them
        return { 
          ok: true, 
          data: { ...resolvedResult.data as object, ...otherProps } 
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

    try {
      const content = await Deno.readTextFile(absolutePath);
      const parsed = JSON.parse(content);
      
      // Recursively resolve the loaded schema
      const resolvedResult = await this.resolveSchema(parsed, absolutePath);
      
      if (resolvedResult.ok) {
        this.resolvedRefs.set(refPath, resolvedResult.data);
      }
      
      return resolvedResult;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({
            kind: "FileNotFound",
            path: absolutePath,
            ref: refPath,
          }, `Referenced schema file not found: ${refPath}`),
        };
      }

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
        kind: "NotImplemented",
        feature: `JSON pointer reference: ${pointer}`,
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
}

/**
 * Factory function to create a schema resolver
 */
export function createSchemaRefResolver(basePath?: string): SchemaRefResolver {
  return new SchemaRefResolver(basePath);
}