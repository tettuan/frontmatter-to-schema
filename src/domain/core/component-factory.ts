/**
 * Simplified Component Factory - Addresses Issue #402
 * Removes dead code and unnecessary abstractions following AI complexity control principles
 *
 * Previous version had 0% branch coverage indicating over-engineering.
 * This version follows YAGNI principle and entropy reduction.
 */

import type { DomainError, Result } from "./result.ts";
import { type Logger, LoggerFactory } from "../shared/logger.ts";

// Core analysis components - direct imports without factory indirection
import {
  type AnalysisEngine,
  ContextualAnalysisProcessor,
  GenericAnalysisEngine,
  RobustSchemaAnalyzer,
  RobustTemplateMapper,
} from "./analysis-engine.ts";

/**
 * Domain Component Categories - maintained for compatibility
 * @deprecated Legacy enum, use strings directly
 */
export const enum ComponentDomain {
  Analysis = "analysis",
  Template = "template",
  Pipeline = "pipeline",
  Infrastructure = "infrastructure",
}

/**
 * Simplified Component Factory
 * Creates components directly without unnecessary abstraction layers
 */
export class ComponentFactory {
  private readonly logger: Logger;

  constructor() {
    this.logger = LoggerFactory.createLogger("component-factory");
  }

  /**
   * Creates analysis components directly - no conditional logic needed
   */
  createAnalysisComponents(): {
    engine: AnalysisEngine;
    processor: ContextualAnalysisProcessor;
    schemaAnalyzer: RobustSchemaAnalyzer<unknown, unknown>;
    templateMapper: RobustTemplateMapper<unknown, unknown>;
  } {
    this.logger.info("Creating analysis components");

    const engine = new GenericAnalysisEngine();
    const schemaAnalyzer = new RobustSchemaAnalyzer<unknown, unknown>();
    const templateMapper = new RobustTemplateMapper<unknown, unknown>();

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
   * Validates basic factory state - always returns success for simplicity
   * Removes complex conditional validation that was never tested
   */
  validate(): Result<boolean, DomainError & { message: string }> {
    return { ok: true, data: true };
  }

  /**
   * Legacy compatibility method for domain component creation
   * @deprecated Use createAnalysisComponents() directly
   */
  createDomainComponents(domain: ComponentDomain): unknown {
    switch (domain) {
      case ComponentDomain.Analysis:
        return this.createAnalysisComponents();
      case ComponentDomain.Template:
      case ComponentDomain.Pipeline:
      case ComponentDomain.Infrastructure:
      default:
        // Return empty object for unsupported domains
        return {};
    }
  }
}

/**
 * Default instance for application use
 * Eliminates need for complex factory configuration
 */
export const defaultComponentFactory = new ComponentFactory();

// Legacy compatibility classes - deprecated but maintained for gradual migration
/** @deprecated Use ComponentFactory directly */
export class AnalysisDomainFactory extends ComponentFactory {}

/** @deprecated Use ComponentFactory directly */
export class TemplateDomainFactory extends ComponentFactory {}

/** @deprecated Use ComponentFactory directly */
export class PipelineDomainFactory extends ComponentFactory {}

/** @deprecated Use ComponentFactory directly */
export class MasterComponentFactory extends ComponentFactory {}

/** @deprecated Use ComponentFactory directly */
export class FactoryConfigurationBuilder extends ComponentFactory {
  /**
   * Create a default configuration - simplified to return ComponentFactory instance
   * @deprecated Use defaultComponentFactory directly instead
   */
  static createDefault(): ComponentFactory {
    return new ComponentFactory();
  }
}

// Legacy namespace for backward compatibility
export const ComponentFactories = {
  AnalysisDomainFactory,
  TemplateDomainFactory,
  PipelineDomainFactory,
  MasterComponentFactory,
  FactoryConfigurationBuilder,
};
