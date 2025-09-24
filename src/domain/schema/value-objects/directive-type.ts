/**
 * @fileoverview Directive Type Value Object
 * @description Represents the different types of schema directives for processing order resolution
 * Following DDD and Totality principles
 */

import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";

/**
 * Directive Type Discriminated Union
 * Following Totality principle - exhaustive enumeration of all directive types
 */
export type DirectiveTypeKind =
  | "frontmatter-part"
  | "extract-from"
  | "flatten-arrays"
  | "jmespath-filter"
  | "merge-arrays"
  | "derived-from"
  | "derived-unique"
  | "template"
  | "template-items"
  | "template-format";

/**
 * Directive Type Value Object
 * Immutable representation of schema directive types with dependency information
 */
export class DirectiveType {
  private readonly kind: DirectiveTypeKind;
  private readonly dependencies: readonly DirectiveTypeKind[];
  private readonly processingPriority: number;

  private constructor(
    kind: DirectiveTypeKind,
    dependencies: readonly DirectiveTypeKind[],
    processingPriority: number,
  ) {
    this.kind = kind;
    this.dependencies = dependencies;
    this.processingPriority = processingPriority;
  }

  /**
   * Smart Constructor for DirectiveType
   * Following Totality principles by returning Result<T,E>
   */
  static create(
    kind: DirectiveTypeKind,
  ): Result<DirectiveType, DomainError & { message: string }> {
    const dependencyMap = this.getDependencyMap();
    const dependencies = dependencyMap.get(kind);
    const priorityMap = this.getPriorityMap();
    const priority = priorityMap.get(kind);

    if (dependencies === undefined || priority === undefined) {
      return ErrorHandler.system({
        operation: "create",
        method: "validateDirectiveType",
      }).configurationError(`Unknown directive type: ${kind}`);
    }

    return ok(new DirectiveType(kind, dependencies, priority));
  }

  /**
   * Create all directive types for dependency resolution
   */
  static createAll(): Result<
    readonly DirectiveType[],
    DomainError & { message: string }
  > {
    const allKinds: DirectiveTypeKind[] = [
      "frontmatter-part",
      "extract-from",
      "flatten-arrays",
      "jmespath-filter",
      "merge-arrays",
      "derived-from",
      "derived-unique",
      "template",
      "template-items",
      "template-format",
    ];

    const results: DirectiveType[] = [];
    for (const kind of allKinds) {
      const result = this.create(kind);
      if (!result.ok) {
        return result;
      }
      results.push(result.data);
    }

    return ok(results);
  }

  // Getters
  getKind(): DirectiveTypeKind {
    return this.kind;
  }

  getDependencies(): readonly DirectiveTypeKind[] {
    return [...this.dependencies];
  }

  getProcessingPriority(): number {
    return this.processingPriority;
  }

  /**
   * Check if this directive depends on another
   */
  dependsOn(other: DirectiveType): boolean {
    return this.dependencies.includes(other.getKind());
  }

  /**
   * Get dependency map for all directive types
   * Defines the logical processing dependencies between directives
   */
  private static getDependencyMap(): Map<
    DirectiveTypeKind,
    readonly DirectiveTypeKind[]
  > {
    return new Map([
      ["frontmatter-part", []], // No dependencies - foundation
      ["extract-from", ["frontmatter-part"]], // Needs data structure
      ["jmespath-filter", ["extract-from"]], // Needs extracted data to filter
      ["flatten-arrays", ["jmespath-filter"]], // Needs filtered data to flatten nested arrays
      ["merge-arrays", ["flatten-arrays"]], // Needs flattened arrays
      ["derived-from", ["merge-arrays"]], // Needs final data structure
      ["derived-unique", ["derived-from"]], // Needs derived fields
      ["template", ["derived-unique"]], // Needs all processing complete
      ["template-items", ["template"]], // Needs main template
      ["template-format", ["template-items"]], // Needs items template
    ]);
  }

  /**
   * Get processing priority map
   * Lower numbers = higher priority (process first)
   */
  private static getPriorityMap(): Map<DirectiveTypeKind, number> {
    return new Map([
      ["frontmatter-part", 1],
      ["extract-from", 2],
      ["jmespath-filter", 3],
      ["flatten-arrays", 4],
      ["merge-arrays", 5],
      ["derived-from", 6],
      ["derived-unique", 7],
      ["template", 8],
      ["template-items", 9],
      ["template-format", 10],
    ]);
  }

  /**
   * Value equality comparison
   */
  equals(other: DirectiveType): boolean {
    return this.kind === other.kind;
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `DirectiveType(${this.kind}, priority=${this.processingPriority}, deps=[${
      this.dependencies.join(", ")
    }])`;
  }
}
