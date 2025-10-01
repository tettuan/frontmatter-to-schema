/**
 * Phase1DirectiveProcessor
 *
 * Implements Phase 1 per-file directive processing before aggregation.
 * Handles directives that transform individual document frontmatter.
 *
 * Phase 1 Directives:
 * - x-flatten-arrays: Flatten nested array structures in frontmatter
 * - x-jmespath-filter: Filter frontmatter data using JMESPath expressions
 *
 * This processor executes BEFORE Phase 2 aggregation, operating on each
 * document independently without cross-document information.
 */

import { Result } from "../../shared/types/result.ts";
import { ProcessingError } from "../../shared/types/errors.ts";
import { MarkdownDocument } from "../../frontmatter/entities/markdown-document.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { JmesPath } from "@halvardm/jmespath";

/**
 * Phase 1 Directive Processor Service
 *
 * Processes per-file directives on individual documents before aggregation.
 * Follows Totality principle - never throws, always returns Result.
 */
export class Phase1DirectiveProcessor {
  private constructor() {}

  /**
   * Factory method to create Phase1DirectiveProcessor instance
   *
   * @returns Result containing processor instance or error
   */
  static create(): Result<Phase1DirectiveProcessor, ProcessingError> {
    try {
      return Result.ok(new Phase1DirectiveProcessor());
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to create Phase1DirectiveProcessor: ${error}`,
          "PROCESSOR_CREATE_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Process a single document with Phase 1 directives
   *
   * @param document - MarkdownDocument to process
   * @param schema - Optional JSON Schema with directive annotations
   * @returns Result containing processed document or error
   */
  processDocument(
    document: MarkdownDocument,
    schema?: Record<string, unknown>,
  ): Result<MarkdownDocument, ProcessingError> {
    try {
      // No frontmatter - return unchanged
      const frontmatter = document.getFrontmatter();
      if (!frontmatter) {
        return Result.ok(document);
      }

      // No schema - return unchanged
      if (!schema) {
        return Result.ok(document);
      }

      // Get frontmatter data
      const originalData = frontmatter.getData();
      let data = originalData;

      // Apply x-flatten-arrays directive
      const flattenResult = this.applyFlattenArrays(data, schema);
      if (flattenResult.isError()) {
        return Result.error(flattenResult.unwrapError());
      }

      data = flattenResult.unwrap();

      // Apply x-jmespath-filter directive
      const filterResult = this.applyJmesPathFilter(data, schema);
      if (filterResult.isError()) {
        return Result.error(filterResult.unwrapError());
      }

      const processedData = filterResult.unwrap();

      // If data unchanged, return original document
      if (originalData === processedData) {
        return Result.ok(document);
      }

      // Create new frontmatter with processed data
      const newFrontmatterResult = FrontmatterData.create(processedData);
      if (newFrontmatterResult.isError()) {
        return Result.error(newFrontmatterResult.unwrapError());
      }

      // Create new document with processed frontmatter
      const newDocument = MarkdownDocument.create(
        document.getId(),
        document.getPath(),
        document.getContent(),
        newFrontmatterResult.unwrap(),
      );

      return Result.ok(newDocument);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to process document: ${error}`,
          "DOCUMENT_PROCESSING_ERROR",
          { error, documentPath: document.getPath().toString() },
        ),
      );
    }
  }

  /**
   * Apply x-flatten-arrays directive to data
   *
   * Flattens nested arrays in properties that have x-flatten-arrays: true
   * in the schema. Recursively flattens all nested levels.
   *
   * @param data - Frontmatter data object
   * @param schema - JSON Schema with directive annotations
   * @returns Result containing processed data or error
   */
  private applyFlattenArrays(
    data: Record<string, unknown>,
    schema: Record<string, unknown>,
  ): Result<Record<string, unknown>, ProcessingError> {
    try {
      // Check if schema has properties
      if (!schema.properties || typeof schema.properties !== "object") {
        return Result.ok(data);
      }

      const properties = schema.properties as Record<string, unknown>;
      const processedData = { ...data };
      let hasChanges = false;

      // Process each property that has x-flatten-arrays directive
      for (const [_propName, propSchema] of Object.entries(properties)) {
        if (typeof propSchema !== "object" || propSchema === null) {
          continue;
        }

        const schemaObj = propSchema as Record<string, unknown>;

        // Check if property has x-flatten-arrays directive (must be string)
        const flattenDirective = schemaObj["x-flatten-arrays"];
        if (typeof flattenDirective !== "string") {
          continue;
        }

        // Directive value IS the frontmatter property name to flatten
        const frontmatterPropertyName = flattenDirective;
        const value = processedData[frontmatterPropertyName];
        if (!Array.isArray(value)) {
          continue;
        }

        // Flatten the array
        const flattened = this.flattenArray(value);

        // Only update if changed
        if (!this.arraysEqual(value, flattened)) {
          processedData[frontmatterPropertyName] = flattened;
          hasChanges = true;
        }
      }

      return Result.ok(hasChanges ? processedData : data);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to apply flatten arrays: ${error}`,
          "FLATTEN_ARRAYS_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Recursively flatten a nested array to a single level
   *
   * @param arr - Array to flatten (may contain nested arrays)
   * @returns Flattened array
   */
  private flattenArray(arr: unknown[]): unknown[] {
    const result: unknown[] = [];

    for (const item of arr) {
      if (Array.isArray(item)) {
        // Recursively flatten nested arrays
        result.push(...this.flattenArray(item));
      } else {
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Compare two arrays for equality
   *
   * @param a - First array
   * @param b - Second array
   * @returns True if arrays are equal
   */
  private arraysEqual(a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (Array.isArray(a[i]) && Array.isArray(b[i])) {
        if (!this.arraysEqual(a[i] as unknown[], b[i] as unknown[])) {
          return false;
        }
      } else if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply x-jmespath-filter directive to data
   *
   * Filters properties that have x-jmespath-filter in the schema.
   * Applies JMESPath expression to filter array values per-file before aggregation.
   *
   * @param data - Frontmatter data object
   * @param schema - JSON Schema with directive annotations
   * @returns Result containing processed data or error
   */
  private applyJmesPathFilter(
    data: Record<string, unknown>,
    schema: Record<string, unknown>,
  ): Result<Record<string, unknown>, ProcessingError> {
    try {
      // Check if schema has properties
      if (!schema.properties || typeof schema.properties !== "object") {
        return Result.ok(data);
      }

      const properties = schema.properties as Record<string, unknown>;
      const processedData = { ...data };
      let hasChanges = false;

      // Process each property that has x-jmespath-filter directive
      for (const [propName, propSchema] of Object.entries(properties)) {
        if (typeof propSchema !== "object" || propSchema === null) {
          continue;
        }

        const schemaObj = propSchema as Record<string, unknown>;

        // Check if property has x-jmespath-filter directive (must be string)
        const filterExpression = schemaObj["x-jmespath-filter"];
        if (typeof filterExpression !== "string") {
          continue;
        }

        // Check if property exists in data
        const value = processedData[propName];
        if (value === undefined || value === null) {
          continue;
        }

        // Apply JMESPath filter
        try {
          // deno-lint-ignore no-explicit-any
          const jmesPath = new JmesPath(value as any);
          const filteredValue = jmesPath.search(filterExpression);
          processedData[propName] = filteredValue;
          hasChanges = true;
        } catch (jmesPathError) {
          return Result.error(
            new ProcessingError(
              `JMESPath filter evaluation failed for property '${propName}': ${
                jmesPathError instanceof Error
                  ? jmesPathError.message
                  : String(jmesPathError)
              }`,
              "JMESPATH_FILTER_ERROR",
              { propName, filterExpression, jmesPathError },
            ),
          );
        }
      }

      return Result.ok(hasChanges ? processedData : data);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to apply jmespath filter: ${error}`,
          "JMESPATH_FILTER_ERROR",
          { error },
        ),
      );
    }
  }
}
