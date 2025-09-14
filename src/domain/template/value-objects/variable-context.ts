import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

/**
 * Represents the context for variable resolution in templates
 * Following DDD value object pattern with Totality principles
 */
export class VariableContext {
  private constructor(
    private readonly data: Record<string, unknown>,
    private readonly arrayData?: unknown[],
  ) {}

  /**
   * Legacy create method for backward compatibility
   * @deprecated Use fromSingleData, fromComposedData, or fromArrayData instead
   */
  static create(
    _schema: unknown,
    data: FrontmatterData,
  ): Result<VariableContext, TemplateError & { message: string }> {
    return VariableContext.fromSingleData(data);
  }

  /**
   * Smart Constructor for single data source
   */
  static fromSingleData(
    data: FrontmatterData,
  ): Result<VariableContext, TemplateError & { message: string }> {
    try {
      const contextData = data.getData();
      return ok(new VariableContext(contextData));
    } catch (error) {
      return err(createError({
        kind: "DataCompositionFailed",
        reason: error instanceof Error
          ? error.message
          : "Unknown error creating context",
      }));
    }
  }

  /**
   * Smart Constructor for composed data (main + items)
   */
  static fromComposedData(
    composedData: ComposedData,
  ): Result<VariableContext, TemplateError & { message: string }> {
    return ok(
      new VariableContext(
        composedData.mainData,
        composedData.arrayData,
      ),
    );
  }

  /**
   * Smart Constructor for array data
   */
  static fromArrayData(
    arrayData: FrontmatterData[],
  ): Result<VariableContext, TemplateError & { message: string }> {
    try {
      const plainData = arrayData.map((item) => item.getData());
      return ok(new VariableContext({}, plainData));
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
   * Get value for variable path using dot notation
   */
  getValue(
    variablePath: string,
  ): Result<unknown, TemplateError & { message: string }> {
    if (!variablePath.trim()) {
      return err(createError({
        kind: "VariableResolutionFailed",
        variable: variablePath,
        reason: "Variable path cannot be empty",
      }));
    }

    // Handle array expansion markers
    if (variablePath.startsWith("@")) {
      return this.resolveArrayMarker(variablePath);
    }

    return this.resolveDataPath(variablePath);
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use getValue instead
   */
  resolveVariable(
    variablePath: string,
  ): Result<unknown, TemplateError & { message: string }> {
    return this.getValue(variablePath);
  }

  /**
   * Get all available data keys
   */
  getDataKeys(): string[] {
    return Object.keys(this.data);
  }

  /**
   * Get hierarchy root (for legacy compatibility)
   * @deprecated Will be removed in future versions
   */
  getHierarchyRoot(): string | null {
    return null;
  }

  /**
   * Validate items resolution (for legacy compatibility)
   * @deprecated Will be removed in future versions
   */
  validateItemsResolution(): boolean {
    return this.hasArrayData();
  }

  /**
   * Create item context (for legacy compatibility)
   * @deprecated Will be removed in future versions
   */
  createItemContext(item: unknown): VariableContext {
    return new VariableContext(item as Record<string, unknown>);
  }

  /**
   * Check if array data is available
   */
  hasArrayData(): boolean {
    return this.arrayData !== undefined && this.arrayData.length > 0;
  }

  /**
   * Get array data for expansion
   */
  getArrayData(): unknown[] {
    return this.arrayData ? [...this.arrayData] : [];
  }

  private resolveArrayMarker(
    marker: string,
  ): Result<unknown, TemplateError & { message: string }> {
    if (marker === "@items" && this.arrayData) {
      return ok(this.arrayData);
    }

    return err(createError({
      kind: "VariableResolutionFailed",
      variable: marker,
      reason:
        `Array marker '${marker}' not supported or no array data available`,
    }));
  }

  private resolveDataPath(
    path: string,
  ): Result<unknown, TemplateError & { message: string }> {
    const segments = path.split(".");
    let current: any = this.data;

    for (const segment of segments) {
      if (current === null || current === undefined) {
        return err(createError({
          kind: "VariableResolutionFailed",
          variable: path,
          reason: `Path segment '${segment}' not found`,
        }));
      }

      if (typeof current !== "object") {
        return err(createError({
          kind: "VariableResolutionFailed",
          variable: path,
          reason: `Cannot access property '${segment}' on non-object value`,
        }));
      }

      current = current[segment];
    }

    return ok(current);
  }
}

/**
 * Represents composed data from multiple sources
 */
export interface ComposedData {
  readonly mainData: Record<string, unknown>;
  readonly arrayData?: unknown[];
}
