/**
 * Simplified Component Registry - Replaces Complex Factory Pattern
 * Applies functional gravity principle: related components are co-located
 * Follows AI Complexity Control: reduces abstraction entropy
 */

import type { Result } from "./result.ts";
import { createDomainError, type DomainError } from "./result.ts";

// Direct imports without factory abstractions
import { TemplateFormatHandlerFactory } from "../template/format-handlers.ts";
import type { TemplateFormatHandler } from "../template/format-handlers.ts";
import { UnifiedTemplateProcessor } from "../template/unified-template-processor.ts";

/**
 * Template Components - Direct access without factory complexity
 * Represents what was previously created by TemplateDomainFactory
 */
export interface TemplateComponents {
  formatHandlers: Map<string, TemplateFormatHandler>;
  templateProcessor: UnifiedTemplateProcessor;
}

/**
 * Component Registry - Simple, direct component access
 * Replaces complex factory hierarchy with straightforward service locator
 */
export class ComponentRegistry {
  private static templateComponents: TemplateComponents | null = null;

  /**
   * Get template components - creates once, reuses thereafter
   * Much simpler than factory pattern, same functionality
   */
  static getTemplateComponents(): TemplateComponents {
    if (!ComponentRegistry.templateComponents) {
      ComponentRegistry.templateComponents = ComponentRegistry
        .createTemplateComponents();
    }
    return ComponentRegistry.templateComponents;
  }

  /**
   * Create template components directly
   * Eliminates factory abstraction layer while preserving functionality
   */
  private static createTemplateComponents(): TemplateComponents {
    // Get all available format handlers using existing factories
    const formatHandlers = new Map<string, TemplateFormatHandler>();

    // Register known formats - same logic as before, simpler execution
    const formats = ["json", "yaml", "handlebars"];
    for (const format of formats) {
      const handlerResult = TemplateFormatHandlerFactory.getHandler(format);
      if (handlerResult.ok) {
        formatHandlers.set(format, handlerResult.data);
      }
    }

    // Create unified template processor
    const templateProcessorResult = UnifiedTemplateProcessor.create();
    if ("kind" in templateProcessorResult) {
      throw new Error(
        `Failed to create template processor: ${templateProcessorResult.kind}`,
      );
    }

    return {
      formatHandlers,
      templateProcessor: templateProcessorResult,
    };
  }

  /**
   * Get specific format handler
   * Simplified interface for common use case
   */
  static getFormatHandler(
    format: string,
  ): Result<TemplateFormatHandler, DomainError & { message: string }> {
    const components = ComponentRegistry.getTemplateComponents();
    const handler = components.formatHandlers.get(format);

    if (!handler) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "NotFound", resource: format },
          `Template format handler not found: ${format}`,
        ),
      };
    }

    return { ok: true, data: handler };
  }

  /**
   * Get template processor
   * Simplified interface for template processing
   */
  static getTemplateProcessor(): UnifiedTemplateProcessor {
    const components = ComponentRegistry.getTemplateComponents();
    return components.templateProcessor;
  }

  /**
   * Reset components - useful for testing
   */
  static reset(): void {
    ComponentRegistry.templateComponents = null;
  }
}

/**
 * Legacy compatibility - gradually migrate away from this
 * @deprecated Use ComponentRegistry directly for better performance
 */
export const TemplateServices = {
  getFormatHandler: ComponentRegistry.getFormatHandler,
  getTemplateProcessor: ComponentRegistry.getTemplateProcessor,
};
