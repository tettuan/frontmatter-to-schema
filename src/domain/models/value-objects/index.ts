/**
 * Value Objects Index - Re-exports all domain value objects
 *
 * This index provides backward compatibility after splitting value-objects.ts
 * into smaller, focused files for AI complexity control compliance.
 */

// Document-related value objects
export {
  DocumentContent,
  DocumentPath,
  FrontMatterContent,
} from "../document-value-objects.ts";

// Configuration-related value objects
export {
  ConfigPath,
  OutputPath,
  TemplatePath,
} from "../configuration-value-objects.ts";

// Schema-related value objects
export { SchemaDefinition, SchemaVersion } from "../schema-value-objects.ts";

// Template and processing-related value objects
export {
  MappingRule,
  ProcessingOptions,
  TemplateFormat,
} from "../template-value-objects.ts";
