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
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Stage 1: List matching files
    const filesResult = this.fileLister.list(inputPattern);
    if (!filesResult.ok) {
      return filesResult;
    }

    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];

    // Stage 2: Process each file
    for (const filePath of filesResult.data) {
      const documentResult = this.processDocument(filePath, validationRules);
      if (documentResult.ok) {
        processedData.push(documentResult.data.frontmatterData);
        documents.push(documentResult.data.document);
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
    const finalData = this.processFrontmatterParts(processedData, schema);

    // Stage 4: Aggregate data using derivation rules
    const aggregatedData = this.aggregateData(finalData, schema);
    if (!aggregatedData.ok) {
      return aggregatedData;
    }

    // Stage 5: Populate base properties from schema defaults
    return this.basePropertyPopulator.populate(aggregatedData.data, schema);
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
   */
  private processFrontmatterParts(
    data: FrontmatterData[],
    schema: Schema,
  ): FrontmatterData[] {
    const frontmatterPartSchema = schema.findFrontmatterPartSchema();
    if (!frontmatterPartSchema) {
      return data;
    }

    const partResults: FrontmatterData[] = [];
    for (const item of data) {
      const parts = this.frontmatterProcessor.extractFromPart(item, "");
      partResults.push(...parts);
    }
    return partResults;
  }

  /**
   * Aggregate data using derivation rules from schema.
   */
  private aggregateData(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const derivationRules = schema.getDerivedRules();

    if (derivationRules.length > 0) {
      // Convert schema rules to domain rules
      const rules = derivationRules.map((r) => {
        const ruleResult = DerivationRule.create(
          r.sourcePath,
          r.targetField,
          r.unique,
        );
        return ruleResult.ok ? ruleResult.data : null;
      }).filter((r) => r !== null) as DerivationRule[];

      // Aggregate with rules
      const aggregationResult = this.aggregator.aggregate(data, rules);
      if (!aggregationResult.ok) {
        return aggregationResult;
      }

      // Merge with base
      return this.aggregator.mergeWithBase(aggregationResult.data);
    } else {
      // No derivation rules - merge all data
      if (data.length > 0) {
        let merged = data[0];
        for (let i = 1; i < data.length; i++) {
          merged = merged.merge(data[i]);
        }
        return ok(merged);
      } else {
        return ok(FrontmatterData.empty());
      }
    }
  }
}
