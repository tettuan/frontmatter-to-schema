/**
 * UnifiedTemplateMapperAdapter - Adapter for UnifiedTemplateProcessor to implement TemplateMapper interface
 *
 * This adapter bridges the gap between:
 * - Domain service interface (TemplateMapper)
 * - Domain implementation (UnifiedTemplateProcessor)
 *
 * Following DDD patterns:
 * - Adapter pattern for interface compatibility
 * - Infrastructure layer adapter (not domain layer)
 * - Maintains separation of concerns
 */

import {
  type ExtractedData,
  MappedData,
  type Template,
} from "../../domain/models/entities.ts";
import type { DomainError, Result } from "../../domain/core/result.ts";
import type {
  SchemaValidationMode,
  TemplateMapper,
} from "../../domain/services/interfaces.ts";
import {
  type TemplateProcessingContext,
  type TemplateProcessingResult,
  TemplateProcessorFactory,
  type UnifiedTemplateProcessor,
} from "../../domain/template/unified-template-processor.ts";
import { createDomainError } from "../../domain/core/result.ts";

/**
 * Type guard for UnifiedTemplateProcessor
 * Eliminates type assertions following Totality principles
 */
function isUnifiedTemplateProcessor(
  value: unknown,
): value is UnifiedTemplateProcessor {
  return value !== null &&
    typeof value === "object" &&
    "process" in value &&
    typeof (value as { process?: unknown }).process === "function";
}

/**
 * Type guard for TemplateProcessingResult
 * Eliminates type assertions following Totality principles
 */
function isTemplateProcessingResult(
  value: unknown,
): value is TemplateProcessingResult {
  return value !== null &&
    typeof value === "object" &&
    "kind" in value &&
    "content" in value &&
    "statistics" in value;
}

/**
 * Adapter that wraps UnifiedTemplateProcessor to implement TemplateMapper interface
 */
export class UnifiedTemplateMapperAdapter implements TemplateMapper {
  private processor: UnifiedTemplateProcessor | null = null;

  constructor() {
    // Initialize processor lazily
  }

  /**
   * Initialize the processor if not already initialized
   */
  private ensureProcessor(): UnifiedTemplateProcessor {
    if (!this.processor) {
      const result = TemplateProcessorFactory.createSchemaProcessor();
      if (this.isDomainError(result)) {
        throw new Error(`Failed to create processor: ${result.message}`);
      }
      if (!isUnifiedTemplateProcessor(result)) {
        throw new Error("Factory returned invalid processor type");
      }
      this.processor = result;
    }
    if (!isUnifiedTemplateProcessor(this.processor)) {
      throw new Error("Processor is not a valid UnifiedTemplateProcessor");
    }
    return this.processor;
  }

  /**
   * Map extracted data to template using UnifiedTemplateProcessor
   */
  map(
    data: ExtractedData,
    template: Template,
    schemaMode: SchemaValidationMode,
  ): Result<MappedData, DomainError & { message: string }> {
    try {
      const processor = this.ensureProcessor();

      // Convert ExtractedData to plain object for processing
      const dataObject = this.extractedDataToObject(data);

      // Convert Template to template string
      const templateContent = this.templateToString(template);

      // Create processing context based on schema mode
      const context = this.createProcessingContext(dataObject, schemaMode);

      // Process the template
      const result = processor.process(templateContent, context);

      // Handle processing result
      if (this.isDomainError(result)) {
        return {
          ok: false,
          error: result,
        };
      }

      // Convert result to MappedData
      if (!isTemplateProcessingResult(result)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: String(result),
            expectedFormat: "TemplateProcessingResult",
          }, "Invalid processing result format"),
        };
      }
      const processedResult = result;
      const mappedData = this.createMappedData(
        processedResult.content,
        data,
        template,
      );

      return {
        ok: true,
        data: mappedData,
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "TemplateMappingFailed",
            template,
            source: data,
          },
          `Template mapping failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Convert ExtractedData to plain object
   */
  private extractedDataToObject(data: ExtractedData): Record<string, unknown> {
    // ExtractedData has a getData() method that returns the actual data
    return data.getData();
  }

  /**
   * Convert Template to string content
   */
  private templateToString(template: Template): string {
    // Template has getFormat() method that returns TemplateFormat
    // TemplateFormat has getTemplate() method that returns the template string
    const format = template.getFormat();
    return format.getTemplate();
  }

  /**
   * Create processing context based on schema validation mode
   */
  private createProcessingContext(
    data: Record<string, unknown>,
    schemaMode: SchemaValidationMode,
  ): TemplateProcessingContext {
    switch (schemaMode.kind) {
      case "WithSchema":
        return {
          kind: "SchemaGuided",
          data,
          schema: schemaMode.schema as {
            properties: Record<string, unknown>;
            required?: string[];
          },
          strictMode: true,
        };
      case "NoSchema":
        return {
          kind: "SimpleReplacement",
          data,
          placeholderPattern: "mustache",
        };
      default: {
        // Exhaustive check
        const _exhaustive: never = schemaMode;
        throw new Error(`Unhandled schema mode: ${_exhaustive}`);
      }
    }
  }

  /**
   * Create MappedData from processing result
   */
  private createMappedData(
    content: string,
    _originalData: ExtractedData,
    _template: Template,
  ): MappedData {
    // Try to parse content as JSON if it looks like JSON
    let result: Record<string, unknown>;
    if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(content);
        result = typeof parsed === "object" && parsed !== null
          ? parsed
          : { content: parsed };
      } catch {
        result = { content };
      }
    } else {
      result = { content };
    }

    // Create MappedData using the static create method
    return MappedData.create(result);
  }

  /**
   * Type guard for DomainError
   */
  private isDomainError(
    value: unknown,
  ): value is DomainError & { message: string } {
    return value !== null &&
      typeof value === "object" &&
      "kind" in value &&
      "message" in value;
  }
}

/**
 * Factory function for creating the adapter
 */
export function createUnifiedTemplateMapperAdapter(): TemplateMapper {
  return new UnifiedTemplateMapperAdapter();
}
