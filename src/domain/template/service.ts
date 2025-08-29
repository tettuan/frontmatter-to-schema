/**
 * Unified Template Processing Service
 *
 * This is the main entry point for all template operations
 * Consolidates the functionality from multiple template mappers
 */

import type { DomainError, Result } from "../core/result.ts";
import {
  TemplateAggregate,
  type TemplateApplicationContext,
} from "./aggregate.ts";
import type { TemplateRepository } from "../services/interfaces.ts";
import {
  NativeTemplateStrategy,
  type TemplateProcessingStrategy,
} from "./strategies.ts";
import type { EventStore } from "./events.ts";

export interface TemplateServiceConfig {
  repository: TemplateRepository;
  eventStore?: EventStore;
  preferAI?: boolean; // Default true
}

/**
 * Unified template processing service
 * Replaces: TemplateMapper, AITemplateMapper, SimpleTemplateMapper
 */
export class TemplateProcessingService {
  private readonly aggregate: TemplateAggregate;
  private readonly eventStore?: EventStore;

  constructor(config: TemplateServiceConfig) {
    // Setup processing strategy
    const strategy = this.createStrategy(config);

    // Create aggregate
    this.aggregate = new TemplateAggregate(
      config.repository,
      strategy,
    );

    this.eventStore = config.eventStore;
  }

  /**
   * Process a template with data
   * This is the main entry point for template processing
   */
  async processTemplate(
    templateId: string,
    data: unknown,
    schema: object,
    format: "json" | "yaml" | "markdown" = "json",
  ): Promise<Result<string, DomainError>> {
    // Validate inputs
    if (!templateId || templateId.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        } as DomainError,
      };
    }

    if (data === null || data === undefined) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        } as DomainError,
      };
    }

    // Validate format
    const validFormats = ["json", "yaml", "markdown"];
    if (!validFormats.includes(format)) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: format,
          expectedFormat: "json, yaml, or markdown",
        } as DomainError,
      };
    }

    const context: TemplateApplicationContext = {
      extractedData: data,
      schema,
      format,
    };

    // Process through aggregate
    const result = await this.aggregate.applyTemplate(templateId, context);

    // Publish events if event store is configured
    if (this.eventStore) {
      const events = this.aggregate.getEvents();
      for (const event of events) {
        this.eventStore.publish(event);
      }
      this.aggregate.clearEvents();
    }

    return result;
  }

  /**
   * Load a template without processing
   * Useful for validation or inspection
   */
  loadTemplate(templateId: string) {
    return this.aggregate.loadTemplate(templateId);
  }

  /**
   * Get loaded templates (for monitoring/debugging)
   */
  getLoadedTemplates() {
    return this.aggregate.getLoadedTemplates();
  }

  /**
   * Create the appropriate processing strategy based on configuration
   */
  private createStrategy(
    _config: TemplateServiceConfig,
  ): TemplateProcessingStrategy {
    // Always use native strategy as AI has been removed
    const nativeStrategy = new NativeTemplateStrategy();
    return nativeStrategy;
  }
}

/**
 * Factory function for creating template service with default configuration
 */
export function createTemplateService(
  repository: TemplateRepository,
  eventStore?: EventStore,
): TemplateProcessingService {
  return new TemplateProcessingService({
    repository,
    eventStore,
    preferAI: false,
  });
}
