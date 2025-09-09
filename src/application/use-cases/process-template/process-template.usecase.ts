/**
 * Process Template Use Case
 *
 * Responsible for transforming validated frontmatter data through templates
 * Part of the Template Context in DDD architecture
 * Follows Totality principles with Result types
 */

import type { UseCase } from "../base.usecase.ts";
import type { DomainError, Result } from "../../../domain/core/result.ts";
import { createDomainError } from "../../../domain/core/result.ts";
import {
  ExtractedData,
  type MappedData,
  type Template,
} from "../../../domain/models/entities.ts";
import type {
  SchemaValidationMode,
  TemplateMapper,
} from "../../../domain/services/interfaces.ts";
import { UnifiedTemplateMapperAdapter } from "../../../infrastructure/adapters/unified-template-mapper-adapter.ts";

/**
 * Input for template processing
 */
export interface ProcessTemplateInput {
  /**
   * Validated frontmatter data to be transformed
   */
  data: Record<string, unknown>;
  /**
   * Template to apply for transformation
   */
  template: Template;
  /**
   * Schema validation mode for template processing
   */
  schemaMode?: SchemaValidationMode;
  /**
   * File path for context and debugging
   */
  filePath?: string;
}

/**
 * Output from template processing
 */
export interface ProcessTemplateOutput {
  /**
   * Template-transformed data
   */
  transformedData: MappedData;
  /**
   * Original extracted data for reference
   */
  originalData: ExtractedData;
  /**
   * Processing metadata
   */
  metadata: {
    templateApplied: string;
    transformationTime: number;
    filePath?: string;
  };
}

/**
 * Process Template Use Case Implementation
 * Handles transformation of validated data through templates
 */
export class ProcessTemplateUseCase
  implements UseCase<ProcessTemplateInput, ProcessTemplateOutput> {
  private readonly templateMapper: TemplateMapper;

  constructor(templateMapper?: TemplateMapper) {
    // Use dependency injection or default to UnifiedTemplateMapperAdapter
    this.templateMapper = templateMapper ?? new UnifiedTemplateMapperAdapter();
  }

  async execute(
    input: ProcessTemplateInput,
  ): Promise<
    Result<ProcessTemplateOutput, DomainError & { message: string }>
  > {
    const startTime = Date.now();

    try {
      // Validate input data
      if (!input.data || typeof input.data !== "object") {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: typeof input.data,
              expectedFormat: "object",
            },
            "Template processing data must be a valid object",
          ),
        };
      }

      if (!input.template) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "EmptyInput",
            },
            "Template is required for processing",
          ),
        };
      }

      // Create ExtractedData from the validated frontmatter
      const extractedData = this.createExtractedData(
        input.data,
        input.filePath,
      );

      // Use default schema validation mode if not provided
      const schemaMode = input.schemaMode ?? { kind: "WithSchema", schema: {} };

      // Transform data through template
      const mappingResult = await Promise.resolve(this.templateMapper.map(
        extractedData,
        input.template,
        schemaMode,
      ));

      if (!mappingResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "TemplateMappingFailed",
              template: input.template,
              source: extractedData,
            },
            `Template processing failed: ${mappingResult.error.message}`,
          ),
        };
      }

      const processingTime = Date.now() - startTime;

      return {
        ok: true,
        data: {
          transformedData: mappingResult.data,
          originalData: extractedData,
          metadata: {
            templateApplied: this.getTemplateDescription(input.template),
            transformationTime: processingTime,
            filePath: input.filePath,
          },
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ProcessingStageError",
            stage: "TemplateProcessing",
            error: {
              kind: "InvalidResponse",
              service: "template-processor",
              response: error instanceof Error ? error.message : String(error),
            },
          },
          `Template processing failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Create ExtractedData from raw data
   * Following current API patterns (to be refactored to Result pattern later)
   */
  private createExtractedData(
    data: Record<string, unknown>,
    _filePath?: string,
  ): ExtractedData {
    // Current ExtractedData.create doesn't return Result type yet
    // Future refactoring will make this follow Smart Constructor pattern
    return ExtractedData.create(data);
  }

  /**
   * Get human-readable template description
   */
  private getTemplateDescription(template: Template): string {
    // Extract meaningful description from template
    if (
      template.getDescription && typeof template.getDescription === "function"
    ) {
      return template.getDescription();
    }

    // Fallback to template identifier if available
    if (template.getId && typeof template.getId === "function") {
      return template.getId().getValue();
    }

    return "unknown-template";
  }
}
