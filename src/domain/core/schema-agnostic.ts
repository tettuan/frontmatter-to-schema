/**
 * Schema-Agnostic Core Domain - Following DDD boundary design
 * This layer has no knowledge of schemas and operates purely on abstractions
 */

import type { Result } from "./result.ts";

/**
 * Pure processing engine that knows nothing about schemas
 * Operates on transformers and generic data
 */
export interface PureProcessingEngine {
  /**
   * Execute a transformation on input data
   * No knowledge of what the transformation does
   */
  execute<TInput, TOutput>(
    input: TInput,
    transformer: Transformer<TInput, TOutput>,
  ): Promise<Result<TOutput, { message: string }>>;

  /**
   * Execute multiple transformations in parallel
   */
  executeParallel<TInput, TOutput>(
    inputs: TInput[],
    transformer: Transformer<TInput, TOutput>,
    options?: { maxConcurrency?: number },
  ): Promise<Result<TOutput[], { message: string }>>;

  /**
   * Execute transformations in a pipeline
   */
  pipeline<T1, T2, T3>(
    input: T1,
    transformers: [
      Transformer<T1, T2>,
      Transformer<T2, T3>,
    ],
  ): Promise<Result<T3, { message: string }>>;
}

/**
 * Generic transformer interface
 * Transforms input to output without schema knowledge
 */
export interface Transformer<TInput, TOutput> {
  /**
   * Transform input to output
   */
  transform(input: TInput): Promise<Result<TOutput, { message: string }>>;

  /**
   * Optional validation before transformation
   */
  validate?(input: TInput): Result<void, { message: string }>;

  /**
   * Optional metadata about the transformer
   */
  metadata?: TransformerMetadata;
}

/**
 * Transformer metadata for introspection
 */
export interface TransformerMetadata {
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly inputType?: string;
  readonly outputType?: string;
}

/**
 * File discovery that doesn't know about schemas
 * Purely discovers files based on patterns
 */
export interface FileDiscovery {
  /**
   * Discover files matching patterns
   */
  discover(patterns: string[]): Promise<string[]>;

  /**
   * Discover files with filtering
   */
  discoverWithFilter(
    patterns: string[],
    filter: (path: string) => boolean,
  ): Promise<string[]>;

  /**
   * Get file metadata
   */
  getMetadata(path: string): Promise<Result<FileMetadata, { message: string }>>;
}

/**
 * File metadata without schema knowledge
 */
export interface FileMetadata {
  readonly path: string;
  readonly size: number;
  readonly modifiedAt: Date;
  readonly createdAt?: Date;
  readonly isDirectory: boolean;
  readonly extension?: string;
}

/**
 * Pure data processor that chains transformations
 * No schema knowledge, just data flow
 */
export class PureDataProcessor implements PureProcessingEngine {
  async execute<TInput, TOutput>(
    input: TInput,
    transformer: Transformer<TInput, TOutput>,
  ): Promise<Result<TOutput, { message: string }>> {
    // Validate if validator exists
    if (transformer.validate) {
      const validationResult = transformer.validate(input);
      if (!validationResult.ok) {
        return validationResult;
      }
    }

    // Transform
    return await transformer.transform(input);
  }

  async executeParallel<TInput, TOutput>(
    inputs: TInput[],
    transformer: Transformer<TInput, TOutput>,
    options?: { maxConcurrency?: number },
  ): Promise<Result<TOutput[], { message: string }>> {
    const maxConcurrency = options?.maxConcurrency || 5;
    const results: TOutput[] = [];
    const errors: string[] = [];

    // Process in batches
    for (let i = 0; i < inputs.length; i += maxConcurrency) {
      const batch = inputs.slice(i, i + maxConcurrency);
      const batchPromises = batch.map((input) =>
        this.execute(input, transformer)
      );

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result.ok) {
          results.push(result.data);
        } else {
          errors.push(result.error.message);
        }
      }
    }

    if (errors.length > 0) {
      return {
        ok: false,
        error: {
          message: `Failed to process ${errors.length} items: ${
            errors.join(", ")
          }`,
        },
      };
    }

    return { ok: true, data: results };
  }

  async pipeline<T1, T2, T3>(
    input: T1,
    transformers: [
      Transformer<T1, T2>,
      Transformer<T2, T3>,
    ],
  ): Promise<Result<T3, { message: string }>> {
    // First transformation
    const result1 = await this.execute(input, transformers[0]);
    if (!result1.ok) {
      return result1;
    }

    // Second transformation
    return this.execute(result1.data, transformers[1]);
  }
}

/**
 * Schema-agnostic file discovery implementation
 */
export class SimpleFileDiscovery implements FileDiscovery {
  constructor(
    private readonly fileSystem: {
      listFiles(path: string): Promise<string[]>;
      getStats(path: string): Promise<{
        size: number;
        modifiedAt: Date;
        isDirectory: boolean;
      }>;
    },
  ) {}

  async discover(patterns: string[]): Promise<string[]> {
    const allFiles: Set<string> = new Set();

    for (const pattern of patterns) {
      const files = await this.fileSystem.listFiles(pattern);
      for (const file of files) {
        allFiles.add(file);
      }
    }

    return Array.from(allFiles).sort();
  }

  async discoverWithFilter(
    patterns: string[],
    filter: (path: string) => boolean,
  ): Promise<string[]> {
    const files = await this.discover(patterns);
    return files.filter(filter);
  }

  async getMetadata(
    path: string,
  ): Promise<Result<FileMetadata, { message: string }>> {
    try {
      const stats = await this.fileSystem.getStats(path);

      const extension = path.includes(".")
        ? path.substring(path.lastIndexOf("."))
        : undefined;

      return {
        ok: true,
        data: {
          path,
          size: stats.size,
          modifiedAt: stats.modifiedAt,
          isDirectory: stats.isDirectory,
          extension,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          message: `Failed to get metadata for ${path}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      };
    }
  }
}

/**
 * Generic data aggregator without schema knowledge
 */
export interface DataAggregator<T> {
  /**
   * Add data to aggregation
   */
  add(data: T): void;

  /**
   * Get aggregated result
   */
  getResult(): T[];

  /**
   * Clear aggregated data
   */
  clear(): void;

  /**
   * Get count of aggregated items
   */
  count(): number;
}

/**
 * Simple array-based aggregator
 */
export class SimpleDataAggregator<T> implements DataAggregator<T> {
  private items: T[] = [];

  add(data: T): void {
    this.items.push(data);
  }

  getResult(): T[] {
    return [...this.items];
  }

  clear(): void {
    this.items = [];
  }

  count(): number {
    return this.items.length;
  }
}

/**
 * Create a composition of transformers
 */
export function composeTransformers<T1, T2, T3>(
  first: Transformer<T1, T2>,
  second: Transformer<T2, T3>,
): Transformer<T1, T3> {
  return {
    async transform(input: T1): Promise<Result<T3, { message: string }>> {
      const result1 = await first.transform(input);
      if (!result1.ok) {
        return result1;
      }
      return second.transform(result1.data);
    },
    validate: first.validate,
    metadata: {
      name: `${first.metadata?.name || "transformer1"} -> ${
        second.metadata?.name || "transformer2"
      }`,
      description:
        `Composition of ${first.metadata?.name} and ${second.metadata?.name}`,
      inputType: first.metadata?.inputType,
      outputType: second.metadata?.outputType,
    },
  };
}

/**
 * Create a parallel transformer that runs multiple transformers
 */
export function parallelTransformers<TInput, TOutput>(
  transformers: Transformer<TInput, TOutput>[],
): Transformer<TInput, TOutput[]> {
  return {
    async transform(
      input: TInput,
    ): Promise<Result<TOutput[], { message: string }>> {
      const promises = transformers.map((t) => t.transform(input));
      const results = await Promise.all(promises);

      const outputs: TOutput[] = [];
      const errors: string[] = [];

      for (const result of results) {
        if (result.ok) {
          outputs.push(result.data);
        } else {
          errors.push(result.error.message);
        }
      }

      if (errors.length > 0) {
        return {
          ok: false,
          error: {
            message: `Parallel transformation failed: ${errors.join(", ")}`,
          },
        };
      }

      return { ok: true, data: outputs };
    },
    metadata: {
      name: "Parallel Transformers",
      description: `Runs ${transformers.length} transformers in parallel`,
    },
  };
}
