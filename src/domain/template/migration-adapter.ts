/**
 * Migration Adapter
 *
 * Provides backward compatibility for existing code that uses old template mappers
 * This allows gradual migration to the new consolidated template domain
 */

import type { DomainError, Result } from "../core/result.ts";
import { createProcessingStageError } from "../core/result.ts";
import type { Template } from "../models/entities.ts";
import { TemplateProcessingService } from "./service.ts";
import { FileTemplateRepository } from "../../infrastructure/template/file-template-repository.ts";
import type { AIAnalyzerPort } from "../../infrastructure/ports/index.ts";

/**
 * Adapter for old TemplateMapper interface
 * Redirects calls to new TemplateProcessingService
 */
export class TemplateMapperAdapter {
  private service: TemplateProcessingService;

  constructor(aiAnalyzer?: AIAnalyzerPort) {
    const repository = new FileTemplateRepository();
    this.service = new TemplateProcessingService({
      repository,
      aiAnalyzer,
      preferAI: false, // Use native strategy for backward compatibility
    });
  }

  /**
   * Map data to template (old interface)
   */
  async map(
    data: unknown,
    template: Template,
  ): Promise<Result<string, DomainError>> {
    // Convert old Template to new format
    const templateId = template.getId();

    // First, save the template to repository so it can be loaded
    const repository = new FileTemplateRepository();
    const saveResult = await repository.save(template);
    if (!saveResult.ok) {
      return saveResult;
    }

    // Process using new service
    return this.service.processTemplate(
      templateId.getValue(),
      data,
      {}, // Empty schema for backward compatibility
      template.getFormat().getFormat() as "json" | "yaml",
    );
  }
}

/**
 * Adapter for old AITemplateMapper interface
 * Redirects calls to new TemplateProcessingService
 */
export class AITemplateMapperAdapter {
  private service: TemplateProcessingService;

  constructor(private readonly aiAnalyzer: AIAnalyzerPort) {
    const repository = new FileTemplateRepository();
    this.service = new TemplateProcessingService({
      repository,
      aiAnalyzer,
      preferAI: true, // Use AI strategy
    });
  }

  /**
   * Apply template using AI (old interface)
   */
  async applyTemplate(
    extractedData: unknown,
    schema: object,
    template: Template,
  ): Promise<Result<string, DomainError>> {
    // Save template to repository
    const repository = new FileTemplateRepository();
    const saveResult = await repository.save(template);
    if (!saveResult.ok) {
      return saveResult;
    }

    // Process using new service
    return this.service.processTemplate(
      template.getId().getValue(),
      extractedData,
      schema,
      template.getFormat().getFormat() as "json" | "yaml",
    );
  }
}

/**
 * Adapter for SimpleTemplateMapper
 * Maps the old interface to new consolidated service
 */
export class SimpleTemplateMapperAdapter {
  private service: TemplateProcessingService;

  constructor() {
    const repository = new FileTemplateRepository();
    this.service = new TemplateProcessingService({
      repository,
      preferAI: false, // Use native strategy
    });
  }

  /**
   * Map extracted data to template (old interface)
   */
  async map(
    data: { getData(): unknown },
    template: {
      applyRules(data: unknown): unknown;
      getFormat(): { getTemplate(): string; getFormat(): string };
    },
  ): Promise<Result<{ getData(): unknown }, DomainError>> {
    try {
      // Extract data
      const rawData = data.getData();
      const mappedData = template.applyRules(rawData);

      // Create a proper Template object
      const { TemplateDefinition, Template: TemplateClass } = await import(
        "../models/template.ts"
      );

      const format = template.getFormat().getFormat();
      const templateStr = template.getFormat().getTemplate();

      const definitionResult = TemplateDefinition.create(
        templateStr,
        format as "json" | "yaml" | "handlebars" | "custom",
      );

      if (!definitionResult.ok) {
        return definitionResult;
      }

      const templateResult = TemplateClass.create(
        "temp-" + Date.now(),
        definitionResult.data,
      );

      if (!templateResult.ok) {
        return templateResult;
      }

      // Save and process
      const repository = new FileTemplateRepository();
      await repository.save(templateResult.data);

      const result = await this.service.processTemplate(
        templateResult.data.getId(),
        mappedData,
        {},
        format as "json" | "yaml",
      );

      if (!result.ok) {
        return result;
      }

      // Wrap result in old format
      return {
        ok: true,
        data: {
          getData(): unknown {
            return JSON.parse(result.data);
          },
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createProcessingStageError(
          "migration adapter",
          { kind: "ParseError", input: String(error) },
          `Migration adapter failed: ${error}`,
        ),
      };
    }
  }
}
