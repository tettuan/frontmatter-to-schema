import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import {
  DEFAULT_DIRECTIVE_ORDER,
  DIRECTIVE_NAMES,
  DirectiveName,
} from "../constants/directive-names.ts";

export type DirectiveType = DirectiveName;

/**
 * Defines the processing order for directives based on requirements.
 * Ensures proper dependency resolution and correct processing sequence.
 */
export class DirectiveOrderingStrategy {
  private constructor(private readonly order: DirectiveType[]) {}

  /**
   * Creates the default directive ordering strategy based on requirements.
   * Processing order:
   * 1. x-frontmatter-part - Extract data from frontmatter first
   * 2. x-flatten-arrays - Normalize array structures
   * 3. x-derived-from - Derive values from other fields
   * 4. x-derived-unique - Apply uniqueness constraints
   * 5. x-jmespath-filter - Filter derived data
   * 6. x-template-* - Template processing directives
   */
  static createDefault(): DirectiveOrderingStrategy {
    return new DirectiveOrderingStrategy(DEFAULT_DIRECTIVE_ORDER);
  }

  /**
   * Creates a custom directive ordering strategy.
   * Validates that all required directives are included exactly once.
   */
  static createCustom(
    order: DirectiveType[],
  ): Result<DirectiveOrderingStrategy, SchemaError> {
    const defaultOrder = DirectiveOrderingStrategy.createDefault().order;

    // Check all directives are included
    const missingDirectives = defaultOrder.filter((d) => !order.includes(d));
    if (missingDirectives.length > 0) {
      return Result.error(
        new SchemaError(
          `Missing directives in custom order: ${missingDirectives.join(", ")}`,
          "MISSING_DIRECTIVES",
          { missing: missingDirectives, provided: order },
        ),
      );
    }

    // Check no extra directives
    const extraDirectives = order.filter((d) => !defaultOrder.includes(d));
    if (extraDirectives.length > 0) {
      return Result.error(
        new SchemaError(
          `Unknown directives in custom order: ${extraDirectives.join(", ")}`,
          "UNKNOWN_DIRECTIVES",
          { unknown: extraDirectives, expected: defaultOrder },
        ),
      );
    }

    // Check no duplicates
    const uniqueDirectives = [...new Set(order)];
    if (uniqueDirectives.length !== order.length) {
      return Result.error(
        new SchemaError(
          "Duplicate directives found in custom order",
          "DUPLICATE_DIRECTIVES",
          { order },
        ),
      );
    }

    return Result.ok(new DirectiveOrderingStrategy(order));
  }

  /**
   * Returns the ordered list of directive types.
   */
  getOrderedDirectives(): DirectiveType[] {
    return [...this.order];
  }

  /**
   * Gets the processing priority of a directive (lower number = higher priority).
   */
  getPriority(directive: DirectiveType): number {
    const index = this.order.indexOf(directive);
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
  }

  /**
   * Sorts directive types according to this strategy.
   */
  sort(directives: DirectiveType[]): DirectiveType[] {
    return directives.sort((a, b) => this.getPriority(a) - this.getPriority(b));
  }

  /**
   * Validates if a directive should be processed before another.
   */
  shouldProcessBefore(first: DirectiveType, second: DirectiveType): boolean {
    return this.getPriority(first) < this.getPriority(second);
  }

  /**
   * Returns all supported directive types.
   */
  getSupportedDirectives(): DirectiveType[] {
    return this.getOrderedDirectives();
  }

  /**
   * Creates a strategy optimized for frontmatter-first processing.
   */
  static createFrontmatterFirst(): DirectiveOrderingStrategy {
    return new DirectiveOrderingStrategy([
      DIRECTIVE_NAMES.FRONTMATTER_PART,
      DIRECTIVE_NAMES.COLLECT_PATTERN,
      DIRECTIVE_NAMES.FLATTEN_ARRAYS,
      DIRECTIVE_NAMES.DERIVED_FROM,
      DIRECTIVE_NAMES.DERIVED_UNIQUE,
      DIRECTIVE_NAMES.JMESPATH_FILTER,
      DIRECTIVE_NAMES.TEMPLATE_FORMAT,
      DIRECTIVE_NAMES.TEMPLATE_ITEMS,
      DIRECTIVE_NAMES.TEMPLATE,
    ]);
  }

  /**
   * Creates a strategy optimized for template-first processing.
   */
  static createTemplateFirst(): DirectiveOrderingStrategy {
    return new DirectiveOrderingStrategy([
      DIRECTIVE_NAMES.TEMPLATE_FORMAT,
      DIRECTIVE_NAMES.TEMPLATE_ITEMS,
      DIRECTIVE_NAMES.TEMPLATE,
      DIRECTIVE_NAMES.FRONTMATTER_PART,
      DIRECTIVE_NAMES.COLLECT_PATTERN,
      DIRECTIVE_NAMES.FLATTEN_ARRAYS,
      DIRECTIVE_NAMES.DERIVED_FROM,
      DIRECTIVE_NAMES.DERIVED_UNIQUE,
      DIRECTIVE_NAMES.JMESPATH_FILTER,
    ]);
  }
}
