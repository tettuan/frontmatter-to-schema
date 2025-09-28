/**
 * @fileoverview Property Transformation Strategy
 * @description Replaces hardcoded property transformations with configurable strategies
 * Following DDD and Totality principles - fixes Issue #1072
 */

import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";

/**
 * Property transformation function type
 */
export type PropertyTransformer = (
  value: unknown,
  propertyName: string,
) => Result<unknown, TemplateError & { message: string }>;

/**
 * Property Transformation Registry
 *
 * Manages transformation strategies for properties, eliminating hardcoding
 * and following the Open/Closed principle.
 */
export class PropertyTransformationRegistry {
  private transformers: Map<string, PropertyTransformer>;

  constructor() {
    this.transformers = new Map();
    this.registerDefaultTransformers();
  }

  /**
   * Register default transformers
   * These replace the hardcoded switch statement
   */
  private registerDefaultTransformers(): void {
    // "full" transformation - returns value as-is
    this.register("full", (value) => ok(value));

    // "short" transformation - abbreviates strings
    this.register("short", (value) => {
      if (typeof value === "string") {
        return ok(value.substring(0, 8));
      }
      return ok(value);
    });

    // "name" transformation - extracts name from objects
    this.register("name", (value) => {
      if (typeof value === "object" && value !== null) {
        const obj = value as Record<string, unknown>;
        if ("name" in obj) return ok(obj.name);
        if ("title" in obj) return ok(obj.title);
      }
      if (typeof value === "string") {
        return ok(value);
      }
      return ErrorHandler.template({
        operation: "PropertyTransformation",
        method: "extractName",
      }).variableResolutionFailed(
        "name",
        `Cannot extract 'name' from value of type ${typeof value}`,
      );
    });

    // "level" transformation - extracts level property
    this.register("level", (value) => {
      if (typeof value === "object" && value !== null) {
        const obj = value as Record<string, unknown>;
        if ("level" in obj) return ok(obj.level);
      }
      return ok(value);
    });

    // "scope" transformation - extracts scope property
    this.register("scope", (value) => {
      if (typeof value === "object" && value !== null) {
        const obj = value as Record<string, unknown>;
        if ("scope" in obj) return ok(obj.scope);
      }
      return ok(value);
    });
  }

  /**
   * Register a new transformation strategy
   * @param property Property name
   * @param transformer Transformation function
   */
  public register(property: string, transformer: PropertyTransformer): void {
    this.transformers.set(property, transformer);
  }

  /**
   * Apply transformation for a property
   * @param property Property name
   * @param value Value to transform
   */
  public transform(
    property: string,
    value: unknown,
  ): Result<unknown, TemplateError & { message: string }> {
    const transformer = this.transformers.get(property);

    if (!transformer) {
      // No specific transformer, return value as-is (default behavior)
      return ok(value);
    }

    return transformer(value, property);
  }

  /**
   * Check if a transformation exists for a property
   * @param property Property name
   */
  public hasTransformer(property: string): boolean {
    return this.transformers.has(property);
  }

  /**
   * Get all registered property names
   */
  public getRegisteredProperties(): string[] {
    return Array.from(this.transformers.keys());
  }

  /**
   * Create from configuration (for future extensibility)
   * @param config Transformation configuration
   */
  static createFromConfig(
    config?: Record<string, PropertyTransformer>,
  ): PropertyTransformationRegistry {
    const registry = new PropertyTransformationRegistry();

    if (config) {
      Object.entries(config).forEach(([property, transformer]) => {
        registry.register(property, transformer);
      });
    }

    return registry;
  }
}
