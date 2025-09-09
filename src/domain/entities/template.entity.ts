/**
 * Template domain entity (core)
 * Extracted from entities-original.ts Template class
 * Represents a template with its basic properties and identity
 * Complex operations delegated to service classes
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type { MappingRule, TemplateFormat } from "../models/value-objects.ts";
import type { TemplateApplicationMode } from "../types/domain-types.ts";
import type { TemplateId } from "../value-objects/identifier-value-objects.ts";
import { PropertyPathNavigator } from "../models/property-path.ts";

/**
 * Template entity - core domain object
 * Focused on template identity and basic data management
 * Complex operations handled by dedicated service classes
 */
export class Template {
  private readonly pathNavigator: PropertyPathNavigator;

  private constructor(
    private readonly id: TemplateId,
    private readonly format: TemplateFormat,
    private readonly mappingRules: MappingRule[],
    private readonly description: string,
    pathNavigator: PropertyPathNavigator,
  ) {
    this.pathNavigator = pathNavigator;
  }

  static create(
    id: TemplateId,
    format: TemplateFormat,
    mappingRules: MappingRule[],
    description: string = "",
  ): Result<Template, DomainError & { message: string }> {
    // Initialize PropertyPathNavigator service
    const navigatorResult = PropertyPathNavigator.create();
    if (!navigatorResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "NotConfigured",
            component: "PropertyPathNavigator",
          },
          `Failed to initialize PropertyPathNavigator: ${navigatorResult.error.message}`,
        ),
      };
    }
    return {
      ok: true,
      data: new Template(
        id,
        format,
        mappingRules,
        description,
        navigatorResult.data,
      ),
    };
  }

  /**
   * Legacy backward compatibility method for tests during migration
   * @deprecated Use create() method that returns Result<Template, Error>
   * This method throws on error for backward compatibility
   */
  static createLegacy(
    id: TemplateId,
    format: TemplateFormat,
    mappingRules: MappingRule[],
    description: string = "",
  ): Template {
    const result = Template.create(id, format, mappingRules, description);
    if (!result.ok) {
      throw new Error(`Template creation failed: ${result.error.message}`);
    }
    return result.data;
  }

  getId(): TemplateId {
    return this.id;
  }

  getFormat(): TemplateFormat {
    return this.format;
  }

  getMappingRules(): MappingRule[] {
    return this.mappingRules;
  }

  getDescription(): string {
    return this.description;
  }

  getPathNavigator(): PropertyPathNavigator {
    return this.pathNavigator;
  }

  /**
   * Apply template rules to data
   * Delegates to TemplateApplicationService for complex logic
   * This method serves as an adapter to maintain the existing API
   *
   * Note: In a production system, this would use dependency injection
   * For now, we'll create a simpler implementation to avoid circular dependencies
   */
  async applyRules(
    data: Record<string, unknown>,
    mode: TemplateApplicationMode,
  ): Promise<
    Result<Record<string, unknown>, DomainError & { message: string }>
  > {
    // Dynamic import to avoid circular dependencies
    const { TemplateApplicationService } = await import(
      "../services/template-application.service.ts"
    );

    // Create service instance and delegate
    const service = new TemplateApplicationService();
    return service.applyRules(this, data, mode);
  }
}
