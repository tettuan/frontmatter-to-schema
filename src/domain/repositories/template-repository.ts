/**
 * Template Repository Domain Interface
 *
 * Following DDD patterns - defines domain contract for template loading
 * Infrastructure layer will implement this interface
 */

import type { DomainError, Result } from "../core/result.ts";
import type { Template } from "../models/entities.ts";

// Import value objects from their proper location
export {
  isTemplateDataPath as isTemplatePath,
  type TemplateDataFormat as TemplateFormat,
  TemplateDataPath as TemplatePath,
  TemplateDataPathValidator as TemplatePathValidator,
} from "../value-objects/template-data-path.ts";

// Re-import for proper type usage
import type { TemplateDataPath as TemplatePath } from "../value-objects/template-data-path.ts";

/**
 * Template Repository Domain Interface
 * Following CD4: Template Management Domain from domain boundary design
 */
export interface ITemplateRepository {
  /**
   * Load template by path
   */
  load(
    path: TemplatePath,
  ): Promise<Result<Template, DomainError & { message: string }>>;

  /**
   * Check if template exists at path
   */
  exists(
    path: TemplatePath,
  ): Promise<Result<boolean, DomainError & { message: string }>>;

  /**
   * Get template base directory for resolving relative paths
   */
  getBaseDirectory(): Result<string, DomainError & { message: string }>;
}
