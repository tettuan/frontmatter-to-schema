/**
 * TypeScript FrontMatter Analyzer - Migration from claude-client.ts
 * Replaces claude -p dependency with AIProcessingEngine
 */

import type { Result } from "../../domain/shared/types.ts";
import type { FrontMatterContent } from "../../domain/models/value-objects.ts";
import type {
  AIProcessingEngine,
  AIProcessingEngineConfig,
} from "../../domain/ai-processing/engine/AIProcessingEngine.ts";
import type {
  TwoStageAnalysisConfig,
  PromptTemplate,
  PromptVariables,
  SchemaDefinition,
  AnalysisOptions,
} from "../../domain/ai-processing/types/analysis-types.ts";
import type {
  AIProcessingError,
} from "../../domain/ai-processing/errors/AIProcessingError.ts";

/**
 * FrontMatter analysis result structure
 */
export interface FrontMatterAnalysisResult {
  readonly extractedData: Record<string, unknown>;
  readonly confidence: number;
  readonly processingTime: number;
  readonly metadata: {
    readonly model: string;
    readonly tokenUsage: {
      readonly input: number;
      readonly output: number;
    };
    readonly stages: {
      readonly extraction: { duration: number; success: boolean };
      readonly mapping: { duration: number; success: boolean };
    };
  };
}

/**
 * Schema definition for extracted information (Stage 1 output)
 */
class ExtractedInfoSchema implements SchemaDefinition<Record<string, unknown>> {
  readonly name = 'ExtractedInfo';
  readonly version = '1.0.0';

  validate(data: unknown): Result<Record<string, unknown>, any> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {
        ok: false,
        error: {
          kind: 'SchemaValidationError',
          message: 'Expected non-null object for extracted info',
          received: data,
          expected: 'Record<string, unknown>'
        }
      };
    }

    return { ok: true, data: data as Record<string, unknown> };
  }

  describe(): string {
    return 'Schema for extracted frontmatter information';
  }
}

/**
 * Schema definition for final analysis result (Stage 2 output)
 */
class AnalysisResultSchema implements SchemaDefinition<FrontMatterAnalysisResult> {
  readonly name = 'FrontMatterAnalysisResult';
  readonly version = '1.0.0';

  validate(data: unknown): Result<FrontMatterAnalysisResult, any> {
    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        error: {
          kind: 'SchemaValidationError',
          message: 'Expected object for analysis result',
          received: data,
          expected: 'FrontMatterAnalysisResult'
        }
      };
    }

    const obj = data as Record<string, unknown>;
    
    // Basic validation - in production, use a proper schema validator
    if (!obj.extractedData || typeof obj.extractedData !== 'object') {
      return {
        ok: false,
        error: {
          kind: 'SchemaValidationError',
          message: 'Missing or invalid extractedData field',
          received: data,
          expected: 'FrontMatterAnalysisResult with extractedData object'
        }
      };
    }

    return {
      ok: true,
      data: {
        extractedData: obj.extractedData as Record<string, unknown>,
        confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.8,
        processingTime: typeof obj.processingTime === 'number' ? obj.processingTime : 0,
        metadata: {
          model: 'claude-3-sonnet-20240229',
          tokenUsage: { input: 0, output: 0 },
          stages: {
            extraction: { duration: 0, success: true },
            mapping: { duration: 0, success: true },
          }
        }
      }
    };
  }

  describe(): string {
    return 'Schema for complete frontmatter analysis result';
  }
}

/**
 * Prompt variables extractor for FrontMatter content
 */
class FrontMatterPromptVariables implements PromptVariables<FrontMatterContent> {
  extract(input: FrontMatterContent, key: string): unknown {
    switch (key) {
      case 'content':
        return input.getValue();
      case 'keys':
        return input.keys().join(', ');
      case 'size':
        return input.size();
      case 'json':
        return JSON.stringify(input.toJSON(), null, 2);
      default:
        return input.get(key);
    }
  }
}

/**
 * Prompt template for information extraction (Stage 1)
 */
class ExtractionPromptTemplate implements PromptTemplate<FrontMatterContent> {
  readonly template = `
Analyze the following frontmatter content and extract all relevant information:

Frontmatter Content:
{{json}}

Please extract and structure the information found in the frontmatter. Focus on:
1. All key-value pairs present
2. Data types of each value
3. Relationships between fields
4. Any patterns or conventions used

Return the extracted information as a JSON object that preserves all original data while adding any inferred structure or relationships.
  `.trim();

  readonly variables = new FrontMatterPromptVariables();

  render(input: FrontMatterContent): string {
    return this.template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.variables.extract(input, key);
      return String(value);
    });
  }
}

/**
 * Prompt variables extractor for extracted information
 */
class ExtractedInfoPromptVariables implements PromptVariables<Record<string, unknown>> {
  extract(input: Record<string, unknown>, key: string): unknown {
    switch (key) {
      case 'json':
        return JSON.stringify(input, null, 2);
      case 'keys':
        return Object.keys(input).join(', ');
      case 'size':
        return Object.keys(input).length;
      default:
        return input[key];
    }
  }
}

/**
 * Prompt template for mapping to final structure (Stage 2)
 */
class MappingPromptTemplate implements PromptTemplate<Record<string, unknown>> {
  readonly template = `
Transform the extracted frontmatter information into a structured analysis result:

Extracted Information:
{{json}}

Please create a comprehensive analysis result with the following structure:
{
  "extractedData": { /* the original extracted data */ },
  "confidence": /* confidence score 0.0-1.0 based on data completeness */,
  "processingTime": /* estimated processing time in milliseconds */,
  "metadata": {
    "model": "claude-3-sonnet-20240229",
    "tokenUsage": { "input": 0, "output": 0 },
    "stages": {
      "extraction": { "duration": 0, "success": true },
      "mapping": { "duration": 0, "success": true }
    }
  }
}

Ensure the result is valid JSON and includes all the extracted data in the extractedData field.
  `.trim();

  readonly variables = new ExtractedInfoPromptVariables();

  render(input: Record<string, unknown>): string {
    return this.template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.variables.extract(input, key);
      return String(value);
    });
  }
}

/**
 * TypeScript FrontMatter Analyzer
 * Complete replacement for claude-client.ts analyzeFrontMatter functionality
 */
export class TypeScriptFrontMatterAnalyzer {
  private readonly analysisConfig: TwoStageAnalysisConfig<
    FrontMatterContent,
    Record<string, unknown>,
    FrontMatterAnalysisResult
  >;

  constructor(private readonly aiEngine: AIProcessingEngine) {
    this.analysisConfig = {
      stage1: {
        prompt: new ExtractionPromptTemplate(),
        schema: new ExtractedInfoSchema(),
        options: {
          temperature: 0.1,
          maxTokens: 1000,
          timeout: 30000,
          retryCount: 3,
        }
      },
      stage2: {
        prompt: new MappingPromptTemplate(),
        schema: new AnalysisResultSchema(),
        options: {
          temperature: 0.0,
          maxTokens: 800,
          timeout: 30000,
          retryCount: 3,
        }
      }
    };
  }

  /**
   * Analyze frontmatter content - direct replacement for claude-client.ts method
   * @param content FrontMatter content to analyze
   * @returns Analysis result with extracted data and metadata
   */
  async analyzeFrontMatter(
    content: FrontMatterContent
  ): Promise<Result<FrontMatterAnalysisResult, AIProcessingError>> {
    const startTime = Date.now();

    // Execute two-stage analysis using AI Processing Engine
    const result = await this.aiEngine.processTwoStageAnalysis(
      content,
      this.analysisConfig
    );

    if (!result.ok) {
      return result;
    }

    // Update processing time in the result
    const processingTime = Date.now() - startTime;
    const updatedResult = {
      ...result.data,
      processingTime,
      metadata: {
        ...result.data.metadata,
        stages: {
          extraction: { ...result.data.metadata.stages.extraction },
          mapping: { ...result.data.metadata.stages.mapping },
        }
      }
    };

    return { ok: true, data: updatedResult };
  }

  /**
   * Batch analyze multiple frontmatter contents
   * @param contents Array of FrontMatter contents to analyze
   * @param options Processing options
   * @returns Array of analysis results
   */
  async batchAnalyzeFrontMatter(
    contents: FrontMatterContent[],
    options: { maxConcurrency?: number; continueOnError?: boolean } = {}
  ): Promise<Result<FrontMatterAnalysisResult[], AIProcessingError[]>> {
    const { maxConcurrency = 3, continueOnError = true } = options;
    const results: FrontMatterAnalysisResult[] = [];
    const errors: AIProcessingError[] = [];

    // Process in batches to respect concurrency limits
    for (let i = 0; i < contents.length; i += maxConcurrency) {
      const batch = contents.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(content => this.analyzeFrontMatter(content));
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const batchResult of batchResults) {
        if (batchResult.status === 'fulfilled') {
          if (batchResult.value.ok) {
            results.push(batchResult.value.data);
          } else {
            errors.push(batchResult.value.error);
            if (!continueOnError) {
              return { ok: false, error: errors };
            }
          }
        } else {
          // Unexpected promise rejection
          errors.push({
            kind: 'ConfigurationError',
            configKey: 'batch_processing',
            expectedFormat: 'successful promise resolution',
            actualValue: batchResult.reason,
            traceId: `batch-${i}-${Date.now()}`
          });
          
          if (!continueOnError) {
            return { ok: false, error: errors };
          }
        }
      }
    }

    if (errors.length > 0) {
      return { ok: false, error: errors };
    }

    return { ok: true, data: results };
  }

  /**
   * Create custom analysis configuration
   * @param customOptions Custom analysis options
   * @returns Custom analysis configuration
   */
  createCustomAnalysisConfig(
    customOptions: Partial<{
      stage1Temperature: number;
      stage2Temperature: number;
      stage1MaxTokens: number;
      stage2MaxTokens: number;
      timeout: number;
      retryCount: number;
    }>
  ): TwoStageAnalysisConfig<FrontMatterContent, Record<string, unknown>, FrontMatterAnalysisResult> {
    return {
      stage1: {
        prompt: new ExtractionPromptTemplate(),
        schema: new ExtractedInfoSchema(),
        options: {
          temperature: customOptions.stage1Temperature ?? 0.1,
          maxTokens: customOptions.stage1MaxTokens ?? 1000,
          timeout: customOptions.timeout ?? 30000,
          retryCount: customOptions.retryCount ?? 3,
        }
      },
      stage2: {
        prompt: new MappingPromptTemplate(),
        schema: new AnalysisResultSchema(),
        options: {
          temperature: customOptions.stage2Temperature ?? 0.0,
          maxTokens: customOptions.stage2MaxTokens ?? 800,
          timeout: customOptions.timeout ?? 30000,
          retryCount: customOptions.retryCount ?? 3,
        }
      }
    };
  }
}