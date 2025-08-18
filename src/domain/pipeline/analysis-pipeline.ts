/**
 * Generic analysis pipeline for processing files
 */

import {
  FilePath,
  SourceFile,
  AnalysisResult,
  type AnalysisContext,
  SchemaDefinition
} from '../core/types.ts';
import type {
  FrontMatterExtractor,
  AnalysisEngine,
  AnalysisStrategy,
  Transformer,
  FileDiscovery,
  PipelineConfig
} from '../core/interfaces.ts';
import { Registry } from '../core/registry.ts';

/**
 * Generic analysis pipeline that orchestrates the entire process
 */
export class AnalysisPipeline<TOutput = unknown> {
  constructor(
    private readonly config: PipelineConfig,
    private readonly fileDiscovery: FileDiscovery,
    private readonly extractor: FrontMatterExtractor,
    private readonly engine: AnalysisEngine,
    private readonly transformer: Transformer<unknown, TOutput>,
    private readonly strategies: Map<string, AnalysisStrategy>
  ) {}

  /**
   * Processes files according to the pipeline configuration
   */
  async process(): Promise<TOutput> {
    // 1. Discover files
    const files = await this.discoverFiles();
    
    // 2. Process each file
    const registry = new Registry();
    
    for (const filePath of files) {
      try {
        const result = await this.processFile(filePath);
        if (result) {
          registry.add(filePath, result);
        }
      } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
        // Continue with other files
      }
    }
    
    // 3. Transform and return results
    const resultMap = new Map<string, AnalysisResult<unknown>>();
    registry.toArray().forEach((item, index) => {
      resultMap.set(index.toString(), item.result);
    });
    return this.transformer.transform(resultMap);
  }

  /**
   * Discovers files based on configuration patterns
   */
  private async discoverFiles(): Promise<string[]> {
    const files = await this.fileDiscovery.discover(this.config.input.patterns);
    
    // Filter for markdown files if needed
    return this.fileDiscovery.filter(files, (file) => {
      const path = new FilePath(file);
      return path.isMarkdown();
    });
  }

  /**
   * Processes a single file through the pipeline
   */
  private async processFile(filePath: string): Promise<AnalysisResult | null> {
    const path = new FilePath(filePath);
    
    // Read file content
    const content = await Deno.readTextFile(filePath);
    
    // Extract frontmatter
    const frontMatter = await this.extractor.extract(content);
    
    if (!frontMatter) {
      console.warn(`No frontmatter found in ${filePath}`);
      return null;
    }
    
    // Create source file
    const sourceFile = new SourceFile(path, frontMatter, content);
    
    // Prepare context
    const context: AnalysisContext = {
      schema: this.config.output.schema 
        ? new SchemaDefinition(this.config.output.schema)
        : undefined,
      template: this.config.output.template,
      options: {}
    };
    
    // Execute strategies in sequence
    let data: unknown = frontMatter.data;
    
    for (const strategyName of this.config.processing.strategies) {
      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        console.warn(`Strategy ${strategyName} not found`);
        continue;
      }
      
      data = await this.engine.analyze(data, strategy);
    }
    
    // Create and return analysis result
    const result = new AnalysisResult(path, data);
    result.addMetadata('processedAt', new Date().toISOString());
    result.addMetadata('strategies', this.config.processing.strategies);
    
    return result;
  }

  /**
   * Validates the pipeline configuration
   */
  validateConfig(): boolean {
    // Check required fields
    if (!this.config.input?.patterns || this.config.input.patterns.length === 0) {
      throw new Error('Input patterns are required');
    }
    
    if (!this.config.processing?.strategies || this.config.processing.strategies.length === 0) {
      throw new Error('Processing strategies are required');
    }
    
    if (!this.config.output?.format) {
      throw new Error('Output format is required');
    }
    
    // Check that all strategies exist
    for (const strategyName of this.config.processing.strategies) {
      if (!this.strategies.has(strategyName)) {
        throw new Error(`Strategy '${strategyName}' not registered`);
      }
    }
    
    return true;
  }
}

/**
 * Pipeline builder for fluent configuration
 */
export class PipelineBuilder<TOutput = any> {
  private config: Partial<PipelineConfig> = {};
  private fileDiscovery?: FileDiscovery;
  private extractor?: FrontMatterExtractor;
  private engine?: AnalysisEngine;
  private transformer?: Transformer<any, TOutput>;
  private strategies = new Map<string, AnalysisStrategy>();

  withInputPatterns(patterns: string[]): this {
    if (!this.config.input) {
      this.config.input = { patterns: [], extractor: 'deno' };
    }
    this.config.input.patterns = patterns;
    return this;
  }

  withExtractor(extractor: FrontMatterExtractor, name: string = 'custom'): this {
    this.extractor = extractor;
    if (!this.config.input) {
      this.config.input = { patterns: [], extractor: name };
    }
    this.config.input.extractor = name;
    return this;
  }

  withEngine(engine: AnalysisEngine, name: string = 'custom'): this {
    this.engine = engine;
    if (!this.config.processing) {
      this.config.processing = { engine: name, strategies: [] };
    }
    this.config.processing.engine = name;
    return this;
  }

  withStrategy(strategy: AnalysisStrategy): this {
    this.strategies.set(strategy.name, strategy);
    if (!this.config.processing) {
      this.config.processing = { engine: 'custom', strategies: [] };
    }
    if (!this.config.processing.strategies.includes(strategy.name)) {
      this.config.processing.strategies.push(strategy.name);
    }
    return this;
  }

  withTransformer(transformer: Transformer<any, TOutput>): this {
    this.transformer = transformer;
    return this;
  }

  withFileDiscovery(discovery: FileDiscovery): this {
    this.fileDiscovery = discovery;
    return this;
  }

  withOutputFormat(format: string): this {
    if (!this.config.output) {
      this.config.output = { format, destination: '' };
    }
    this.config.output.format = format;
    return this;
  }

  withOutputSchema(schema: unknown): this {
    if (!this.config.output) {
      this.config.output = { format: 'json', destination: '' };
    }
    this.config.output.schema = schema;
    return this;
  }

  withOutputTemplate(template: unknown): this {
    if (!this.config.output) {
      this.config.output = { format: 'json', destination: '' };
    }
    this.config.output.template = template;
    return this;
  }

  withOutputDestination(destination: string): this {
    if (!this.config.output) {
      this.config.output = { format: 'json', destination };
    }
    this.config.output.destination = destination;
    return this;
  }

  build(): AnalysisPipeline<TOutput> {
    // Validate required components
    if (!this.fileDiscovery) {
      throw new Error('FileDiscovery is required');
    }
    if (!this.extractor) {
      throw new Error('FrontMatterExtractor is required');
    }
    if (!this.engine) {
      throw new Error('AnalysisEngine is required');
    }
    if (!this.transformer) {
      throw new Error('Transformer is required');
    }
    
    // Complete config with defaults
    const completeConfig: PipelineConfig = {
      input: this.config.input || { patterns: [], extractor: 'deno' },
      processing: this.config.processing || { engine: 'custom', strategies: [] },
      output: this.config.output || { format: 'json', destination: '' }
    };
    
    return new AnalysisPipeline(
      completeConfig,
      this.fileDiscovery,
      this.extractor,
      this.engine,
      this.transformer,
      this.strategies
    );
  }
}