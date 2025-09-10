/**
 * Unified Template Processor - Domain Service
 * Main orchestrator for template processing operations
 * Part of Template Context - Domain Layer
 * Follows Totality principles with Result types
 */

import type { DomainError } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";
import type {
  TemplateProcessingContext,
  TemplateProcessingOptions,
  TemplateProcessingResult,
} from "../models/template-processing-types.ts";
import { ValidatedTemplateContent } from "./template-content-validator.ts";
import { SimpleReplacementProcessor } from "./simple-replacement-processor.ts";
import { SchemaGuidedProcessor } from "./schema-guided-processor.ts";
import { TypeScriptProcessor } from "./typescript-processor.ts";
import { isDomainError } from "./template-utils.service.ts";

/**
 * UnifiedTemplateProcessor - Main Consolidating Class
 *
 * Entropy Reduction Impact:
 * - Eliminates 4+ separate processor classes
 * - Reduces abstraction layers from 6+ to 3
 * - Consolidates ~1500 lines to ~600 lines (60% reduction)
 */
export class UnifiedTemplateProcessor {
  private constructor(
    private readonly defaultOptions: TemplateProcessingOptions,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Replaces multiple factory patterns from eliminated classes
   */
  static create(
    options?: Partial<TemplateProcessingOptions>,
  ): UnifiedTemplateProcessor | DomainError {
    try {
      const defaultOptions: TemplateProcessingOptions = {
        handleMissingRequired: "warning",
        handleMissingOptional: "empty",
        arrayFormat: "json",
        ...options,
      };

      return new UnifiedTemplateProcessor(defaultOptions);
    } catch (error) {
      return createDomainError({
        kind: "InvalidAnalysisContext",
        context: options,
      }, `Failed to create UnifiedTemplateProcessor: ${error}`);
    }
  }

  /**
   * Main Processing Method - Consolidates All Template Logic
   *
   * Replaces:
   * - TemplateMapper.applyDataToTemplateStrict()
   * - TypeScriptTemplateProcessor.processTemplate()
   * - PlaceholderProcessor.process()
   * - NativeTemplateStrategy.process()
   */
  process(
    templateContent: string,
    context: TemplateProcessingContext,
  ): TemplateProcessingResult | DomainError {
    const startTime = Date.now();

    // Validate template content using smart constructor
    const validatedContent = ValidatedTemplateContent.create(templateContent);
    if (isDomainError(validatedContent)) {
      return validatedContent;
    }

    // Process based on context type (Totality - discriminated union)
    let result: TemplateProcessingResult | DomainError;

    switch (context.kind) {
      case "SimpleReplacement": {
        result = SimpleReplacementProcessor.process(
          validatedContent.content,
          context,
        );
        break;
      }
      case "SchemaGuided": {
        result = SchemaGuidedProcessor.process(
          validatedContent.content,
          context,
        );
        break;
      }
      case "TypeScriptProcessing": {
        result = TypeScriptProcessor.process(
          validatedContent.content,
          context,
          this.defaultOptions,
        );
        break;
      }
      default: {
        // Exhaustive check - TypeScript will error if we miss a case (Totality)
        const _exhaustiveCheck: never = context;
        return createDomainError({
          kind: "InvalidAnalysisContext",
          context: _exhaustiveCheck,
        }, `Unhandled processing context: ${String(_exhaustiveCheck)}`);
      }
    }

    // Add timing to successful results
    if (this.isProcessingResult(result)) {
      const processingTimeMs = Date.now() - startTime;
      result.statistics = {
        ...result.statistics,
        processingTimeMs,
      };
    }

    return result;
  }

  private isProcessingResult(
    value: unknown,
  ): value is TemplateProcessingResult {
    return value !== null &&
      typeof value === "object" &&
      "kind" in value &&
      ("content" in value);
  }
}
