/**
 * TemplateValidator Domain Service
 *
 * Validates template content, metadata, and syntax according to business rules
 * Follows Totality principles with Result<T, E> return types
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import { DEFAULT_ERROR_CONTEXT_LIMIT } from "../../shared/constants.ts";
import type {
  TemplateEngine,
  TemplateMetadata,
} from "../value-objects/template-definition.ts";

/**
 * Domain service for template validation
 * Encapsulates all validation logic for templates and metadata
 */
export class TemplateValidator {
  /**
   * Validate metadata structure according to business rules
   */
  static validateMetadata(
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
   * Validate template syntax based on engine type
   */
  static validateTemplateSyntax(
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
                input: DEFAULT_ERROR_CONTEXT_LIMIT.truncateContent(content),
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
                input: DEFAULT_ERROR_CONTEXT_LIMIT.truncateContent(content),
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
                input: DEFAULT_ERROR_CONTEXT_LIMIT.truncateContent(content),
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
                input: DEFAULT_ERROR_CONTEXT_LIMIT.truncateContent(content),
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
   * Validate engine type against allowed engines
   */
  static validateEngine(
    engine: TemplateEngine,
  ): Result<void, DomainError & { message: string }> {
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

    return { ok: true, data: undefined };
  }
}
