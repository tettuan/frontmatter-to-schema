/**
 * Configuration Repository Interface
 * Defines contract for configuration management
 * Follows DDD principles with Repository pattern
 */

import type { DomainError, Result } from "../core/result.ts";
import type { ProcessingConfiguration } from "../services/interfaces.ts";

/**
 * Repository interface for configuration management
 */
export interface ConfigurationRepository {
  /**
   * Load configuration from file
   * @param configPath - Path to configuration file
   * @returns Result containing ProcessingConfiguration or error
   */
  load(
    configPath: string,
  ): Promise<
    Result<ProcessingConfiguration, DomainError & { message: string }>
  >;

  /**
   * Save configuration to file
   * @param configPath - Path to save configuration
   * @param config - Configuration to save
   * @returns Result indicating success or error
   */
  save(
    configPath: string,
    config: ProcessingConfiguration,
  ): Promise<Result<void, DomainError & { message: string }>>;

  /**
   * Validate configuration
   * @param config - Configuration to validate
   * @returns Result indicating validity
   */
  validate(
    config: ProcessingConfiguration,
  ): Result<void, DomainError & { message: string }>;
}
