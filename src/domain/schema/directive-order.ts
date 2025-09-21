/**
 * @fileoverview Directive Processing Order Control System - Issue #900
 * @description Manages the execution order of x-* directives based on dependencies
 */

import { err, ok, Result } from "../shared/types/result.ts";
import { createError, DomainError } from "../shared/types/errors.ts";

/**
 * Represents the different types of schema directives and their processing characteristics
 */
export type DirectiveType =
  | "x-frontmatter-part" // Stage 1: Identify target arrays
  | "x-extract-from" // Stage 2: Extract values (normalize with [] notation)
  | "x-jmespath-filter" // Stage 3: Apply filtering
  | "x-merge-arrays" // Stage 4: Array merging
  | "x-derived-from" // Stage 5: Value aggregation
  | "x-derived-unique" // Stage 6: Duplicate removal
  | "x-template" // Stage 7: Template application
  | "x-template-items"; // Stage 7: Item template application

/**
 * Directive dependency relationship
 */
export interface DirectiveDependency {
  readonly directive: DirectiveType;
  readonly dependsOn: readonly DirectiveType[];
  readonly stage: number;
  readonly description: string;
}

/**
 * Processing order determination result
 */
export interface ProcessingOrder {
  readonly orderedDirectives: readonly DirectiveType[];
  readonly stages: readonly {
    readonly stage: number;
    readonly directives: readonly DirectiveType[];
    readonly description: string;
  }[];
  readonly dependencyGraph: Record<DirectiveType, readonly DirectiveType[]>;
}

/**
 * Circular dependency detection result
 */
export interface CircularDependencyError {
  readonly kind: "CircularDependency";
  readonly cycle: readonly DirectiveType[];
  readonly message: string;
}

/**
 * Smart Constructor for directive order management following Totality principles
 */
export class DirectiveOrderManager {
  private readonly dependencies: readonly DirectiveDependency[];

  private constructor(dependencies: readonly DirectiveDependency[]) {
    this.dependencies = dependencies;
  }

  /**
   * Create DirectiveOrderManager with predefined dependency rules
   */
  static create(): Result<
    DirectiveOrderManager,
    DomainError & { message: string }
  > {
    const dependencies: DirectiveDependency[] = [
      {
        directive: "x-frontmatter-part",
        dependsOn: [],
        stage: 1,
        description: "Identify target arrays for processing",
      },
      {
        directive: "x-extract-from",
        dependsOn: ["x-frontmatter-part"],
        stage: 2,
        description: "Extract values using normalized [] notation",
      },
      {
        directive: "x-jmespath-filter",
        dependsOn: ["x-extract-from"],
        stage: 3,
        description: "Apply JMESPath filtering to extracted data",
      },
      {
        directive: "x-merge-arrays",
        dependsOn: ["x-jmespath-filter", "x-extract-from"],
        stage: 4,
        description: "Merge multiple arrays into unified structure",
      },
      {
        directive: "x-derived-from",
        dependsOn: ["x-merge-arrays", "x-extract-from"],
        stage: 5,
        description: "Aggregate values from multiple sources",
      },
      {
        directive: "x-derived-unique",
        dependsOn: ["x-derived-from"],
        stage: 6,
        description: "Remove duplicate values from aggregated data",
      },
      {
        directive: "x-template",
        dependsOn: ["x-derived-unique", "x-derived-from"],
        stage: 7,
        description: "Apply main template to processed data",
      },
      {
        directive: "x-template-items",
        dependsOn: ["x-derived-unique", "x-derived-from"],
        stage: 7,
        description: "Apply item template to individual elements",
      },
    ];

    return ok(new DirectiveOrderManager(dependencies));
  }

  /**
   * Determine the correct processing order for given directives
   */
  determineProcessingOrder(
    presentDirectives: readonly DirectiveType[],
  ): Result<ProcessingOrder, DomainError & { message: string }> {
    // Check for circular dependencies
    const circularCheck = this.detectCircularDependencies(presentDirectives);
    if (!circularCheck.ok) {
      return err(circularCheck.error);
    }

    // Filter dependencies to only include present directives
    const relevantDependencies = this.dependencies.filter((dep) =>
      presentDirectives.includes(dep.directive)
    );

    // Perform topological sort
    const sortResult = this.topologicalSort(relevantDependencies);
    if (!sortResult.ok) {
      return err(sortResult.error);
    }

    // Group by stages
    const stages = this.groupByStages(relevantDependencies, sortResult.data);

    // Create dependency graph
    const dependencyGraph = this.createDependencyGraph(relevantDependencies);

    return ok({
      orderedDirectives: sortResult.data,
      stages,
      dependencyGraph,
    });
  }

  /**
   * Detect circular dependencies in the directive graph
   */
  private detectCircularDependencies(
    directives: readonly DirectiveType[],
  ): Result<void, DomainError & { message: string }> {
    const visited = new Set<DirectiveType>();
    const recursionStack = new Set<DirectiveType>();

    for (const directive of directives) {
      if (!visited.has(directive)) {
        const result = this.dfsCheckCycle(
          directive,
          visited,
          recursionStack,
          directives,
        );
        if (!result.ok) {
          return err(result.error);
        }
      }
    }

    return ok(undefined);
  }

  /**
   * Depth-first search for cycle detection
   */
  private dfsCheckCycle(
    current: DirectiveType,
    visited: Set<DirectiveType>,
    recursionStack: Set<DirectiveType>,
    allDirectives: readonly DirectiveType[],
  ): Result<void, DomainError & { message: string }> {
    visited.add(current);
    recursionStack.add(current);

    const currentDep = this.dependencies.find((d) => d.directive === current);
    if (!currentDep) {
      return ok(undefined);
    }

    for (const dependency of currentDep.dependsOn) {
      if (!allDirectives.includes(dependency)) {
        continue; // Skip dependencies not present in current schema
      }

      if (!visited.has(dependency)) {
        const result = this.dfsCheckCycle(
          dependency,
          visited,
          recursionStack,
          allDirectives,
        );
        if (!result.ok) {
          return err(result.error);
        }
      } else if (recursionStack.has(dependency)) {
        // Circular dependency detected
        const cycle = Array.from(recursionStack).concat([dependency]);
        return err(createError({
          kind: "InvalidFormat",
          format: "directive-dependency-graph",
          value: cycle.join(" → "),
          field: "directive-processing-order",
        }));
      }
    }

    recursionStack.delete(current);
    return ok(undefined);
  }

  /**
   * Perform topological sort to determine processing order
   */
  private topologicalSort(
    dependencies: readonly DirectiveDependency[],
  ): Result<readonly DirectiveType[], DomainError & { message: string }> {
    const result: DirectiveType[] = [];
    const visited = new Set<DirectiveType>();
    const tempMarked = new Set<DirectiveType>();

    // Create a set of directives we're actually processing
    const presentDirectives = new Set(dependencies.map((d) => d.directive));

    const visit = (
      directive: DirectiveType,
    ): Result<void, DomainError & { message: string }> => {
      if (tempMarked.has(directive)) {
        return err(createError({
          kind: "InvalidFormat",
          format: "directive-dependency-graph",
          value: directive,
          field: "directive-topological-sort",
        }));
      }

      if (visited.has(directive)) {
        return ok(undefined);
      }

      tempMarked.add(directive);

      const dep = dependencies.find((d) => d.directive === directive);
      if (dep) {
        for (const dependency of dep.dependsOn) {
          // Only visit dependencies that are actually present in our directive list
          if (presentDirectives.has(dependency)) {
            const depResult = visit(dependency);
            if (!depResult.ok) {
              return err(depResult.error);
            }
          }
        }
      }

      tempMarked.delete(directive);
      visited.add(directive);
      result.push(directive); // Add to end for correct topological order

      return ok(undefined);
    };

    for (const dep of dependencies) {
      if (!visited.has(dep.directive)) {
        const visitResult = visit(dep.directive);
        if (!visitResult.ok) {
          return err(visitResult.error);
        }
      }
    }

    return ok(result);
  }

  /**
   * Group directives by processing stages
   */
  private groupByStages(
    dependencies: readonly DirectiveDependency[],
    orderedDirectives: readonly DirectiveType[],
  ) {
    const stageMap = new Map<number, DirectiveType[]>();

    for (const directive of orderedDirectives) {
      const dep = dependencies.find((d) => d.directive === directive);
      if (dep) {
        if (!stageMap.has(dep.stage)) {
          stageMap.set(dep.stage, []);
        }
        stageMap.get(dep.stage)!.push(directive);
      }
    }

    const stages = Array.from(stageMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([stage, directives]) => {
        const firstDep = dependencies.find((d) =>
          d.directive === directives[0]
        );
        return {
          stage,
          directives: directives as readonly DirectiveType[],
          description: firstDep?.description || `Stage ${stage} processing`,
        };
      });

    return stages;
  }

  /**
   * Create dependency graph representation
   */
  private createDependencyGraph(
    dependencies: readonly DirectiveDependency[],
  ): Record<DirectiveType, readonly DirectiveType[]> {
    const graph: Record<string, readonly DirectiveType[]> = {};

    for (const dep of dependencies) {
      graph[dep.directive] = dep.dependsOn;
    }

    return graph as Record<DirectiveType, readonly DirectiveType[]>;
  }

  /**
   * Get all supported directive types
   */
  getSupportedDirectives(): readonly DirectiveType[] {
    return this.dependencies.map((d) => d.directive);
  }

  /**
   * Get dependency information for a specific directive
   */
  getDirectiveDependencies(
    directive: DirectiveType,
  ): Result<DirectiveDependency, DomainError & { message: string }> {
    const dependency = this.dependencies.find((d) => d.directive === directive);

    if (!dependency) {
      return err(createError({
        kind: "InvalidFormat",
        format: "supported-directive",
        value: directive,
        field: "directive-type",
      }));
    }

    return ok(dependency);
  }
}
