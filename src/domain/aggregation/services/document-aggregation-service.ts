import { Result } from "../../shared/types/result.ts";
import { ProcessingError } from "../../shared/types/errors.ts";
import { MarkdownDocument } from "../../frontmatter/entities/markdown-document.ts";

/**
 * Configuration interface for document aggregation.
 */
export interface AggregationConfig {
  readonly includeMetadata?: boolean;
  readonly includeProcessingTime?: boolean;
  readonly customMetadata?: Record<string, unknown>;
}

/**
 * Configuration manager interface for dependency injection.
 */
export interface ConfigurationManager {
  getBooleanDefault(key: string): Result<boolean, ProcessingError>;
  getObjectDefault(
    key: string,
  ): Result<Record<string, unknown>, ProcessingError>;
}

/**
 * Domain service for aggregating frontmatter data from multiple documents.
 * Handles single vs. multiple document processing strategies.
 * Follows totality principles with comprehensive Result-based error handling.
 */
export class DocumentAggregationService {
  private constructor(
    private readonly configManager?: ConfigurationManager,
  ) {}

  /**
   * Creates a DocumentAggregationService instance.
   */
  static create(
    configManager?: ConfigurationManager,
  ): Result<DocumentAggregationService, ProcessingError> {
    return Result.ok(new DocumentAggregationService(configManager));
  }

  /**
   * Transforms documents into aggregated data structure.
   * Uses configuration strategy for metadata generation.
   * Consults schema to determine property names for x-frontmatter-part directives.
   */
  transformDocuments(
    documents: MarkdownDocument[],
    template: unknown,
    schema?: Record<string, unknown>,
    config?: AggregationConfig,
  ): Result<Record<string, unknown>, ProcessingError> {
    if (!Array.isArray(documents)) {
      return Result.error(
        new ProcessingError(
          "Documents must be an array for aggregation",
          "INVALID_DOCUMENTS_TYPE",
          { documentsType: typeof documents },
        ),
      );
    }

    if (documents.length === 0) {
      return Result.error(
        new ProcessingError(
          "At least one document is required for aggregation",
          "EMPTY_DOCUMENTS_ARRAY",
          { documentCount: 0 },
        ),
      );
    }

    try {
      // Extract frontmatter data from all documents
      const extractionResult = this.extractFrontmatterData(documents);
      if (extractionResult.isError()) {
        return Result.error(extractionResult.unwrapError());
      }

      const allFrontmatterData = extractionResult.unwrap();

      // Single document processing: return frontmatter directly for variable resolution
      // Exception: if schema has NESTED x-frontmatter-part paths (e.g., "tools.commands"),
      // must use createAggregatedData to build the nested structure
      if (documents.length === 1 && allFrontmatterData.length === 1) {
        const hasNestedPaths = schema &&
          this.hasNestedFrontmatterPartPaths(schema);
        if (!hasNestedPaths) {
          return Result.ok(allFrontmatterData[0]);
        }
      }

      // Multiple document OR nested-path schema processing: create aggregate data structure
      const aggregationResult = this.createAggregatedData(
        allFrontmatterData,
        documents,
        template,
        schema,
        config,
      );
      if (aggregationResult.isError()) {
        return Result.error(aggregationResult.unwrapError());
      }

      return Result.ok(aggregationResult.unwrap());
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Document transformation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "TRANSFORMATION_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Extracts frontmatter data from all documents.
   */
  private extractFrontmatterData(
    documents: MarkdownDocument[],
  ): Result<Record<string, unknown>[], ProcessingError> {
    try {
      const allFrontmatterData: Record<string, unknown>[] = [];

      for (const document of documents) {
        const frontmatter = document.getFrontmatter();
        if (frontmatter) {
          allFrontmatterData.push(frontmatter.getData());
        }
      }

      return Result.ok(allFrontmatterData);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to extract frontmatter data: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "FRONTMATTER_EXTRACTION_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Creates aggregated data structure for multiple documents.
   * Uses schema to determine property names for frontmatter aggregation.
   * Schema-driven: ALL property names must come from schema, no hardcoded properties.
   */
  private createAggregatedData(
    frontmatterData: Record<string, unknown>[],
    _documents: MarkdownDocument[],
    _template: unknown,
    schema?: Record<string, unknown>,
    config?: AggregationConfig,
  ): Result<Record<string, unknown>, ProcessingError> {
    try {
      // Schema is required for schema-driven aggregation
      const propertyNamesResult = this.getSchemaPropertyNames(schema);
      if (propertyNamesResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Schema must specify x-frontmatter-part properties: ${propertyNamesResult.unwrapError().message}`,
            "SCHEMA_REQUIRED_FOR_AGGREGATION",
            { error: propertyNamesResult.unwrapError() },
          ),
        );
      }

      const aggregatedData: Record<string, unknown> = {};

      // Add frontmatter data using ONLY schema property paths (supports nested paths)
      const propertyPaths = propertyNamesResult.unwrap();
      for (const propertyPath of propertyPaths) {
        this.setNestedValue(aggregatedData, propertyPath, frontmatterData);
      }

      // Add metadata if configured
      const includeMetadata = this.shouldIncludeMetadata(config);
      if (includeMetadata) {
        const metadataResult = this.generateMetadata(config);
        if (metadataResult.isError()) {
          return Result.error(metadataResult.unwrapError());
        }
        Object.assign(aggregatedData, metadataResult.unwrap());
      }

      return Result.ok(aggregatedData);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to create aggregated data: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "AGGREGATION_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Extracts property paths from schema that have x-frontmatter-part: true.
   * These properties indicate where aggregated frontmatter data should be placed.
   * Recursively searches nested properties and returns dot-notation paths.
   */
  private getSchemaPropertyNames(
    schema?: Record<string, unknown>,
  ): Result<string[], ProcessingError> {
    if (!schema || typeof schema !== "object") {
      return Result.error(
        new ProcessingError(
          "Schema not provided or invalid",
          "SCHEMA_NOT_PROVIDED",
        ),
      );
    }

    try {
      const properties = schema.properties as
        | Record<string, unknown>
        | undefined;

      if (!properties || typeof properties !== "object") {
        return Result.error(
          new ProcessingError(
            "Schema properties not found",
            "SCHEMA_PROPERTIES_NOT_FOUND",
          ),
        );
      }

      // Recursively find properties with x-frontmatter-part: true
      const propertyPaths = this.findFrontmatterPartProperties(properties, "");

      if (propertyPaths.length === 0) {
        return Result.error(
          new ProcessingError(
            "No properties with x-frontmatter-part found in schema",
            "NO_FRONTMATTER_PROPERTIES",
          ),
        );
      }

      return Result.ok(propertyPaths);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to extract schema property names: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "SCHEMA_PROPERTY_EXTRACTION_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Checks if schema has any nested x-frontmatter-part paths (containing dots).
   * Returns true if paths like "tools.commands" exist, false for top-level paths like "documents".
   */
  private hasNestedFrontmatterPartPaths(
    schema: Record<string, unknown>,
  ): boolean {
    try {
      const properties = schema.properties as
        | Record<string, unknown>
        | undefined;

      if (!properties || typeof properties !== "object") {
        return false;
      }

      const paths = this.findFrontmatterPartProperties(properties, "");
      return paths.some((path) => path.includes("."));
    } catch {
      return false;
    }
  }

  /**
   * Recursively finds properties with x-frontmatter-part: true.
   * Returns dot-notation paths (e.g., "tools.commands").
   */
  private findFrontmatterPartProperties(
    properties: Record<string, unknown>,
    currentPath: string,
  ): string[] {
    const results: string[] = [];

    for (const [propName, propSchema] of Object.entries(properties)) {
      const fullPath = currentPath ? `${currentPath}.${propName}` : propName;

      if (propSchema && typeof propSchema === "object") {
        // Check if this property has x-frontmatter-part: true
        if (
          "x-frontmatter-part" in propSchema &&
          propSchema["x-frontmatter-part"] === true
        ) {
          results.push(fullPath);
        }

        // Recursively search nested properties
        const nestedProperties = (propSchema as Record<string, unknown>)
          .properties as Record<string, unknown> | undefined;
        if (nestedProperties && typeof nestedProperties === "object") {
          const nestedResults = this.findFrontmatterPartProperties(
            nestedProperties,
            fullPath,
          );
          results.push(...nestedResults);
        }
      }
    }

    return results;
  }

  /**
   * Sets a value at a nested path in an object using dot notation.
   * Creates intermediate objects as needed.
   * @param obj - Target object
   * @param path - Dot-notation path (e.g., "tools.commands")
   * @param value - Value to set
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const segments = path.split(".");
    let current = obj;

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (!segment) continue;

      if (!(segment in current) || typeof current[segment] !== "object") {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }

    const lastSegment = segments[segments.length - 1];
    if (lastSegment) {
      current[lastSegment] = value;
    }
  }

  /**
   * Determines whether to include metadata based on configuration.
   */
  private shouldIncludeMetadata(config?: AggregationConfig): boolean {
    // Check explicit config first
    if (config?.includeMetadata !== undefined) {
      return config.includeMetadata;
    }

    // Fallback to configuration manager
    if (this.configManager) {
      const includeMetadataResult = this.configManager.getBooleanDefault(
        "includeMetadata",
      );
      if (includeMetadataResult.isOk()) {
        return includeMetadataResult.unwrap();
      }
    }

    // Default to true
    return true;
  }

  /**
   * Generates metadata for aggregated data.
   * Provides multiple aliases for timestamp to support various template naming conventions.
   */
  private generateMetadata(
    config?: AggregationConfig,
  ): Result<Record<string, unknown>, ProcessingError> {
    try {
      const timestamp = new Date().toISOString();
      const metadata: Record<string, unknown> = {
        processedAt: timestamp,
        generated_at: timestamp, // Common template variable name
        generatedAt: timestamp, // Camel case variant
        timestamp: timestamp, // Simple variant
      };

      // Add custom metadata if provided
      if (config?.customMetadata) {
        Object.assign(metadata, config.customMetadata);
      }

      return Result.ok(metadata);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to generate metadata: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "METADATA_GENERATION_ERROR",
          { error },
        ),
      );
    }
  }
}
