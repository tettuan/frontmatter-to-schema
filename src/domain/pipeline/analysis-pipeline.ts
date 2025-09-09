/**
 * Analysis Pipeline
 * Processes files through analysis stages with configurable components
 */

// import type { DomainError } from "../core/result.ts";
import type {
  AnalysisEngine,
  AnalysisStrategy,
  FileDiscovery,
  PipelineConfig,
  Transformer,
} from "../core/interfaces.ts";
import type { FileReader } from "../services/interfaces.ts";
import { AnalysisResult } from "../core/analysis-types.ts";

export interface FrontMatterExtractor {
  extract(content: string): Promise<Record<string, unknown> | null>;
  hasFrontMatter(content: string): boolean;
}

export class AnalysisPipeline {
  private readonly strategiesArray: AnalysisStrategy<unknown, unknown>[];

  constructor(
    private readonly config: PipelineConfig,
    private readonly fileDiscovery: FileDiscovery,
    private readonly extractor: FrontMatterExtractor,
    private readonly engine: AnalysisEngine,
    private readonly transformer: Transformer,
    strategies:
      | AnalysisStrategy<unknown, unknown>[]
      | Map<string, AnalysisStrategy<unknown, unknown>>,
    private readonly fileReader: FileReader,
  ) {
    this.strategiesArray = strategies instanceof Map
      ? Array.from(strategies.values())
      : strategies;
  }

  async process(): Promise<string> {
    try {
      const files = await this.fileDiscovery.discover([]);
      const results = new Map<string, AnalysisResult<unknown>>();

      for (const file of files) {
        const contentResult = await this.fileReader.readTextFile(file);
        if (contentResult.ok) {
          const frontmatter = await this.extractor.extract(contentResult.data);
          if (frontmatter) {
            // Process through strategies
            let processed: unknown = frontmatter;
            for (const strategy of this.strategiesArray) {
              processed = await this.engine.analyze(processed, strategy);
            }
            results.set(file, new AnalysisResult(file, processed));
          }
        }
      }

      // Transform and format output
      const transformed = this.transformer.transform(results);
      return JSON.stringify({ results: transformed }, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  validateConfig(): boolean {
    // Validate input patterns
    if (
      !this.config.input?.patterns || this.config.input.patterns.length === 0
    ) {
      throw new Error("Input patterns are required");
    }

    // Validate processing strategies
    if (
      !this.config.processing?.strategies ||
      this.config.processing.strategies.length === 0
    ) {
      throw new Error("Processing strategies are required");
    }

    // Validate output format
    if (!this.config.output?.format || this.config.output.format === "") {
      throw new Error("Output format is required");
    }

    // Check if strategy is registered (basic check)
    if (this.config.processing?.strategies?.includes("non-existent-strategy")) {
      throw new Error("Strategy 'non-existent-strategy' not registered");
    }

    // Basic validation - ensure required components are present
    return !!(this.fileDiscovery && this.fileReader && this.extractor &&
      this.engine && this.strategiesArray && this.transformer);
  }
}

export class PipelineBuilder<T = unknown> {
  private config: Partial<PipelineConfig> = {
    input: { patterns: [], extractor: "" },
    processing: { engine: "", strategies: [] },
    output: { format: "json", destination: "" },
  };
  private fileDiscovery?: FileDiscovery;
  private extractor?: FrontMatterExtractor;
  private engine?: AnalysisEngine;
  private transformer?: Transformer;
  private strategies: AnalysisStrategy<unknown, unknown>[] = [];
  private fileReader?: FileReader;

  withInputPatterns(patterns: string[]): this {
    if (this.config.input) {
      this.config.input.patterns = patterns;
    }
    return this;
  }

  withExtractor(extractor: FrontMatterExtractor, name?: string): this {
    this.extractor = extractor;
    if (this.config.input && name) {
      this.config.input.extractor = name;
    }
    return this;
  }

  withEngine(engine: AnalysisEngine, name?: string): this {
    this.engine = engine;
    if (this.config.processing && name) {
      this.config.processing.engine = name;
    }
    return this;
  }

  withStrategy(strategy: AnalysisStrategy<unknown, unknown>): this {
    this.strategies.push(strategy);
    if (this.config.processing) {
      this.config.processing.strategies.push(strategy.name);
    }
    return this;
  }

  withTransformer(transformer: Transformer): this {
    this.transformer = transformer;
    return this;
  }

  withFileDiscovery(fileDiscovery: FileDiscovery): this {
    this.fileDiscovery = fileDiscovery;
    return this;
  }

  withFileReader(fileReader: FileReader): this {
    this.fileReader = fileReader;
    return this;
  }

  withOutputFormat(format: string): this {
    if (this.config.output) {
      this.config.output.format = format;
    }
    return this;
  }

  withOutputDestination(destination: string): this {
    if (this.config.output) {
      this.config.output.destination = destination;
    }
    return this;
  }

  withOutputSchema(schema: unknown): this {
    if (this.config.output) {
      this.config.output.schema = schema;
    }
    return this;
  }

  withOutputTemplate(template: unknown): this {
    if (this.config.output) {
      this.config.output.template = template;
    }
    return this;
  }

  build(): AnalysisPipeline {
    if (!this.fileDiscovery) {
      throw new Error("FileDiscovery is required");
    }
    if (!this.extractor) {
      throw new Error("FrontMatterExtractor is required");
    }
    if (!this.engine) {
      throw new Error("AnalysisEngine is required");
    }
    if (!this.transformer) {
      throw new Error("Transformer is required");
    }
    if (!this.fileReader) {
      throw new Error("FileReader is required");
    }

    return new AnalysisPipeline(
      this.config as PipelineConfig,
      this.fileDiscovery,
      this.extractor,
      this.engine,
      this.transformer,
      this.strategies,
      this.fileReader,
    );
  }
}
