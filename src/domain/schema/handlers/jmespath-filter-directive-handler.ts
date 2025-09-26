/**
 * @fileoverview JMESPath Filter Directive Handler
 * @description Handles x-jmespath-filter directive processing following DDD and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../../frontmatter/factories/frontmatter-data-factory.ts";
import { Schema } from "../entities/schema.ts";
import { JMESPathFilterService } from "../services/jmespath-filter-service.ts";
import { defaultSchemaExtensionRegistry } from "../value-objects/schema-extension-registry.ts";
import {
  BaseDirectiveHandler,
  DirectiveConfig,
  DirectiveHandlerError,
  DirectiveHandlerFactory,
  DirectiveProcessingResult,
  ExtensionExtractionResult,
  LegacySchemaProperty,
} from "../interfaces/directive-handler.ts";

/**
 * JMESPath filter directive configuration
 */
interface JMESPathFilterConfig {
  readonly filterExpression: string;
  readonly targetPath?: string;
}

/**
 * JMESPath filter processing metadata
 */
interface JMESPathFilterMetadata {
  readonly filterApplied: boolean;
  readonly originalDataSize: number;
  readonly filteredDataSize: number;
  readonly filterExpression: string;
}

/**
 * JMESPath Filter Directive Handler
 *
 * Processes x-jmespath-filter directives that apply JMESPath expressions to filter data.
 * Following DDD and Totality principles:
 * - Smart Constructor pattern
 * - Result<T,E> for all operations
 * - No exceptions or undefined behavior
 */
export class JMESPathFilterDirectiveHandler
  extends BaseDirectiveHandler<JMESPathFilterConfig, JMESPathFilterMetadata> {
  private constructor() {
    super("jmespath-filter", 4, []); // Priority 4: JMESPath Filtering
  }

  /**
   * Smart Constructor following Totality principles
   */
  static create(): Result<
    JMESPathFilterDirectiveHandler,
    DirectiveHandlerError
  > {
    return ok(new JMESPathFilterDirectiveHandler());
  }

  /**
   * Extract JMESPath filter configuration from legacy schema
   * Handles both extensions object and direct property
   */
  extractConfig(
    schema: LegacySchemaProperty,
  ): Result<DirectiveConfig<JMESPathFilterConfig>, DirectiveHandlerError> {
    let filterExpression: string | undefined;

    // Check extensions object first (legacy format)
    if (schema.extensions && typeof schema.extensions === "object") {
      const extensions = schema.extensions as Record<string, unknown>;
      if (extensions["x-jmespath-filter"] !== undefined) {
        if (typeof extensions["x-jmespath-filter"] === "string") {
          filterExpression = extensions["x-jmespath-filter"];
        } else {
          return err({
            kind: "ValidationError",
            directiveName: this.directiveName,
            message:
              `Invalid JMESPath expression: expected string but got ${typeof extensions[
                "x-jmespath-filter"
              ]}`,
            invalidValue: extensions["x-jmespath-filter"],
          });
        }
      }
    }

    // Check direct property (standard JSON Schema extension pattern)
    // Takes precedence over extensions object
    if (schema["x-jmespath-filter"] !== undefined) {
      if (typeof schema["x-jmespath-filter"] === "string") {
        filterExpression = schema["x-jmespath-filter"];
      } else {
        return err({
          kind: "ValidationError",
          directiveName: this.directiveName,
          message:
            `Invalid JMESPath expression: expected string but got ${typeof schema[
              "x-jmespath-filter"
            ]}`,
          invalidValue: schema["x-jmespath-filter"],
        });
      }
    }

    if (filterExpression === undefined) {
      return DirectiveHandlerFactory.createConfig(
        this.directiveName,
        { filterExpression: "" },
        false,
      );
    }

    // Validate JMESPath expression syntax
    if (!this.isValidJMESPathExpression(filterExpression)) {
      return err({
        kind: "ValidationError",
        directiveName: this.directiveName,
        message: `Invalid JMESPath expression: ${filterExpression}`,
        invalidValue: filterExpression,
      });
    }

    return DirectiveHandlerFactory.createConfig(
      this.directiveName,
      { filterExpression },
      true,
    );
  }

  /**
   * Process data using JMESPath filter configuration
   */
  processData(
    data: FrontmatterData,
    config: DirectiveConfig<JMESPathFilterConfig>,
    _schema: Schema,
  ): Result<
    DirectiveProcessingResult<JMESPathFilterMetadata>,
    DirectiveHandlerError
  > {
    if (!config.isPresent || !config.configuration.filterExpression) {
      return DirectiveHandlerFactory.createResult(
        this.directiveName,
        data,
        {
          filterApplied: false,
          originalDataSize: 0,
          filteredDataSize: 0,
          filterExpression: "",
        },
      );
    }

    try {
      // Create JMESPath filter service
      const serviceResult = JMESPathFilterService.create();
      if (!serviceResult.ok) {
        return err({
          kind: "ProcessingError",
          directiveName: this.directiveName,
          message: "Failed to create JMESPath filter service",
          cause: serviceResult.error,
        });
      }

      const service = serviceResult.data;
      const originalData = data.getData();
      let workingData: unknown = originalData;

      // Pre-process nested arrays if needed
      if (
        Array.isArray(originalData) && originalData.length > 0 &&
        Array.isArray(originalData[0])
      ) {
        // Flatten nested arrays before filtering
        workingData = originalData.flat();
      }

      const originalSize = this.calculateDataSize(workingData);

      // Create temporary FrontmatterData for filtering if we modified the structure
      let dataToFilter = data;
      if (workingData !== originalData) {
        const tempDataResult = FrontmatterDataFactory.fromParsedData(
          workingData,
        );
        if (!tempDataResult.ok) {
          // If we can't create temp data, use original
          dataToFilter = data;
          workingData = originalData;
        } else {
          dataToFilter = tempDataResult.data;
        }
      }

      // Apply JMESPath filter
      const filterResult = service.applyFilter(
        dataToFilter,
        config.configuration.filterExpression,
      );
      if (!filterResult.ok) {
        return err({
          kind: "ProcessingError",
          directiveName: this.directiveName,
          message: `JMESPath filter failed: ${filterResult.error.message}`,
          cause: filterResult.error,
        });
      }

      let processedData = filterResult.data;
      const filteredSize = this.calculateDataSize(processedData);

      // Handle case where JMESPath returns null or invalid data
      // This can happen when the expression doesn't match the data structure
      if (processedData === null || processedData === undefined) {
        // Return original data when filter produces no results
        return DirectiveHandlerFactory.createResult(
          this.directiveName,
          data,
          {
            filterApplied: true,
            originalDataSize: originalSize,
            filteredDataSize: 0,
            filterExpression: config.configuration.filterExpression,
          },
        );
      }

      // Handle nested array flattening if needed
      if (
        Array.isArray(processedData) && processedData.length > 0 &&
        Array.isArray(processedData[0])
      ) {
        processedData = processedData
          .flat()
          .filter((item: unknown) =>
            item !== null && item !== undefined &&
            !(Array.isArray(item) && item.length === 0) &&
            (typeof item === "object" && Object.keys(item).length > 0)
          );
      }

      // If processedData is not suitable for FrontmatterData creation,
      // wrap it in a structure that works
      let dataForCreation = processedData;
      if (Array.isArray(processedData)) {
        // If the result is just an array, wrap it in an object
        dataForCreation = { items: processedData };
      }

      // Create new FrontmatterData with processed data
      const newDataResult = FrontmatterDataFactory.fromParsedData(
        dataForCreation,
      );
      if (!newDataResult.ok) {
        // If creation still fails, return original data with metadata
        return DirectiveHandlerFactory.createResult(
          this.directiveName,
          data,
          {
            filterApplied: true,
            originalDataSize: originalSize,
            filteredDataSize: filteredSize,
            filterExpression: config.configuration.filterExpression,
          },
        );
      }

      return DirectiveHandlerFactory.createResult(
        this.directiveName,
        newDataResult.data,
        {
          filterApplied: true,
          originalDataSize: originalSize,
          filteredDataSize: filteredSize,
          filterExpression: config.configuration.filterExpression,
        },
      );
    } catch (error) {
      return err({
        kind: "ProcessingError",
        directiveName: this.directiveName,
        message: `JMESPath filter processing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        cause: {
          kind: "ConfigurationError",
          message: error instanceof Error ? error.message : String(error),
        } as DomainError,
      });
    }
  }

  /**
   * Extract extension key-value pair for schema building
   */
  extractExtension(
    schema: LegacySchemaProperty,
  ): Result<ExtensionExtractionResult, DirectiveHandlerError> {
    const configResult = this.extractConfig(schema);
    if (!configResult.ok) {
      return configResult;
    }

    const config = configResult.data;
    if (!config.isPresent) {
      return ok({
        kind: "ExtensionNotApplicable",
        reason: "No x-jmespath-filter directive found in schema",
      });
    }

    const registry = defaultSchemaExtensionRegistry;
    const key = registry.getJmespathFilterKey().getValue();

    return ok({
      kind: "ExtensionFound",
      key,
      value: config.configuration.filterExpression,
    });
  }

  /**
   * Validate JMESPath expression syntax
   * Basic validation - in real implementation would use JMESPath parser
   */
  private isValidJMESPathExpression(expression: string): boolean {
    if (!expression || expression.trim() === "") {
      return false;
    }

    // Basic syntax checks
    const trimmed = expression.trim();

    // Check for balanced brackets
    const openBrackets = (trimmed.match(/\[/g) || []).length;
    const closeBrackets = (trimmed.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      return false;
    }

    // Check for balanced parentheses
    const openParens = (trimmed.match(/\(/g) || []).length;
    const closeParens = (trimmed.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return false;
    }

    // JMESPath expressions should not start with invalid characters
    // Valid JMESPath expressions typically start with: letters, @, *, [, or certain functions
    if (/^[()&|<>!]/.test(trimmed)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate data size for metadata
   * For JMESPath filtering, we want to count the items that would be filtered
   */
  private calculateDataSize(data: unknown): number {
    if (Array.isArray(data)) {
      return data.length;
    } else if (data && typeof data === "object") {
      // For objects, find the first array property and count its items
      // This is typically what JMESPath filters operate on
      const obj = data as Record<string, unknown>;
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          return value.length;
        }
      }
      // If no array found, count object keys
      return Object.keys(obj).length;
    } else {
      return data != null ? 1 : 0;
    }
  }
}
