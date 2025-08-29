/**
 * Domain Analysis Component Factory - Issue #431 Resolution
 *
 * Follows DDD principles and AI complexity control:
 * - Single Responsibility: Only creates domain analysis components
 * - Domain Purity: No infrastructure dependencies in domain layer
 * - Explicit Dependencies: Clear component relationships
 * - Entropy Reduction: Eliminates unnecessary abstractions
 */

import type { DomainError, Result } from "./result.ts";

// Core analysis components - direct imports following DDD aggregate pattern
import {
  type AnalysisEngine,
  ContextualAnalysisProcessor,
  GenericAnalysisEngine,
  RobustSchemaAnalyzer,
  RobustTemplateMapper,
} from "./analysis-engine.ts";

/**
 * Analysis Component Aggregate Factory
 *
 * Creates analysis domain components as a cohesive aggregate.
 * Follows DDD principles by keeping domain logic pure and focused.
 */
export class ComponentFactory {
  /**
   * Creates analysis components with explicit dependencies
   *
   * Pure function following Totality principle - no side effects.
   * Infrastructure concerns (logging) moved to application layer.
   */
  createAnalysisComponents(): {
    engine: AnalysisEngine;
    processor: ContextualAnalysisProcessor;
    schemaAnalyzer: RobustSchemaAnalyzer<unknown, unknown>;
    templateMapper: RobustTemplateMapper<unknown, unknown>;
  } {
    // Direct instantiation following DDD aggregate pattern
    const engine = new GenericAnalysisEngine();
    const schemaAnalyzer = new RobustSchemaAnalyzer<unknown, unknown>();
    const templateMapper = new RobustTemplateMapper<unknown, unknown>();

    // Aggregate root construction with clear dependencies
    const processor = new ContextualAnalysisProcessor(
      engine,
      schemaAnalyzer,
      templateMapper,
    );

    return {
      engine,
      processor,
      schemaAnalyzer,
      templateMapper,
    };
  }

  /**
   * Domain invariant validation
   *
   * Returns Result for proper error handling following Totality principle.
   * Domain validation is always valid for this simple factory aggregate.
   */
  validate(): Result<boolean, DomainError & { message: string }> {
    return { ok: true, data: true };
  }
}

/**
 * Default factory instance for application layer use
 *
 * Eliminates complex configuration following AI complexity control principles.
 * Application layer can inject this into use cases as needed.
 */
export const defaultComponentFactory = new ComponentFactory();
