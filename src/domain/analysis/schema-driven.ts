/**
 * Schema-driven analysis engine with template mapping capabilities
 *
 * This module re-exports components from individual service modules
 * for backward compatibility while maintaining better code organization.
 */

// Type guard utility - shared across services
export function isValidRecordData(
  data: unknown,
): data is Record<string, unknown> {
  return typeof data === "object" &&
    data !== null &&
    !Array.isArray(data);
}

// Re-export schema analyzer components
export {
  GenericSchemaAnalyzer,
  TotalGenericSchemaAnalyzer,
  type TotalSchemaBasedAnalyzer,
} from "./services/schema-analyzer.service.ts";

// Re-export template mapper components
export {
  SchemaGuidedTemplateMapper,
  TotalSchemaGuidedTemplateMapper,
  type TotalTemplateMapper,
} from "./services/template-mapper.service.ts";

// Re-export schema processor components
export { SchemaAnalysisProcessor } from "./services/schema-processor.service.ts";

// Re-export factory components
export { SchemaAnalysisFactory } from "./services/analysis-factory.service.ts";
