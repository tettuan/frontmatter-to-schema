/**
 * Configuration Extractor Service
 * 
 * Extracts prompts and settings from ProcessingConfiguration discriminated unions.
 * Follows Totality principles with exhaustive switch statements.
 */

import type { ProcessingConfiguration } from "../configuration.ts";

/**
 * Extracts configuration values from ProcessingConfiguration discriminated unions
 * 
 * Implements Totality pattern: exhaustive switch statements ensure all cases handled
 */
export class ConfigurationExtractor {
  /**
   * Extract extraction prompt from ProcessingConfiguration
   * 
   * @param processing Processing configuration discriminated union
   * @returns Extraction prompt if available
   */
  getExtractionPrompt(processing: ProcessingConfiguration): string | undefined {
    switch (processing.kind) {
      case "CustomPrompts":
      case "FullCustom":
        return processing.extractionPrompt;
      case "BasicProcessing":
      case "ParallelProcessing":
        return undefined;
      // No default case needed - TypeScript ensures exhaustiveness
    }
  }

  /**
   * Extract mapping prompt from ProcessingConfiguration discriminated union
   * 
   * @param processing Processing configuration discriminated union
   * @returns Mapping prompt if available
   */
  getMappingPrompt(processing: ProcessingConfiguration): string | undefined {
    switch (processing.kind) {
      case "CustomPrompts":
      case "FullCustom":
        return processing.mappingPrompt;
      case "BasicProcessing":
      case "ParallelProcessing":
        return undefined;
      // No default case needed - TypeScript ensures exhaustiveness
    }
  }

  /**
   * Determine if processing should continue on error
   * 
   * @param processing Processing configuration discriminated union
   * @returns Whether to continue processing on errors
   */
  shouldContinueOnError(processing: ProcessingConfiguration): boolean {
    switch (processing.kind) {
      case "ParallelProcessing":
      case "FullCustom":
        return processing.continueOnError;
      case "BasicProcessing":
      case "CustomPrompts":
        return false; // Default to false for basic processing
      // No default case needed - TypeScript ensures exhaustiveness
    }
  }
}