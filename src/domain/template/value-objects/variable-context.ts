import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";
import { TemplateVariable } from "./template-variable.ts";

/**
 * Hierarchy root state using discriminated union for Totality
 */
export type HierarchyRootState =
  | { readonly kind: "defined"; readonly value: string }
  | { readonly kind: "not-defined" };

/**
 * Array data state using discriminated union for Totality
 */
export type ArrayDataState =
  | { readonly kind: "available"; readonly data: unknown[] }
  | { readonly kind: "not-available" };

/**
 * Represents the context for variable resolution in templates
 * Following DDD value object pattern with Totality principles
 */
export class VariableContext {
  private constructor(
    private readonly data: Record<string, unknown>,
    private readonly arrayDataState: ArrayDataState,
    private readonly hierarchyRootState: HierarchyRootState,
  ) {}

  /**
   * Legacy create method for backward compatibility
   * @deprecated Use fromSingleData, fromComposedData, or fromArrayData instead
   */
  static create(
    schema: any,
    data: FrontmatterData,
  ): Result<VariableContext, TemplateError & { message: string }> {
    try {
      // Extract hierarchy root from schema if it has x-frontmatter-part
      let hierarchyRootState: HierarchyRootState = { kind: "not-defined" };
      if (schema && schema.findFrontmatterPartPath) {
        const pathResult = schema.findFrontmatterPartPath();
        if (pathResult && pathResult.ok && pathResult.data) {
          hierarchyRootState = { kind: "defined", value: pathResult.data };
        }
      }

      const contextData = data.getData();

      // If we have a hierarchy root, extract the array data from that path
      let arrayDataState: ArrayDataState = { kind: "not-available" };
      if (hierarchyRootState.kind === "defined") {
        const parts = hierarchyRootState.value.split(".");
        let current: any = contextData;
        for (const part of parts) {
          if (current && typeof current === "object" && part in current) {
            current = current[part];
          } else {
            current = undefined;
            break;
          }
        }
        if (Array.isArray(current)) {
          arrayDataState = { kind: "available", data: current };
        }
      }

      return ok(
        new VariableContext(contextData, arrayDataState, hierarchyRootState),
      );
    } catch (error) {
      return ErrorHandler.template({
        operation: "create",
        method: "processData",
      }).invalid(
        error instanceof Error
          ? error.message
          : "Unknown error creating context",
      );
    }
  }

  /**
   * Smart Constructor for single data source
   */
  static fromSingleData(
    data: FrontmatterData,
  ): Result<VariableContext, TemplateError & { message: string }> {
    try {
      const contextData = data.getData();
      return ok(
        new VariableContext(
          contextData,
          { kind: "not-available" },
          { kind: "not-defined" },
        ),
      );
    } catch (error) {
      return ErrorHandler.template({
        operation: "fromSingleData",
        method: "processData",
      }).invalid(
        error instanceof Error
          ? error.message
          : "Unknown error creating context",
      );
    }
  }

  /**
   * Smart Constructor for composed data (main + items)
   */
  static fromComposedData(
    composedData: ComposedData,
  ): Result<VariableContext, TemplateError & { message: string }> {
    const arrayDataState: ArrayDataState = composedData.arrayData
      ? { kind: "available", data: composedData.arrayData }
      : { kind: "not-available" };

    return ok(
      new VariableContext(
        composedData.mainData,
        arrayDataState,
        { kind: "not-defined" },
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
      return ok(
        new VariableContext(
          {},
          { kind: "available", data: plainData },
          { kind: "not-defined" },
        ),
      );
    } catch (error) {
      return ErrorHandler.template({
        operation: "fromArrayData",
        method: "processArrayData",
      }).invalid(
        error instanceof Error
          ? error.message
          : "Unknown error creating array context",
      );
    }
  }

  /**
   * Get value for variable path using dot notation
   */
  getValue(
    variablePath: string,
  ): Result<unknown, TemplateError & { message: string }> {
    if (!variablePath.trim()) {
      return ErrorHandler.template({
        operation: "getValue",
        method: "validatePath",
      }).variableNotFound(variablePath || "[empty]");
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
   * Get hierarchy root state using Totality principles
   */
  getHierarchyRootState(): HierarchyRootState {
    return this.hierarchyRootState;
  }

  /**
   * Get hierarchy root (for legacy compatibility)
   * @deprecated Use getHierarchyRootState instead
   */
  getHierarchyRoot(): string | null {
    return this.hierarchyRootState.kind === "defined"
      ? this.hierarchyRootState.value
      : null;
  }

  /**
   * Get array data state using Totality principles
   */
  getArrayDataState(): ArrayDataState {
    return this.arrayDataState;
  }

  /**
   * Validate items resolution (for legacy compatibility)
   * @deprecated Use getArrayDataState instead
   */
  validateItemsResolution(): boolean {
    return this.hasArrayData();
  }

  /**
   * Create item context (for legacy compatibility)
   * @deprecated Will be removed in future versions
   */
  createItemContext(item: unknown): VariableContext {
    const itemObjResult = SafePropertyAccess.asRecord(item);
    const itemData = itemObjResult.ok ? itemObjResult.data : {};

    return new VariableContext(
      itemData,
      { kind: "not-available" },
      this.hierarchyRootState,
    );
  }

  /**
   * Check if array data is available
   */
  hasArrayData(): boolean {
    return this.arrayDataState.kind === "available" &&
      this.arrayDataState.data.length > 0;
  }

  /**
   * Get array data for expansion
   */
  getArrayData(): unknown[] {
    return this.arrayDataState.kind === "available"
      ? [...this.arrayDataState.data]
      : [];
  }

  private resolveArrayMarker(
    marker: string,
  ): Result<unknown, TemplateError & { message: string }> {
    // Use type-safe variable resolution instead of hardcoded string check
    const variableResult = TemplateVariable.create(marker);
    if (!variableResult.ok) {
      return variableResult;
    }

    const variable = variableResult.data;
    if (variable.isArrayExpansion && this.arrayDataState.kind === "available") {
      return ok(this.arrayDataState.data);
    }

    return ErrorHandler.template({
      operation: "resolveArrayMarker",
      method: "checkArrayData",
    }).variableNotFound(marker);
  }

  private resolveDataPath(
    path: string,
  ): Result<unknown, TemplateError & { message: string }> {
    const segments = path.split(".");
    let current: any = this.data;

    for (const segment of segments) {
      if (current === null || current === undefined) {
        return ErrorHandler.template({
          operation: "resolveDataPath",
          method: "traversePath",
        }).variableNotFound(path);
      }

      if (typeof current !== "object") {
        return ErrorHandler.template({
          operation: "resolveDataPath",
          method: "accessProperty",
        }).invalid(`Cannot access property '${segment}' on non-object value`);
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
