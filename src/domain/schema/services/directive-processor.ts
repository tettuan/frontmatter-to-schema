/**
 * @fileoverview Directive Processor Domain Service
 * @description Unified directive processing with dependency resolution
 * Following DDD, TDD, and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { DirectiveType } from "../value-objects/directive-type.ts";
import { Schema } from "../entities/schema.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../../frontmatter/factories/frontmatter-data-factory.ts";
import { JMESPathFilterService } from "./jmespath-filter-service.ts";

/**
 * Type guards for safe unknown type handling
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRecordWithProperty(
  value: unknown,
  property: string,
): value is Record<string, unknown> & { [K in typeof property]: unknown } {
  return isRecord(value) && property in value;
}

function isRecordWithStringProperty(
  value: unknown,
  property: string,
): value is Record<string, unknown> & { [K in typeof property]: string } {
  return isRecordWithProperty(value, property) &&
    typeof (value as Record<string, unknown>)[property] === "string";
}

/**
 * Directive Processing Error Types
 */
export type DirectiveProcessingError =
  | {
    kind: "CircularDependency";
    cycle: readonly string[];
    message: string;
  }
  | {
    kind: "MissingDependency";
    directive: string;
    missing: string;
    message: string;
  }
  | {
    kind: "InvalidCombination";
    directives: readonly string[];
    message: string;
  }
  | {
    kind: "ProcessingFailed";
    directive: string;
    error: DomainError;
    message: string;
  };

/**
 * Directive Node for Dependency Graph
 */
export interface DirectiveNode {
  readonly id: string;
  readonly type: DirectiveType;
  readonly schemaPath: string;
  readonly isPresent: boolean;
}

/**
 * Processing Phase with ordered directives
 */
export interface DirectivePhase {
  readonly phaseNumber: number;
  readonly description: string;
  readonly directives: readonly DirectiveNode[];
}

/**
 * Complete directive processing order
 */
export interface DirectiveProcessingOrder {
  readonly phases: readonly DirectivePhase[];
  readonly totalDirectives: number;
  readonly dependencyGraph: readonly DirectiveNode[];
}

/**
 * Directive Processor Domain Service
 *
 * Provides unified directive processing with dependency resolution using topological sorting.
 * Eliminates processing variance by ensuring deterministic execution order.
 *
 * Following DDD principles:
 * - Single responsibility: Directive processing orchestration
 * - Clean boundaries: Uses domain entities and value objects
 * - Totality: All methods return Result<T,E>
 */
export class DirectiveProcessor {
  private constructor() {
    // Private constructor for Smart Constructor pattern
  }

  /**
   * Smart Constructor for DirectiveProcessor
   * Following Totality principles by returning Result<T,E>
   */
  static create(): Result<
    DirectiveProcessor,
    DomainError & { message: string }
  > {
    return ok(new DirectiveProcessor());
  }

  /**
   * Resolve processing order for all directives in schema
   * Uses topological sorting to determine dependency-safe execution order
   */
  resolveProcessingOrder(
    schema: Schema,
  ): Result<DirectiveProcessingOrder, DirectiveProcessingError> {
    // 1. Discover all directives present in schema
    const discoveryResult = this.discoverDirectives(schema);
    if (!discoveryResult.ok) {
      return discoveryResult;
    }
    const presentDirectives = discoveryResult.data;

    // 2. Build complete dependency graph (including missing dependencies)
    const graphResult = this.buildDependencyGraph(presentDirectives);
    if (!graphResult.ok) {
      return graphResult;
    }
    const dependencyGraph = graphResult.data;

    // 3. Perform topological sort
    const sortResult = this.topologicalSort(dependencyGraph);
    if (!sortResult.ok) {
      return sortResult;
    }
    const sortedNodes = sortResult.data;

    // 4. Group into processing phases
    const phases = this.groupIntoPhases(sortedNodes);

    return ok({
      phases,
      totalDirectives: presentDirectives.length,
      dependencyGraph,
    });
  }

  /**
   * Process directives in dependency-safe order
   * Main orchestration method that applies all directives
   */
  processDirectives(
    data: FrontmatterData,
    schema: Schema,
    processingOrder: DirectiveProcessingOrder,
  ): Result<FrontmatterData, DirectiveProcessingError> {
    let currentData = data;

    // Process each phase in order
    for (const phase of processingOrder.phases) {
      // Phase processing debug information removed for production
      // Phase ${phase.phaseNumber}: ${phase.description}

      // Process all directives in current phase
      for (const directiveNode of phase.directives) {
        if (!directiveNode.isPresent) {
          continue; // Skip directives not present in schema
        }

        // Directive processing debug information removed for production
        // Processing: ${directiveNode.type.getKind()} at ${directiveNode.schemaPath}

        const processResult = this.processDirective(
          currentData,
          schema,
          directiveNode,
        );
        if (!processResult.ok) {
          return processResult;
        }
        currentData = processResult.data;
      }
    }

    // All directive processing complete - debug information removed for production
    return ok(currentData);
  }

  /**
   * Discover all directives present in the schema
   */
  private discoverDirectives(
    schema: Schema,
  ): Result<readonly DirectiveNode[], DirectiveProcessingError> {
    const nodes: DirectiveNode[] = [];

    // Check for x-frontmatter-part
    const frontmatterPartResult = schema.findFrontmatterPartPath();
    if (frontmatterPartResult.ok) {
      const typeResult = DirectiveType.create("frontmatter-part");
      if (!typeResult.ok) {
        return err({
          kind: "ProcessingFailed",
          directive: "frontmatter-part",
          error: typeResult.error,
          message: "Failed to create frontmatter-part directive type",
        });
      }

      nodes.push({
        id: "frontmatter-part",
        type: typeResult.data,
        schemaPath: frontmatterPartResult.data,
        isPresent: true,
      });
    }

    // Check for x-derived-from (via ValidationRules)
    // Note: This is detected indirectly through schema analysis
    const derivedFromPresent = this.hasDerivationDirectives(schema);
    if (derivedFromPresent) {
      const typeResult = DirectiveType.create("derived-from");
      if (!typeResult.ok) {
        return err({
          kind: "ProcessingFailed",
          directive: "derived-from",
          error: typeResult.error,
          message: "Failed to create derived-from directive type",
        });
      }

      nodes.push({
        id: "derived-from",
        type: typeResult.data,
        schemaPath: "multiple", // Can be in multiple properties
        isPresent: true,
      });
    }

    // Check for x-flatten-arrays (via schema analysis)
    const flattenArraysPresent = this.hasFlattenArraysDirectives(schema);
    if (flattenArraysPresent) {
      const typeResult = DirectiveType.create("flatten-arrays");
      if (!typeResult.ok) {
        return err({
          kind: "ProcessingFailed",
          directive: "flatten-arrays",
          error: typeResult.error,
          message: "Failed to create flatten-arrays directive type",
        });
      }

      nodes.push({
        id: "flatten-arrays",
        type: typeResult.data,
        schemaPath: "multiple", // Can be in multiple properties
        isPresent: true,
      });
    }

    // Check for x-jmespath-filter (via schema analysis)
    const jmespathFilterPresent = this.hasJMESPathFilterDirectives(schema);
    if (jmespathFilterPresent) {
      const typeResult = DirectiveType.create("jmespath-filter");
      if (!typeResult.ok) {
        return err({
          kind: "ProcessingFailed",
          directive: "jmespath-filter",
          error: typeResult.error,
          message: "Failed to create jmespath-filter directive type",
        });
      }

      nodes.push({
        id: "jmespath-filter",
        type: typeResult.data,
        schemaPath: "multiple", // Can be in multiple properties
        isPresent: true,
      });
    }

    // Additional directive types will be detected as new features are implemented:
    // - x-derived-unique (validation directives)
    // - x-template, x-template-items, x-template-format (template directives)

    return ok(nodes);
  }

  /**
   * Build complete dependency graph including missing dependencies
   */
  private buildDependencyGraph(
    presentDirectives: readonly DirectiveNode[],
  ): Result<readonly DirectiveNode[], DirectiveProcessingError> {
    const allNodes = new Map<string, DirectiveNode>();

    // Add all present directives
    for (const directive of presentDirectives) {
      allNodes.set(directive.id, directive);
    }

    // Add missing dependencies as placeholder nodes
    for (const directive of presentDirectives) {
      for (const depKind of directive.type.getDependencies()) {
        if (!allNodes.has(depKind)) {
          const typeResult = DirectiveType.create(depKind);
          if (!typeResult.ok) {
            return err({
              kind: "ProcessingFailed",
              directive: depKind,
              error: typeResult.error,
              message: `Failed to create dependency directive type: ${depKind}`,
            });
          }

          // Add as missing dependency placeholder
          allNodes.set(depKind, {
            id: depKind,
            type: typeResult.data,
            schemaPath: "not-present",
            isPresent: false,
          });
        }
      }
    }

    return ok(Array.from(allNodes.values()));
  }

  /**
   * Perform topological sort on dependency graph
   * Returns directives in dependency-safe execution order
   */
  private topologicalSort(
    nodes: readonly DirectiveNode[],
  ): Result<readonly DirectiveNode[], DirectiveProcessingError> {
    // Kahn's algorithm for topological sorting
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, DirectiveNode[]>();
    const nodeMap = new Map<string, DirectiveNode>();

    // Initialize
    for (const node of nodes) {
      nodeMap.set(node.id, node);
      inDegree.set(node.id, 0);
      adjacencyList.set(node.id, []);
    }

    // Build adjacency list and calculate in-degrees
    for (const node of nodes) {
      for (const depKind of node.type.getDependencies()) {
        const depNode = nodeMap.get(depKind);
        if (depNode) {
          adjacencyList.get(depKind)?.push(node);
          inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
        }
      }
    }

    // Process nodes with no incoming edges
    const queue: DirectiveNode[] = [];
    const result: DirectiveNode[] = [];

    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        const node = nodeMap.get(nodeId);
        if (node) {
          queue.push(node);
        }
      }
    }

    // Process queue
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      // Process neighbors
      const neighbors = adjacencyList.get(current.id) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor.id) || 0) - 1;
        inDegree.set(neighbor.id, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check for circular dependencies
    if (result.length !== nodes.length) {
      const remainingNodes = nodes.filter((node) =>
        !result.some((r) => r.id === node.id)
      );
      const cycle = remainingNodes.map((n) => n.id);

      return err({
        kind: "CircularDependency",
        cycle,
        message: `Circular dependency detected: ${cycle.join(" -> ")}`,
      });
    }

    return ok(result);
  }

  /**
   * Group sorted directives into processing phases
   */
  private groupIntoPhases(
    sortedNodes: readonly DirectiveNode[],
  ): readonly DirectivePhase[] {
    const phases: DirectivePhase[] = [];
    const priorityGroups = new Map<number, DirectiveNode[]>();

    // Group by processing priority
    for (const node of sortedNodes) {
      const priority = node.type.getProcessingPriority();
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, []);
      }
      priorityGroups.get(priority)!.push(node);
    }

    // Create phases from priority groups
    const sortedPriorities = Array.from(priorityGroups.keys()).sort((a, b) =>
      a - b
    );

    for (let i = 0; i < sortedPriorities.length; i++) {
      const priority = sortedPriorities[i];
      const nodes = priorityGroups.get(priority) || [];

      phases.push({
        phaseNumber: i + 1,
        description: this.getPhaseDescription(priority),
        directives: nodes,
      });
    }

    return phases;
  }

  /**
   * Process individual directive
   */
  private processDirective(
    data: FrontmatterData,
    _schema: Schema,
    directiveNode: DirectiveNode,
  ): Result<FrontmatterData, DirectiveProcessingError> {
    const kind = directiveNode.type.getKind();

    switch (kind) {
      case "frontmatter-part":
        // FEATURE: frontmatter-part processing not yet implemented
        // Will handle frontmatter section directives when feature is developed
        return ok(data);

      case "derived-from":
        // FEATURE: derived-from processing not yet implemented
        // Will handle derived data directives when feature is developed
        return ok(data);

      case "flatten-arrays":
        return this.processFlattenArraysDirective(data, _schema, directiveNode);

      case "jmespath-filter":
        return this.processJMESPathFilterDirective(
          data,
          _schema,
          directiveNode,
        );

      default: {
        // ErrorHandler methods always return error Results
        const configErrorResult = ErrorHandler.system({
          operation: "processDirective",
          method: "switchKind",
        }).configurationError(`Directive processing not implemented: ${kind}`);

        // ErrorHandler always returns Err results, handle it type-safely
        if (!configErrorResult.ok) {
          return err({
            kind: "ProcessingFailed",
            directive: kind,
            error: configErrorResult.error,
            message: `Directive processing not implemented: ${kind}`,
          });
        } else {
          // This should never happen as ErrorHandler always returns errors
          return err({
            kind: "ProcessingFailed",
            directive: kind,
            error: {
              kind: "ConfigurationError",
              message: "Unexpected success from ErrorHandler",
            },
            message: `Directive processing not implemented: ${kind}`,
          });
        }
      }
    }
  }

  /**
   * Get phase description based on priority
   */
  private getPhaseDescription(priority: number): string {
    switch (priority) {
      case 1:
        return "Data Structure Foundation";
      case 2:
        return "Data Extraction";
      case 3:
        return "Array Flattening";
      case 4:
        return "JMESPath Filtering";
      case 5:
        return "Array Merging";
      case 6:
        return "Field Derivation";
      case 7:
        return "Uniqueness Processing";
      case 8:
        return "Template Processing";
      case 9:
        return "Items Template Processing";
      case 10:
        return "Format Processing";
      default:
        return `Processing Priority ${priority}`;
    }
  }

  /**
   * Check if schema has derivation directives (x-derived-from, x-derived-unique)
   */
  private hasDerivationDirectives(schema: Schema): boolean {
    // This is a simplified check - in a real implementation,
    // we would traverse the schema to look for x-derived-from properties
    // For now, return true if schema has any properties (indicating potential derivation)
    try {
      const schemaDefinition = schema.getDefinition();
      const schemaData = schemaDefinition.getRawSchema();
      return schemaData.kind === "object" &&
        Object.keys(schemaData.properties).length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if schema has x-flatten-arrays directives
   */
  private hasFlattenArraysDirectives(schema: Schema): boolean {
    try {
      const schemaDefinition = schema.getDefinition();
      const schemaData = schemaDefinition.getRawSchema();
      return this.searchForFlattenArraysInObject(schemaData);
    } catch {
      return false;
    }
  }

  /**
   * Recursively search for x-flatten-arrays directive in schema object
   */
  private searchForFlattenArraysInObject(obj: unknown): boolean {
    if (!isRecord(obj)) return false;

    // Check in extensions object (for migrated schema)
    if (isRecordWithProperty(obj, "extensions") && isRecord(obj.extensions)) {
      if (obj.extensions["x-flatten-arrays"]) {
        return true;
      }
    }

    // Check for direct property (standard JSON Schema extension pattern)
    if (obj["x-flatten-arrays"]) {
      return true;
    }

    // Recursively check properties
    if (isRecordWithProperty(obj, "properties") && isRecord(obj.properties)) {
      for (const value of Object.values(obj.properties)) {
        if (this.searchForFlattenArraysInObject(value)) {
          return true;
        }
      }
    }

    // Recursively check items
    if (isRecordWithProperty(obj, "items") && isRecord(obj.items)) {
      if (this.searchForFlattenArraysInObject(obj.items)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Process x-flatten-arrays directive
   */
  private processFlattenArraysDirective(
    data: FrontmatterData,
    schema: Schema,
    _directiveNode: DirectiveNode,
  ): Result<FrontmatterData, DirectiveProcessingError> {
    try {
      const schemaDefinition = schema.getDefinition();
      const schemaData = schemaDefinition.getRawSchema();

      // Process the data by flattening arrays according to schema directives
      const processedData = this.applyFlattenArraysToData(
        data.getData(),
        schemaData,
        "root",
      );

      // Create new FrontmatterData with processed data
      const newDataResult = FrontmatterDataFactory.fromParsedData(
        processedData,
      );
      if (!newDataResult.ok) {
        return err({
          kind: "ProcessingFailed",
          directive: "flatten-arrays",
          error: newDataResult.error,
          message: "Failed to create FrontmatterData after flattening arrays",
        });
      }

      return ok(newDataResult.data);
    } catch (error) {
      return err({
        kind: "ProcessingFailed",
        directive: "flatten-arrays",
        error: {
          kind: "InvalidSchema",
          message: error instanceof Error ? error.message : String(error),
        },
        message: `Failed to process flatten-arrays directive: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  /**
   * Apply array flattening to data according to schema directives
   */
  private applyFlattenArraysToData(
    data: unknown,
    schemaObj: unknown,
    _currentPath: string,
  ): unknown {
    if (!data || !schemaObj || typeof schemaObj !== "object") {
      return data;
    }

    let result = data;

    // First, collect all flatten-arrays directives from the entire schema
    const flattenDirectives = this.collectFlattenDirectives(schemaObj);

    // Apply all flatten directives to the root data
    if (
      flattenDirectives.length > 0 && typeof result === "object" &&
      result !== null
    ) {
      let dataRecord = result as Record<string, unknown>;

      for (const directive of flattenDirectives) {
        const targetValue = this.getNestedProperty(
          dataRecord,
          directive.target,
        );
        if (Array.isArray(targetValue)) {
          const flattenedValue = this.flattenArray(targetValue);
          dataRecord = this.setNestedProperty(
            dataRecord,
            directive.target,
            flattenedValue,
          );
        }
      }

      result = dataRecord;
    }

    return result;
  }

  /**
   * Collect all x-flatten-arrays directives from the schema
   */
  private collectFlattenDirectives(
    schemaObj: unknown,
  ): Array<{ target: string }> {
    const directives: Array<{ target: string }> = [];

    if (!isRecord(schemaObj)) {
      return directives;
    }

    // Check in extensions object (for migrated schema)
    if (
      isRecordWithProperty(schemaObj, "extensions") &&
      isRecord(schemaObj.extensions)
    ) {
      if (
        isRecordWithStringProperty(schemaObj.extensions, "x-flatten-arrays")
      ) {
        const target = schemaObj.extensions["x-flatten-arrays"];
        directives.push({ target });
      }
    }

    // Check for direct property (standard JSON Schema extension pattern)
    // Only add if not already added from extensions
    if (isRecordWithStringProperty(schemaObj, "x-flatten-arrays")) {
      const target = schemaObj["x-flatten-arrays"];
      // Check if not already added
      if (!directives.some((d) => d.target === target)) {
        directives.push({ target });
      }
    }

    // Recursively check properties
    if (
      isRecordWithProperty(schemaObj, "properties") &&
      isRecord(schemaObj.properties)
    ) {
      for (const propSchema of Object.values(schemaObj.properties)) {
        directives.push(...this.collectFlattenDirectives(propSchema));
      }
    }

    // Recursively check items
    if (isRecordWithProperty(schemaObj, "items") && isRecord(schemaObj.items)) {
      directives.push(...this.collectFlattenDirectives(schemaObj.items));
    }

    return directives;
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
   * Get nested property value from object using dot notation
   */
  private getNestedProperty(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
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
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): Record<string, unknown> {
    const segments = path.split(".");
    const result = { ...obj };
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
   * Check if schema has x-jmespath-filter directives
   */
  private hasJMESPathFilterDirectives(schema: Schema): boolean {
    try {
      const schemaDefinition = schema.getDefinition();
      const schemaData = schemaDefinition.getRawSchema();
      return this.searchForJMESPathFilterInObject(schemaData);
    } catch {
      return false;
    }
  }

  /**
   * Recursively search for x-jmespath-filter directive in schema object
   */
  private searchForJMESPathFilterInObject(obj: unknown): boolean {
    if (!obj || typeof obj !== "object") return false;

    const record = obj as Record<string, unknown>;

    // Check in extensions object (for migrated schema)
    if (record.extensions && typeof record.extensions === "object") {
      const extensions = record.extensions as Record<string, unknown>;
      if (extensions["x-jmespath-filter"]) {
        return true;
      }
    }

    // Check for direct property (standard JSON Schema extension pattern)
    if (record["x-jmespath-filter"]) {
      return true;
    }

    // Recursively check properties
    if (record.properties && typeof record.properties === "object") {
      const properties = record.properties as Record<string, unknown>;
      for (const value of Object.values(properties)) {
        if (this.searchForJMESPathFilterInObject(value)) {
          return true;
        }
      }
    }

    // Check items if array
    if (record.items) {
      if (this.searchForJMESPathFilterInObject(record.items)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Process x-jmespath-filter directive
   */
  private processJMESPathFilterDirective(
    data: FrontmatterData,
    schema: Schema,
    _directiveNode: DirectiveNode,
  ): Result<FrontmatterData, DirectiveProcessingError> {
    try {
      // Create service instance
      const serviceResult = JMESPathFilterService.create();
      if (!serviceResult.ok) {
        return err({
          kind: "ProcessingFailed",
          directive: "jmespath-filter",
          error: serviceResult.error,
          message: "Failed to create JMESPath filter service",
        });
      }

      const service = serviceResult.data;

      const schemaDefinition = schema.getDefinition();
      const schemaData = schemaDefinition.getRawSchema();

      // Process the data by applying JMESPath filters according to schema directives
      const processedData = this.applyJMESPathFiltersToData(
        data,
        schemaData,
        service,
      );

      // Create new FrontmatterData with processed data
      const newDataResult = FrontmatterDataFactory.fromParsedData(
        processedData,
      );

      if (!newDataResult.ok) {
        return err({
          kind: "ProcessingFailed",
          directive: "jmespath-filter",
          error: newDataResult.error,
          message: "Failed to create FrontmatterData after JMESPath filtering",
        });
      }

      return ok(newDataResult.data);
    } catch (error) {
      // Safe error handling following totality principles
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      const domainError: DomainError =
        error instanceof Error && "kind" in error &&
          typeof error.kind === "string"
          ? error as DomainError
          : { kind: "ConfigurationError", message: errorMessage };

      return err({
        kind: "ProcessingFailed",
        directive: "jmespath-filter",
        error: domainError,
        message: `Error processing JMESPath filter directive: ${errorMessage}`,
      });
    }
  }

  /**
   * Apply JMESPath filters to data based on schema directives
   */
  private applyJMESPathFiltersToData(
    data: FrontmatterData,
    schemaData: unknown,
    service: JMESPathFilterService,
  ): unknown {
    const currentData = data.getData();
    const result = { ...currentData };

    // Find and apply JMESPath filters
    const filters = this.collectJMESPathFilters(schemaData);

    filters.forEach(({ path, expression }) => {
      // Apply the filter to the nested traceability array
      // The data structure is nested: { "traceability": [{ "traceability": [...] }] }
      const fullExpression = `${path}[].traceability${expression}`;

      const filterResult = service.applyFilter(data, fullExpression);

      if (
        filterResult.ok &&
        filterResult.data !== null &&
        filterResult.data !== undefined
      ) {
        // Flatten the nested array result from JMESPath
        let flattenedData = filterResult.data;

        if (
          Array.isArray(flattenedData) && flattenedData.length > 0 &&
          Array.isArray(flattenedData[0])
        ) {
          // Flatten nested arrays and filter out empty arrays
          flattenedData = flattenedData
            .flat()
            .filter((item) =>
              item !== null && item !== undefined &&
              !(Array.isArray(item) && item.length === 0) &&
              (typeof item === "object" && Object.keys(item).length > 0)
            );
        }

        // Update the result with flattened data
        this.setNestedProperty(result, path, flattenedData);
      }
    });

    return result;
  }

  /**
   * Collect all JMESPath filter directives from schema
   */
  private collectJMESPathFilters(
    schemaData: unknown,
    currentPath: string = "",
  ): Array<{ path: string; expression: string }> {
    const filters: Array<{ path: string; expression: string }> = [];

    if (!schemaData || typeof schemaData !== "object") {
      return filters;
    }

    const record = schemaData as Record<string, unknown>;

    // Check for x-jmespath-filter in current level
    let filterExpression: string | undefined;

    if (record.extensions && typeof record.extensions === "object") {
      const extensions = record.extensions as Record<string, unknown>;
      if (typeof extensions["x-jmespath-filter"] === "string") {
        filterExpression = extensions["x-jmespath-filter"];
      }
    }

    if (!filterExpression && typeof record["x-jmespath-filter"] === "string") {
      filterExpression = record["x-jmespath-filter"];
    }

    if (filterExpression && currentPath) {
      filters.push({ path: currentPath, expression: filterExpression });
    }

    // Recursively check properties
    if (record.properties && typeof record.properties === "object") {
      const properties = record.properties as Record<string, unknown>;
      for (const [key, value] of Object.entries(properties)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        filters.push(...this.collectJMESPathFilters(value, newPath));
      }
    }

    return filters;
  }
}
