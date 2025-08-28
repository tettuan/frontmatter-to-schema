/**
 * Template Processing Strategies
 *
 * Implements strategy pattern for different template processing approaches
 * Following the principle from AI domain template:
 * - Primary: AI-based processing (Claude)
 * - Fallback: Native TypeScript processing
 */

import type { DomainError, Result } from "../core/result.ts";
import {
  createDomainError,
  createProcessingStageError,
} from "../core/result.ts";
import type { Template } from "../models/entities.ts";
import type { TemplateApplicationContext } from "./aggregate.ts";

// Re-export for external use
export type { TemplateApplicationContext };
import { TemplateFormatHandlerFactory } from "./format-handlers.ts";
import {
  type PlaceholderProcessingContext,
  PlaceholderProcessor,
} from "./placeholder-processor.ts";
import { StructuredLogger } from "../shared/logger.ts";

/**
 * Strategy interface for template processing
 */
export interface TemplateProcessingStrategy {
  /**
   * Process a template with the given context
   */
  process(
    template: Template,
    context: TemplateApplicationContext,
  ): Promise<Result<string, DomainError>>;

  /**
   * Check if this strategy can handle the given template
   */
  canHandle(template: Template): boolean;

  /**
   * Get strategy name for logging/debugging
   */
  getName(): string;
}

/**
 * Native TypeScript template processing strategy (Fallback)
 * Processes templates using shared common infrastructure
 * Updated to use TemplateFormatHandler and PlaceholderProcessor
 */
export class NativeTemplateStrategy implements TemplateProcessingStrategy {
  private readonly placeholderProcessor: PlaceholderProcessor;

  constructor() {
    this.placeholderProcessor = new PlaceholderProcessor();
  }

  process(
    template: Template,
    context: TemplateApplicationContext,
  ): Promise<Result<string, DomainError>> {
    const format = template.getFormat().getFormat();

    // Check if this strategy can handle the template format
    if (!this.canHandle(template)) {
      return Promise.resolve({
        ok: false,
        error: createDomainError(
          { kind: "UnsupportedAnalysisType", type: format },
          `NativeTemplateStrategy cannot handle format: ${format}`,
        ),
      });
    }

    try {
      // Get appropriate format handler from factory
      const handlerResult = TemplateFormatHandlerFactory.getHandler(format);
      if (!handlerResult.ok) {
        return Promise.resolve({
          ok: false,
          error: createDomainError(
            { kind: "UnsupportedAnalysisType", type: format },
            `Unsupported template format for native processing: ${format}. ${handlerResult.error.message}`,
          ),
        });
      }

      const handler = handlerResult.data;
      const templateContent = template.getFormat().getTemplate();

      // Parse template using format handler
      const parseResult = handler.parse(templateContent);
      if (!parseResult.ok) {
        return Promise.resolve({
          ok: false,
          error: createDomainError(
            {
              kind: "ParseError",
              input: "template",
              details: parseResult.error.message,
            },
            `Failed to parse template: ${parseResult.error.message}`,
          ),
        });
      }

      // Validate that extractedData is an object for placeholder processing
      if (
        context.extractedData === null || context.extractedData === undefined ||
        typeof context.extractedData !== "object" ||
        Array.isArray(context.extractedData)
      ) {
        return Promise.resolve({
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: typeof context.extractedData,
              expectedFormat: "object",
            },
            `Template processing requires extractedData to be an object, received: ${typeof context
              .extractedData}`,
          ),
        });
      }

      // Process placeholders using unified processor
      const placeholderContext: PlaceholderProcessingContext = {
        data: context.extractedData as Record<string, unknown>,
        patternType: "mustache", // Default to mustache style
        strictMode: false, // Allow partial replacements
      };

      const placeholderResult = this.placeholderProcessor.process(
        parseResult.data,
        placeholderContext,
      );

      if (!placeholderResult.ok) {
        return Promise.resolve({
          ok: false,
          error: createProcessingStageError(
            "placeholder processing",
            {
              kind: "InvalidResponse",
              service: "placeholder processor",
              response: placeholderResult.error.message,
            } as DomainError,
            `Placeholder processing failed: ${placeholderResult.error.message}`,
          ),
        });
      }

      const processResult = placeholderResult.data;

      // Handle processing results based on kind
      let processedData: unknown;
      switch (processResult.kind) {
        case "Success":
          processedData = processResult.processedContent;
          break;
        case "PartialSuccess": {
          // Log warning for missing placeholders but continue
          const logger = StructuredLogger.getStageLogger("native-strategy");
          logger.warn(
            "Template processing completed with missing placeholders",
            {
              missingPlaceholders: processResult.missingPlaceholders,
            },
          );
          processedData = processResult.processedContent;
          break;
        }
        case "Failure":
          return Promise.resolve({
            ok: false,
            error: createProcessingStageError(
              "placeholder processing",
              {
                kind: "InvalidResponse",
                service: "placeholder processor",
                response: processResult.error.message,
              } as DomainError,
              `Placeholder processing failed: ${processResult.error.message}`,
            ),
          });
      }

      // Serialize result using format handler
      const serializeResult = handler.serialize(processedData);
      if (!serializeResult.ok) {
        return Promise.resolve({
          ok: false,
          error: createProcessingStageError(
            "template serialization",
            {
              kind: "InvalidResponse",
              service: "template serializer",
              response: serializeResult.error.message,
            } as DomainError,
            `Failed to serialize processed template: ${serializeResult.error.message}`,
          ),
        });
      }

      return Promise.resolve({
        ok: true,
        data: serializeResult.data,
      });
    } catch (error) {
      return Promise.resolve({
        ok: false,
        error: createProcessingStageError(
          "native template processing",
          {
            kind: "InvalidResponse",
            service: "native",
            response: error instanceof Error ? error.message : String(error),
          } as DomainError,
          `Native template processing failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      });
    }
  }

  canHandle(template: Template): boolean {
    const format = template.getFormat().getFormat();
    // Native strategy can handle json, yaml, and custom formats
    return ["json", "yaml", "custom"].includes(format);
  }

  getName(): string {
    return "NativeTemplateStrategy";
  }

  // Removed duplicate methods that are now handled by shared infrastructure:
  // - processJsonTemplate: replaced by TemplateFormatHandlerFactory
  // - processYamlTemplate: replaced by TemplateFormatHandlerFactory
  // - processCustomTemplate: replaced by TemplateFormatHandlerFactory
  // - applyDataToTemplate: replaced by PlaceholderProcessor
  // - getValueByPath: replaced by PlaceholderProcessor
  // - convertToYaml: replaced by YAMLTemplateHandler
  // - dataToYaml: replaced by YAMLTemplateHandler
}
