import { Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import { ValidatedData } from "./frontmatter-context-port.ts";

/**
 * Template Context Port - DDD Boundary Interface
 *
 * Defines the contract for Template Context interactions following DDD principles.
 * This interface encapsulates all Template-related operations following the
 * medium lifecycle pattern defined in the architecture.
 */

export interface TemplateData {
  readonly templatePath: string;
  readonly content: string;
  readonly format: "json" | "yaml" | "markdown";
  readonly variables: string[];
}

export interface EnrichedResult {
  readonly mainData: Record<string, unknown>;
  readonly aggregatedData?: Record<string, unknown>;
  readonly derivedFields?: Record<string, unknown>;
}

export interface RenderedOutput {
  readonly content: string;
  readonly format: "json" | "yaml" | "markdown";
  readonly templatePath: string;
  readonly renderedAt: Date;
}

export type TemplateError = DomainError & {
  readonly kind:
    | "TemplateNotFound"
    | "TemplateInvalid"
    | "RenderError"
    | "VariableResolutionFailed";
};

/**
 * Template Context Port Interface
 *
 * Following the DDD architecture design from docs/domain/domain-boundary.md:
 * - Medium lifecycle context for template management
 * - Receives ValidatedData from Frontmatter Context
 * - Receives EnrichedResult from Aggregation Context
 * - Implements the final Template Application stage
 */
export interface TemplateContextPort {
  /**
   * Load template from the specified path
   * Supports template caching for medium lifecycle
   */
  loadTemplate(
    templatePath: string,
  ): Promise<Result<TemplateData, TemplateError>>;

  /**
   * Render template with validated data
   * Implements core Template Application stage
   */
  renderTemplate(
    template: TemplateData,
    data: ValidatedData,
  ): Result<RenderedOutput, TemplateError>;

  /**
   * Render template with enriched result from aggregation
   * Supports complex data composition scenarios
   */
  renderWithEnrichedData(
    template: TemplateData,
    enrichedData: EnrichedResult,
  ): Result<RenderedOutput, TemplateError>;

  /**
   * Resolve template path from schema configuration
   * Supports x-template schema extension resolution
   */
  resolveTemplatePath(
    schemaPath: string,
    explicitTemplatePath?: string,
  ): Result<string, TemplateError>;

  /**
   * Get available variables from template
   * Supports template analysis and validation
   */
  getTemplateVariables(template: TemplateData): string[];

  /**
   * Validate that data provides all required template variables
   * Prevents render-time failures
   */
  validateTemplateData(
    template: TemplateData,
    data: ValidatedData | EnrichedResult,
  ): Result<boolean, TemplateError>;
}

/**
 * Template Context Factory
 *
 * Factory interface for creating Template Context instances.
 * Allows dependency injection while maintaining context boundaries.
 */
export interface TemplateContextFactory {
  create(): TemplateContextPort;
}
