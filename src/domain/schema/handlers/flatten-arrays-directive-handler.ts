/**
 * @fileoverview Flatten Arrays Directive Handler
 * @description Handles x-flatten-arrays directive processing following DDD and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../../frontmatter/factories/frontmatter-data-factory.ts";
import { Schema } from "../entities/schema.ts";
import { defaultSchemaExtensionRegistry } from "../value-objects/schema-extension-registry.ts";
import {
  BaseDirectiveHandler,
  DirectiveConfig,
  DirectiveHandlerError,
  DirectiveHandlerFactory,
  DirectiveProcessingResult,
  ExtensionExtractionResult,
  LegacySchemaProperty,
} from "../interfaces/directive-handler.ts";

/**
 * Flatten arrays directive configuration
 */
interface FlattenArraysConfig {
  readonly targetPath: string;
}

/**
 * Flatten arrays processing metadata
 */
interface FlattenArraysMetadata {
  readonly flatteningApplied: boolean;
  readonly targetPath: string;
  readonly originalDepth: number;
  readonly finalDepth: number;
  readonly itemsProcessed: number;
}

/**
 * Flatten Arrays Directive Handler
 *
 * Processes x-flatten-arrays directives that flatten nested arrays at specified paths.
 * Following DDD and Totality principles:
 * - Smart Constructor pattern
 * - Result<T,E> for all operations
 * - No exceptions or undefined behavior
 */
export class FlattenArraysDirectiveHandler
  extends BaseDirectiveHandler<FlattenArraysConfig, FlattenArraysMetadata> {
  private constructor() {
    super("flatten-arrays", 3, []); // Priority 3: Array Flattening
  }

  /**
   * Smart Constructor following Totality principles
   */
  static create(): Result<
    FlattenArraysDirectiveHandler,
    DirectiveHandlerError
  > {
    return ok(new FlattenArraysDirectiveHandler());
  }

  /**
   * Extract flatten arrays configuration from legacy schema
   * Handles both extensions object and direct property
   */
  extractConfig(
    schema: LegacySchemaProperty,
  ): Result<DirectiveConfig<FlattenArraysConfig>, DirectiveHandlerError> {
    let targetPath: string | undefined;

    // Check extensions object first (legacy format)
    if (schema.extensions && typeof schema.extensions === "object") {
      const extensions = schema.extensions as Record<string, unknown>;
      if (extensions["x-flatten-arrays"] !== undefined) {
        if (typeof extensions["x-flatten-arrays"] === "string") {
          targetPath = extensions["x-flatten-arrays"];
        } else {
          return err({
            kind: "ValidationError",
            directiveName: this.directiveName,
            message:
              `Invalid target path: expected string but got ${typeof extensions[
                "x-flatten-arrays"
              ]}`,
            invalidValue: extensions["x-flatten-arrays"],
          });
        }
      }
    }

    // Check direct property (standard JSON Schema extension pattern)
    // Takes precedence over extensions object
    if (schema["x-flatten-arrays"] !== undefined) {
      if (typeof schema["x-flatten-arrays"] === "string") {
        targetPath = schema["x-flatten-arrays"];
      } else {
        return err({
          kind: "ValidationError",
          directiveName: this.directiveName,
          message:
            `Invalid target path: expected string but got ${typeof schema[
              "x-flatten-arrays"
            ]}`,
          invalidValue: schema["x-flatten-arrays"],
        });
      }
    }

    if (targetPath === undefined) {
      return DirectiveHandlerFactory.createConfig(
        this.directiveName,
        { targetPath: "" },
        false,
      );
    }

    // Validate target path
    if (!this.isValidPath(targetPath)) {
      return err({
        kind: "ValidationError",
        directiveName: this.directiveName,
        message: `Invalid target path: ${targetPath}`,
        invalidValue: targetPath,
      });
    }

    return DirectiveHandlerFactory.createConfig(
      this.directiveName,
      { targetPath },
      true,
    );
  }

  /**
   * Process data using flatten arrays configuration
   */
  processData(
    data: FrontmatterData,
    config: DirectiveConfig<FlattenArraysConfig>,
    _schema: Schema,
  ): Result<
    DirectiveProcessingResult<FlattenArraysMetadata>,
    DirectiveHandlerError
  > {
    if (!config.isPresent || !config.configuration.targetPath) {
      return DirectiveHandlerFactory.createResult(
        this.directiveName,
        data,
        {
          flatteningApplied: false,
          targetPath: "",
          originalDepth: 0,
          finalDepth: 0,
          itemsProcessed: 0,
        },
      );
    }

    try {
      const currentData = data.getData();
      const targetPath = config.configuration.targetPath;

      // Get the target array
      const targetValue = this.getNestedProperty(currentData, targetPath);
      if (!Array.isArray(targetValue)) {
        // Target is not an array - no flattening needed
        return DirectiveHandlerFactory.createResult(
          this.directiveName,
          data,
          {
            flatteningApplied: false,
            targetPath,
            originalDepth: 0,
            finalDepth: 0,
            itemsProcessed: 0,
          },
        );
      }

      const originalDepth = this.calculateArrayDepth(targetValue);
      const flattenedArray = this.flattenArray(targetValue);
      const finalDepth = this.calculateArrayDepth(flattenedArray);

      // Create new data with flattened array
      const processedData = this.setNestedProperty(
        currentData,
        targetPath,
        flattenedArray,
      );

      // Create new FrontmatterData with processed data
      const newDataResult = FrontmatterDataFactory.fromParsedData(
        processedData,
      );
      if (!newDataResult.ok) {
        return err({
          kind: "ProcessingError",
          directiveName: this.directiveName,
          message: "Failed to create FrontmatterData after array flattening",
          cause: newDataResult.error,
        });
      }

      return DirectiveHandlerFactory.createResult(
        this.directiveName,
        newDataResult.data,
        {
          flatteningApplied: originalDepth !== finalDepth,
          targetPath,
          originalDepth,
          finalDepth,
          itemsProcessed: flattenedArray.length,
        },
      );
    } catch (error) {
      return err({
        kind: "ProcessingError",
        directiveName: this.directiveName,
        message: `Array flattening failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        cause: {
          kind: "ConfigurationError",
          message: error instanceof Error ? error.message : String(error),
        } as DomainError,
      });
    }
  }

  /**
   * Extract extension key-value pair for schema building
   * Following Totality principles with discriminated union result
   */
  extractExtension(
    schema: LegacySchemaProperty,
  ): Result<ExtensionExtractionResult, DirectiveHandlerError> {
    const configResult = this.extractConfig(schema);
    if (!configResult.ok) {
      return configResult;
    }

    const config = configResult.data;
    if (!config.isPresent) {
      return ok({
        kind: "ExtensionNotApplicable",
        reason: "No x-flatten-arrays directive found in schema",
      });
    }

    const registry = defaultSchemaExtensionRegistry;
    const key = registry.getFlattenArraysKey().getValue();

    return ok({
      kind: "ExtensionFound",
      key,
      value: config.configuration.targetPath,
    });
  }

  /**
   * Validate path syntax
   */
  private isValidPath(path: string): boolean {
    if (!path || path.trim() === "") {
      return false;
    }

    // Basic path validation
    const trimmed = path.trim();

    // Cannot start or end with dot
    if (trimmed.startsWith(".") || trimmed.endsWith(".")) {
      return false;
    }

    // Cannot have consecutive dots
    if (trimmed.includes("..")) {
      return false;
    }

    // Check for invalid characters
    if (/[\/\[\]\s]/.test(trimmed)) {
      return false;
    }

    // Simple path segments validation
    const segments = trimmed.split(".");
    for (const segment of segments) {
      if (!segment || segment.trim() === "") {
        return false;
      }
      // Each segment should only contain valid path characters
      if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(segment)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get nested property value from object using dot notation
   */
  private getNestedProperty(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== "object") {
      return undefined;
    }

    const segments = path.split(".");
    let current: unknown = obj;

    for (const segment of segments) {
      if (
        current && typeof current === "object" &&
        segment in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Set nested property value in object using dot notation
   */
  private setNestedProperty(
    obj: unknown,
    path: string,
    value: unknown,
  ): unknown {
    if (!obj || typeof obj !== "object") {
      return obj;
    }

    const segments = path.split(".");
    const result = { ...(obj as Record<string, unknown>) };
    let current = result;

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (!(segment in current) || typeof current[segment] !== "object") {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }

    current[segments[segments.length - 1]] = value;
    return result;
  }

  /**
   * Flatten nested arrays recursively
   */
  private flattenArray(arr: unknown[]): unknown[] {
    const result: unknown[] = [];

    for (const item of arr) {
      if (Array.isArray(item)) {
        result.push(...this.flattenArray(item));
      } else {
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Calculate maximum depth of nested arrays
   */
  private calculateArrayDepth(
    arr: unknown[],
    currentDepth: number = 1,
  ): number {
    let maxDepth = currentDepth;

    for (const item of arr) {
      if (Array.isArray(item)) {
        const itemDepth = this.calculateArrayDepth(item, currentDepth + 1);
        maxDepth = Math.max(maxDepth, itemDepth);
      }
    }

    return maxDepth;
  }
}
