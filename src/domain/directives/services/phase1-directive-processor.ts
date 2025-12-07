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
import { FlattenArraysDirective } from "../../schema/value-objects/flatten-arrays-directive.ts";
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
   * Uses FlattenArraysDirective value object to ensure consistent semantics:
   * - null/undefined → empty array []
   * - scalar → [scalar]
   * - nested arrays → recursively flattened
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
      let processedData = { ...data };
      let hasChanges = false;

      // Process each property that has x-flatten-arrays directive
      for (const [_propName, propSchema] of Object.entries(properties)) {
        if (typeof propSchema !== "object" || propSchema === null) {
          continue;
        }

        const schemaObj = propSchema as Record<string, unknown>;

        // Check if property has x-flatten-arrays directive (must be string)
        const flattenDirectiveValue = schemaObj["x-flatten-arrays"];
        if (typeof flattenDirectiveValue !== "string") {
          continue;
        }

        // Use FlattenArraysDirective value object for consistent semantics
        const directiveResult = FlattenArraysDirective.create(
          flattenDirectiveValue,
        );
        if (directiveResult.isError()) {
          return Result.error(
            new ProcessingError(
              `Failed to create flatten-arrays directive: ${directiveResult.unwrapError().message}`,
              "FLATTEN_ARRAYS_ERROR",
              { error: directiveResult.unwrapError() },
            ),
          );
        }

        const directive = directiveResult.unwrap();
        const originalValue = processedData[directive.getPropertyName()];

        // Apply directive (handles null, undefined, scalar, and array cases)
        processedData = directive.apply(processedData);

        // Check if value changed
        const newValue = processedData[directive.getPropertyName()];
        if (
          JSON.stringify(originalValue) !== JSON.stringify(newValue)
        ) {
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
