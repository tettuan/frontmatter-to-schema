/**
 * Template Aggregate Root
 *
 * Following DDD principles from docs/domain/domain-boundary.md:
 * - CD4: Template Management Domain
 * - Responsible for template loading, validation, and application
 */

import type { Result } from "../core/result.ts";
import type { ValidationError } from "../shared/errors.ts";
import { createValidationError } from "../shared/errors.ts";
import type { Template } from "../models/domain-models.ts";
import type { TemplateRepository } from "./repository.ts";
import type { TemplateProcessingStrategy } from "./strategies.ts";
import { TemplateAppliedEvent, TemplateLoadedEvent } from "./events.ts";

export interface TemplateApplicationContext {
  extractedData: unknown;
  schema: object;
  format: "json" | "yaml" | "markdown";
}

/**
 * Template Aggregate - The root of the Template Management bounded context
 * Coordinates all template operations while maintaining domain invariants
 */
export class TemplateAggregate {
  private loadedTemplates: Map<string, Template> = new Map();
  private events: Array<TemplateLoadedEvent | TemplateAppliedEvent> = [];

  constructor(
    private readonly repository: TemplateRepository,
    private readonly processingStrategy: TemplateProcessingStrategy,
  ) {}

  /**
   * Load a template from the repository
   * Emits: TemplateLoadedEvent
   */
  async loadTemplate(
    templateId: string,
  ): Promise<Result<Template, ValidationError>> {
    // Validate templateId
    if (!templateId || templateId.trim() === "") {
      return {
        ok: false,
        error: createValidationError("Template ID cannot be empty"),
      };
    }

    // Check if already loaded
    const cached = this.loadedTemplates.get(templateId);
    if (cached) {
      return { ok: true, data: cached };
    }

    // Load from repository
    const result = await this.repository.load(templateId);
    if (!result.ok) {
      return result;
    }

    // Cache and emit event
    this.loadedTemplates.set(templateId, result.data);
    this.events.push(new TemplateLoadedEvent(templateId, result.data));

    return result;
  }

  /**
   * Apply a template to data using the configured strategy
   * Emits: TemplateAppliedEvent
   */
  async applyTemplate(
    templateId: string,
    context: TemplateApplicationContext,
  ): Promise<Result<string, ValidationError>> {
    // Validate context
    if (!context) {
      return {
        ok: false,
        error: createValidationError(
          "Template application context cannot be null",
        ),
      };
    }

    // Load template if not cached
    const templateResult = await this.loadTemplate(templateId);
    if (!templateResult.ok) {
      return templateResult;
    }

    const template = templateResult.data;

    // Validate template format matches requested format
    const templateFormat = template.getDefinition().getFormat();
    if (templateFormat !== "custom" && templateFormat !== context.format) {
      return {
        ok: false,
        error: createValidationError(
          `Template format mismatch: template is ${templateFormat}, requested ${context.format}`,
        ),
      };
    }

    // Apply template using strategy
    const result = await this.processingStrategy.process(template, context);

    if (result.ok) {
      this.events.push(
        new TemplateAppliedEvent(templateId, context, result.data),
      );
    }

    return result;
  }

  /**
   * Get all domain events that have occurred
   * Used for event sourcing and integration with other domains
   */
  getEvents(): ReadonlyArray<TemplateLoadedEvent | TemplateAppliedEvent> {
    return [...this.events];
  }

  /**
   * Clear events after they have been published
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get currently loaded templates (for monitoring/debugging)
   */
  getLoadedTemplates(): ReadonlyMap<string, Template> {
    return new Map(this.loadedTemplates);
  }
}
