/**
 * UnifiedTemplateProcessor - Legacy Wrapper (Deprecated)
 *
 * This file is being phased out in favor of smaller, specialized processors.
 * Use the new decomposed services in the services/ directory.
 *
 * @deprecated Use services/unified-template-processor.ts and specialized processors instead
 */

// Re-export types and classes from new decomposed structure
export type { PlaceholderPatternType } from "./services/placeholder-pattern.ts";
export type {
  MappedSchemaData,
  ProcessingStatistics,
  SchemaDefinition,
  TemplateProcessingContext,
  TemplateProcessingOptions,
  TemplateProcessingResult,
} from "./models/template-processing-types.ts";

export { PlaceholderPattern } from "./services/placeholder-pattern.ts";
export { ValidatedTemplateContent } from "./services/template-content-validator.ts";
export { UnifiedTemplateProcessor } from "./services/unified-template-processor.ts";
export { TemplateProcessorFactory } from "./services/template-processor-factory.ts";
