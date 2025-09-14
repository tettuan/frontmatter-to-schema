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
import { DebugLogger } from "../../../infrastructure/adapters/debug-logger.ts";

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
    private readonly debugLogger?: DebugLogger,
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
    this.debugLogger?.logInfo(
      "document-processing",
      `Starting document processing with pattern: ${inputPattern}`,
      {
        pattern: inputPattern,
      },
    );

    if (verbose) {
      console.log("[VERBOSE] Listing files with pattern: " + inputPattern);
    }
    const filesResult = this.fileLister.list(inputPattern);
    if (!filesResult.ok) {
      this.debugLogger?.logError("file-listing", filesResult.error, {
        pattern: inputPattern,
      });
      return filesResult;
    }

    this.debugLogger?.logInfo(
      "file-listing",
      `Found ${filesResult.data.length} files to process`,
      {
        count: filesResult.data.length,
        files: filesResult.data,
      },
    );

    if (verbose) {
      console.log(`[VERBOSE] Found ${filesResult.data.length} files`);
    }

    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];

    // Stage 2: Process each file
    for (const filePath of filesResult.data) {
      this.debugLogger?.logDebug(
        "file-processing",
        `Processing file: ${filePath}`,
      );

      if (verbose) {
        console.log("[VERBOSE] Processing file: " + filePath);
      }
      const documentResult = this.processDocument(filePath, validationRules);
      if (documentResult.ok) {
        processedData.push(documentResult.data.frontmatterData);
        documents.push(documentResult.data.document);

        this.debugLogger?.logDebug(
          "file-processing",
          `Successfully processed: ${filePath}`,
        );

        if (verbose) {
          console.log("[VERBOSE]   ✓ File processed successfully");
        }
      } else {
        this.debugLogger?.logError("file-processing", documentResult.error, {
          filePath,
          stage: "individual-file-processing",
        });

        if (verbose) {
          console.log(
            "[VERBOSE]   ✗ Failed to process file: " +
              documentResult.error.message,
          );
        }
      }
      // Note: Individual file failures don't stop processing
    }

    if (processedData.length === 0) {
      const noDataError = createError({
        kind: "AggregationFailed",
        message: "No valid documents found to process",
      });
      this.debugLogger?.logError("document-processing", noDataError);
      return err(noDataError);
    }

    this.debugLogger?.logInfo(
      "document-processing",
      `Successfully processed ${processedData.length} documents`,
      {
        processedCount: processedData.length,
        totalFiles: filesResult.data.length,
      },
    );

    // Stage 3: Apply frontmatter-part processing if needed
    this.debugLogger?.logDebug(
      "frontmatter-part-processing",
      "Starting frontmatter-part processing",
    );
    if (verbose) {
      console.log("[VERBOSE] Applying frontmatter-part processing");
    }
    const finalData = this.processFrontmatterParts(processedData, schema);

    this.debugLogger?.logInfo(
      "frontmatter-part-processing",
      `Frontmatter-part processing complete`,
      {
        inputCount: processedData.length,
        outputCount: finalData.length,
      },
    );

    // Stage 4: Aggregate data using derivation rules
    this.debugLogger?.logDebug(
      "aggregation",
      "Starting data aggregation with derivation rules",
    );
    if (verbose) {
      console.log("[VERBOSE] Aggregating data with derivation rules");
    }
    const derivationRules = schema.getDerivedRules();

    this.debugLogger?.logInfo(
      "aggregation",
      `Found ${derivationRules.length} derivation rules`,
      {
        rules: derivationRules.map((r) => ({
          sourcePath: r.sourcePath,
          targetField: r.targetField,
        })),
      },
    );

    const aggregatedData = this.aggregateData(finalData, schema);
    if (!aggregatedData.ok) {
      this.debugLogger?.logError("aggregation", aggregatedData.error);
      return aggregatedData;
    }

    // Stage 5: Populate base properties from schema defaults
    this.debugLogger?.logDebug(
      "base-property-population",
      "Starting base property population",
    );
    if (verbose) {
      console.log("[VERBOSE] Populating base properties from schema");
    }
    const result = this.basePropertyPopulator.populate(
      aggregatedData.data,
      schema,
    );

    if (result.ok) {
      this.debugLogger?.logInfo(
        "document-processing",
        "Document processing pipeline completed successfully",
      );
      if (verbose) {
        console.log("[VERBOSE] Document processing completed");
      }
    } else {
      this.debugLogger?.logError("base-property-population", result.error);
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
    this.debugLogger?.logDebug(
      "single-document",
      `Starting processing of document: ${filePath}`,
    );

    // Create file path value object
    const filePathResult = FilePath.create(filePath);
    if (!filePathResult.ok) {
      this.debugLogger?.logError("file-path-validation", filePathResult.error, {
        filePath,
      });
      return filePathResult;
    }

    // Read file content
    this.debugLogger?.logDebug(
      "file-reading",
      `Reading file content: ${filePath}`,
    );
    const contentResult = this.fileReader.read(filePath);
    if (!contentResult.ok) {
      this.debugLogger?.logError("file-reading", contentResult.error, {
        filePath,
      });
      return contentResult;
    }

    // Extract frontmatter
    this.debugLogger?.logDebug(
      "frontmatter-extraction",
      `Extracting frontmatter from: ${filePath}`,
    );
    const extractResult = this.frontmatterProcessor.extract(contentResult.data);
    if (!extractResult.ok) {
      this.debugLogger?.logError(
        "frontmatter-extraction",
        extractResult.error,
        { filePath },
      );
      return extractResult;
    }

    const { frontmatter, body } = extractResult.data;
    this.debugLogger?.logDebug(
      "frontmatter-extraction",
      `Successfully extracted frontmatter from: ${filePath}`,
      {
        frontmatterKeys: Object.keys(frontmatter || {}),
        bodyLength: body.length,
      },
    );

    // Validate frontmatter
    this.debugLogger?.logDebug(
      "frontmatter-validation",
      `Validating frontmatter for: ${filePath}`,
    );
    const validationResult = this.frontmatterProcessor.validate(
      frontmatter,
      validationRules,
    );
    if (!validationResult.ok) {
      this.debugLogger?.logError(
        "frontmatter-validation",
        validationResult.error,
        { filePath },
      );
      return validationResult;
    }

    this.debugLogger?.logDebug(
      "frontmatter-validation",
      `Successfully validated frontmatter for: ${filePath}`,
    );

    // Create document entity
    this.debugLogger?.logDebug(
      "document-creation",
      `Creating MarkdownDocument entity for: ${filePath}`,
    );
    const docResult = MarkdownDocument.create(
      filePathResult.data,
      contentResult.data,
      validationResult.data,
      body,
    );
    if (!docResult.ok) {
      this.debugLogger?.logError("document-creation", docResult.error, {
        filePath,
      });
      return docResult;
    }

    this.debugLogger?.logDebug(
      "single-document",
      `Successfully processed document: ${filePath}`,
    );

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
    this.debugLogger?.logDebug(
      "frontmatter-parts",
      "Checking for x-frontmatter-part schema definition",
    );

    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();
    if (!frontmatterPartSchemaResult.ok) {
      this.debugLogger?.logDebug(
        "frontmatter-parts",
        "No x-frontmatter-part schema found, returning original data",
      );
      return data;
    }

    // Get the path to the frontmatter part (e.g., "commands")
    const frontmatterPartPathResult = schema.findFrontmatterPartPath();
    if (!frontmatterPartPathResult.ok) {
      this.debugLogger?.logDebug(
        "frontmatter-parts",
        "No x-frontmatter-part path found, returning original data",
      );
      return data;
    }

    const partPath = frontmatterPartPathResult.data;
    this.debugLogger?.logInfo(
      "frontmatter-parts",
      `Processing frontmatter parts at path: ${partPath}`,
      {
        partPath,
        inputDataCount: data.length,
      },
    );

    const extractedParts: FrontmatterData[] = [];

    // Extract the frontmatter part from each document
    for (const frontmatterData of data) {
      const dataObj = frontmatterData.getData();
      this.debugLogger?.logDebug(
        "frontmatter-part-extraction",
        `Processing document for frontmatter-part at schema path '${partPath}'`,
        {
          availableKeys: Object.keys(dataObj),
        },
      );

      // For frontmatter-part processing, the individual markdown files contain
      // the data that will become items in the target array. The partPath indicates
      // where the final array will be placed in the aggregated result, NOT where
      // to extract data from individual files.
      // Therefore, we extract the entire frontmatter object from each file.
      const partData = dataObj; // Use the entire frontmatter object

      if (partData && typeof partData === "object") {
        this.debugLogger?.logDebug(
          "frontmatter-part-extraction",
          "Found frontmatter object to extract as array item",
          {
            keys: Object.keys(partData),
          },
        );

        // Each individual frontmatter object becomes one item in the target array
        const itemDataResult = FrontmatterData.create(partData);
        if (itemDataResult.ok) {
          extractedParts.push(itemDataResult.data);
          this.debugLogger?.logDebug(
            "frontmatter-part-extraction",
            "Successfully processed frontmatter as array item",
          );
        } else {
          this.debugLogger?.logError(
            "frontmatter-part-extraction",
            itemDataResult.error,
            { partData },
          );
        }
      } else {
        this.debugLogger?.logDebug(
          "frontmatter-part-extraction",
          `No valid data found at '${partPath}' (type: ${typeof partData})`,
        );
      }
    }

    const result = extractedParts.length > 0 ? extractedParts : data;
    this.debugLogger?.logInfo(
      "frontmatter-parts",
      `Frontmatter parts processing complete`,
      {
        inputCount: data.length,
        extractedCount: extractedParts.length,
        returningOriginalData: extractedParts.length === 0,
      },
    );

    return result;
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

    this.debugLogger?.logDebug(
      "data-structure-creation",
      "Creating data structure using SchemaPathResolver",
      {
        inputDataCount: data.length,
        commandsArrayLength: commandsArray.length,
        sampleCommand: commandsArray[0]
          ? Object.keys(commandsArray[0])
          : "no data",
      },
    );

    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      this.debugLogger?.logError(
        "data-structure-creation",
        structureResult.error,
      );
      return structureResult;
    }

    this.debugLogger?.logDebug(
      "data-structure-creation",
      "Successfully created data structure",
      {
        structure: structureResult.data.getStructure(),
      },
    );

    // Convert to FrontmatterData and apply derivation rules
    const baseDataResult = structureResult.data.toFrontmatterData();
    if (!baseDataResult.ok) {
      this.debugLogger?.logError(
        "frontmatter-conversion",
        baseDataResult.error,
      );
      return baseDataResult;
    }

    this.debugLogger?.logDebug(
      "frontmatter-conversion",
      "Successfully converted structure to FrontmatterData",
      {
        dataKeys: Object.keys(baseDataResult.data.getData()),
      },
    );

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

    this.debugLogger?.logDebug(
      "derivation-rules-application",
      "Applying derivation rules while preserving frontmatter-part data",
      {
        ruleCount: rules.length,
        baseDataKeys: Object.keys(baseData.getData()),
        baseDataStructure: JSON.stringify(baseData.getData(), null, 2),
      },
    );

    // Apply derivation rules and merge with base data
    const aggregationResult = this.aggregator.aggregate(
      [baseData],
      rules,
      baseData,
    );
    if (!aggregationResult.ok) {
      return aggregationResult;
    }

    // Use aggregator's mergeWithBase to properly apply derived fields
    const mergeResult = this.aggregator.mergeWithBase(aggregationResult.data);
    if (!mergeResult.ok) {
      return mergeResult;
    }

    const finalData = mergeResult.data;

    this.debugLogger?.logDebug(
      "derivation-rules-application",
      "Successfully applied derivation rules",
      {
        finalDataKeys: Object.keys(finalData.getData()),
        finalDataStructure: JSON.stringify(finalData.getData(), null, 2),
      },
    );

    return ok(finalData);
  }

  /**
   * Calculate derived fields from source data using derivation rules.
   * Preserves frontmatter-part data by computing only derived fields.
   */
  private calculateDerivedFields(
    sourceData: FrontmatterData,
    rules: DerivationRule[],
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const derivedFields: Record<string, unknown> = {};

    this.debugLogger?.logDebug(
      "derived-field-calculation",
      "Calculating derived fields",
      {
        ruleCount: rules.length,
        sourceDataKeys: Object.keys(sourceData.getData()),
      },
    );

    for (const rule of rules) {
      const sourceResult = sourceData.get(rule.getBasePath());
      if (sourceResult.ok && Array.isArray(sourceResult.data)) {
        this.debugLogger?.logDebug(
          "derived-field-calculation",
          `Processing rule: ${rule.getBasePath()} -> ${rule.getTargetField()}`,
          {
            sourceArrayLength: sourceResult.data.length,
            isUnique: rule.isUnique(),
          },
        );

        const values = sourceResult.data.map((item) =>
          typeof item === "object" && item !== null
            ? (item as Record<string, unknown>)[rule.getPropertyPath()]
            : item
        ).filter((value) => value !== undefined);

        const finalValues = rule.isUnique() ? [...new Set(values)] : values;

        // Set derived field using targetField path
        this.setNestedField(derivedFields, rule.getTargetField(), finalValues);

        this.debugLogger?.logDebug(
          "derived-field-calculation",
          `Calculated derived field: ${rule.getTargetField()}`,
          {
            valuesCount: finalValues.length,
            sampleValue: finalValues[0],
          },
        );
      } else {
        this.debugLogger?.logDebug(
          "derived-field-calculation",
          `Skipping rule due to missing or non-array source: ${rule.getBasePath()}`,
          {
            sourceResult: sourceResult.ok ? "found but not array" : "not found",
          },
        );
      }
    }

    this.debugLogger?.logDebug(
      "derived-field-calculation",
      "Derived field calculation completed",
      {
        derivedFieldsKeys: Object.keys(derivedFields),
      },
    );

    return FrontmatterData.create(derivedFields);
  }

  /**
   * Deep merge two FrontmatterData objects, preserving existing nested structures.
   * Required to merge derived fields without overwriting frontmatter-part data.
   */
  private deepMerge(
    baseData: FrontmatterData,
    derivedData: FrontmatterData,
  ): FrontmatterData {
    const baseObj = baseData.getData();
    const derivedObj = derivedData.getData();

    const mergedObj = this.deepMergeObjects(baseObj, derivedObj);
    const mergedResult = FrontmatterData.create(mergedObj);

    // Since we control the input, this should never fail
    if (!mergedResult.ok) {
      throw new Error(`Deep merge failed: ${mergedResult.error.message}`);
    }

    return mergedResult.data;
  }

  /**
   * Deep merge two objects recursively.
   */
  private deepMergeObjects(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined) {
        if (
          typeof source[key] === "object" &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof result[key] === "object" &&
          result[key] !== null &&
          !Array.isArray(result[key])
        ) {
          // Both are objects - merge recursively
          result[key] = this.deepMergeObjects(
            result[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>,
          );
        } else {
          // Replace value (for arrays, primitives, or when target is not object)
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Set nested field in object using dot notation path.
   * Helper method for applying derived field values to nested structure.
   */
  private setNestedField(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
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
