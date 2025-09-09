/**
 * Configuration Types Value Objects
 * Extracted from configuration.ts for better domain separation
 * Defines all configuration interfaces and types following DDD principles
 */

import type {
  OutputFormat,
  SchemaFormat,
  TemplateFormat,
} from "./configuration-formats.value-object.ts";

/**
 * Input configuration discriminated union following Totality principle
 */
export type InputConfiguration =
  | { kind: "DirectoryInput"; path: string; pattern: string }
  | { kind: "FileInput"; path: string };

/**
 * Schema configuration interface
 */
export interface SchemaConfiguration {
  definition: string;
  format: SchemaFormat;
}

/**
 * Template configuration interface
 */
export interface TemplateConfiguration {
  definition: string;
  format: TemplateFormat;
}

/**
 * Output configuration interface
 */
export interface OutputConfiguration {
  path: string;
  format: OutputFormat;
}

/**
 * Processing configuration discriminated union following Totality principle
 */
export type ProcessingConfiguration =
  | { kind: "BasicProcessing" }
  | { kind: "CustomPrompts"; extractionPrompt: string; mappingPrompt: string }
  | { kind: "ParallelProcessing"; parallel: boolean; continueOnError: boolean }
  | {
    kind: "FullCustom";
    extractionPrompt: string;
    mappingPrompt: string;
    parallel: boolean;
    continueOnError: boolean;
  };

/**
 * Main application configuration interface
 */
export interface ApplicationConfiguration {
  input: InputConfiguration;
  schema: SchemaConfiguration;
  template: TemplateConfiguration;
  output: OutputConfiguration;
  processing: ProcessingConfiguration;
}
