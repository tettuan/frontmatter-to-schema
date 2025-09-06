/**
 * Core Analysis Engine - Backward Compatibility Re-exports
 *
 * This file maintains backward compatibility after splitting the original
 * large analysis-engine.ts file into smaller, focused modules for AI complexity
 * control compliance (200-line limit).
 *
 * Original file: 804 lines (402% over 200-line limit)
 * Split into 4 files: ~200 lines each for optimal AI cognitive load management
 *
 * Split files:
 * - analysis-interfaces.ts: Core interfaces and type definitions
 * - analysis-engine-core.ts: GenericAnalysisEngine and RobustSchemaAnalyzer
 * - analysis-template-mapper.ts: RobustTemplateMapper implementation
 * - analysis-processors-strategies.ts: Context processors and concrete strategies
 */

export * from "./analysis-engine/index.ts";
