/**
 * Generic Pipeline - Stub implementation for backward compatibility
 */

export interface ClimptAnalysisPipeline {
  process(): Promise<string>;
}

export interface FrontMatterInput {
  content?: string;
  path?: string;
  sourceDirectory?: string;
  filePattern?: RegExp;
  options?: Record<string, unknown>;
}

export interface FrontMatterOutput<TSchema = unknown, TResult = unknown> {
  results: TResult[];
  metadata?: Record<string, unknown>;
  summary?: {
    totalFiles?: number;
    processedFiles?: number;
    successfulFiles?: number;
    failedFiles?: number;
    errors?: string[];
  };
}

export interface FrontMatterPipelineConfig<
  TSchema = unknown,
  TResult = unknown,
> {
  inputPatterns?: string[];
  outputFormat?: string;
  schemaPath?: string;
  templatePath?: string;
  schema?: TSchema;
  template?: TSchema;
  prompts?: { extractionPrompt: string; mappingPrompt: string };
  fileSystem?: unknown;
  analysisProcessor?: unknown;
}

export class GenericPipeline implements ClimptAnalysisPipeline {
  process(): Promise<string> {
    return Promise.resolve(JSON.stringify({ results: [] }));
  }
}

export class FrontMatterAnalysisPipeline<TSchema = unknown, TResult = unknown>
  implements ClimptAnalysisPipeline {
  constructor(protected config: FrontMatterPipelineConfig<TSchema, TResult>) {}

  process(): Promise<string>;
  process(input: FrontMatterInput): Promise<string>;
  process(_input?: FrontMatterInput): Promise<string> {
    return Promise.resolve(JSON.stringify({ results: [] }));
  }

  processTyped(
    _input: FrontMatterInput,
  ): Promise<FrontMatterOutput<TSchema, TResult>> {
    return Promise.resolve({
      results: [] as TResult[],
      metadata: {},
      summary: {
        totalFiles: 0,
        processedFiles: 0,
        successfulFiles: 0,
        failedFiles: 0,
        errors: [],
      },
    });
  }
}
