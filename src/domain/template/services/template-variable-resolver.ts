/**
 * Template Variable Resolver Service - Enhanced DDD+Totality Implementation
 *
 * Centralizes template variable resolution logic following strict DDD and Totality principles.
 * This service addresses the core template variable resolution issue by implementing:
 * - Smart Constructor pattern for service creation
 * - Complete Result<T,E> compliance (no partial functions)
 * - Hierarchical variable resolution with proper error handling
 * - Domain-specific transformation logic
 *
 * Design Philosophy:
 * - Domain Service pattern: Encapsulates complex business logic
 * - Functional cohesion: Related variable operations grouped together
 * - Total functions: All operations return Result<T, E> for complete error handling
 * - Immutable operations: No side effects, pure functional approach
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { TemplateError, ValidationError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { TemplateVariable } from "../value-objects/template-variable.ts";
import { matchTemplateVariableType } from "../value-objects/template-variable-type.ts";
import {
  ARRAY_EXPANSION_MARKER,
  ERROR_MESSAGES,
} from "../constants/template-variable-constants.ts";
import {
  DomainLogger,
  NullDomainLogger,
} from "../../shared/services/domain-logger.ts";
import { VariableTransformationRegistry } from "../strategies/variable-transformation-strategy.ts";
import { PropertyTransformationRegistry } from "../strategies/property-transformation-strategy.ts";

/**
 * Array data state for template variable resolution.
 */
export type ArrayDataState =
  | { readonly kind: "available"; readonly data: unknown[] }
  | { readonly kind: "not-available" };

/**
 * Context for template variable resolution.
 */
export interface VariableResolutionContext {
  readonly data: FrontmatterData;
  readonly arrayDataState: ArrayDataState;
  readonly hierarchyRoot?: string;
}

/**
 * Template Variable Resolver Service - DDD+Totality Implementation
 *
 * Enhanced service that provides unified variable resolution with complete type safety,
 * comprehensive error handling, and hierarchical variable resolution capabilities.
 *
 * Key improvements:
 * - Smart Constructor pattern prevents invalid instances
 * - All methods return Result<T,E> types (no partial functions)
 * - Enhanced hierarchical resolution for variables like {id.full}
 * - Comprehensive logging and error context
 * - Immutable operations following functional programming principles
 */
export class TemplateVariableResolver {
  private readonly transformationRegistry: VariableTransformationRegistry;
  private readonly propertyTransformationRegistry:
    PropertyTransformationRegistry;

  private constructor(
    private readonly domainLogger: DomainLogger = new NullDomainLogger(),
  ) {
    this.transformationRegistry = new VariableTransformationRegistry();
    this.propertyTransformationRegistry = new PropertyTransformationRegistry();
  }

  /**
   * Smart Constructor for TemplateVariableResolver
   * Follows Totality principle - all creation paths handled explicitly
   * @param domainLogger - Optional domain logger for debugging
   * @returns Result containing TemplateVariableResolver instance or validation error
   */
  static create(
    domainLogger?: DomainLogger,
  ): Result<TemplateVariableResolver, ValidationError & { message: string }> {
    try {
      const resolver = new TemplateVariableResolver(
        domainLogger ?? new NullDomainLogger(),
      );
      return ok(resolver);
    } catch (error) {
      return err({
        kind: "UnknownError" as const,
        field: "TemplateVariableResolver",
        message: `Failed to create TemplateVariableResolver: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }
  /**
   * Resolves a template variable within the given context.
   * Enhanced with proper logging and comprehensive error handling.
   * Implements exhaustive pattern matching for all variable types.
   */
  resolveVariable(
    variable: TemplateVariable,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    this.domainLogger.logDebug(
      "template-variable-resolution",
      "Starting variable resolution",
      {
        variableName: variable.displayName,
        variableType: variable.type.kind,
        hasArrayData: context.arrayDataState.kind === "available",
      },
    );

    const result = matchTemplateVariableType(variable.type, {
      StandardVariable: (standardVar) =>
        this.resolveStandardVariable(standardVar.name, context),
      ArrayExpansionVariable: (_arrayVar) =>
        this.resolveArrayExpansionVariable(context),
      SpecialProcessorVariable: (specialVar) =>
        this.resolveSpecialProcessorVariable(specialVar.marker, context),
    });

    if (result.ok) {
      this.domainLogger.logDebug(
        "template-variable-resolution",
        "Variable resolution successful",
        {
          variableName: variable.displayName,
          resolvedValueType: typeof result.data,
          resolvedValue: result.data,
        },
      );
    } else {
      this.domainLogger.logError(
        "template-variable-resolution",
        result.error,
        {
          variableName: variable.displayName,
          variableType: variable.type.kind,
        },
      );
    }

    return result;
  }

  /**
   * Resolves a standard template variable from data context.
   * Enhanced with proper logging, error handling, and hierarchical support.
   * Handles both simple variables and hierarchical dot-notation variables.
   */
  private resolveStandardVariable(
    variableName: string,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    this.domainLogger.logDebug(
      "standard-variable-resolution",
      `Resolving variable: ${variableName}`,
      {
        variableName,
        availableKeys: Object.keys(context.data.getData()),
        isHierarchical: variableName.includes("."),
      },
    );

    // Handle hierarchical variables (e.g., "id.full")
    if (variableName.includes(".")) {
      return this.resolveHierarchicalVariable(variableName, context);
    }

    // Handle simple variables
    const dataResult = context.data.get(variableName);
    if (!dataResult.ok) {
      this.domainLogger.logDebug(
        "standard-variable-resolution",
        `Variable '${variableName}' not found in data context`,
        {
          variableName,
          availableKeys: Object.keys(context.data.getData()),
          dataContext: context.data.getData(),
        },
      );
      return ErrorHandler.template({
        operation: "resolveStandardVariable",
        method: "getFromData",
      }).variableResolutionFailed(
        variableName,
        `Variable '${variableName}' not found in data context`,
      );
    }

    this.domainLogger.logDebug(
      "standard-variable-resolution",
      `Variable '${variableName}' resolved successfully`,
      {
        variableName,
        resolvedValue: dataResult.data,
        valueType: typeof dataResult.data,
      },
    );
    return ok(dataResult.data);
  }

  /**
   * Resolves hierarchical template variables using enhanced DDD + Totality principles.
   * This is the core fix for the template variable resolution issue.
   * Handles dot-notation variables by attempting multiple resolution strategies.
   */
  private resolveHierarchicalVariable(
    variableName: string,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    this.domainLogger.logDebug(
      "hierarchical-variable-resolution",
      `Resolving hierarchical variable: ${variableName}`,
      {
        variableName,
        pathSegments: variableName.split("."),
      },
    );

    // Strategy 1: Direct path resolution (e.g., data contains {"id.full": "value"})
    const directResult = context.data.get(variableName);
    if (directResult.ok) {
      this.domainLogger.logDebug(
        "hierarchical-variable-resolution",
        `Direct path resolution successful for ${variableName}`,
        { value: directResult.data },
      );
      return directResult;
    }

    // Strategy 2: Navigate object hierarchy (e.g., data contains {"id": {"full": "value"}})
    const hierarchyResult = this.resolveObjectHierarchy(variableName, context);
    if (hierarchyResult.ok) {
      return hierarchyResult;
    }

    // Strategy 3: Smart transformation for common patterns
    const pathParts = variableName.split(".");
    if (pathParts.length === 2) {
      const [baseName, property] = pathParts;
      const transformResult = this.resolveTransformedHierarchicalVariable(
        baseName,
        property,
        context,
      );
      if (transformResult.ok) {
        return transformResult;
      }
    }

    this.domainLogger.logError(
      "hierarchical-variable-resolution",
      {
        kind: "VariableNotFound",
        message:
          `Hierarchical variable '${variableName}' could not be resolved`,
      },
      {
        variableName,
        availableKeys: Object.keys(context.data.getData()),
      },
    );

    return ErrorHandler.template({
      operation: "resolveHierarchicalVariable",
      method: "allStrategiesFailed",
    }).variableResolutionFailed(
      variableName,
      `Hierarchical variable '${variableName}' not found after trying all resolution strategies`,
    );
  }

  /**
   * New method: Resolves variables by navigating object hierarchy.
   * This addresses the core issue where {id.full} should work when data contains nested objects.
   */
  private resolveObjectHierarchy(
    variableName: string,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    const pathParts = variableName.split(".");
    let currentValue: unknown = context.data.getData();

    this.domainLogger.logDebug(
      "object-hierarchy-navigation",
      "Starting object hierarchy navigation",
      {
        path: pathParts,
        initialValue: typeof currentValue,
      },
    );

    for (const [index, part] of pathParts.entries()) {
      if (typeof currentValue !== "object" || currentValue === null) {
        this.domainLogger.logDebug(
          "object-hierarchy-navigation",
          `Navigation stopped at step ${index}: not an object`,
          { part, currentValueType: typeof currentValue },
        );
        return ErrorHandler.template({
          operation: "resolveObjectHierarchy",
          method: "navigateHierarchy",
        }).variableResolutionFailed(
          variableName,
          `Cannot navigate '${part}' on non-object value at path segment ${index}`,
        );
      }

      const obj = currentValue as Record<string, unknown>;
      if (!(part in obj)) {
        this.domainLogger.logDebug(
          "object-hierarchy-navigation",
          `Property '${part}' not found at step ${index}`,
          { availableKeys: Object.keys(obj) },
        );
        return ErrorHandler.template({
          operation: "resolveObjectHierarchy",
          method: "navigateHierarchy",
        }).variableResolutionFailed(
          variableName,
          `Property '${part}' not found in object at path segment ${index}`,
        );
      }

      currentValue = obj[part];
      this.domainLogger.logDebug(
        "object-hierarchy-navigation",
        `Navigated to '${part}' at step ${index}`,
        { value: currentValue, valueType: typeof currentValue },
      );
    }

    this.domainLogger.logDebug(
      "object-hierarchy-navigation",
      "Object hierarchy navigation successful",
      { finalValue: currentValue },
    );

    return ok(currentValue);
  }

  /**
   * Transforms flat data structure to support hierarchical variable access.
   * Enhanced with proper logging and comprehensive transformation logic.
   * Implements domain-specific transformation logic following Totality principles.
   */
  private resolveTransformedHierarchicalVariable(
    baseName: string,
    property: string,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    this.domainLogger.logDebug(
      "hierarchical-transformation",
      `Attempting transformation for ${baseName}.${property}`,
      { baseName, property },
    );

    // Get base value from flat structure
    const baseResult = context.data.get(baseName);
    if (!baseResult.ok) {
      this.domainLogger.logDebug(
        "hierarchical-transformation",
        `Base variable '${baseName}' not found`,
        { baseName },
      );
      return ErrorHandler.template({
        operation: "resolveTransformedHierarchicalVariable",
        method: "getBaseValue",
      }).variableResolutionFailed(
        baseName,
        `Base variable '${baseName}' not found for hierarchical access`,
      );
    }

    // Apply domain-specific transformation patterns
    const transformationResult = this.applyHierarchicalTransformation(
      baseResult.data,
      property,
      baseName,
    );

    if (transformationResult.ok) {
      this.domainLogger.logDebug(
        "hierarchical-transformation",
        `Transformation successful: ${baseName}.${property}`,
        {
          baseName,
          property,
          transformedValue: transformationResult.data,
        },
      );
      return transformationResult;
    }

    this.domainLogger.logDebug(
      "hierarchical-transformation",
      `Transformation failed for ${baseName}.${property}`,
      { error: transformationResult.error },
    );

    return transformationResult;
  }

  /**
   * Applies domain-specific transformation logic for hierarchical variable access.
   * Enhanced with Result<T,E> return type and comprehensive transformation patterns.
   * Following DDD principles, this encapsulates business rules for data transformation.
   */
  private applyHierarchicalTransformation(
    baseValue: unknown,
    property: string,
    baseName: string,
  ): Result<unknown, TemplateError & { message: string }> {
    this.domainLogger.logDebug(
      "transformation-logic",
      "Applying hierarchical transformation",
      {
        baseName,
        property,
        baseValueType: typeof baseValue,
        baseValue: baseValue,
      },
    );

    // Check for registered transformation strategies
    const strategy = this.transformationRegistry.findStrategy(
      baseName,
      property,
    );
    if (strategy) {
      this.domainLogger.logDebug(
        "transformation-logic",
        `Applying transformation strategy for ${baseName}.${property}`,
      );
      return strategy.apply(baseValue);
    }

    // Pattern 2: For other properties, check if base value contains the property
    if (typeof baseValue === "object" && baseValue !== null) {
      const obj = baseValue as Record<string, unknown>;
      if (property in obj) {
        this.domainLogger.logDebug(
          "transformation-logic",
          `Property '${property}' found in object`,
          { value: obj[property] },
        );
        return ok(obj[property]);
      }
    }

    // Pattern 3: Property-specific transformations
    const propertyTransformResult = this.applyPropertySpecificTransformation(
      baseValue,
      property,
    );
    if (propertyTransformResult.ok) {
      return propertyTransformResult;
    }

    // No transformation pattern matched
    this.domainLogger.logDebug(
      "transformation-logic",
      `No transformation pattern for ${baseName}.${property}`,
      { baseName, property, baseValueType: typeof baseValue },
    );

    return ErrorHandler.template({
      operation: "applyHierarchicalTransformation",
      method: "noPatternMatched",
    }).variableResolutionFailed(
      `${baseName}.${property}`,
      `No transformation pattern available for '${baseName}.${property}'`,
    );
  }

  /**
   * Applies property-specific transformation patterns.
   * Separated for better maintainability and testing.
   */
  private applyPropertySpecificTransformation(
    baseValue: unknown,
    property: string,
  ): Result<unknown, TemplateError & { message: string }> {
    // Use PropertyTransformationRegistry instead of hardcoded switch
    // This follows the Open/Closed principle and fixes Issue #1072
    this.domainLogger.logDebug(
      "property-transformation",
      `Applying transformation for property '${property}'`,
      { baseValue, property },
    );

    const result = this.propertyTransformationRegistry.transform(
      property,
      baseValue,
    );

    if (result.ok) {
      this.domainLogger.logDebug(
        "property-transformation",
        `Transformation successful for property '${property}'`,
        { original: baseValue, transformed: result.data },
      );
    } else {
      this.domainLogger.logDebug(
        "property-transformation",
        `Transformation failed for property '${property}'`,
        { error: result.error },
      );
    }

    return result;
  }

  /**
   * Resolves array expansion variable ({@items}).
   * Enhanced with proper logging and comprehensive state checking.
   * Requires available array data state.
   */
  private resolveArrayExpansionVariable(
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    this.domainLogger.logDebug(
      "array-expansion-resolution",
      "Resolving @items variable",
      {
        arrayDataKind: context.arrayDataState.kind,
        hasData: context.arrayDataState.kind === "available",
        dataLength: context.arrayDataState.kind === "available"
          ? context.arrayDataState.data.length
          : 0,
      },
    );

    if (context.arrayDataState.kind === "available") {
      this.domainLogger.logDebug(
        "array-expansion-resolution",
        "@items resolver - returning array data",
        {
          dataLength: context.arrayDataState.data.length,
          data: context.arrayDataState.data,
        },
      );
      return ok(context.arrayDataState.data);
    }

    this.domainLogger.logDebug(
      "array-expansion-resolution",
      "@items resolver - array data not available",
    );
    return ErrorHandler.template({
      operation: "resolveArrayExpansionVariable",
      method: "checkArrayDataState",
    }).variableResolutionFailed(
      ARRAY_EXPANSION_MARKER,
      ERROR_MESSAGES.ARRAY_MARKER_NOT_SUPPORTED(ARRAY_EXPANSION_MARKER),
    );
  }

  /**
   * Resolves special processor variables (future extensibility).
   * Enhanced with proper logging and extensible architecture.
   * Currently only supports @items; others are treated as unsupported.
   */
  private resolveSpecialProcessorVariable(
    marker: string,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    this.domainLogger.logDebug(
      "special-processor-resolution",
      `Resolving special processor variable: ${marker}`,
      { marker },
    );

    // Handle the special case of @items as a processor variable
    if (marker === ARRAY_EXPANSION_MARKER) {
      return this.resolveArrayExpansionVariable(context);
    }

    // All other special processors are currently unsupported
    this.domainLogger.logDebug(
      "special-processor-resolution",
      `Unsupported special processor: ${marker}`,
      { marker },
    );
    return ErrorHandler.template({
      operation: "resolveSpecialProcessorVariable",
      method: "checkUnsupportedMarker",
    }).variableResolutionFailed(
      marker,
      ERROR_MESSAGES.ARRAY_MARKER_NOT_SUPPORTED(marker),
    );
  }

  /**
   * Resolves a variable by name (legacy support).
   * Enhanced with proper instance method call and comprehensive error handling.
   * Converts string-based resolution to type-safe approach.
   */
  resolveVariableByName(
    variableName: string,
    context: VariableResolutionContext,
  ): Result<unknown, TemplateError & { message: string }> {
    this.domainLogger.logDebug(
      "variable-by-name-resolution",
      `Resolving variable by name: ${variableName}`,
      { variableName },
    );

    const variableResult = TemplateVariable.create(variableName);
    if (!variableResult.ok) {
      this.domainLogger.logError(
        "variable-by-name-resolution",
        variableResult.error,
        { variableName },
      );
      return variableResult;
    }

    return this.resolveVariable(variableResult.data, context);
  }

  /**
   * Checks if a variable name should be processed.
   * Enhanced with Result<T,E> return type for better error handling.
   * Replaces hardcoded string checks with type-safe logic.
   */
  shouldProcessVariable(
    variableName: string,
  ): Result<boolean, ValidationError & { message: string }> {
    this.domainLogger.logDebug(
      "variable-processing-check",
      `Checking if variable should be processed: ${variableName}`,
      { variableName },
    );

    const variableResult = TemplateVariable.create(variableName);
    if (!variableResult.ok) {
      this.domainLogger.logDebug(
        "variable-processing-check",
        `Variable '${variableName}' should not be processed due to creation error`,
        { error: variableResult.error },
      );
      return ok(false);
    }

    const variable = variableResult.data;

    // Process standard variables and array expansion variables
    // Skip special processor variables (except @items)
    const shouldProcess = matchTemplateVariableType(variable.type, {
      StandardVariable: () => true,
      ArrayExpansionVariable: () => true,
      SpecialProcessorVariable: (specialVar) =>
        specialVar.marker === ARRAY_EXPANSION_MARKER,
    });

    this.domainLogger.logDebug(
      "variable-processing-check",
      `Variable '${variableName}' processing decision: ${shouldProcess}`,
      { shouldProcess, variableType: variable.type.kind },
    );

    return ok(shouldProcess);
  }

  /**
   * Legacy static method for backward compatibility.
   * @deprecated Use instance method shouldProcessVariable instead
   */
  static shouldProcessVariable(variableName: string): boolean {
    const variableResult = TemplateVariable.create(variableName);
    if (!variableResult.ok) {
      return false;
    }

    const variable = variableResult.data;

    return matchTemplateVariableType(variable.type, {
      StandardVariable: () => true,
      ArrayExpansionVariable: () => true,
      SpecialProcessorVariable: (specialVar) =>
        specialVar.marker === ARRAY_EXPANSION_MARKER,
    });
  }

  /**
   * Creates an array data context from array data.
   * Enhanced with validation and error handling.
   */
  static createArrayDataContext(arrayData?: unknown[]): ArrayDataState {
    if (arrayData && Array.isArray(arrayData)) {
      return { kind: "available", data: arrayData };
    }
    return { kind: "not-available" };
  }

  /**
   * Creates a variable resolution context.
   * Enhanced with validation and comprehensive context creation.
   */
  static createContext(
    data: FrontmatterData,
    arrayData?: unknown[],
    hierarchyRoot?: string,
  ): VariableResolutionContext {
    return {
      data,
      arrayDataState: this.createArrayDataContext(arrayData),
      hierarchyRoot,
    };
  }

  /**
   * Creates a variable resolution context with Result<T,E> validation.
   * Preferred method for context creation with error handling.
   */
  static createContextSafe(
    data: FrontmatterData,
    arrayData?: unknown[],
    hierarchyRoot?: string,
  ): Result<VariableResolutionContext, ValidationError & { message: string }> {
    try {
      const context = {
        data,
        arrayDataState: this.createArrayDataContext(arrayData),
        hierarchyRoot,
      };
      return ok(context);
    } catch (error) {
      return err({
        kind: "UnknownError" as const,
        field: "VariableResolutionContext",
        message: `Failed to create variable resolution context: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }
}
