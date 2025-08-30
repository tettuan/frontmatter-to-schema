/**
 * Component Factory with Totality Principles
 * Applies DDD boundaries and type safety through discriminated unions and smart constructors
 */

import type { Result } from "./result.ts";
import { createDomainError, type DomainError } from "./result.ts";
import { type Logger, LoggerFactory } from "../shared/logger.ts";

// Import domain components
import type {
  AnalysisEngine,
  ContextualAnalysisProcessor,
} from "./analysis-engine.ts";
import type {
  ExternalAnalysisService,
  PromptConfiguration,
  SchemaBasedAnalyzer,
  TemplateMapper,
} from "./abstractions.ts";
import type { TemplateFormatHandler } from "../template/format-handlers.ts";
import { TemplateFormatHandlerFactory } from "../template/format-handlers.ts";
import type { PlaceholderProcessor } from "../template/placeholder-processor.ts";
import { PlaceholderProcessorFactory } from "../template/placeholder-processor.ts";
import type { SchemaProcessor, SchemaSwitcher } from "./schema-management.ts";

/**
 * Domain Component Types - Discriminated Union
 * Replaces enum to enforce type safety and totality
 */
export type ComponentDomain =
  | { kind: "analysis"; config: AnalysisDomainConfig }
  | { kind: "template"; config: TemplateDomainConfig }
  | { kind: "pipeline"; config: PipelineDomainConfig };

/**
 * Analysis Domain Configuration with Smart Constructor
 */
export class AnalysisDomainConfig {
  private constructor(
    readonly externalService: ExternalAnalysisService | undefined,
    readonly prompts: PromptConfiguration | undefined,
    readonly timeout: number,
  ) {}

  static create(params?: {
    externalService?: ExternalAnalysisService;
    prompts?: PromptConfiguration;
    timeout?: number;
  }): Result<AnalysisDomainConfig, DomainError & { message: string }> {
    const timeout = params?.timeout ?? 30000;

    if (timeout < 0 || timeout > 600000) {
      return {
        ok: false,
        error: createDomainError({
          kind: "OutOfRange",
          value: timeout,
          min: 0,
          max: 600000,
        }, `Timeout must be between 0 and 600000ms, got ${timeout}`),
      };
    }

    return {
      ok: true,
      data: new AnalysisDomainConfig(
        params?.externalService,
        params?.prompts,
        timeout,
      ),
    };
  }
}

/**
 * Template Domain Configuration with Smart Constructor
 */
export class TemplateDomainConfig {
  private constructor(
    readonly defaultFormat: string,
    readonly strictMode: boolean,
  ) {}

  static create(params?: {
    defaultFormat?: string;
    strictMode?: boolean;
  }): Result<TemplateDomainConfig, DomainError & { message: string }> {
    const defaultFormat = params?.defaultFormat ?? "json";
    const strictMode = params?.strictMode ?? true;

    const validFormats = ["json", "yaml", "xml", "toml"];
    if (!validFormats.includes(defaultFormat)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: defaultFormat,
            expectedFormat: validFormats.join(", "),
          },
          `Invalid format: ${defaultFormat}. Must be one of: ${
            validFormats.join(", ")
          }`,
        ),
      };
    }

    return {
      ok: true,
      data: new TemplateDomainConfig(defaultFormat, strictMode),
    };
  }
}

/**
 * Pipeline Domain Configuration with Smart Constructor
 */
export class PipelineDomainConfig {
  private constructor(
    readonly schemaPath: string | undefined,
    readonly cacheEnabled: boolean,
    readonly maxRetries: number,
  ) {}

  static create(params?: {
    schemaPath?: string;
    cacheEnabled?: boolean;
    maxRetries?: number;
  }): Result<PipelineDomainConfig, DomainError & { message: string }> {
    const maxRetries = params?.maxRetries ?? 3;
    const cacheEnabled = params?.cacheEnabled ?? false;

    if (maxRetries < 0 || maxRetries > 10) {
      return {
        ok: false,
        error: createDomainError({
          kind: "OutOfRange",
          value: maxRetries,
          min: 0,
          max: 10,
        }, `Max retries must be between 0 and 10, got ${maxRetries}`),
      };
    }

    return {
      ok: true,
      data: new PipelineDomainConfig(
        params?.schemaPath,
        cacheEnabled,
        maxRetries,
      ),
    };
  }
}

/**
 * Factory Result Types - Type-safe component creation results
 */
export type AnalysisComponents = {
  engine: AnalysisEngine;
  processor: ContextualAnalysisProcessor;
  schemaAnalyzer: SchemaBasedAnalyzer<unknown, unknown>;
  templateMapper: TemplateMapper<unknown, unknown>;
};

export type TemplateComponents = {
  formatHandler: TemplateFormatHandler;
  placeholderProcessor: PlaceholderProcessor;
};

export type PipelineComponents = {
  schemaProcessor: SchemaProcessor;
  schemaSwitcher: SchemaSwitcher;
};

/**
 * Component Factory Result - Discriminated union for factory results
 */
export type ComponentFactoryResult =
  | { kind: "analysis"; components: AnalysisComponents }
  | { kind: "template"; components: TemplateComponents }
  | { kind: "pipeline"; components: PipelineComponents };

/**
 * Abstract Factory Interface with Totality
 */
export interface TotalDomainFactory<T extends ComponentDomain> {
  readonly domain: T;
  createComponents(): Promise<
    Result<ComponentFactoryResult, DomainError & { message: string }>
  >;
  validateDependencies(): Result<true, DomainError & { message: string }>;
}

/**
 * Analysis Domain Factory Implementation
 */
export class TotalAnalysisDomainFactory
  implements
    TotalDomainFactory<{ kind: "analysis"; config: AnalysisDomainConfig }> {
  readonly domain: { kind: "analysis"; config: AnalysisDomainConfig };
  private readonly logger: Logger;

  constructor(config: AnalysisDomainConfig) {
    this.domain = { kind: "analysis", config };
    this.logger = LoggerFactory.createLogger("analysis-factory-total");
  }

  validateDependencies(): Result<true, DomainError & { message: string }> {
    this.logger.debug("Validating analysis domain dependencies");

    // All validations passed in smart constructor
    return { ok: true, data: true };
  }

  async createComponents(): Promise<
    Result<ComponentFactoryResult, DomainError & { message: string }>
  > {
    this.logger.info("Creating analysis domain components with totality");

    const validationResult = this.validateDependencies();
    if (!validationResult.ok) {
      return validationResult;
    }

    try {
      // Lazy import to avoid circular dependencies
      const {
        GenericAnalysisEngine,
        RobustSchemaAnalyzer,
        RobustTemplateMapper,
        ContextualAnalysisProcessor,
      } = await import("./analysis-engine.ts");

      const engine = new GenericAnalysisEngine(this.domain.config.timeout);
      const schemaAnalyzer = new RobustSchemaAnalyzer();
      const templateMapper = new RobustTemplateMapper();
      const processor = new ContextualAnalysisProcessor(
        engine,
        schemaAnalyzer,
        templateMapper,
      );

      return {
        ok: true,
        data: {
          kind: "analysis",
          components: {
            engine,
            processor,
            schemaAnalyzer,
            templateMapper,
          },
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "analysis component creation",
          error: {
            kind: "InvalidResponse",
            service: "component-factory",
            response: error instanceof Error ? error.message : String(error),
          },
        }, `Failed to create analysis components: ${error}`),
      };
    }
  }
}

/**
 * Template Domain Factory Implementation
 */
export class TotalTemplateDomainFactory
  implements
    TotalDomainFactory<{ kind: "template"; config: TemplateDomainConfig }> {
  readonly domain: { kind: "template"; config: TemplateDomainConfig };
  private readonly logger: Logger;

  constructor(config: TemplateDomainConfig) {
    this.domain = { kind: "template", config };
    this.logger = LoggerFactory.createLogger("template-factory-total");
  }

  validateDependencies(): Result<true, DomainError & { message: string }> {
    this.logger.debug("Validating template domain dependencies");
    return { ok: true, data: true };
  }

  createComponents(): Promise<
    Result<ComponentFactoryResult, DomainError & { message: string }>
  > {
    this.logger.info("Creating template domain components with totality");

    const validationResult = this.validateDependencies();
    if (!validationResult.ok) {
      return Promise.resolve(validationResult);
    }

    try {
      // Create template components directly
      // For now, use simple implementations

      // Use existing factories to create proper implementations
      const formatHandlerResult = TemplateFormatHandlerFactory.getHandler(
        "json",
      );
      if (!formatHandlerResult.ok) {
        return Promise.resolve({
          ok: false,
          error: formatHandlerResult.error,
        });
      }
      const formatHandler = formatHandlerResult.data;

      const placeholderProcessor = PlaceholderProcessorFactory
        .createMustacheProcessor();

      return Promise.resolve({
        ok: true,
        data: {
          kind: "template",
          components: {
            formatHandler,
            placeholderProcessor,
          },
        },
      });
    } catch (error) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "template component creation",
          error: {
            kind: "InvalidResponse",
            service: "component-factory",
            response: error instanceof Error ? error.message : String(error),
          },
        }, `Failed to create template components: ${error}`),
      });
    }
  }
}

/**
 * Pipeline Domain Factory Implementation
 */
export class TotalPipelineDomainFactory
  implements
    TotalDomainFactory<{ kind: "pipeline"; config: PipelineDomainConfig }> {
  readonly domain: { kind: "pipeline"; config: PipelineDomainConfig };
  private readonly logger: Logger;

  constructor(config: PipelineDomainConfig) {
    this.domain = { kind: "pipeline", config };
    this.logger = LoggerFactory.createLogger("pipeline-factory-total");
  }

  validateDependencies(): Result<true, DomainError & { message: string }> {
    this.logger.debug("Validating pipeline domain dependencies");

    if (this.domain.config.schemaPath) {
      // Could validate schema file exists here
      this.logger.debug(
        `Schema path configured: ${this.domain.config.schemaPath}`,
      );
    }

    return { ok: true, data: true };
  }

  createComponents(): Promise<
    Result<ComponentFactoryResult, DomainError & { message: string }>
  > {
    this.logger.info("Creating pipeline domain components with totality");

    const validationResult = this.validateDependencies();
    if (!validationResult.ok) {
      return Promise.resolve(validationResult);
    }

    try {
      // Create pipeline components directly
      // For now, use simple implementations
      const schemaProcessor = {} as SchemaProcessor;
      const schemaSwitcher = {} as SchemaSwitcher;

      return Promise.resolve({
        ok: true,
        data: {
          kind: "pipeline",
          components: {
            schemaProcessor,
            schemaSwitcher,
          },
        },
      });
    } catch (error) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "pipeline component creation",
          error: {
            kind: "InvalidResponse",
            service: "component-factory",
            response: error instanceof Error ? error.message : String(error),
          },
        }, `Failed to create pipeline components: ${error}`),
      });
    }
  }
}

/**
 * Master Factory with Totality - Orchestrates domain factories
 */
export class TotalMasterComponentFactory {
  private readonly logger: Logger;
  private readonly factories: Map<string, TotalDomainFactory<ComponentDomain>>;

  constructor() {
    this.logger = LoggerFactory.createLogger("master-factory-total");
    this.factories = new Map();
  }

  /**
   * Register a domain factory
   */
  registerFactory(
    factory: TotalDomainFactory<ComponentDomain>,
  ): Result<true, DomainError & { message: string }> {
    const key = factory.domain.kind;

    if (this.factories.has(key)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidState",
          expected: "unregistered domain factory",
          actual: `domain '${key}' already registered`,
        }, `Factory for domain '${key}' already registered`),
      };
    }

    this.factories.set(key, factory);
    this.logger.info(`Registered factory for domain: ${key}`);

    return { ok: true, data: true };
  }

  /**
   * Create components for a specific domain
   */
  createComponents(
    domain: ComponentDomain,
  ): Promise<
    Result<ComponentFactoryResult, DomainError & { message: string }>
  > {
    const factory = this.factories.get(domain.kind);

    if (!factory) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "NotFound",
          resource: "factory",
          name: domain.kind,
        }, `No factory registered for domain: ${domain.kind}`),
      });
    }

    return factory.createComponents();
  }

  /**
   * Create all registered components
   */
  async createAllComponents(): Promise<
    Result<ComponentFactoryResult[], DomainError & { message: string }>
  > {
    const results: ComponentFactoryResult[] = [];

    for (const factory of this.factories.values()) {
      const result = await factory.createComponents();
      if (!result.ok) {
        return result;
      }
      results.push(result.data);
    }

    return { ok: true, data: results };
  }
}

/**
 * Factory Builder with Totality - Fluent API for configuration
 */
export class TotalFactoryBuilder {
  private readonly masterFactory: TotalMasterComponentFactory;
  private readonly logger: Logger;

  constructor() {
    this.masterFactory = new TotalMasterComponentFactory();
    this.logger = LoggerFactory.createLogger("factory-builder-total");
  }

  /**
   * Configure analysis domain
   */
  withAnalysisDomain(
    params?: Parameters<typeof AnalysisDomainConfig.create>[0],
  ): Result<TotalFactoryBuilder, DomainError & { message: string }> {
    const configResult = AnalysisDomainConfig.create(params);
    if (!configResult.ok) {
      return configResult;
    }

    const factory = new TotalAnalysisDomainFactory(configResult.data);
    const registerResult = this.masterFactory.registerFactory(factory);

    if (!registerResult.ok) {
      return registerResult;
    }

    return { ok: true, data: this };
  }

  /**
   * Configure template domain
   */
  withTemplateDomain(
    params?: Parameters<typeof TemplateDomainConfig.create>[0],
  ): Result<TotalFactoryBuilder, DomainError & { message: string }> {
    const configResult = TemplateDomainConfig.create(params);
    if (!configResult.ok) {
      return configResult;
    }

    const factory = new TotalTemplateDomainFactory(configResult.data);
    const registerResult = this.masterFactory.registerFactory(factory);

    if (!registerResult.ok) {
      return registerResult;
    }

    return { ok: true, data: this };
  }

  /**
   * Configure pipeline domain
   */
  withPipelineDomain(
    params?: Parameters<typeof PipelineDomainConfig.create>[0],
  ): Result<TotalFactoryBuilder, DomainError & { message: string }> {
    const configResult = PipelineDomainConfig.create(params);
    if (!configResult.ok) {
      return configResult;
    }

    const factory = new TotalPipelineDomainFactory(configResult.data);
    const registerResult = this.masterFactory.registerFactory(factory);

    if (!registerResult.ok) {
      return registerResult;
    }

    return { ok: true, data: this };
  }

  /**
   * Build and return the configured master factory
   */
  build(): Result<
    TotalMasterComponentFactory,
    DomainError & { message: string }
  > {
    this.logger.info("Building master component factory with totality");
    return { ok: true, data: this.masterFactory };
  }
}

/**
 * Create a factory builder instance
 */
export function createFactoryBuilder(): TotalFactoryBuilder {
  return new TotalFactoryBuilder();
}
