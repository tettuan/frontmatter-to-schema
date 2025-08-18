/**
 * Core abstractions for the generic frontmatter analysis system
 * 
 * This module provides high-level interfaces and abstract classes that define
 * the system's architecture and enable schema-driven, template-based analysis.
 */

/**
 * Generic pipeline interface for processing data through stages
 */
export interface Pipeline<TInput, TOutput> {
  process(input: TInput): Promise<TOutput>;
}

/**
 * Schema-based analyzer that uses external schema definitions to analyze data
 */
export interface SchemaBasedAnalyzer<TSchema, TResult> {
  analyze(data: unknown, schema: TSchema, context?: AnalysisContext): Promise<TResult>;
}

/**
 * Template mapper that applies data to templates using schema guidance
 */
export interface TemplateMapper<TSource, TTarget> {
  map(source: TSource, template: TTarget, schema?: unknown): Promise<TTarget>;
}

/**
 * Configuration provider for schema-driven systems
 */
export interface ConfigurationProvider<TConfig> {
  getSchema(): Promise<TConfig>;
  getTemplate(): Promise<unknown>;
  getPrompts(): Promise<PromptConfiguration>;
}

/**
 * External analysis service abstraction (e.g., Claude, GPT, etc.)
 */
export interface ExternalAnalysisService {
  analyze(prompt: string, context?: Record<string, unknown>): Promise<unknown>;
}

/**
 * File system operations abstraction
 */
export interface FileSystemProvider {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readDirectory(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
}

/**
 * Context information passed through the analysis pipeline
 */
export interface AnalysisContext {
  sourceFile?: string;
  schema?: unknown;
  template?: unknown;
  options?: Record<string, unknown>;
  metadata?: Map<string, unknown>;
}

/**
 * Configuration for prompts used in the analysis process
 */
export interface PromptConfiguration {
  extractionPrompt: string;
  mappingPrompt: string;
  validationPrompt?: string;
}

/**
 * Result of the analysis process with metadata
 */
export interface ProcessingResult<T> {
  data: T;
  metadata: Map<string, unknown>;
  isValid: boolean;
  errors?: string[];
}

/**
 * Abstract base class for implementing pipelines with common functionality
 */
export abstract class AbstractPipeline<TInput, TOutput> implements Pipeline<TInput, TOutput> {
  protected readonly context: AnalysisContext;

  constructor(context: AnalysisContext = {}) {
    this.context = { ...context, metadata: new Map() };
  }

  abstract process(input: TInput): Promise<TOutput>;

  protected addMetadata(key: string, value: unknown): void {
    this.context.metadata?.set(key, value);
  }

  protected getMetadata(key: string): unknown {
    return this.context.metadata?.get(key);
  }

  protected createProcessingResult<T>(
    data: T,
    isValid: boolean = true,
    errors: string[] = []
  ): ProcessingResult<T> {
    return {
      data,
      metadata: new Map(this.context.metadata),
      isValid,
      errors
    };
  }
}

/**
 * Factory pattern for creating configured analysis pipelines
 */
export abstract class PipelineFactory<TConfig, TPipeline extends Pipeline<any, any>> {
  constructor(protected readonly config: TConfig) {}

  abstract createPipeline(): TPipeline;
  abstract validateConfiguration(): boolean;
}

/**
 * Event-driven pipeline with hooks for extensibility
 */
export interface PipelineHooks<TInput, TOutput> {
  beforeProcess?(input: TInput): Promise<TInput>;
  afterProcess?(output: TOutput): Promise<TOutput>;
  onError?(error: Error, input: TInput): Promise<void>;
}

/**
 * Extensible pipeline that supports hooks and middleware
 */
export abstract class ExtensiblePipeline<TInput, TOutput> extends AbstractPipeline<TInput, TOutput> {
  private hooks: PipelineHooks<TInput, TOutput> = {};

  setHooks(hooks: PipelineHooks<TInput, TOutput>): void {
    this.hooks = hooks;
  }

  async process(input: TInput): Promise<TOutput> {
    try {
      const processedInput = this.hooks.beforeProcess ? 
        await this.hooks.beforeProcess(input) : input;
      
      const result = await this.processInternal(processedInput);
      
      return this.hooks.afterProcess ? 
        await this.hooks.afterProcess(result) : result;
    } catch (error) {
      if (this.hooks.onError) {
        await this.hooks.onError(error as Error, input);
      }
      throw error;
    }
  }

  protected abstract processInternal(input: TInput): Promise<TOutput>;
}