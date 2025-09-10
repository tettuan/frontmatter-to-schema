/**
 * Template Processor Factory - Domain Service
 * Creates pre-configured template processors
 * Part of Template Context - Domain Layer
 * Follows Totality principles with Result types
 */

import type { TemplateProcessingOptions } from "../models/template-processing-types.ts";

/**
 * Factory for Creating Pre-configured Processors
 * Replaces multiple factory classes from eliminated code
 */
export class TemplateProcessorFactory {
  /**
   * Create processor optimized for simple placeholder replacement
   * Replaces PlaceholderProcessorFactory.createMustacheProcessor()
   */
  static createSimpleProcessor(): TemplateProcessingOptions {
    return {
      handleMissingRequired: "ignore",
      handleMissingOptional: "empty",
      arrayFormat: "csv",
    };
  }

  /**
   * Create processor optimized for schema-guided processing
   * Replaces TemplateMapper instantiation patterns
   */
  static createSchemaProcessor(): TemplateProcessingOptions {
    return {
      handleMissingRequired: "warning",
      handleMissingOptional: "remove",
      arrayFormat: "json",
    };
  }

  /**
   * Create processor optimized for TypeScript processing
   * Replaces TypeScriptTemplateProcessor instantiation
   */
  static createTypeScriptProcessor(): TemplateProcessingOptions {
    return {
      handleMissingRequired: "error",
      handleMissingOptional: "keep",
      arrayFormat: "json",
    };
  }
}
