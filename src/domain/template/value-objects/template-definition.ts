/**
 * TemplateDefinition Value Object
 *
 * Represents a validated template definition with content and metadata
 * Follows Totality principles with Smart Constructor pattern
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import { TemplateValidator } from "../services/template-validator.ts";
import { TemplateParser } from "../services/template-parser.ts";

/**
 * Template engine types as discriminated union
 */
export type TemplateEngine =
  | "handlebars"
  | "mustache"
  | "liquid"
  | "ejs"
  | "pug"
  | "html"
  | "text"
  | "custom";

/**
 * Template metadata interface
 */
export interface TemplateMetadata {
  readonly name?: string;
  readonly description?: string;
  readonly version?: string;
  readonly author?: string;
  readonly tags?: readonly string[];
  readonly variables?: readonly string[];
}

/**
 * TemplateDefinition value object with validation
 * Ensures template content is valid and well-formed
 */
export class TemplateDefinition {
  private constructor(
    private readonly content: string,
    private readonly engine: TemplateEngine,
    private readonly metadata: TemplateMetadata,
  ) {}

  /**
   * Smart Constructor for TemplateDefinition
   * Validates template content and metadata using domain services
   */
  static create(
    content: string,
    engine: TemplateEngine,
    metadata: TemplateMetadata = {},
  ): Result<TemplateDefinition, DomainError & { message: string }> {
    // Check for empty content
    if (!content || content.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Template content cannot be empty",
        ),
      };
    }

    const normalizedContent = TemplateParser.normalizeContent(content);

    // Validate engine type using domain service
    const engineValidation = TemplateValidator.validateEngine(engine);
    if (!engineValidation.ok) {
      return engineValidation;
    }

    // Validate metadata using domain service
    const metadataValidation = TemplateValidator.validateMetadata(metadata);
    if (!metadataValidation.ok) {
      return metadataValidation;
    }

    // Validate template syntax using domain service
    const syntaxValidation = TemplateValidator.validateTemplateSyntax(
      normalizedContent,
      engine,
    );
    if (!syntaxValidation.ok) {
      return syntaxValidation;
    }

    // Freeze metadata to ensure immutability
    const frozenMetadata: TemplateMetadata = {
      ...metadata,
      tags: metadata.tags ? Object.freeze([...metadata.tags]) : undefined,
      variables: metadata.variables
        ? Object.freeze([...metadata.variables])
        : undefined,
    };

    return {
      ok: true,
      data: new TemplateDefinition(normalizedContent, engine, frozenMetadata),
    };
  }

  /**
   * Get the template content
   */
  getContent(): string {
    return this.content;
  }

  /**
   * Get the template engine
   */
  getEngine(): TemplateEngine {
    return this.engine;
  }

  /**
   * Get the template metadata
   */
  getMetadata(): TemplateMetadata {
    return { ...this.metadata };
  }

  /**
   * Get template name
   */
  getName(): string | undefined {
    return this.metadata.name;
  }

  /**
   * Get template description
   */
  getDescription(): string | undefined {
    return this.metadata.description;
  }

  /**
   * Get template version
   */
  getVersion(): string | undefined {
    return this.metadata.version;
  }

  /**
   * Get template tags
   */
  getTags(): readonly string[] {
    return this.metadata.tags || [];
  }

  /**
   * Get template variables
   */
  getVariables(): readonly string[] {
    return this.metadata.variables || [];
  }

  /**
   * Check if template has a specific tag
   */
  hasTag(tag: string): boolean {
    return this.getTags().includes(tag);
  }

  /**
   * Check if template has a specific variable
   */
  hasVariable(variable: string): boolean {
    return this.getVariables().includes(variable);
  }

  /**
   * Extract variables from template content based on engine
   */
  extractVariables(): string[] {
    return TemplateParser.extractVariables(this.content, this.engine);
  }

  /**
   * Check if template content contains specific text
   */
  contains(text: string): boolean {
    return TemplateParser.containsText(this.content, text);
  }

  /**
   * Get template content length
   */
  getLength(): number {
    return this.content.length;
  }

  /**
   * Check if template is empty (only whitespace)
   */
  isEmpty(): boolean {
    return TemplateParser.getContentStats(this.content).isEmpty;
  }

  /**
   * Get template content statistics
   */
  getStats(): {
    readonly length: number;
    readonly isEmpty: boolean;
    readonly lineCount: number;
    readonly wordCount: number;
  } {
    return TemplateParser.getContentStats(this.content);
  }

  /**
   * Create a new template with updated metadata
   */
  withMetadata(
    newMetadata: Partial<TemplateMetadata>,
  ): Result<TemplateDefinition, DomainError & { message: string }> {
    const mergedMetadata = {
      ...this.metadata,
      ...newMetadata,
    };

    return TemplateDefinition.create(this.content, this.engine, mergedMetadata);
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    const name = this.getName() || "unnamed";
    return `TemplateDefinition(${this.engine}, "${name}", ${this.getLength()} chars)`;
  }
}
