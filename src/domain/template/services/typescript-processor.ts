/**
 * TypeScript Processor - Domain Service
 * Handles TypeScript-specific template processing
 * Part of Template Context - Domain Layer
 * Follows Totality principles with Result types
 */

import type {
  MappedSchemaData,
  ProcessingStatistics,
  TemplateProcessingContext,
  TemplateProcessingOptions,
  TemplateProcessingResult,
} from "../models/template-processing-types.ts";
import { formatValue, getValueByPath } from "./template-utils.service.ts";

/**
 * Domain service for TypeScript template processing
 * Consolidates TypeScriptTemplateProcessor logic
 */
export class TypeScriptProcessor {
  /**
   * Process TypeScript template with mapped data
   */
  static process(
    content: string,
    context: Extract<
      TemplateProcessingContext,
      { kind: "TypeScriptProcessing" }
    >,
    defaultOptions: TemplateProcessingOptions,
  ): TemplateProcessingResult {
    const { mappedData, options } = context;
    const effectiveOptions = { ...defaultOptions, ...options };

    // Implement TypeScript-specific processing logic
    const replacedVariables: string[] = [];
    let processedContent = content;

    // Variable pattern matching from original TypeScriptTemplateProcessor
    const variablePattern = /\$\{([^}]+)\}/g;
    processedContent = content.replace(variablePattern, (match, path) => {
      const value = TypeScriptProcessor.resolveSchemaPath(
        mappedData,
        path.trim(),
      );

      if (value !== undefined) {
        replacedVariables.push(path.trim());
        return formatValue(value, effectiveOptions.arrayFormat);
      }

      // Handle missing variables based on options
      switch (effectiveOptions.handleMissingRequired) {
        case "error":
          return match; // Keep original, will be handled as partial success
        case "warning":
        case "ignore":
        default:
          return "";
      }
    });

    const statistics: ProcessingStatistics = {
      replacedVariables,
      totalReplacements: replacedVariables.length,
      processingTimeMs: 0,
    };

    return {
      kind: "Success",
      content: processedContent,
      statistics,
    };
  }

  private static resolveSchemaPath(
    mappedData: MappedSchemaData,
    path: string,
  ): unknown {
    return getValueByPath(mappedData.data, path);
  }
}
