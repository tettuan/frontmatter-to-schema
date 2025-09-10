/**
 * Output Formatter Interface
 *
 * Infrastructure service for generating output from processed data.
 * Handles the final output generation step of the document processing workflow.
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import type { BatchTransformationResult } from "../../domain/models/transformation.ts";
import type { Template } from "../../domain/models/entities.ts";
import type { OutputConfiguration } from "../../application/configuration.ts";

/**
 * Interface for output generation services
 *
 * Belongs to Infrastructure layer - responsible for final output formatting
 */
export interface OutputFormatter {
  /**
   * Generate output from batch transformation results
   *
   * @param batchResult Processed batch transformation results
   * @param template Template for output formatting
   * @param outputConfig Output configuration
   * @returns Result indicating success or error
   */
  generateOutput(
    batchResult: BatchTransformationResult,
    template: Template,
    outputConfig: OutputConfiguration,
  ): Promise<Result<void, DomainError>>;
}
