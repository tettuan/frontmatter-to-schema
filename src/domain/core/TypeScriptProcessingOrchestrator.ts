/**
 * TypeScript Processing Orchestrator
 */

import type { Result } from "./result.ts";
import {
  createValidationError,
  type ValidationError,
} from "../shared/errors.ts";
import { LoggerFactory } from "../shared/logging/logger.ts";

import {
  type FrontMatterData,
  TypeScriptFrontMatterExtractor,
} from "../frontmatter/TypeScriptExtractor.ts";
import {
  type MappedSchemaData,
  type SchemaProperty,
  TypeScriptSchemaMatcher,
} from "../schema/TypeScriptSchemaMatcher.ts";
import {
  type ProcessedTemplate,
  type TemplateProcessingOptions,
  TypeScriptTemplateProcessor,
} from "../template/TypeScriptTemplateProcessor.ts";

export interface ProcessingRequest {
  readonly content: string;
  readonly schema: unknown;
  readonly templateContent: string;
  readonly options?: ProcessingOptions;
}

export interface ProcessingOptions {
  readonly templateOptions?: Partial<TemplateProcessingOptions>;
  readonly verbose?: boolean;
  readonly skipValidation?: boolean;
}

export interface ProcessingResult {
  readonly processedTemplate: ProcessedTemplate;
  readonly mappedData: MappedSchemaData;
  readonly schemaProperties: SchemaProperty[];
  readonly frontMatterData: FrontMatterData;
  readonly warnings: string[];
}

export class TypeScriptProcessingOrchestrator {
  private readonly frontMatterExtractor: TypeScriptFrontMatterExtractor;
  private readonly schemaMatcher: TypeScriptSchemaMatcher;
  private readonly templateProcessor: TypeScriptTemplateProcessor;

  constructor() {
    this.frontMatterExtractor = new TypeScriptFrontMatterExtractor();
    this.schemaMatcher = new TypeScriptSchemaMatcher();
    this.templateProcessor = new TypeScriptTemplateProcessor();
  }

  /**
   * Main processing pipeline - replaces Claude -p workflow
   * Implements the 3-phase architecture: Extract -> Match -> Template
   */
  process(
    request: ProcessingRequest,
  ): Promise<Result<ProcessingResult, ValidationError>> {
    const logger = LoggerFactory.createLogger("typescript-orchestrator");
    const verbose = request.options?.verbose || false;
    const warnings: string[] = [];

    try {
      if (verbose) {
        logger.info("Starting TypeScript processing pipeline");
      }

      // Phase 1: Frontmatter Extraction
      if (verbose) {
        logger.info("Phase 1: Extracting frontmatter");
      }

      const extractionResult = this.frontMatterExtractor.extract(
        request.content,
      );
      if (!extractionResult.ok) {
        return Promise.resolve({
          ok: false,
          error: createValidationError(
            `Frontmatter extraction failed: ${extractionResult.error.message}`,
          ),
        });
      }

      const frontMatterData = extractionResult.data;
      if (verbose) {
        logger.debug("Frontmatter extracted", {
          keysFound: Object.keys(frontMatterData.data).length,
        });
      }

      // Phase 2: Schema Mapping
      if (verbose) {
        logger.info("Phase 2: Mapping frontmatter to schema");
      }

      const mappingResult = this.schemaMatcher.mapToSchema(
        frontMatterData,
        request.schema,
      );
      if (!mappingResult.ok) {
        return Promise.resolve({
          ok: false,
          error: createValidationError(
            `Schema mapping failed: ${mappingResult.error.message}`,
          ),
        });
      }

      const mappedData = mappingResult.data;
      if (verbose) {
        logger.debug("Schema mapping completed", {
          matches: mappedData.matches.length,
          unmatchedKeys: mappedData.unmatchedKeys.length,
          missingRequired: mappedData.missingRequiredKeys.length,
        });
      }

      // Add warnings for unmatched keys and missing required keys
      if (mappedData.unmatchedKeys.length > 0) {
        warnings.push(
          `Unmatched frontmatter keys: ${mappedData.unmatchedKeys.join(", ")}`,
        );
      }

      if (mappedData.missingRequiredKeys.length > 0) {
        warnings.push(
          `Missing required schema properties: ${
            mappedData.missingRequiredKeys.join(", ")
          }`,
        );
      }

      // Get schema properties for metadata
      const schemaExpansionResult = this.schemaMatcher.expandSchema(
        request.schema,
      );
      if (!schemaExpansionResult.ok) {
        return Promise.resolve({
          ok: false,
          error: createValidationError(
            `Schema expansion failed: ${schemaExpansionResult.error.message}`,
          ),
        });
      }
      const schemaProperties = schemaExpansionResult.data;

      // Phase 3: Template Processing
      if (verbose) {
        logger.info("Phase 3: Processing template variables");
      }

      const templateResult = this.templateProcessor.processTemplate(
        request.templateContent,
        mappedData,
        request.options?.templateOptions,
      );

      if (!templateResult.ok) {
        return Promise.resolve({
          ok: false,
          error: createValidationError(
            `Template processing failed: ${templateResult.error.message}`,
          ),
        });
      }

      const processedTemplate = templateResult.data;
      if (verbose) {
        logger.debug("Template processing completed", {
          replacedVariables: processedTemplate.replacedVariables.length,
          unresolvedVariables: processedTemplate.unresolvedVariables.length,
        });
      }

      // Add warnings for unresolved template variables
      if (processedTemplate.unresolvedVariables.length > 0) {
        warnings.push(
          `Unresolved template variables: ${
            processedTemplate.unresolvedVariables.join(", ")
          }`,
        );
      }

      if (processedTemplate.missingRequiredVariables.length > 0) {
        warnings.push(
          `Missing required template variables: ${
            processedTemplate.missingRequiredVariables.join(", ")
          }`,
        );
      }

      const result: ProcessingResult = {
        processedTemplate,
        mappedData,
        schemaProperties,
        frontMatterData,
        warnings,
      };

      if (verbose) {
        logger.info("TypeScript processing pipeline completed successfully", {
          warningsCount: warnings.length,
        });
      }

      return Promise.resolve({
        ok: true,
        data: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      logger.error("Unexpected error in TypeScript processing pipeline", {
        error: errorMessage,
      });

      return Promise.resolve({
        ok: false,
        error: createValidationError(
          `Processing pipeline failed: ${errorMessage}`,
        ),
      });
    }
  }

  /**
   * Validate that the processing request is well-formed
   */
  validateRequest(request: ProcessingRequest): Result<void, ValidationError> {
    if (!request.content || typeof request.content !== "string") {
      return {
        ok: false,
        error: createValidationError("Content must be a non-empty string"),
      };
    }

    if (!request.schema || typeof request.schema !== "object") {
      return {
        ok: false,
        error: createValidationError("Schema must be an object"),
      };
    }

    if (
      !request.templateContent || typeof request.templateContent !== "string"
    ) {
      return {
        ok: false,
        error: createValidationError(
          "Template content must be a non-empty string",
        ),
      };
    }

    return { ok: true, data: undefined };
  }

  /**
   * Extract template variables from template content
   * Utility method for external usage
   */
  extractTemplateVariables(
    templateContent: string,
  ): Result<string[], ValidationError> {
    return this.frontMatterExtractor.extractTemplateVariables(templateContent);
  }

  /**
   * Expand schema into flat properties
   * Utility method for external usage
   */
  expandSchema(schema: unknown): Result<SchemaProperty[], ValidationError> {
    return this.schemaMatcher.expandSchema(schema);
  }
}
