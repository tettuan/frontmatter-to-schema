// Schema Processing Domain Exports
// This module provides schema validation and transformation capabilities following DDD principles

// Interfaces
export type {
  SchemaError,
  SchemaMetadata,
  SchemaProcessor,
  ValidatedData,
} from "./interfaces/schema-processor.ts";

// Services
export { SchemaValidationProcessor } from "./services/schema-validation-processor.ts";
