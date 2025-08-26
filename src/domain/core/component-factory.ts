/**
 * Unified Component Factory - Abstract Factory Pattern Implementation
 * Consolidates factory responsibilities following DDD domain boundaries
 */

import type { Result } from "./result.ts";
import type { ValidationError } from "../shared/errors.ts";
import { type Logger, LoggerFactory } from "../shared/logger.ts";

// Analysis Domain Factories
import {
  type AnalysisEngine,
  ContextualAnalysisProcessor,
  GenericAnalysisEngine,
  RobustSchemaAnalyzer,
  RobustTemplateMapper,
} from "./analysis-engine.ts";
import { SchemaAnalysisFactory } from "../analysis/schema-driven.ts";
import type {
  ExternalAnalysisService,
  PromptConfiguration,
  SchemaBasedAnalyzer,
  TemplateMapper,
} from "./abstractions.ts";

// Template Domain Factories
import {
  type TemplateFormatHandler,
  TemplateFormatHandlerFactory,
} from "../template/format-handlers.ts";
import {
  type PlaceholderProcessor,
  PlaceholderProcessorFactory,
} from "../template/placeholder-processor.ts";

// Pipeline Domain Factories
import type { SchemaProcessor, SchemaSwitcher } from "./schema-management.ts";
import { DynamicPipelineFactory } from "./schema-management.ts";

/**
 * Domain Component Categories
 * Enforces separation of concerns across domain boundaries
 */
export const enum ComponentDomain {
  Analysis = "analysis",
  Template = "template",
  Pipeline = "pipeline",
  Infrastructure = "infrastructure",
}

/**
 * Abstract Factory Interface
 * Defines the contract for domain-specific component creation
 */
export interface DomainComponentFactory<TDomain extends ComponentDomain> {
  readonly domain: TDomain;
  createComponents(): unknown;
  validateDependencies(): Result<boolean, ValidationError>;
}

/**
 * Analysis Domain Factory
 * Consolidates all analysis-related component creation
 */
export class AnalysisDomainFactory
  implements DomainComponentFactory<ComponentDomain.Analysis> {
  readonly domain = ComponentDomain.Analysis;
  private readonly logger: Logger;
  private readonly timeout?: number;

  constructor(
    private readonly externalService?: ExternalAnalysisService,
    private readonly prompts?: PromptConfiguration,
    options?: { timeout?: number },
  ) {
    this.logger = LoggerFactory.createLogger("analysis-factory");
    this.timeout = options?.timeout;
  }

  createComponents(): {
    engine: AnalysisEngine;
    processor: ContextualAnalysisProcessor;
    schemaAnalyzer: SchemaBasedAnalyzer<unknown, unknown>;
    templateMapper: TemplateMapper<unknown, unknown>;
  } {
    this.logger.info("Creating analysis domain components");

    // Create core engine components directly (previously done by deprecated AnalysisEngineFactory)
    const engine = new GenericAnalysisEngine(this.timeout);
    const robustSchemaAnalyzer = new RobustSchemaAnalyzer();
    const robustTemplateMapper = new RobustTemplateMapper();

    const processor = new ContextualAnalysisProcessor(
      engine,
      robustSchemaAnalyzer,
      robustTemplateMapper,
    );

    // Create schema-driven components if dependencies are available
    let schemaAnalyzer: SchemaBasedAnalyzer<unknown, unknown>;
    let templateMapper: TemplateMapper<unknown, unknown>;

    if (this.externalService && this.prompts) {
      schemaAnalyzer = SchemaAnalysisFactory.createAnalyzer(
        this.externalService,
        this.prompts,
      );
      templateMapper = SchemaAnalysisFactory.createMapper(
        this.externalService,
        this.prompts,
      );
    } else {
      // Use default implementations (the robust ones created above)
      this.logger.warn(
        "Creating analysis components with default implementations",
      );
      schemaAnalyzer = robustSchemaAnalyzer;
      templateMapper = robustTemplateMapper;
    }

    this.logger.info("Analysis domain components created successfully");

    return {
      engine,
      processor,
      schemaAnalyzer,
      templateMapper,
    };
  }

  validateDependencies(): Result<boolean, ValidationError> {
    this.logger.debug("Validating analysis domain dependencies");
    // Basic validation - can be enhanced
    return { ok: true, data: true };
  }
}

/**
 * Template Domain Factory
 * Consolidates all template-related component creation
 */
export class TemplateDomainFactory
  implements DomainComponentFactory<ComponentDomain.Template> {
  readonly domain = ComponentDomain.Template;
  private readonly logger: Logger;

  constructor() {
    this.logger = LoggerFactory.createLogger("template-factory");
  }

  createComponents(): {
    formatHandlers: Map<string, TemplateFormatHandler>;
    placeholderProcessors: {
      mustache: PlaceholderProcessor;
      dollar: PlaceholderProcessor;
      percent: PlaceholderProcessor;
    };
  } {
    this.logger.info("Creating template domain components");

    // Get all available format handlers
    const formatHandlers = new Map<string, TemplateFormatHandler>();

    // Register known formats
    const formats = ["json", "yaml", "handlebars"];
    for (const format of formats) {
      const handlerResult = TemplateFormatHandlerFactory.getHandler(format);
      if (handlerResult.ok) {
        formatHandlers.set(format, handlerResult.data);
      }
    }

    // Create placeholder processors
    const placeholderProcessors = {
      mustache: PlaceholderProcessorFactory.createMustacheProcessor(),
      dollar: PlaceholderProcessorFactory.createDollarProcessor(),
      percent: PlaceholderProcessorFactory.createPercentProcessor(),
    };

    this.logger.info("Template domain components created successfully", {
      formatHandlerCount: formatHandlers.size,
      placeholderProcessorCount: Object.keys(placeholderProcessors).length,
    });

    return {
      formatHandlers,
      placeholderProcessors,
    };
  }

  validateDependencies(): Result<boolean, ValidationError> {
    this.logger.debug("Validating template domain dependencies");
    return { ok: true, data: true };
  }
}

/**
 * Pipeline Domain Factory
 * Consolidates all pipeline-related component creation
 */
export class PipelineDomainFactory
  implements DomainComponentFactory<ComponentDomain.Pipeline> {
  readonly domain = ComponentDomain.Pipeline;
  private readonly logger: Logger;

  constructor(
    private readonly config?: {
      schemaProcessor?: Map<string, SchemaProcessor>;
      switcher?: SchemaSwitcher;
    },
  ) {
    this.logger = LoggerFactory.createLogger("pipeline-factory");
  }

  createComponents(): {
    dynamicFactory?: DynamicPipelineFactory;
  } {
    this.logger.info("Creating pipeline domain components");

    let dynamicFactory: DynamicPipelineFactory | undefined;

    // Create dynamic factory if dependencies are available
    if (this.config?.switcher && this.config?.schemaProcessor) {
      dynamicFactory = new DynamicPipelineFactory(
        this.config.switcher,
        this.config.schemaProcessor,
      );
    }

    this.logger.info("Pipeline domain components created successfully", {
      hasDynamicFactory: !!dynamicFactory,
    });

    return {
      dynamicFactory,
    };
  }

  validateDependencies(): Result<boolean, ValidationError> {
    this.logger.debug("Validating pipeline domain dependencies");
    return { ok: true, data: true };
  }
}

/**
 * Master Component Factory
 * Coordinates creation across all domain boundaries
 */
export class MasterComponentFactory {
  private readonly logger: Logger;
  private readonly factories: Map<
    ComponentDomain,
    DomainComponentFactory<ComponentDomain>
  >;

  constructor() {
    this.logger = LoggerFactory.createLogger("master-factory");
    this.factories = new Map();
  }

  /**
   * Register a domain factory
   */
  registerFactory<TDomain extends ComponentDomain>(
    factory: DomainComponentFactory<TDomain>,
  ): void {
    this.logger.debug(`Registering factory for domain: ${factory.domain}`);
    this.factories.set(
      factory.domain,
      factory as DomainComponentFactory<ComponentDomain>,
    );
  }

  /**
   * Create components for a specific domain
   */
  createDomainComponents<TDomain extends ComponentDomain>(
    domain: TDomain,
  ): unknown {
    const factory = this.factories.get(domain);
    if (!factory) {
      this.logger.error(`No factory registered for domain: ${domain}`);
      throw new Error(`No factory registered for domain: ${domain}`);
    }

    // Validate dependencies before creation
    const validationResult = factory.validateDependencies();
    if (!validationResult.ok) {
      this.logger.error(`Dependency validation failed for domain: ${domain}`, {
        error: validationResult.error,
      });
      throw new Error(
        `Dependency validation failed: ${validationResult.error.message}`,
      );
    }

    this.logger.info(`Creating components for domain: ${domain}`);
    return factory.createComponents();
  }

  /**
   * Create components for all registered domains
   */
  createAllComponents(): Map<ComponentDomain, unknown> {
    this.logger.info("Creating components for all registered domains");
    const components = new Map<ComponentDomain, unknown>();

    for (const [domain, factory] of this.factories) {
      try {
        const domainComponents = factory.createComponents();
        components.set(domain, domainComponents);
        this.logger.debug(
          `Successfully created components for domain: ${domain}`,
        );
      } catch (error) {
        this.logger.error(`Failed to create components for domain: ${domain}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    this.logger.info("All domain components created successfully", {
      domainCount: components.size,
    });

    return components;
  }

  /**
   * Get factory for specific domain
   */
  getFactory<TDomain extends ComponentDomain>(
    domain: TDomain,
  ): DomainComponentFactory<TDomain> | undefined {
    return this.factories.get(domain) as
      | DomainComponentFactory<TDomain>
      | undefined;
  }

  /**
   * List all registered domains
   */
  getRegisteredDomains(): ComponentDomain[] {
    return Array.from(this.factories.keys());
  }
}

/**
 * Factory Configuration Builder
 * Provides fluent interface for factory setup
 */
export class FactoryConfigurationBuilder {
  private readonly masterFactory: MasterComponentFactory;
  private readonly logger: Logger;

  constructor() {
    this.masterFactory = new MasterComponentFactory();
    this.logger = LoggerFactory.createLogger("factory-config-builder");
  }

  /**
   * Configure analysis domain factory
   */
  withAnalysisDomain(
    config?: {
      externalService?: ExternalAnalysisService;
      prompts?: PromptConfiguration;
    },
  ): FactoryConfigurationBuilder {
    const factory = new AnalysisDomainFactory(
      config?.externalService,
      config?.prompts,
    );
    this.masterFactory.registerFactory(factory);
    this.logger.debug("Analysis domain factory registered");
    return this;
  }

  /**
   * Configure template domain factory
   */
  withTemplateDomain(): FactoryConfigurationBuilder {
    const factory = new TemplateDomainFactory();
    this.masterFactory.registerFactory(factory);
    this.logger.debug("Template domain factory registered");
    return this;
  }

  /**
   * Configure pipeline domain factory
   */
  withPipelineDomain(
    config?: {
      schemaProcessor?: Map<string, SchemaProcessor>;
      switcher?: SchemaSwitcher;
    },
  ): FactoryConfigurationBuilder {
    const factory = new PipelineDomainFactory(config);
    this.masterFactory.registerFactory(factory);
    this.logger.debug("Pipeline domain factory registered");
    return this;
  }

  /**
   * Build the configured master factory
   */
  build(): MasterComponentFactory {
    this.logger.info("Factory configuration completed", {
      registeredDomains: this.masterFactory.getRegisteredDomains(),
    });
    return this.masterFactory;
  }

  /**
   * Create a default configuration with all domains
   */
  static createDefault(): MasterComponentFactory {
    return new FactoryConfigurationBuilder()
      .withAnalysisDomain()
      .withTemplateDomain()
      .withPipelineDomain()
      .build();
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
