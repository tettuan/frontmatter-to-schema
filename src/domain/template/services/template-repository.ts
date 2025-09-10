/**
 * TemplateRepository Domain Service
 *
 * Handles template loading and management following DDD and Totality principles
 * Consolidates template repository business logic into a single domain service
 * Uses value objects and returns Result<T,E> for all operations
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import { TemplateDefinition } from "../../value-objects/template-definition.ts";
import type { TemplatePath } from "../../value-objects/template-path.ts";

/**
 * Template loading result
 */
export interface TemplateLoadResult {
  readonly template: TemplateDefinition;
  readonly path: TemplatePath;
  readonly lastModified?: Date;
}

/**
 * Template cache entry
 */
interface TemplateCacheEntry {
  readonly template: TemplateDefinition;
  readonly loadedAt: Date;
  readonly lastModified?: Date;
}

/**
 * TemplateRepository domain service for managing template loading and caching
 * Follows Totality principles - all functions are total and return Result<T,E>
 */
export class TemplateRepository {
  private readonly cache = new Map<string, TemplateCacheEntry>();

  private constructor() {}

  /**
   * Smart Constructor for TemplateRepository
   * @returns Result containing TemplateRepository
   */
  static create(): Result<
    TemplateRepository,
    DomainError & { message: string }
  > {
    return {
      ok: true,
      data: new TemplateRepository(),
    };
  }

  /**
   * Load template from path with caching
   * @param path - TemplatePath to load from
   * @param useCache - Whether to use cached version if available
   * @returns Result containing template or error
   */
  async loadTemplate(
    path: TemplatePath,
    useCache: boolean = true,
  ): Promise<Result<TemplateLoadResult, DomainError & { message: string }>> {
    const pathStr = path.getValue();

    // Check cache first if enabled
    if (useCache) {
      const cached = this.cache.get(pathStr);
      if (cached) {
        return {
          ok: true,
          data: {
            template: cached.template,
            path,
            lastModified: cached.lastModified,
          },
        };
      }
    }

    // Validate path exists (simulation - in real implementation would use filesystem)
    const validationResult = this.validateTemplatePath(pathStr);
    if (!validationResult.ok) {
      return validationResult;
    }

    // Load template content (simulation)
    const loadResult = await this.loadTemplateContent(pathStr);
    if (!loadResult.ok) {
      return loadResult;
    }

    const { template, lastModified } = loadResult.data;

    // Cache the loaded template
    if (useCache) {
      this.cache.set(pathStr, {
        template,
        loadedAt: new Date(),
        lastModified,
      });
    }

    return {
      ok: true,
      data: {
        template,
        path,
        lastModified,
      },
    };
  }

  /**
   * Check if template exists at path
   * @param path - TemplatePath to check
   * @returns Result containing existence status
   */
  async templateExists(
    path: TemplatePath,
  ): Promise<Result<boolean, DomainError & { message: string }>> {
    const pathStr = path.getValue();

    // Check cache first
    if (this.cache.has(pathStr)) {
      return { ok: true, data: true };
    }

    // Simulate filesystem check
    const exists = await this.checkTemplateFileExists(pathStr);
    return { ok: true, data: exists };
  }

  /**
   * Get cached template if available
   * @param path - TemplatePath to get from cache
   * @returns Result containing cached template or null
   */
  getCachedTemplate(
    path: TemplatePath,
  ): Result<TemplateDefinition | null, DomainError & { message: string }> {
    const pathStr = path.getValue();
    const cached = this.cache.get(pathStr);

    return {
      ok: true,
      data: cached ? cached.template : null,
    };
  }

  /**
   * Clear template cache
   * @param path - Optional specific path to clear, clears all if not provided
   * @returns Result indicating success
   */
  clearCache(
    path?: TemplatePath,
  ): Result<void, DomainError & { message: string }> {
    if (path) {
      this.cache.delete(path.getValue());
    } else {
      this.cache.clear();
    }

    return { ok: true, data: undefined };
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{
      path: string;
      loadedAt: Date;
      lastModified?: Date;
    }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([path, entry]) => ({
      path,
      loadedAt: entry.loadedAt,
      lastModified: entry.lastModified,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Preload multiple templates
   * @param paths - Array of TemplatePaths to preload
   * @returns Result containing successful loads and errors
   */
  async preloadTemplates(
    paths: TemplatePath[],
  ): Promise<
    Result<{
      loaded: TemplateLoadResult[];
      errors: Array<
        { path: TemplatePath; error: DomainError & { message: string } }
      >;
    }, DomainError & { message: string }>
  > {
    const loaded: TemplateLoadResult[] = [];
    const errors: Array<
      { path: TemplatePath; error: DomainError & { message: string } }
    > = [];

    for (const path of paths) {
      const result = await this.loadTemplate(path, true);
      if (result.ok) {
        loaded.push(result.data);
      } else {
        errors.push({ path, error: result.error });
      }
    }

    return {
      ok: true,
      data: { loaded, errors },
    };
  }

  /**
   * Validate template path format and accessibility
   * @param pathStr - Path string to validate
   * @returns Result indicating validation success
   */
  private validateTemplatePath(
    pathStr: string,
  ): Result<void, DomainError & { message: string }> {
    // Basic validation - no dangerous path traversal
    if (pathStr.includes("..") || pathStr.includes("~")) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "SecurityViolation",
            path: pathStr,
            reason: "Path traversal not allowed",
          },
          "Template path contains unsafe characters",
        ),
      };
    }

    // Must have supported extension (matches TemplatePath supported extensions)
    const supportedExtensions = [
      ".hbs",
      ".handlebars",
      ".mustache",
      ".liquid",
      ".ejs",
      ".pug",
      ".html",
      ".htm",
      ".txt",
    ];
    if (!supportedExtensions.some((ext) => pathStr.endsWith(ext))) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "FileExtensionMismatch",
            path: pathStr,
            expected: supportedExtensions,
          },
          `Template file must have supported extension: ${
            supportedExtensions.join(", ")
          }`,
        ),
      };
    }

    return { ok: true, data: undefined };
  }

  /**
   * Load template content from filesystem (simulation)
   * @param pathStr - Path to load from
   * @returns Result containing template and metadata
   */
  private async loadTemplateContent(
    pathStr: string,
  ): Promise<
    Result<{
      template: TemplateDefinition;
      lastModified: Date;
    }, DomainError & { message: string }>
  > {
    try {
      // Simulate async file loading
      await new Promise((resolve) => setTimeout(resolve, 1));

      // For now, create a simple template based on path
      // In production, this would read actual file content
      const mockContent = this.generateMockTemplateContent(pathStr);
      const mockEngine = this.inferEngineFromPath(pathStr);

      const templateResult = TemplateDefinition.create(
        mockContent,
        mockEngine,
        {
          name: this.extractNameFromPath(pathStr),
          description: `Template loaded from ${pathStr}`,
        },
      );

      if (!templateResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ParseError",
              input: pathStr,
              details: templateResult.error.message,
            },
            `Failed to create template from ${pathStr}`,
          ),
        };
      }

      return {
        ok: true,
        data: {
          template: templateResult.data,
          lastModified: new Date(),
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "FileNotFound",
            path: pathStr,
            details: error instanceof Error ? error.message : String(error),
          },
          `Failed to load template from ${pathStr}`,
        ),
      };
    }
  }

  /**
   * Check if template file exists (simulation)
   * @param pathStr - Path to check
   * @returns Promise resolving to existence status
   */
  private async checkTemplateFileExists(pathStr: string): Promise<boolean> {
    // Simulate async filesystem check
    await new Promise((resolve) => setTimeout(resolve, 1));

    // For simulation, assume templates exist if they have valid extensions
    const supportedExtensions = [
      ".hbs",
      ".handlebars",
      ".mustache",
      ".liquid",
      ".ejs",
      ".pug",
      ".html",
      ".htm",
      ".txt",
    ];
    return supportedExtensions.some((ext) => pathStr.endsWith(ext));
  }

  /**
   * Generate mock template content for simulation
   * @param pathStr - Template path
   * @returns Mock template content
   */
  private generateMockTemplateContent(pathStr: string): string {
    if (pathStr.endsWith(".html") || pathStr.endsWith(".htm")) {
      return "<html><body><h1>{{title}}</h1><p>{{description}}</p><div>{{content}}</div></body></html>";
    }

    if (pathStr.endsWith(".hbs") || pathStr.endsWith(".handlebars")) {
      return "{{title}} - {{description}}\n{{content}}";
    }

    if (pathStr.endsWith(".mustache")) {
      return "{{title}} | {{description}}\n{{content}}";
    }

    if (pathStr.endsWith(".liquid")) {
      return "{{ title }} - {{ description }}\n{{ content }}";
    }

    if (pathStr.endsWith(".ejs")) {
      return "<%=title%> - <%=description%>\n<%=content%>";
    }

    if (pathStr.endsWith(".pug")) {
      return "h1= title\np= description\nblock content";
    }

    // Default for .txt and others
    return "{{title}}: {{description}}\n{{content}}";
  }

  /**
   * Infer template engine from file path
   * @param pathStr - Template path
   * @returns Inferred template engine
   */
  private inferEngineFromPath(
    pathStr: string,
  ): import("../../value-objects/template-definition.ts").TemplateEngine {
    if (pathStr.includes("handlebars") || pathStr.includes("hbs")) {
      return "handlebars";
    }
    if (pathStr.includes("mustache")) {
      return "mustache";
    }
    if (pathStr.includes("liquid")) {
      return "liquid";
    }
    if (pathStr.includes("ejs")) {
      return "ejs";
    }
    if (pathStr.includes("pug")) {
      return "pug";
    }
    if (pathStr.endsWith(".html")) {
      return "html";
    }

    return "text";
  }

  /**
   * Extract template name from path
   * @param pathStr - Template path
   * @returns Extracted name
   */
  private extractNameFromPath(pathStr: string): string {
    const filename = pathStr.split("/").pop() || pathStr;
    return filename.replace(/\.[^.]+$/, ""); // Remove extension
  }
}
