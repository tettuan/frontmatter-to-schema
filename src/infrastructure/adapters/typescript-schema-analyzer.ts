/**
 * TypeScript Schema Analyzer Adapter
 * Replaces ClaudeSchemaAnalyzer with TypeScript implementation
 * Implements the SchemaAnalyzerPort interface
 */

import type { Result } from "../../domain/core/result.ts";
import {
  createError,
  type ProcessingError,
} from "../../domain/shared/types.ts";
import {
  ExtractedData,
  type FrontMatter,
  type Schema,
} from "../../domain/models/entities.ts";
import type { SchemaAnalyzer } from "../../domain/services/interfaces.ts";
import type {
  FrontMatterContent,
  SchemaDefinition,
} from "../../domain/core/types.ts";
import { LoggerFactory } from "../../domain/shared/logging/logger.ts";

import {
  type ProcessingRequest,
  TypeScriptProcessingOrchestrator,
} from "../../domain/core/TypeScriptProcessingOrchestrator.ts";

export class TypeScriptSchemaAnalyzer implements SchemaAnalyzer {
  private readonly orchestrator: TypeScriptProcessingOrchestrator;
  private readonly logger = LoggerFactory.createLogger(
    "typescript-schema-analyzer",
  );

  constructor() {
    this.orchestrator = new TypeScriptProcessingOrchestrator();
  }

  async analyze(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Promise<Result<ExtractedData, ProcessingError & { message: string }>> {
    const verboseMode = Deno.env.get("FRONTMATTER_VERBOSE_MODE") === "true";

    try {
      // Get the underlying content from domain entities
      // Note: Type casting needed due to duplicate FrontMatterContent classes
      const frontMatterContent = frontMatter
        .getContent() as unknown as FrontMatterContent;
      const schemaDefinition = schema
        .getDefinition() as unknown as SchemaDefinition<unknown>;

      if (verboseMode) {
        this.logger.info("Starting TypeScript-based frontmatter analysis");
        this.logger.debug("Frontmatter content keys", {
          keys: frontMatterContent.keys().join(", "),
        });
      }

      // Create a dummy template since we're just extracting and mapping data
      const dummyTemplate = JSON.stringify(schemaDefinition.schema, null, 2);

      // Convert frontmatter to YAML-like content
      const frontmatterContentStr = frontMatterContent.keys()
        .map((key: string) =>
          `${key}: ${JSON.stringify(frontMatterContent.get(key))}`
        )
        .join("\n");

      const processingRequest: ProcessingRequest = {
        content: `---\n${frontmatterContentStr}\n---\nDummy content`,
        schema: schemaDefinition.schema,
        templateContent: dummyTemplate,
        options: {
          verbose: verboseMode,
          templateOptions: {
            handleMissingRequired: "warning",
            handleMissingOptional: "empty",
          },
        },
      };

      // Validate request
      const validationResult = this.orchestrator.validateRequest(
        processingRequest,
      );
      if (!validationResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "AnalysisFailed",
            document: "unknown",
            reason: validationResult.error.message,
          }),
        };
      }

      // Process using TypeScript orchestrator
      const processingResult = await this.orchestrator.process(
        processingRequest,
      );
      if (!processingResult.ok) {
        if (verboseMode) {
          this.logger.error("TypeScript processing failed", {
            error: processingResult.error.message,
          });
        }

        return {
          ok: false,
          error: createError({
            kind: "AnalysisFailed",
            document: "unknown",
            reason: processingResult.error.message,
          }),
        };
      }

      const result = processingResult.data;

      if (verboseMode) {
        this.logger.info("TypeScript analysis completed successfully");
        this.logger.debug("Analysis results", {
          matchesFound: result.mappedData.matches.length,
          warnings: result.warnings.length,
        });

        // Log warnings if any
        if (result.warnings.length > 0) {
          this.logger.warn("Analysis completed with warnings", {
            warnings: result.warnings,
          });
        }
      }

      // Convert the mapped schema data to ExtractedData format
      const extractedData = ExtractedData.create(
        result.mappedData.schemaCompliantData,
      );

      return {
        ok: true,
        data: extractedData,
      };
    } catch (error) {
      if (verboseMode) {
        this.logger.error("Unexpected error in TypeScript analysis", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return {
        ok: false,
        error: createError({
          kind: "AnalysisFailed",
          document: "unknown",
          reason: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  /**
   * Get processing statistics for monitoring and debugging
   */
  getProcessingStats(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Result<ProcessingStats, ProcessingError> {
    try {
      // Get the underlying schema definition
      const schemaDefinition = schema
        .getDefinition() as unknown as SchemaDefinition<unknown>;

      // Expand schema to get properties count
      const schemaExpansionResult = this.orchestrator.expandSchema(
        schemaDefinition.schema,
      );

      if (!schemaExpansionResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "AnalysisFailed",
            document: "unknown",
            reason: schemaExpansionResult.error.message,
          }),
        };
      }

      const schemaProperties = schemaExpansionResult.data;
      const requiredProperties = schemaProperties.filter((p) => p.required);

      // Get frontmatter key count
      const frontMatterContent = frontMatter
        .getContent() as unknown as FrontMatterContent;
      const frontMatterKeys = frontMatterContent.keys();

      const stats: ProcessingStats = {
        schemaPropertiesCount: schemaProperties.length,
        requiredPropertiesCount: requiredProperties.length,
        frontMatterKeysCount: frontMatterKeys.length,
        processingMethod: "typescript",
      };

      return {
        ok: true,
        data: stats,
      };
    } catch (error) {
      return {
        ok: false,
        error: createError({
          kind: "AnalysisFailed",
          document: "unknown",
          reason: error instanceof Error
            ? error.message
            : "Failed to get processing stats",
        }),
      };
    }
  }
}

export interface ProcessingStats {
  readonly schemaPropertiesCount: number;
  readonly requiredPropertiesCount: number;
  readonly frontMatterKeysCount: number;
  readonly processingMethod: "typescript" | "claude";
}
