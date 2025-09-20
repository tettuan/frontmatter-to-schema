import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, SchemaError } from "../../shared/types/errors.ts";

/**
 * Represents the type of data structure that a schema defines.
 * Following Totality principles with discriminated union pattern.
 *
 * This value object encapsulates different schema structure patterns:
 * - Registry: Hierarchical command/tool structures (tools.commands)
 * - Collection: Simple array collections (books, articles, etc.)
 * - Custom: User-defined nested structures
 */
export type StructureType =
  | {
    readonly kind: "registry";
    readonly path: "tools.commands";
    readonly description: "CLI command registry structure";
  }
  | {
    readonly kind: "collection";
    readonly path: string;
    readonly description: string;
  }
  | {
    readonly kind: "custom";
    readonly path: string;
    readonly description: string;
  };

/**
 * Value object factory for creating StructureType instances.
 * Follows Smart Constructor pattern with validation.
 */
export class StructureTypeFactory {
  /**
   * Create a registry structure type (CLI commands, tools)
   */
  static registry(): StructureType {
    return {
      kind: "registry",
      path: "tools.commands",
      description: "CLI command registry structure",
    };
  }

  /**
   * Create a collection structure type (books, articles, etc.)
   */
  static collection(
    path: string,
    description?: string,
  ): Result<StructureType, SchemaError & { message: string }> {
    if (!path || path.trim() === "") {
      return err(createError({
        kind: "InvalidSchema",
        message: "Collection path cannot be empty",
      }));
    }

    // Validate path format - should be simple property name for collections
    const pathPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!pathPattern.test(path)) {
      return err(createError({
        kind: "InvalidSchema",
        message:
          `Invalid collection path format '${path}': must be a valid property name`,
      }));
    }

    return ok({
      kind: "collection",
      path,
      description: description || `${path} collection structure`,
    });
  }

  /**
   * Create a custom structure type (nested paths)
   */
  static custom(
    path: string,
    description?: string,
  ): Result<StructureType, SchemaError & { message: string }> {
    if (!path || path.trim() === "") {
      return err(createError({
        kind: "InvalidSchema",
        message: "Custom path cannot be empty",
      }));
    }

    // Validate nested path format (allows dots)
    const pathPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
    if (!pathPattern.test(path)) {
      return err(createError({
        kind: "InvalidSchema",
        message:
          `Invalid custom path format '${path}': must be a valid nested property path`,
      }));
    }

    return ok({
      kind: "custom",
      path,
      description: description || `Custom structure at ${path}`,
    });
  }

  /**
   * Auto-detect structure type from frontmatter path
   */
  static fromPath(
    path: string,
  ): Result<StructureType, SchemaError & { message: string }> {
    if (!path || path.trim() === "") {
      return err(createError({
        kind: "InvalidSchema",
        message: "Path cannot be empty for structure type detection",
      }));
    }

    // Registry pattern detection
    if (path === "tools.commands" || path === "commands") {
      return ok(this.registry());
    }

    // Check if it's a nested path (contains dots)
    if (path.includes(".")) {
      return this.custom(path);
    }

    // Default to collection for simple paths
    return this.collection(path);
  }
}

/**
 * Utility functions for working with StructureType
 */
export class StructureTypeUtils {
  /**
   * Check if structure type is a registry
   */
  static isRegistry(structureType: StructureType): boolean {
    return structureType.kind === "registry";
  }

  /**
   * Check if structure type is a collection
   */
  static isCollection(structureType: StructureType): boolean {
    return structureType.kind === "collection";
  }

  /**
   * Check if structure type is custom
   */
  static isCustom(structureType: StructureType): boolean {
    return structureType.kind === "custom";
  }

  /**
   * Get the path for data placement
   */
  static getPath(structureType: StructureType): string {
    return structureType.path;
  }

  /**
   * Get human-readable description
   */
  static getDescription(structureType: StructureType): string {
    return structureType.description;
  }

  /**
   * Compare two structure types for equality
   */
  static equals(a: StructureType, b: StructureType): boolean {
    return a.kind === b.kind && a.path === b.path;
  }

  /**
   * Convert to string representation for debugging
   */
  static toString(structureType: StructureType): string {
    return `StructureType(${structureType.kind}:${structureType.path})`;
  }
}
