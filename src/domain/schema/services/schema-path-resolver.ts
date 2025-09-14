import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { Schema } from "../entities/schema.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../../frontmatter/factories/frontmatter-data-factory.ts";

/**
 * Schema path resolution errors following Totality principles
 */
export type SchemaPathError =
  | { kind: "FrontmatterPartNotFound"; schema: string }
  | { kind: "InvalidPathStructure"; path: string }
  | { kind: "StructureBuildFailed"; reason: string }
  | { kind: "EmptyDataArray" };

/**
 * Value Object representing dynamically constructed data structure.
 * Follows Totality principle with private constructor and smart creation.
 */
export class DataStructure {
  private constructor(private readonly structure: Record<string, unknown>) {}

  /**
   * Smart constructor creating DataStructure with validation (全域関数)
   */
  static create(
    structure: Record<string, unknown>,
  ): Result<DataStructure, DomainError & { message: string }> {
    if (!structure || typeof structure !== "object") {
      return err(createError({
        kind: "InvalidType",
        expected: "object",
        actual: typeof structure,
      }));
    }
    return ok(new DataStructure(structure));
  }

  /**
   * Convert to FrontmatterData with proper error handling
   */
  toFrontmatterData(): Result<
    FrontmatterData,
    DomainError & { message: string }
  > {
    return FrontmatterDataFactory.fromObject(this.structure);
  }

  /**
   * Get the underlying structure for testing/debugging
   */
  getStructure(): Record<string, unknown> {
    return { ...this.structure };
  }
}

/**
 * Domain service responsible for Schema-driven data structure resolution.
 * Replaces hardcoded structure assumptions with schema-based determination.
 *
 * Follows DDD principles:
 * - Domain service (complex logic not belonging to entities)
 * - Totality principle (all functions return Result types)
 * - No hardcoding (structure determined by schema)
 */
export class SchemaPathResolver {
  /**
   * Resolve data structure based on schema definition instead of hardcoding.
   * This replaces the hardcoded { tools: { commands: dataArray } } approach.
   */
  static resolveDataStructure(
    schema: Schema,
    dataArray: unknown[],
  ): Result<DataStructure, DomainError & { message: string }> {
    if (dataArray.length === 0) {
      return err(createError({
        kind: "EmptyInput",
      }));
    }

    // Get frontmatter-part path from schema (not hardcoded)
    const frontmatterPartPathResult = schema.findFrontmatterPartPath();
    if (!frontmatterPartPathResult.ok) {
      return frontmatterPartPathResult;
    }

    const path = frontmatterPartPathResult.data;

    // Create dynamic structure based on schema definition
    return this.createDynamicStructure(path, dataArray);
  }

  /**
   * Build nested structure dynamically based on schema path.
   * Supports both simple paths (e.g., "commands") and nested paths (e.g., "tools.commands")
   */
  private static createDynamicStructure(
    path: string,
    dataArray: unknown[],
  ): Result<DataStructure, DomainError & { message: string }> {
    try {
      const pathParts = path.split(".");
      const structure = this.buildNestedStructure(pathParts, dataArray);

      // No hardcoded backward compatibility - this should be handled by schema configuration
      // If backward compatibility is needed, it should be specified in the schema's x-compatibility-path

      return DataStructure.create(structure);
    } catch (error) {
      return err(createError({
        kind: "AggregationFailed",
        message: `Failed to build structure for path "${path}": ${error}`,
      }));
    }
  }

  /**
   * Recursively build nested object structure from path parts.
   * Example: ["tools", "commands"] + dataArray → { tools: { commands: dataArray } }
   */
  private static buildNestedStructure(
    pathParts: string[],
    dataArray: unknown[],
  ): Record<string, unknown> {
    if (pathParts.length === 0) {
      throw new Error("Path parts cannot be empty");
    }

    if (pathParts.length === 1) {
      // Base case: single part, assign array directly
      return { [pathParts[0]]: dataArray };
    }

    // Recursive case: build nested structure
    const [currentPart, ...remainingParts] = pathParts;
    return {
      [currentPart]: this.buildNestedStructure(remainingParts, dataArray),
    };
  }

  /**
   * Create empty structure based on schema path for initialization.
   * Used when no data is available but structure needs to exist.
   */
  static createEmptyStructure(
    schema: Schema,
  ): Result<DataStructure, DomainError & { message: string }> {
    const frontmatterPartPathResult = schema.findFrontmatterPartPath();
    if (!frontmatterPartPathResult.ok) {
      // If no frontmatter-part path defined, return empty object
      return DataStructure.create({});
    }

    const path = frontmatterPartPathResult.data;
    return this.createDynamicStructure(path, []);
  }
}
