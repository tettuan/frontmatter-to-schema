/**
 * RefResolver Domain Service
 *
 * Handles $ref resolution in JSON schemas following DDD and Totality principles
 * Uses value objects and returns Result<T,E> for all operations
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import type { SchemaDefinition } from "../../value-objects/schema-definition.ts";
import { SchemaPath } from "../../value-objects/schema-path.ts";
import {
  DEFAULT_ERROR_CONTEXT_LIMIT,
  MAX_REFERENCE_DEPTH,
} from "../../shared/constants.ts";

/**
 * Resolved schema with all $ref dependencies resolved
 */
export interface ResolvedSchema {
  readonly content: Record<string, unknown>;
  readonly resolvedRefs: readonly string[];
}

/**
 * RefResolver domain service for handling $ref resolution in schemas
 * Follows Totality principles - all functions are total and return Result<T,E>
 */
export class RefResolver {
  private constructor(
    private readonly maxDepth: number = 10,
    private readonly visited: Set<string> = new Set(),
  ) {}

  /**
   * Smart Constructor for RefResolver
   * @param maxDepth - Maximum resolution depth to prevent infinite recursion
   * @returns Result containing RefResolver or error
   */
  static create(
    maxDepth: number = MAX_REFERENCE_DEPTH.getValue(),
  ): Result<RefResolver, DomainError & { message: string }> {
    if (maxDepth < 1) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "OutOfRange",
            value: maxDepth,
            min: 1,
          },
          "Maximum resolution depth must be at least 1",
        ),
      };
    }

    if (MAX_REFERENCE_DEPTH.isExceeded(maxDepth)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "OutOfRange",
            value: maxDepth,
            min: 1,
            max: MAX_REFERENCE_DEPTH.getValue(),
          },
          `Maximum resolution depth cannot exceed ${MAX_REFERENCE_DEPTH.getValue()}`,
        ),
      };
    }

    return {
      ok: true,
      data: new RefResolver(maxDepth),
    };
  }

  /**
   * Resolve all $ref references in a schema
   * @param schema - Schema to resolve
   * @param schemaLoader - Function to load referenced schemas
   * @returns Result containing resolved schema or error
   */
  resolveRefs(
    schema: SchemaDefinition,
    schemaLoader: (
      path: SchemaPath,
    ) => Promise<Result<SchemaDefinition, DomainError & { message: string }>>,
  ): Promise<Result<ResolvedSchema, DomainError & { message: string }>> {
    return this.resolveRefsInternal(schema, schemaLoader, 0, []);
  }

  /**
   * Internal recursive ref resolution
   */
  private async resolveRefsInternal(
    schema: SchemaDefinition,
    schemaLoader: (
      path: SchemaPath,
    ) => Promise<Result<SchemaDefinition, DomainError & { message: string }>>,
    depth: number,
    resolvedRefs: string[],
  ): Promise<Result<ResolvedSchema, DomainError & { message: string }>> {
    // Check depth limit
    if (depth >= this.maxDepth) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "TooDeep",
            currentDepth: depth,
            maxDepth: this.maxDepth,
          },
          `$ref resolution exceeded maximum depth of ${this.maxDepth}`,
        ),
      };
    }

    const contentResult = schema.getParsedSchema();
    if (!contentResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ParseError",
            input: DEFAULT_ERROR_CONTEXT_LIMIT.truncateContent(
              schema.getRawDefinition(),
            ),
            details: contentResult.error.message,
          },
          "Failed to parse schema for $ref resolution",
        ),
      };
    }
    const content = contentResult.data;

    // Find all $ref references
    const refs = this.findRefs(content);
    if (refs.length === 0) {
      // No refs to resolve
      return {
        ok: true,
        data: {
          content,
          resolvedRefs,
        },
      };
    }

    // Check for circular references
    for (const ref of refs) {
      if (this.visited.has(ref)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "CircularReference",
              reference: ref,
              visitedRefs: Array.from(this.visited),
            },
            `Circular reference detected: ${ref}`,
          ),
        };
      }
    }

    // Resolve each ref
    let resolvedContent = { ...content };
    const newResolvedRefs = [...resolvedRefs];

    for (const ref of refs) {
      this.visited.add(ref);

      // Convert ref to SchemaPath
      const schemaPathResult = SchemaPath.create(ref);
      if (!schemaPathResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidReference",
              reference: ref,
              reason: schemaPathResult.error.message,
            },
            `Invalid $ref path: ${ref}`,
          ),
        };
      }

      // Load referenced schema
      const referencedSchemaResult = await schemaLoader(schemaPathResult.data);
      if (!referencedSchemaResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ReferenceLoadError",
              reference: ref,
              reason: referencedSchemaResult.error.message,
            },
            `Failed to load $ref: ${ref}`,
          ),
        };
      }

      // Recursively resolve refs in the referenced schema
      const nestedResolver = new RefResolver(
        this.maxDepth,
        new Set(this.visited),
      );
      const nestedResolvedResult = await nestedResolver.resolveRefsInternal(
        referencedSchemaResult.data,
        schemaLoader,
        depth + 1,
        [], // Start with empty array for nested resolution
      );

      if (!nestedResolvedResult.ok) {
        return nestedResolvedResult;
      }

      // Replace $ref with resolved content
      resolvedContent = this.replaceRef(
        resolvedContent,
        ref,
        nestedResolvedResult.data.content,
      );
      newResolvedRefs.push(ref);
      newResolvedRefs.push(...nestedResolvedResult.data.resolvedRefs);

      this.visited.delete(ref);
    }

    return {
      ok: true,
      data: {
        content: resolvedContent,
        resolvedRefs: newResolvedRefs,
      },
    };
  }

  /**
   * Find all $ref references in a schema object
   */
  private findRefs(obj: unknown): string[] {
    const refs: string[] = [];

    if (typeof obj === "object" && obj !== null) {
      if (Array.isArray(obj)) {
        for (const item of obj) {
          refs.push(...this.findRefs(item));
        }
      } else {
        const record = obj as Record<string, unknown>;
        for (const [key, value] of Object.entries(record)) {
          if (key === "$ref" && typeof value === "string") {
            refs.push(value);
          } else {
            refs.push(...this.findRefs(value));
          }
        }
      }
    }

    return refs;
  }

  /**
   * Replace a $ref with resolved content
   */
  private replaceRef(
    obj: Record<string, unknown>,
    ref: string,
    resolvedContent: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...obj };

    for (const [key, value] of Object.entries(result)) {
      if (key === "$ref" && value === ref) {
        // Replace the $ref with resolved content
        return { ...resolvedContent };
      } else if (typeof value === "object" && value !== null) {
        if (Array.isArray(value)) {
          result[key] = value.map((item) =>
            typeof item === "object" && item !== null
              ? this.replaceRef(
                item as Record<string, unknown>,
                ref,
                resolvedContent,
              )
              : item
          );
        } else {
          result[key] = this.replaceRef(
            value as Record<string, unknown>,
            ref,
            resolvedContent,
          );
        }
      }
    }

    return result;
  }

  /**
   * Check if a schema has any $ref references
   */
  static hasRefs(schema: SchemaDefinition): boolean {
    const resolver = new RefResolver();
    const contentResult = schema.getParsedSchema();
    if (!contentResult.ok) return false;

    return resolver.findRefs(contentResult.data).length > 0;
  }

  /**
   * Get all $ref references in a schema without resolving them
   */
  static extractRefs(schema: SchemaDefinition): string[] {
    const resolver = new RefResolver();
    const contentResult = schema.getParsedSchema();
    if (!contentResult.ok) return [];

    return resolver.findRefs(contentResult.data);
  }
}
