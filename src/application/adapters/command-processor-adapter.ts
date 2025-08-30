/**
 * CommandProcessorAdapter - Stage 1 Processing Adapter
 *
 * Adapts existing domain services (FrontMatterExtractor, SchemaAnalyzer, TemplateMapper)
 * into a two-stage processing pipeline for Stage 1: Document → Command conversion
 *
 * This adapter follows the Adapter Pattern to bridge existing interfaces without
 * breaking backward compatibility while enabling the new two-stage processing flow.
 */

import type {
  Document,
  ExtractedData,
  FrontMatter,
  Schema,
  Template,
} from "../../domain/models/entities.ts";
import type { DomainError, Result } from "../../domain/core/result.ts";
import type {
  FrontMatterExtractionResult,
  FrontMatterExtractor,
  SchemaAnalyzer,
  SchemaValidationMode,
  TemplateMapper,
} from "../../domain/services/interfaces.ts";

/**
 * Command structure for Stage 1 output
 * Represents the result of processing a single document through Stage 1
 */
export interface Command {
  /** Command category (c1 field from frontmatter) */
  readonly c1: string;
  /** Command layer (c2 field from frontmatter) */
  readonly c2: string;
  /** Command directive (c3 field from frontmatter) */
  readonly c3: string;
  /** Additional command options extracted from frontmatter */
  readonly options: Record<string, unknown>;
  /** Source document path for traceability */
  readonly sourcePath: string;
  /** Original frontmatter data for debugging */
  readonly originalFrontMatter: Record<string, unknown>;
}

/**
 * Stage 1 processing result using Totality principles
 */
export type CommandProcessingResult =
  | { kind: "Success"; command: Command }
  | { kind: "NoFrontMatter"; documentPath: string }
  | {
    kind: "MissingC1C2C3";
    missingFields: string[];
    frontMatter: Record<string, unknown>;
  }
  | { kind: "SchemaAnalysisError"; error: DomainError & { message: string } }
  | { kind: "TemplateMappingError"; error: DomainError & { message: string } }
  | { kind: "ExtractionError"; error: DomainError & { message: string } };

/**
 * CommandProcessorAdapter
 *
 * Bridges existing domain services into Stage 1 of two-stage processing.
 * Maintains full compatibility with existing interfaces while extracting
 * c1/c2/c3 fields and applying command-level templates.
 */
export class CommandProcessorAdapter {
  constructor(
    private readonly frontMatterExtractor: FrontMatterExtractor,
    private readonly schemaAnalyzer: SchemaAnalyzer,
    private readonly templateMapper: TemplateMapper,
  ) {}

  /**
   * Processes a document through Stage 1 of two-stage pipeline
   *
   * Flow:
   * 1. Extract frontmatter from document
   * 2. Validate required c1/c2/c3 fields
   * 3. Apply command schema analysis
   * 4. Map to command template structure
   * 5. Return Command object
   */
  async processDocument(
    document: Document,
    commandSchema: Schema,
    commandTemplate: Template,
  ): Promise<CommandProcessingResult> {
    // Step 1: Extract frontmatter
    const extractionResult = await this.extractFrontMatter(document);
    if (!extractionResult.ok) {
      return { kind: "ExtractionError", error: extractionResult.error };
    }

    // Check if frontmatter was found
    if (extractionResult.data.kind === "NotPresent") {
      return {
        kind: "NoFrontMatter",
        documentPath: document.getPath().getValue(),
      };
    }

    const frontMatter = extractionResult.data.frontMatter;

    // Step 2: Validate c1/c2/c3 fields
    const c1c2c3ValidationResult = this.validateC1C2C3Fields(frontMatter);
    if (c1c2c3ValidationResult.kind !== "Valid") {
      return c1c2c3ValidationResult;
    }

    const { c1, c2, c3 } = c1c2c3ValidationResult.fields;

    // Step 3: Apply schema analysis
    const analysisResult = await this.schemaAnalyzer.analyze(
      frontMatter,
      commandSchema,
    );
    if (!analysisResult.ok) {
      return { kind: "SchemaAnalysisError", error: analysisResult.error };
    }

    // Step 4: Apply template mapping
    const schemaMode: SchemaValidationMode = {
      kind: "WithSchema",
      schema: commandSchema.getDefinition().getValue(),
    };
    const mappingResult = this.templateMapper.map(
      analysisResult.data,
      commandTemplate,
      schemaMode,
    );
    if (!mappingResult.ok) {
      return { kind: "TemplateMappingError", error: mappingResult.error };
    }

    // Step 5: Build Command object
    const command: Command = {
      c1,
      c2,
      c3,
      options: this.extractOptions(frontMatter, analysisResult.data),
      sourcePath: document.getPath().getValue(),
      originalFrontMatter: frontMatter.toObject() as Record<string, unknown>,
    };

    return { kind: "Success", command };
  }

  /**
   * Processes multiple documents in parallel for Stage 1
   */
  async processDocuments(
    documents: Document[],
    commandSchema: Schema,
    commandTemplate: Template,
  ): Promise<{
    successful: Command[];
    failed: Array<{
      documentPath: string;
      error: Exclude<CommandProcessingResult, { kind: "Success" }>;
    }>;
  }> {
    const results = await Promise.all(
      documents.map(async (document) => ({
        document,
        result: await this.processDocument(
          document,
          commandSchema,
          commandTemplate,
        ),
      })),
    );

    const successful: Command[] = [];
    const failed: Array<
      {
        documentPath: string;
        error: Exclude<CommandProcessingResult, { kind: "Success" }>;
      }
    > = [];

    for (const { document, result } of results) {
      if (result.kind === "Success") {
        successful.push(result.command);
      } else {
        failed.push({
          documentPath: document.getPath().getValue(),
          error: result,
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Extract frontmatter using existing service
   */
  private async extractFrontMatter(
    document: Document,
  ): Promise<
    Result<FrontMatterExtractionResult, DomainError & { message: string }>
  > {
    return await this.frontMatterExtractor.extract(document);
  }

  /**
   * Validate that required c1/c2/c3 fields exist in frontmatter
   */
  private validateC1C2C3Fields(
    frontMatter: FrontMatter,
  ):
    | { kind: "Valid"; fields: { c1: string; c2: string; c3: string } }
    | {
      kind: "MissingC1C2C3";
      missingFields: string[];
      frontMatter: Record<string, unknown>;
    } {
    const data = frontMatter.toObject() as Record<string, unknown>;
    const missingFields: string[] = [];

    const c1 = data.c1;
    const c2 = data.c2;
    const c3 = data.c3;

    if (!c1 || typeof c1 !== "string") missingFields.push("c1");
    if (!c2 || typeof c2 !== "string") missingFields.push("c2");
    if (!c3 || typeof c3 !== "string") missingFields.push("c3");

    if (missingFields.length > 0) {
      return {
        kind: "MissingC1C2C3",
        missingFields,
        frontMatter: data,
      };
    }

    return {
      kind: "Valid",
      fields: { c1: c1 as string, c2: c2 as string, c3: c3 as string },
    };
  }

  /**
   * Extract additional options from frontmatter and analysis results
   */
  private extractOptions(
    frontMatter: FrontMatter,
    extractedData: ExtractedData,
  ): Record<string, unknown> {
    const frontMatterData = frontMatter.toObject() as Record<string, unknown>;
    const analysisData = extractedData.getData();

    // Combine frontmatter options with analyzed data
    // Exclude c1/c2/c3 as they are handled separately
    const options: Record<string, unknown> = {};

    // Add non-c1/c2/c3 frontmatter fields
    for (const [key, value] of Object.entries(frontMatterData)) {
      if (!["c1", "c2", "c3"].includes(key)) {
        options[key] = value;
      }
    }

    // Add analyzed data (excluding c1/c2/c3)
    if (typeof analysisData === "object" && analysisData !== null) {
      for (const [key, value] of Object.entries(analysisData)) {
        if (!["c1", "c2", "c3"].includes(key)) {
          options[key] = value;
        }
      }
    }

    return options;
  }
}
