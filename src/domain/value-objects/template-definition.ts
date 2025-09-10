/**
 * TemplateDefinition Value Object
 *
 * Represents a validated template definition with content and metadata
 * Follows Totality principles with Smart Constructor pattern
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";

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
   * Validates template content and metadata
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

    const trimmedContent = content.trim();

    // Validate engine type
    const validEngines: TemplateEngine[] = [
      "handlebars",
      "mustache",
      "liquid",
      "ejs",
      "pug",
      "html",
      "text",
      "custom",
    ];

    if (!validEngines.includes(engine)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: engine,
            expectedFormat: validEngines.join(", "),
          },
          `Invalid template engine: ${engine}`,
        ),
      };
    }

    // Validate metadata
    const metadataValidation = TemplateDefinition.validateMetadata(metadata);
    if (!metadataValidation.ok) {
      return metadataValidation;
    }

    // Validate template syntax based on engine
    const syntaxValidation = TemplateDefinition.validateTemplateSyntax(
      trimmedContent,
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
      data: new TemplateDefinition(trimmedContent, engine, frozenMetadata),
    };
  }

  /**
   * Validate metadata structure
   */
  private static validateMetadata(
    metadata: TemplateMetadata,
  ): Result<void, DomainError & { message: string }> {
    // Validate name if provided
    if (metadata.name !== undefined) {
      if (typeof metadata.name !== "string" || metadata.name.trim() === "") {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(metadata.name),
              expectedFormat: "non-empty string",
            },
            "Template name must be a non-empty string",
          ),
        };
      }
    }

    // Validate version format if provided
    if (metadata.version !== undefined) {
      if (typeof metadata.version !== "string") {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(metadata.version),
              expectedFormat: "version string",
            },
            "Template version must be a string",
          ),
        };
      }
    }

    // Validate tags if provided
    if (metadata.tags !== undefined) {
      if (!Array.isArray(metadata.tags)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(metadata.tags),
              expectedFormat: "array of strings",
            },
            "Template tags must be an array",
          ),
        };
      }

      for (const tag of metadata.tags) {
        if (typeof tag !== "string" || tag.trim() === "") {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: String(tag),
                expectedFormat: "non-empty string",
              },
              "All template tags must be non-empty strings",
            ),
          };
        }
      }
    }

    // Validate variables if provided
    if (metadata.variables !== undefined) {
      if (!Array.isArray(metadata.variables)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(metadata.variables),
              expectedFormat: "array of strings",
            },
            "Template variables must be an array",
          ),
        };
      }

      for (const variable of metadata.variables) {
        if (typeof variable !== "string" || variable.trim() === "") {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: String(variable),
                expectedFormat: "non-empty string",
              },
              "All template variables must be non-empty strings",
            ),
          };
        }
      }
    }

    return { ok: true, data: undefined };
  }

  /**
   * Validate template syntax based on engine
   */
  private static validateTemplateSyntax(
    content: string,
    engine: TemplateEngine,
  ): Result<void, DomainError & { message: string }> {
    switch (engine) {
      case "handlebars": {
        // Basic Handlebars validation - check for balanced braces
        const openBraces = (content.match(/\{\{/g) || []).length;
        const closeBraces = (content.match(/\}\}/g) || []).length;
        if (openBraces !== closeBraces) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: content.substring(0, 100),
                expectedFormat: "balanced Handlebars braces",
              },
              "Handlebars template has unbalanced braces",
            ),
          };
        }
        break;
      }

      case "mustache": {
        // Basic Mustache validation - check for balanced braces
        const openBraces = (content.match(/\{\{/g) || []).length;
        const closeBraces = (content.match(/\}\}/g) || []).length;
        if (openBraces !== closeBraces) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: content.substring(0, 100),
                expectedFormat: "balanced Mustache braces",
              },
              "Mustache template has unbalanced braces",
            ),
          };
        }
        break;
      }

      case "liquid": {
        // Basic Liquid validation - check for balanced tags
        const openTags = (content.match(/\{\%/g) || []).length;
        const closeTags = (content.match(/\%\}/g) || []).length;
        if (openTags !== closeTags) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: content.substring(0, 100),
                expectedFormat: "balanced Liquid tags",
              },
              "Liquid template has unbalanced tags",
            ),
          };
        }
        break;
      }

      case "ejs": {
        // Basic EJS validation - check for balanced tags
        const openTags = (content.match(/<%/g) || []).length;
        const closeTags = (content.match(/%>/g) || []).length;
        if (openTags !== closeTags) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: content.substring(0, 100),
                expectedFormat: "balanced EJS tags",
              },
              "EJS template has unbalanced tags",
            ),
          };
        }
        break;
      }

      case "pug":
      case "html":
      case "text":
      case "custom":
        // No specific syntax validation for these engines
        break;

      default: {
        // Exhaustive check
        const _exhaustiveCheck: never = engine;
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(_exhaustiveCheck),
              expectedFormat: "valid template engine",
            },
            `Unknown template engine: ${String(_exhaustiveCheck)}`,
          ),
        };
      }
    }

    return { ok: true, data: undefined };
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
    const variables: Set<string> = new Set();

    switch (this.engine) {
      case "handlebars":
      case "mustache": {
        // Extract {{variable}} patterns
        const matches = this.content.matchAll(
          /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
        );
        for (const match of matches) {
          variables.add(match[1]);
        }
        break;
      }

      case "liquid": {
        // Extract {{variable}} and {% assign variable patterns
        const outputMatches = this.content.matchAll(
          /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
        );
        for (const match of outputMatches) {
          variables.add(match[1]);
        }
        break;
      }

      case "ejs": {
        // Extract <%=variable%> patterns
        const matches = this.content.matchAll(
          /<%=\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*%>/g,
        );
        for (const match of matches) {
          variables.add(match[1]);
        }
        break;
      }

      default:
        // For other engines, return metadata variables or empty array
        break;
    }

    return Array.from(variables).sort();
  }

  /**
   * Check if template content contains specific text
   */
  contains(text: string): boolean {
    return this.content.includes(text);
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
    return this.content.trim().length === 0;
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
