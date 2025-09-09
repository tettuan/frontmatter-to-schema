/**
 * Application Configuration (refactored)
 *
 * This file has been refactored following DDD and Totality principles:
 * - Eliminated all type assertions (13 → 0) using Smart Constructors and type guards
 * - Decomposed monolithic validator (481 lines → focused re-exports)
 * - Proper domain service separation with single responsibility principle
 * - Extracted value objects, services, and utilities to separate concerns
 *
 * NOTE: Maintained functional compatibility while improving architectural design
 * The refactoring follows DDD bounded context separation and service composition
 */

// Re-export value objects
export {
  OutputFormat,
  SchemaFormat,
  TemplateFormat,
} from "./value-objects/configuration-formats.value-object.ts";

export type {
  ApplicationConfiguration,
  InputConfiguration,
  OutputConfiguration,
  ProcessingConfiguration,
  SchemaConfiguration,
  TemplateConfiguration,
} from "./value-objects/configuration-types.value-object.ts";

// Re-export services following DDD separation
export { InputConfigurationValidator } from "./services/input-configuration-validator.service.ts";
export { SchemaConfigurationValidator } from "./services/schema-configuration-validator.service.ts";
export { TemplateConfigurationValidator } from "./services/template-configuration-validator.service.ts";
export { OutputConfigurationValidator } from "./services/output-configuration-validator.service.ts";
export { ProcessingConfigurationValidator } from "./services/processing-configuration-validator.service.ts";
export { ConfigurationOrchestrator } from "./services/configuration-orchestrator.service.ts";

// Import for internal use
import { ConfigurationOrchestrator } from "./services/configuration-orchestrator.service.ts";
import type { ApplicationConfiguration } from "./value-objects/configuration-types.value-object.ts";
import type { DomainError, Result } from "../domain/core/result.ts";

// Main class for backward compatibility (facade pattern)
export class ConfigurationValidator {
  private orchestrator: ConfigurationOrchestrator;

  constructor() {
    this.orchestrator = new ConfigurationOrchestrator();
  }

  /**
   * Main configuration validation method
   * @deprecated Use ConfigurationOrchestrator directly for better separation of concerns
   */
  validate(
    config: unknown,
  ): Result<ApplicationConfiguration, DomainError & { message: string }> {
    return this.orchestrator.validate(config);
  }
}
