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

      default: {
        // ErrorHandler methods always return error Results
        const configErrorResult = ErrorHandler.system({
          operation: "processDirective",
          method: "switchKind",
        }).configurationError(`Directive processing not implemented: ${kind}`);

        // Since ErrorHandler always returns errors, we can safely assert this is an Err
        return err({
          kind: "ProcessingFailed",
          directive: kind,
          error: (configErrorResult as any).error, // ErrorHandler always returns Err results
          message: `Directive processing not implemented: ${kind}`,
        });
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
        return "Array Merging";
      case 4:
        return "Field Derivation";
      case 5:
        return "Uniqueness Processing";
      case 6:
        return "Template Processing";
      case 7:
        return "Items Template Processing";
      case 8:
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
}
