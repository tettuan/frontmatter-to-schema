/**
 * Mock implementation of TemplateMapper for testing
 */

import {
  type ExtractedData,
  MappedData,
  type Template,
} from "../../src/domain/models/entities.ts";
import type { DomainError, Result } from "../../src/domain/core/result.ts";
import type {
  SchemaValidationMode,
  TemplateMapper,
} from "../../src/domain/services/interfaces.ts";

export class MockTemplateMapper implements TemplateMapper {
  private mappingResult: MappedData | null = null;
  private mappingError: (DomainError & { message: string }) | null = null;

  /**
   * Sets the result that will be returned by map()
   */
  setMappingResult(data: Record<string, unknown>): void {
    this.mappingResult = MappedData.create(data);
    this.mappingError = null;
  }

  /**
   * Sets an error that will be returned by map()
   */
  setMappingError(error: DomainError & { message: string }): void {
    this.mappingError = error;
    this.mappingResult = null;
  }

  map(
    data: ExtractedData,
    _template: Template,
    _schemaMode: SchemaValidationMode,
  ): Result<MappedData, DomainError & { message: string }> {
    // Return error if set
    if (this.mappingError) {
      return { ok: false, error: this.mappingError };
    }

    // Return result if set
    if (this.mappingResult) {
      return { ok: true, data: this.mappingResult };
    }

    // Default behavior - return the extracted data as mapped data
    return { ok: true, data: MappedData.create(data.getData()) };
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.mappingResult = null;
    this.mappingError = null;
  }
}
