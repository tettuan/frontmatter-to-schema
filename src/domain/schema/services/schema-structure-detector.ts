import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { Schema } from "../entities/schema.ts";
import {
  StructureType,
  StructureTypeFactory,
} from "../value-objects/structure-type.ts";

/**
 * Domain service responsible for detecting schema structure types.
 *
 * This service replaces hardcoded structure assumptions with schema-driven detection.
 * It analyzes the schema definition to determine what kind of data structure
 * the schema represents (registry, collection, or custom).
 *
 * Following DDD principles:
 * - Domain service for complex logic that doesn't belong to entities
 * - Totality principle with Result types
 * - Schema-driven detection instead of hardcoding
 */
export class SchemaStructureDetector {
  /**
   * Detect the structure type from a schema definition.
   *
   * This method replaces hardcoded detectStructureType logic with
   * schema-driven analysis using x-frontmatter-part directives.
   */
  static detectStructureType(
    schema: Schema,
  ): Result<StructureType, DomainError & { message: string }> {
    // Try to find x-frontmatter-part path in schema
    const frontmatterPartResult = schema.findFrontmatterPartPath();

    if (!frontmatterPartResult.ok) {
      // No x-frontmatter-part found - this might be a simple schema
      // Check if it looks like a registry by examining schema structure
      const registryDetectionResult = this.detectRegistryByStructure(schema);
      if (registryDetectionResult.ok) {
        return registryDetectionResult;
      }

      // Default to collection type with generic path
      const collectionResult = StructureTypeFactory.collection(
        "items",
        "Generic collection structure",
      );
      if (!collectionResult.ok) {
        return err(createError({
          kind: "AggregationFailed",
          message: "Failed to create default collection structure type",
        }));
      }

      return collectionResult;
    }

    const path = frontmatterPartResult.data;

    // Detect structure type from the frontmatter-part path
    return StructureTypeFactory.fromPath(path);
  }

  /**
   * Detect registry structure by analyzing schema properties.
   *
   * This checks for registry-specific patterns in the schema:
   * - tools property with commands sub-property
   * - command-related field names
   * - registry-specific extensions
   */
  private static detectRegistryByStructure(
    schema: Schema,
  ): Result<StructureType, DomainError & { message: string }> {
    const definition = schema.getDefinition();
    const rawSchema = definition.getRawSchema();

    // Check for registry-specific structure patterns
    if (this.hasRegistryStructurePattern(rawSchema)) {
      return ok(StructureTypeFactory.registry());
    }

    return err(createError({
      kind: "FrontmatterPartNotFound",
      message: "Schema does not contain registry structure patterns",
    }));
  }

  /**
   * Check if schema has registry-specific structural patterns.
   */
  private static hasRegistryStructurePattern(rawSchema: unknown): boolean {
    if (typeof rawSchema !== "object" || rawSchema === null) {
      return false;
    }

    const schema = rawSchema as Record<string, unknown>;

    // Check for tools.commands structure
    if (
      this.hasNestedProperty(schema, [
        "properties",
        "tools",
        "properties",
        "commands",
      ])
    ) {
      return true;
    }

    // Check for direct commands property with c1/c2/c3 pattern
    const properties = schema.properties as Record<string, unknown> | undefined;
    if (properties && typeof properties === "object") {
      const hasCommandFields = ["c1", "c2", "c3"].some((field) =>
        field in properties
      );
      const hasCommandsArray = "commands" in properties;

      if (hasCommandFields || hasCommandsArray) {
        return true;
      }
    }

    return false;
  }

  /**
   * Helper to check for nested property existence.
   */
  private static hasNestedProperty(
    obj: Record<string, unknown>,
    path: string[],
  ): boolean {
    let current: unknown = obj;

    for (const segment of path) {
      if (
        typeof current !== "object" || current === null || !(segment in current)
      ) {
        return false;
      }
      current = (current as Record<string, unknown>)[segment];
    }

    return current !== undefined;
  }

  /**
   * Get structure-specific processing hints.
   *
   * Different structure types may require different processing approaches.
   * This method provides hints for the processing pipeline.
   */
  static getProcessingHints(
    structureType: StructureType,
  ): ProcessingHints {
    switch (structureType.kind) {
      case "registry":
        return {
          requiresAggregation: true,
          expectedArrayFields: ["commands"],
          derivationRules: ["availableConfigs"],
          templateFormat: "json",
        };

      case "collection":
        return {
          requiresAggregation: false,
          expectedArrayFields: [structureType.path],
          derivationRules: [],
          templateFormat: "auto",
        };

      case "custom":
        return {
          requiresAggregation: true,
          expectedArrayFields: [structureType.path.split(".").pop() || "items"],
          derivationRules: [],
          templateFormat: "auto",
        };
    }
  }
}

/**
 * Processing hints based on detected structure type.
 */
export interface ProcessingHints {
  readonly requiresAggregation: boolean;
  readonly expectedArrayFields: string[];
  readonly derivationRules: string[];
  readonly templateFormat: "json" | "yaml" | "auto";
}
