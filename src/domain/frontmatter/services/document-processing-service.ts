import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FilePath } from "../value-objects/file-path.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { FrontmatterProcessor } from "../processors/frontmatter-processor.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { Aggregator, DerivationRule } from "../../aggregation/index.ts";
import { BasePropertyPopulator } from "../../schema/services/base-property-populator.ts";
import { SchemaPathResolver } from "../../schema/services/schema-path-resolver.ts";

export interface FileReader {
  read(path: string): Result<string, DomainError & { message: string }>;
}

export interface FileLister {
  list(pattern: string): Result<string[], DomainError & { message: string }>;
}

export interface ProcessedDocuments {
  readonly documents: MarkdownDocument[];
  readonly processedData: FrontmatterData[];
}

/**
 * Result of converting schema derivation rules to domain rules.
 * Replaces silent error handling with explicit rule conversion tracking.
 */
export type RuleConversionResult = {
  readonly successfulRules: DerivationRule[];
  readonly failedRuleCount: number;
  readonly errors: Array<DomainError & { message: string }>;
};

/**
 * Domain service responsible for Document processing stage of the 3-stage pipeline.
 * Handles: Frontmatter → ValidatedData + Aggregation + BaseProperty population
 */
export class DocumentProcessingService {
  constructor(
    private readonly frontmatterProcessor: FrontmatterProcessor,
    private readonly aggregator: Aggregator,
    private readonly basePropertyPopulator: BasePropertyPopulator,
    private readonly fileReader: FileReader,
    private readonly fileLister: FileLister,
  ) {}

  /**
   * Process documents from file pattern with validation and aggregation.
   * Follows 3-stage architecture: Extract → Validate → Aggregate
   */
  processDocuments(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    verbose: boolean = false,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Stage 1: List matching files
    if (verbose) {
      console.log("[VERBOSE] Listing files with pattern: " + inputPattern);
    }
    const filesResult = this.fileLister.list(inputPattern);
    if (!filesResult.ok) {
      return filesResult;
    }
    if (verbose) {
      console.log(`[VERBOSE] Found ${filesResult.data.length} files`);
    }

    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];

    // Stage 2: Process each file
    for (const filePath of filesResult.data) {
      if (verbose) {
        console.log("[VERBOSE] Processing file: " + filePath);
      }
      const documentResult = this.processDocument(filePath, validationRules);
      if (documentResult.ok) {
        processedData.push(documentResult.data.frontmatterData);
        documents.push(documentResult.data.document);
        if (verbose) {
          console.log("[VERBOSE]   ✓ File processed successfully");
        }
      } else if (verbose) {
        console.log(
          "[VERBOSE]   ✗ Failed to process file: " +
            documentResult.error.message,
        );
      }
      // Note: Individual file failures don't stop processing
    }

    if (processedData.length === 0) {
      return err(createError({
        kind: "AggregationFailed",
        message: "No valid documents found to process",
      }));
    }

    // Stage 3: Apply frontmatter-part processing if needed
    if (verbose) {
      console.log("[VERBOSE] Applying frontmatter-part processing");
    }
    const finalData = this.processFrontmatterParts(processedData, schema);

    // Stage 4: Aggregate data using derivation rules
    if (verbose) {
      console.log("[VERBOSE] Aggregating data with derivation rules");
    }
    const _derivationRules = schema.getDerivedRules();

    const aggregatedData = this.aggregateData(finalData, schema);
    if (!aggregatedData.ok) {
      return aggregatedData;
    }

    // Stage 5: Populate base properties from schema defaults
    if (verbose) {
      console.log("[VERBOSE] Populating base properties from schema");
    }
    const result = this.basePropertyPopulator.populate(
      aggregatedData.data,
      schema,
    );
    if (verbose && result.ok) {
      console.log("[VERBOSE] Document processing completed");
    }
    return result;
  }

  /**
   * Process a single document file.
   */
  private processDocument(
    filePath: string,
    validationRules: ValidationRules,
  ): Result<
    { document: MarkdownDocument; frontmatterData: FrontmatterData },
    DomainError & { message: string }
  > {
    // Create file path value object
    const filePathResult = FilePath.create(filePath);
    if (!filePathResult.ok) {
      return filePathResult;
    }

    // Read file content
    const contentResult = this.fileReader.read(filePath);
    if (!contentResult.ok) {
      return contentResult;
    }

    // Extract frontmatter
    const extractResult = this.frontmatterProcessor.extract(contentResult.data);
    if (!extractResult.ok) {
      return extractResult;
    }

    const { frontmatter, body } = extractResult.data;

    // Validate frontmatter
    const validationResult = this.frontmatterProcessor.validate(
      frontmatter,
      validationRules,
    );
    if (!validationResult.ok) {
      return validationResult;
    }

    // Create document entity
    const docResult = MarkdownDocument.create(
      filePathResult.data,
      contentResult.data,
      validationResult.data,
      body,
    );
    if (!docResult.ok) {
      return docResult;
    }

    return ok({
      document: docResult.data,
      frontmatterData: validationResult.data,
    });
  }

  /**
   * Process frontmatter parts if schema defines x-frontmatter-part.
   * When x-frontmatter-part is true, extracts the specific part from each markdown file.
   */
  private processFrontmatterParts(
    data: FrontmatterData[],
    schema: Schema,
  ): FrontmatterData[] {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();
    if (!frontmatterPartSchemaResult.ok) {
      return data;
    }

    // Get the path to the frontmatter part (e.g., "commands")
    const frontmatterPartPathResult = schema.findFrontmatterPartPath();
    if (!frontmatterPartPathResult.ok) {
      return data;
    }

    const partPath = frontmatterPartPathResult.data;
    const extractedParts: FrontmatterData[] = [];

    // Extract the frontmatter part from each document
    for (const frontmatterData of data) {
      const dataObj = frontmatterData.getData();
      const partData = this.extractNestedProperty(dataObj, partPath);

      if (partData !== undefined && Array.isArray(partData)) {
        // If the part is an array, each item becomes a separate FrontmatterData
        for (const item of partData) {
          if (item && typeof item === "object") {
            const itemDataResult = FrontmatterData.create(
              item as Record<string, unknown>,
            );
            if (itemDataResult.ok) {
              extractedParts.push(itemDataResult.data);
            }
          }
        }
      } else if (
        partData !== undefined && partData && typeof partData === "object"
      ) {
        // If the part is an object, it becomes a single FrontmatterData
        const partDataResult = FrontmatterData.create(
          partData as Record<string, unknown>,
        );
        if (partDataResult.ok) {
          extractedParts.push(partDataResult.data);
        }
      }
    }

    return extractedParts.length > 0 ? extractedParts : data;
  }

  /**
   * Aggregate data using derivation rules from schema.
   * Refactored to use SchemaPathResolver following DDD Totality principles.
   */
  private aggregateData(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const derivationRules = schema.getDerivedRules();

    if (derivationRules.length > 0) {
      return this.aggregateWithDerivationRules(data, schema, derivationRules);
    } else {
      return this.aggregateWithoutDerivationRules(data, schema);
    }
  }

  /**
   * Handles aggregation with derivation rules using schema-driven approach.
   * Replaces hardcoded structure creation with SchemaPathResolver.
   */
  private aggregateWithDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      return this.mergeDataDirectly(data);
    }

    // Handle empty data by creating empty structure
    if (data.length === 0) {
      const emptyStructureResult = SchemaPathResolver.createEmptyStructure(
        schema,
      );
      if (!emptyStructureResult.ok) {
        return emptyStructureResult;
      }

      const baseDataResult = emptyStructureResult.data.toFrontmatterData();
      if (!baseDataResult.ok) {
        return baseDataResult;
      }

      return this.applyDerivationRules(baseDataResult.data, derivationRules);
    }

    // Use SchemaPathResolver instead of hardcoded structure creation
    const commandsArray = data.map((item) => item.getData());
    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      return structureResult;
    }

    // Convert to FrontmatterData and apply derivation rules
    const baseDataResult = structureResult.data.toFrontmatterData();
    if (!baseDataResult.ok) {
      return baseDataResult;
    }

    return this.applyDerivationRules(baseDataResult.data, derivationRules);
  }

  /**
   * Handles aggregation without derivation rules using schema-driven approach.
   * Replaces hardcoded structure creation with SchemaPathResolver.
   */
  private aggregateWithoutDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      return this.mergeDataDirectly(data);
    }

    // Handle empty data by creating empty structure
    if (data.length === 0) {
      const emptyStructureResult = SchemaPathResolver.createEmptyStructure(
        schema,
      );
      if (!emptyStructureResult.ok) {
        return emptyStructureResult;
      }

      return emptyStructureResult.data.toFrontmatterData();
    }

    // Use SchemaPathResolver instead of hardcoded structure creation
    const commandsArray = data.map((item) => item.getData());
    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      return structureResult;
    }

    return structureResult.data.toFrontmatterData();
  }

  /**
   * Applies derivation rules to base data using existing aggregator.
   */
  private applyDerivationRules(
    baseData: FrontmatterData,
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Convert schema rules to domain rules with explicit error tracking
    const ruleConversion = this.convertDerivationRules(derivationRules);

    // For backward compatibility, we continue processing even with failed rules
    const rules = ruleConversion.successfulRules;

    // Aggregate with rules using the base data
    const aggregationResult = this.aggregator.aggregate([baseData], rules);
    if (!aggregationResult.ok) {
      return aggregationResult;
    }

    // Merge with base
    const mergedResult = this.aggregator.mergeWithBase(aggregationResult.data);
    if (!mergedResult.ok) {
      return mergedResult;
    }

    return mergedResult;
  }

  /**
   * Fallback for direct merging when no frontmatter-part schema exists.
   * Follows Totality principle with proper error handling.
   */
  private mergeDataDirectly(
    data: FrontmatterData[],
  ): Result<FrontmatterData, DomainError & { message: string }> {
    if (data.length === 0) {
      return ok(FrontmatterData.empty());
    }

    let merged = data[0];
    for (let i = 1; i < data.length; i++) {
      merged = merged.merge(data[i]);
    }
    return ok(merged);
  }

  /**
   * Convert schema derivation rules to domain rules with explicit error handling.
   * Replaces silent error handling with tracked rule conversion results.
   */
  private convertDerivationRules(
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): RuleConversionResult {
    const successfulRules: DerivationRule[] = [];
    const errors: Array<DomainError & { message: string }> = [];
    let failedRuleCount = 0;

    for (const rule of derivationRules) {
      const ruleResult = DerivationRule.create(
        rule.sourcePath,
        rule.targetField,
        rule.unique,
      );

      if (ruleResult.ok) {
        successfulRules.push(ruleResult.data);
      } else {
        failedRuleCount++;
        errors.push(ruleResult.error);
      }
    }

    return { successfulRules, failedRuleCount, errors };
  }

  /**
   * Helper method to extract nested properties from an object.
   */
  private extractNestedProperty(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (
        current && typeof current === "object" &&
        part in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Helper method to set nested properties in an object.
   */
  private setNestedProperty(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    let current = obj;

    // Navigate to the parent of the target property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    // Set the final property
    current[parts[parts.length - 1]] = value;
  }
}
