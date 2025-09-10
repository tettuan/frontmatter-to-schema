/**
 * Schema Guided Processor - Domain Service
 * Handles schema-guided template processing
 * Part of Template Context - Domain Layer
 * Follows Totality principles with Result types
 */

import type {
  ProcessingStatistics,
  TemplateProcessingContext,
  TemplateProcessingResult,
} from "../models/template-processing-types.ts";
import {
  applyDataToTemplate,
  parseTemplateStructure,
} from "./template-utils.service.ts";

/**
 * Domain service for schema-guided processing
 * Consolidates TemplateMapper logic with schema validation
 */
export class SchemaGuidedProcessor {
  /**
   * Process template with schema guidance
   */
  static process(
    content: string,
    context: Extract<TemplateProcessingContext, { kind: "SchemaGuided" }>,
  ): TemplateProcessingResult {
    // Apply schema-guided processing (consolidate from TemplateMapper)
    const result = applyDataToTemplate(
      context.data,
      parseTemplateStructure(content),
      context.data,
    );

    // Convert result to string format
    let resultContent: string;
    if (typeof result === "string") {
      resultContent = result;
    } else {
      // Serialize objects back to JSON
      resultContent = JSON.stringify(result);
    }

    const statistics: ProcessingStatistics = {
      replacedVariables: [],
      totalReplacements: 0,
      processingTimeMs: 0,
    };

    return {
      kind: "Success",
      content: resultContent,
      statistics,
    };
  }
}
