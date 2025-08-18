/**
 * Core domain interfaces for pluggable components
 */

import { FrontMatterContent, AnalysisContext, AnalysisResult } from './types.ts';

/**
 * Interface for frontmatter extraction
 */
export interface FrontMatterExtractor {
  /**
   * Extracts frontmatter from markdown content
   */
  extract(content: string): Promise<FrontMatterContent | null>;
  
  /**
   * Checks if content has frontmatter
   */
  hasFrontMatter(content: string): boolean;
}

/**
 * Generic analysis strategy interface
 */
export interface AnalysisStrategy<TInput = any, TOutput = any> {
  /**
   * Strategy name for identification
   */
  readonly name: string;
  
  /**
   * Executes the analysis strategy
   */
  execute(input: TInput, context: AnalysisContext): Promise<TOutput>;
}

/**
 * Analysis engine that executes strategies
 */
export interface AnalysisEngine {
  /**
   * Analyzes input using a specific strategy
   */
  analyze<TInput, TOutput>(
    input: TInput,
    strategy: AnalysisStrategy<TInput, TOutput>
  ): Promise<TOutput>;
}

/**
 * Transformer for converting analysis results to output format
 */
export interface Transformer<TInput = any, TOutput = any> {
  /**
   * Transforms analysis results to desired output format
   */
  transform(data: Map<string, AnalysisResult<TInput>>): TOutput;
}

/**
 * File discovery interface for finding source files
 */
export interface FileDiscovery {
  /**
   * Discovers files matching patterns
   */
  discover(patterns: string[]): Promise<string[]>;
  
  /**
   * Filters discovered files
   */
  filter(files: string[], predicate: (file: string) => boolean): string[];
}

/**
 * Output formatter for different serialization formats
 */
export interface OutputFormatter<T = any> {
  /**
   * Format name (json, yaml, xml, etc.)
   */
  readonly formatName: string;
  
  /**
   * Formats data to string
   */
  format(data: T): string;
  
  /**
   * Parses string back to data
   */
  parse(content: string): T;
}

/**
 * Configuration for the analysis pipeline
 */
export interface PipelineConfig {
  input: {
    patterns: string[];
    extractor: string;
  };
  processing: {
    engine: string;
    strategies: string[];
  };
  output: {
    format: string;
    schema?: any;
    template?: any;
    destination: string;
  };
}