/**
 * Template and Processing Value Objects implementing Domain-Driven Design patterns
 *
 * These value objects follow the Totality principle:
 * - Smart constructors ensure only valid instances can be created
 * - All functions are total (no exceptions, use Result types)
 * - Immutable after creation
 * - Self-validating with business rules embedded
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { DEFAULT_PROCESSING_LIMIT } from "../shared/constants.ts";

/**
 * Represents a template format configuration
 *
 * Business Rules:
 * - Format must be one of the supported types
 * - Template content must not be empty
 * - Immutable after creation
 *
 * @example
 * const result = TemplateFormat.create("json", '{"title": "{{title}}"}');
 * if (result.ok) {
 *   console.log(result.data.getFormat()); // "json"
 *   console.log(result.data.getTemplate()); // '{"title": "{{title}}"}'
 * }
 */
export class TemplateFormat {
  private constructor(
    private readonly format: "json" | "yaml" | "toml" | "handlebars" | "custom",
    private readonly template: string,
  ) {}

  /**
   * Creates a validated TemplateFormat instance
   *
   * @param format - Template format type
   * @param template - Template content string
   * @returns Result containing either a valid TemplateFormat or validation error
   */
  static create(
    format: string,
    template: string,
  ): Result<TemplateFormat, DomainError & { message: string }> {
    if (!template || template.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Input cannot be empty"),
      };
    }

    if (
      format !== "json" && format !== "yaml" && format !== "toml" &&
      format !== "handlebars" && format !== "custom"
    ) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: format,
            expectedFormat: "json, yaml, toml, handlebars, or custom",
          },
          `Invalid format. Expected json, yaml, toml, handlebars, or custom, got: ${format}`,
        ),
      };
    }

    return {
      ok: true,
      data: new TemplateFormat(
        format as "json" | "yaml" | "toml" | "handlebars" | "custom",
        template,
      ),
    };
  }

  /**
   * Gets the template format type
   */
  getFormat(): "json" | "yaml" | "toml" | "handlebars" | "custom" {
    return this.format;
  }

  /**
   * Gets the template content
   */
  getTemplate(): string {
    return this.template;
  }
}

/**
 * Represents a mapping rule for transforming data fields
 *
 * Business Rules:
 * - Source and target field names must not be empty
 * - Transform function is optional
 * - Immutable after creation
 *
 * @example
 * const result = MappingRule.create("frontmatter.title", "output.heading");
 * if (result.ok) {
 *   const data = { frontmatter: { title: "Hello World" } };
 *   console.log(result.data.apply(data)); // "Hello World"
 * }
 */
export class MappingRule {
  private constructor(
    private readonly source: string,
    private readonly target: string,
    private readonly transform?: (value: unknown) => unknown,
  ) {}

  /**
   * Creates a validated MappingRule instance
   *
   * @param source - Source field path (dot notation)
   * @param target - Target field path (dot notation)
   * @param transform - Optional transform function
   * @returns Result containing either a valid MappingRule or validation error
   */
  static create(
    source: string,
    target: string,
    transform?: (value: unknown) => unknown,
  ): Result<MappingRule, DomainError & { message: string }> {
    if (!source || !target) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Input cannot be empty"),
      };
    }

    return { ok: true, data: new MappingRule(source, target, transform) };
  }

  /**
   * Gets the source field path
   */
  getSource(): string {
    return this.source;
  }

  /**
   * Gets the target field path
   */
  getTarget(): string {
    return this.target;
  }

  /**
   * Applies the mapping rule to extract and transform data
   *
   * @param data - Source data object
   * @returns Transformed value or undefined if source path doesn't exist
   */
  apply(data: Record<string, unknown>): unknown {
    const value = this.getValueByPath(data, this.source);

    // Only return value if it exists in source data (no fallbacks or defaults)
    if (value === undefined) {
      return undefined;
    }

    return this.transform ? this.transform(value) : value;
  }

  /**
   * Extracts a value from an object using dot notation path
   *
   * @param obj - Object to extract from
   * @param path - Dot notation path (e.g., "user.profile.name")
   * @returns Value at path or undefined if path doesn't exist
   */
  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    // Strict path resolution - return undefined if any part of path is missing
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object" ||
        Array.isArray(current)
      ) {
        return undefined;
      }

      const currentObj = current as Record<string, unknown>;
      if (!(part in currentObj)) {
        return undefined;
      }

      current = currentObj[part];
    }

    return current;
  }
}

/**
 * Represents processing configuration options
 *
 * Business Rules:
 * - Max concurrency must be between 1 and DEFAULT_PROCESSING_LIMIT
 * - Default values are provided for all options
 * - Immutable after creation
 *
 * @example
 * const result = ProcessingOptions.create({
 *   parallel: true,
 *   maxConcurrency: 10,
 *   continueOnError: false
 * });
 * if (result.ok) {
 *   console.log(result.data.isParallel()); // true
 *   console.log(result.data.getMaxConcurrency()); // 10
 * }
 */
export class ProcessingOptions {
  private constructor(
    private readonly parallel: boolean,
    private readonly maxConcurrency: number,
    private readonly continueOnError: boolean,
  ) {}

  /**
   * Creates a validated ProcessingOptions instance
   *
   * @param options - Configuration options object
   * @returns Result containing either valid ProcessingOptions or validation error
   */
  static create(options: {
    parallel?: boolean;
    maxConcurrency?: number;
    continueOnError?: boolean;
  }): Result<ProcessingOptions, DomainError & { message: string }> {
    const parallel = options.parallel ?? true;
    const maxConcurrency = options.maxConcurrency ?? 5;
    const continueOnError = options.continueOnError ?? false;

    if (
      maxConcurrency < 1 || DEFAULT_PROCESSING_LIMIT.isExceeded(maxConcurrency)
    ) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "OutOfRange",
            value: maxConcurrency,
            min: 1,
            max: DEFAULT_PROCESSING_LIMIT.getValue(),
          },
          `Max concurrency out of range (1-${DEFAULT_PROCESSING_LIMIT.getValue()}): ${maxConcurrency}`,
        ),
      };
    }

    return {
      ok: true,
      data: new ProcessingOptions(parallel, maxConcurrency, continueOnError),
    };
  }

  /**
   * Checks if parallel processing is enabled
   */
  isParallel(): boolean {
    return this.parallel;
  }

  /**
   * Gets the maximum concurrency limit
   */
  getMaxConcurrency(): number {
    return this.maxConcurrency;
  }

  /**
   * Checks if processing should continue on errors
   */
  shouldContinueOnError(): boolean {
    return this.continueOnError;
  }
}
