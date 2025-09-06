/**
 * Analysis Engine Index - Re-exports all analysis engine components
 *
 * This index provides backward compatibility after splitting analysis-engine.ts
 * into smaller, focused files for AI complexity control compliance.
 */

// Core interfaces and types
export * from "../analysis-interfaces.ts";

// Core engine implementations
export {
  GenericAnalysisEngine,
  RobustSchemaAnalyzer,
} from "../analysis-engine-core.ts";

// Template mapping implementation
export { RobustTemplateMapper } from "../analysis-template-mapper.ts";

// Context processors and strategies
export {
  AnalysisStrategies,
  ContextualAnalysisProcessor,
  FrontMatterExtractionStrategy,
  SchemaMappingStrategy,
} from "../analysis-processors-strategies.ts";
