/**
 * Generic pipeline engine for frontmatter analysis
 * 
 * This module provides a configurable pipeline engine that can process
 * frontmatter files through multiple stages using schema-driven analysis.
 */

import {
  ExtensiblePipeline,
  PipelineFactory,
  type Pipeline,
  type ConfigurationProvider,
  type FileSystemProvider,
  type AnalysisContext,
  type ProcessingResult
} from "../core/abstractions.ts";
import { SchemaAnalysisProcessor } from "../analysis/schema-driven.ts";
import { FrontMatterContent, SourceFile, FilePath } from "../core/types.ts";

/**
 * Input for the frontmatter analysis pipeline
 */
export interface FrontMatterInput {
  sourceDirectory: string;
  filePattern?: RegExp;
  options?: Record<string, unknown>;
}

/**
 * Output from the frontmatter analysis pipeline
 */
export interface FrontMatterOutput<T> {
  results: ProcessingResult<T>[];
  summary: {
    totalFiles: number;
    processedFiles: number;
    successfulFiles: number;
    failedFiles: number;
    errors: string[];
  };
}

/**
 * Configuration for the generic frontmatter pipeline
 */
export interface FrontMatterPipelineConfig<TSchema, TTemplate> {
  schema: TSchema;
  template: TTemplate;
  prompts: {
    extractionPrompt: string;
    mappingPrompt: string;
  };
  fileSystem: FileSystemProvider;
  analysisProcessor: SchemaAnalysisProcessor<FrontMatterContent, TSchema, TTemplate>;
}

/**
 * Generic frontmatter analysis pipeline
 */
export class FrontMatterAnalysisPipeline<TSchema, TTemplate> 
  extends ExtensiblePipeline<FrontMatterInput, FrontMatterOutput<TTemplate>> {
  
  constructor(private readonly config: FrontMatterPipelineConfig<TSchema, TTemplate>) {
    super();
  }

  protected async processInternal(input: FrontMatterInput): Promise<FrontMatterOutput<TTemplate>> {
    const { sourceDirectory, filePattern, options = {} } = input;
    
    this.addMetadata('startTime', new Date().toISOString());
    this.addMetadata('sourceDirectory', sourceDirectory);
    
    // Stage 1: Discover and read files
    const sourceFiles = await this.discoverSourceFiles(sourceDirectory, filePattern);
    this.addMetadata('discoveredFiles', sourceFiles.length);
    
    // Stage 2: Process each file through schema analysis
    const results: ProcessingResult<TTemplate>[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < sourceFiles.length; i++) {
      const sourceFile = sourceFiles[i];
      const context: AnalysisContext = {
        sourceFile: sourceFile.path.value,
        schema: this.config.schema,
        template: this.config.template,
        options: { ...options, index: i },
        metadata: new Map<string, unknown>([
          ['processIndex', i],
          ['fileName', sourceFile.path.filename]
        ])
      };
      
      try {
        if (sourceFile.hasFrontMatter()) {
          const result = await this.config.analysisProcessor.process(
            sourceFile.frontMatter!,
            context
          );
          results.push(result);
          
          if (!result.isValid) {
            errors.push(...(result.errors || []));
          }
        } else {
          // Create a result for files without frontmatter
          results.push({
            data: this.config.template,
            metadata: new Map<string, unknown>(context.metadata),
            isValid: false,
            errors: ['No frontmatter found']
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Error processing ${sourceFile.path.filename}: ${errorMessage}`);
        
        results.push({
          data: this.config.template,
          metadata: new Map<string, unknown>(context.metadata),
          isValid: false,
          errors: [errorMessage]
        });
      }
    }
    
    // Stage 3: Generate summary
    const summary = this.generateSummary(sourceFiles.length, results, errors);
    this.addMetadata('endTime', new Date().toISOString());
    this.addMetadata('processingTime', Date.now() - new Date(this.getMetadata('startTime') as string).getTime());
    
    return {
      results,
      summary
    };
  }

  private async discoverSourceFiles(directory: string, pattern?: RegExp): Promise<SourceFile[]> {
    const fileNames = await this.config.fileSystem.readDirectory(directory);
    const sourceFiles: SourceFile[] = [];
    
    for (const fileName of fileNames) {
      if (pattern && !pattern.test(fileName)) {
        continue;
      }
      
      const fullPath = `${directory}/${fileName}`;
      try {
        const content = await this.config.fileSystem.readFile(fullPath);
        const frontMatter = this.extractFrontMatter(content);
        const sourceFile = new SourceFile(
          new FilePath(fullPath),
          frontMatter,
          content
        );
        sourceFiles.push(sourceFile);
      } catch (error) {
        console.warn(`Failed to read file ${fullPath}:`, error);
      }
    }
    
    return sourceFiles;
  }

  private extractFrontMatter(content: string): FrontMatterContent | null {
    // Simple YAML frontmatter extraction
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontMatterRegex);
    
    if (!match) {
      return null;
    }
    
    try {
      // This is a simplified YAML parser - in practice, use a proper YAML library
      const yamlContent = match[1];
      const data = this.parseSimpleYaml(yamlContent);
      return new FrontMatterContent(data);
    } catch (error) {
      console.warn('Failed to parse frontmatter:', error);
      return null;
    }
  }

  private parseSimpleYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();
      
      result[key] = this.parseYamlValue(value);
    }
    
    return result;
  }

  private parseYamlValue(value: string): unknown {
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    // Parse boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Parse number
    const num = Number(value);
    if (!isNaN(num)) return num;
    
    // Parse array (simple case)
    if (value.startsWith('[') && value.endsWith(']')) {
      const content = value.slice(1, -1).trim();
      if (!content) return [];
      return content.split(',').map(item => this.parseYamlValue(item.trim()));
    }
    
    return value;
  }

  private generateSummary(
    totalFiles: number,
    results: ProcessingResult<TTemplate>[],
    errors: string[]
  ) {
    const successfulFiles = results.filter(r => r.isValid).length;
    const failedFiles = results.filter(r => !r.isValid).length;
    
    return {
      totalFiles,
      processedFiles: results.length,
      successfulFiles,
      failedFiles,
      errors
    };
  }
}

/**
 * Factory for creating configured frontmatter analysis pipelines
 */
export class FrontMatterPipelineFactory<TSchema, TTemplate> 
  extends PipelineFactory<FrontMatterPipelineConfig<TSchema, TTemplate>, FrontMatterAnalysisPipeline<TSchema, TTemplate>> {
  
  createPipeline(): FrontMatterAnalysisPipeline<TSchema, TTemplate> {
    if (!this.validateConfiguration()) {
      throw new Error('Invalid pipeline configuration');
    }
    
    return new FrontMatterAnalysisPipeline(this.config);
  }

  validateConfiguration(): boolean {
    const { schema, template, prompts, fileSystem, analysisProcessor } = this.config;
    
    return !!(
      schema &&
      template &&
      prompts?.extractionPrompt &&
      prompts?.mappingPrompt &&
      fileSystem &&
      analysisProcessor
    );
  }
}

/**
 * Configuration provider that loads settings from external sources
 */
export class ConfigurablePipelineProvider<TSchema, TTemplate> implements ConfigurationProvider<TSchema> {
  constructor(
    private readonly schemaSource: () => Promise<TSchema>,
    private readonly templateSource: () => Promise<TTemplate>,
    private readonly promptSource: () => Promise<{ extractionPrompt: string; mappingPrompt: string; }>
  ) {}

  async getSchema(): Promise<TSchema> {
    return await this.schemaSource();
  }

  async getTemplate(): Promise<TTemplate> {
    return await this.templateSource();
  }

  async getPrompts(): Promise<{ extractionPrompt: string; mappingPrompt: string; }> {
    return await this.promptSource();
  }

  async createConfig(
    fileSystem: FileSystemProvider,
    analysisProcessor: SchemaAnalysisProcessor<FrontMatterContent, TSchema, TTemplate>
  ): Promise<FrontMatterPipelineConfig<TSchema, TTemplate>> {
    const [schema, template, prompts] = await Promise.all([
      this.getSchema(),
      this.getTemplate(),
      this.getPrompts()
    ]);

    return {
      schema,
      template,
      prompts,
      fileSystem,
      analysisProcessor
    };
  }
}