/**
 * Template Variable Orchestrator Service
 * Extracted from template-variable-resolver.ts for better domain separation
 * Orchestrates all template variable operations following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";
import { PropertyPathNavigator } from "../models/property-path.ts";
import { TemplateVariableExtractor } from "./template-variable-extractor.service.ts";
import { TemplateVariableParser } from "./template-variable-parser.service.ts";
import { TemplateVariableResolverImpl } from "./template-variable-resolver-impl.service.ts";
import { TemplateProcessor } from "./template-processor.service.ts";
import type { TemplateVariable } from "../value-objects/template-variable.value-object.ts";
import type {
  TemplateProcessingResult,
  VariableResolutionResult,
} from "../value-objects/variable-resolution-result.value-object.ts";

/**
 * Template Variable Orchestrator - Main orchestrator for all template variable operations
 * Follows DDD principles with proper service composition
 */
export class TemplateVariableOrchestrator {
  private readonly parser: TemplateVariableParser;
  private readonly extractor: TemplateVariableExtractor;
  private readonly resolver: TemplateVariableResolverImpl;
  private readonly processor: TemplateProcessor;

  constructor(pathNavigator?: PropertyPathNavigator) {
    // Initialize with dependency injection or create default implementation
    const navigator = pathNavigator || this.createDefaultNavigator();

    this.parser = new TemplateVariableParser();
    this.extractor = new TemplateVariableExtractor(this.parser);
    this.resolver = new TemplateVariableResolverImpl(navigator);
    this.processor = new TemplateProcessor(this.extractor, this.resolver);
  }

  /**
   * Extract variables from template content
   */
  extractVariables(
    templateContent: string,
  ): Result<TemplateVariable[], DomainError & { message: string }> {
    return this.extractor.extractVariables(templateContent);
  }

  /**
   * Process template by resolving and substituting variables
   */
  processTemplate(
    templateContent: string,
    data: Record<string, unknown>,
    allowPartialResolution = false,
  ): Result<TemplateProcessingResult, DomainError & { message: string }> {
    return this.processor.processTemplate(
      templateContent,
      data,
      allowPartialResolution,
    );
  }

  /**
   * Resolve a single variable against provided data
   */
  resolveVariable(
    variable: TemplateVariable,
    data: Record<string, unknown>,
    useDefaults: boolean,
  ): Result<VariableResolutionResult, DomainError & { message: string }> {
    return this.resolver.resolveVariable(variable, data, useDefaults);
  }

  /**
   * Parse variable content from template
   */
  parseVariableContent(
    content: string,
    placeholder: string,
  ): Result<TemplateVariable, DomainError & { message: string }> {
    return this.parser.parseVariableContent(content, placeholder);
  }

  /**
   * Create default PropertyPathNavigator if none provided
   */
  private createDefaultNavigator(): PropertyPathNavigator {
    const navigatorResult = PropertyPathNavigator.create();
    if (!navigatorResult.ok) {
      throw new Error(
        createDomainError({
          kind: "NotConfigured",
          component: "PropertyPathNavigator",
        }).message,
      );
    }
    return navigatorResult.data;
  }
}
