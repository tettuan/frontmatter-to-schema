import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

/**
 * Variable Context represents the hierarchical scope for template variable resolution.
 * Follows DDD principles with clear value object semantics.
 *
 * Key architectural constraint: {@items} variables are resolved from the
 * x-frontmatter-part hierarchy level, similar to $ref processing.
 */
export class VariableContext {
  private constructor(
    private readonly schema: Schema,
    private readonly data: FrontmatterData,
    private readonly hierarchyRoot: string | null, // Path to x-frontmatter-part root
    private readonly legacyArrayData?: unknown[], // Backward compatibility
  ) {}

  /**
   * Smart Constructor that establishes variable context from schema and data.
   * Automatically determines the hierarchy root based on x-frontmatter-part location.
   */
  static create(
    schema: Schema,
    data: FrontmatterData,
  ): Result<VariableContext, TemplateError & { message: string }> {
    // Find the hierarchy root for {@items} resolution
    const hierarchyRootResult = this.findFrontmatterPartRoot(schema);
    const hierarchyRoot = hierarchyRootResult.ok
      ? hierarchyRootResult.data
      : null;

    return ok(new VariableContext(schema, data, hierarchyRoot));
  }

  /**
   * Legacy constructor for backward compatibility
   * @deprecated Use create() instead for proper schema-aware context
   */
  static fromSingleData(
    data: FrontmatterData,
  ): Result<VariableContext, TemplateError & { message: string }> {
    // Create a minimal schema for legacy support
    const _contextData = data.getData();
    return ok(
      new VariableContext(
        null as any, // Legacy mode - no schema
        data,
        null, // No hierarchy root in legacy mode
      ),
    );
  }

  /**
   * Legacy constructor for backward compatibility with array data
   * @deprecated Use create() with proper schema instead
   */
  static fromComposedData(
    composedData: ComposedData,
  ): Result<VariableContext, TemplateError & { message: string }> {
    const frontmatterDataResult = FrontmatterData.create(composedData.mainData);
    if (!frontmatterDataResult.ok) {
      return err(createError({
        kind: "DataCompositionFailed",
        reason: "Failed to create FrontmatterData from composed data",
      }));
    }

    return ok(
      new VariableContext(
        null as any, // Legacy mode
        frontmatterDataResult.data,
        null, // No hierarchy root in legacy mode
        composedData.arrayData,
      ),
    );
  }

  /**
   * Legacy constructor for array data
   * @deprecated Use create() with proper schema instead
   */
  static fromArrayData(
    arrayData: FrontmatterData[],
  ): Result<VariableContext, TemplateError & { message: string }> {
    try {
      const plainData = arrayData.map((item) => item.getData());
      const emptyData = FrontmatterData.empty();
      return ok(
        new VariableContext(
          null as any, // Legacy mode
          emptyData,
          null, // No hierarchy root in legacy mode
          plainData,
        ),
      );
    } catch (error) {
      return err(createError({
        kind: "DataCompositionFailed",
        reason: error instanceof Error
          ? error.message
          : "Unknown error creating array context",
      }));
    }
  }

  /**
   * Resolves a variable within this context, respecting hierarchy rules.
   * {@items} variables are resolved from the x-frontmatter-part root.
   */
  resolveVariable(
    variableName: string,
  ): Result<unknown, TemplateError & { message: string }> {
    // Handle {@items} special variable with hierarchy root constraint
    if (variableName === "@items") {
      return this.resolveItemsVariable();
    }

    // Handle other @ variables (reserved for special processing)
    if (variableName.startsWith("@")) {
      return err(createError({
        kind: "RenderFailed",
        message: `Unknown special variable: ${variableName}`,
      }));
    }

    // Resolve regular variables from the full data context
    const dataResult = this.data.get(variableName);
    if (!dataResult.ok) {
      return err(createError({
        kind: "RenderFailed",
        message:
          `Variable '${variableName}' not found: ${dataResult.error.message}`,
      }));
    }
    return ok(dataResult.data);
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use resolveVariable() instead
   */
  getValue(
    variablePath: string,
  ): Result<unknown, TemplateError & { message: string }> {
    return this.resolveVariable(variablePath);
  }

  /**
   * Resolves {@items} variable from the x-frontmatter-part hierarchy root.
   * This ensures consistency with $ref processing patterns.
   */
  private resolveItemsVariable(): Result<
    unknown[],
    TemplateError & { message: string }
  > {
    // Fallback to legacy array data if no schema hierarchy
    if (!this.hierarchyRoot && this.legacyArrayData) {
      return ok(this.legacyArrayData);
    }

    if (!this.hierarchyRoot) {
      return err(createError({
        kind: "RenderFailed",
        message:
          "Cannot resolve {@items}: no x-frontmatter-part found in schema",
      }));
    }

    // Resolve data from the hierarchy root (similar to $ref resolution)
    const rootDataResult = this.data.get(this.hierarchyRoot);
    if (!rootDataResult.ok) {
      return err(createError({
        kind: "RenderFailed",
        message:
          `Cannot resolve {@items}: data not found at hierarchy root ${this.hierarchyRoot}`,
      }));
    }

    const rootData = rootDataResult.data;
    if (!Array.isArray(rootData)) {
      return err(createError({
        kind: "RenderFailed",
        message:
          `Cannot resolve {@items}: expected array at ${this.hierarchyRoot}, got ${typeof rootData}`,
      }));
    }

    return ok(rootData);
  }

  /**
   * Finds the path to the x-frontmatter-part root in the schema.
   * This path becomes the hierarchy root for {@items} resolution.
   */
  private static findFrontmatterPartRoot(
    schema: Schema,
  ): Result<string, TemplateError & { message: string }> {
    const frontmatterPartResult = schema.findFrontmatterPartPath();
    if (!frontmatterPartResult.ok) {
      return err(createError({
        kind: "RenderFailed",
        message:
          "No x-frontmatter-part found in schema for {@items} resolution",
      }));
    }

    return ok(frontmatterPartResult.data);
  }

  /**
   * Creates a scoped context for array item processing.
   * Each array item gets its own variable context.
   */
  createItemContext(
    itemData: FrontmatterData,
  ): Result<VariableContext, TemplateError & { message: string }> {
    // Item contexts inherit the same schema but use item-specific data
    return ok(new VariableContext(this.schema, itemData, this.hierarchyRoot));
  }

  /**
   * Gets the hierarchy root path for debugging and validation.
   */
  getHierarchyRoot(): string | null {
    return this.hierarchyRoot;
  }

  /**
   * Validates that the context can properly resolve {@items}.
   * Used for template-schema binding validation.
   */
  validateItemsResolution(): Result<void, TemplateError & { message: string }> {
    if (!this.hierarchyRoot) {
      return err(createError({
        kind: "RenderFailed",
        message:
          "Invalid context: no x-frontmatter-part found for {@items} resolution",
      }));
    }

    // Validate that the hierarchy root exists in the data
    const rootDataResult = this.data.get(this.hierarchyRoot);
    if (!rootDataResult.ok) {
      return err(createError({
        kind: "RenderFailed",
        message:
          `Invalid context: hierarchy root ${this.hierarchyRoot} not found in data`,
      }));
    }

    // Validate that the root data is an array (required for {@items})
    const rootData = rootDataResult.data;
    if (!Array.isArray(rootData)) {
      return err(createError({
        kind: "RenderFailed",
        message:
          `Invalid context: hierarchy root ${this.hierarchyRoot} must be an array for {@items}`,
      }));
    }

    return ok(undefined);
  }

  /**
   * Gets the schema associated with this context.
   */
  getSchema(): Schema {
    return this.schema;
  }

  /**
   * Gets the data associated with this context.
   */
  getData(): FrontmatterData {
    return this.data;
  }

  /**
   * Legacy methods for backward compatibility
   */
  getDataKeys(): string[] {
    return Object.keys(this.data.getData());
  }

  hasArrayData(): boolean {
    return this.legacyArrayData !== undefined &&
      this.legacyArrayData.length > 0;
  }

  getArrayData(): unknown[] {
    return this.legacyArrayData ? [...this.legacyArrayData] : [];
  }
}

/**
 * Represents composed data from multiple sources
 */
export interface ComposedData {
  readonly mainData: Record<string, unknown>;
  readonly arrayData?: unknown[];
}
