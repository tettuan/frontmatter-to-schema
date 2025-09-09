/**
 * Pipeline-related type definitions
 * Extracted from schema-management.ts for better domain separation
 * Contains interfaces and types related to pipeline execution and configuration
 */

import type {
  PromptContext,
  SchemaContext,
  TemplateContext,
} from "../core/schema-injection.ts";
import type { DomainError, Result } from "../core/result.ts";

/**
 * Execution Configuration for pipeline creation
 */
export interface ExecutionConfiguration {
  name?: string;
  schemaPath: string;
  templatePath: string;
  promptPaths: {
    extraction: string;
    mapping: string;
  };
  inputPath: string;
  outputPath: string;
  outputFormat: "json" | "yaml" | "xml";
  fileSystem?: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
  };
}

/**
 * Pipeline Output structure
 */
export interface PipelineOutput {
  id: string;
  output: unknown;
  outputPath: string;
  format: "json" | "yaml" | "xml";
  executedAt: Date;
}

/**
 * Schema Processor Interface for pipeline processing
 */
export interface SchemaProcessor {
  process(
    inputPath: string,
    schemaContext: SchemaContext,
    templateContext: TemplateContext,
    promptContext: PromptContext,
  ): Promise<Result<unknown, DomainError & { message: string }>>;
}
