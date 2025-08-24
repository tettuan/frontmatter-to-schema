/**
 * Template domain value objects
 * Re-exports from models for compatibility
 */

// Re-export template-related value objects from the models directory
export {
  TemplateFormat,
  MappingRule,
} from "../models/value-objects.ts";

// Template-specific types if needed
export type TemplateValueObject = string;