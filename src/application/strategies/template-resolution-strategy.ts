import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { ResolvedTemplatePaths } from "../../domain/template/services/template-path-resolver.ts";

/**
 * Template Resolution Strategy (Legacy Compatibility)
 *
 * Basic template resolution for maintaining compatibility.
 * In the new 3-domain architecture, this is handled by TemplateManagementDomainService.
 */
export interface TemplateResolutionConfig {
  readonly kind?: "explicit" | "schema-derived";
  readonly mainTemplate?: string;
  readonly itemsTemplate?: string;
  readonly outputFormat?: string;
}

// Legacy compatibility aliases
export type TemplateConfig = TemplateResolutionConfig;

export class ExplicitTemplateStrategy {
  static create(
    config: TemplateConfig,
  ): Result<ExplicitTemplateStrategy, DomainError & { message: string }> {
    return ok(new ExplicitTemplateStrategy(config));
  }

  constructor(private readonly config: TemplateConfig) {}

  getConfig(): TemplateConfig {
    return this.config;
  }
}

export class TemplateResolutionStrategyFactory {
  static create(): Result<
    TemplateResolutionStrategyFactory,
    DomainError & { message: string }
  > {
    return ok(new TemplateResolutionStrategyFactory());
  }

  static createStrategy(
    _config?: TemplateConfig,
  ): Result<TemplateResolutionStrategy, DomainError & { message: string }> {
    return TemplateResolutionStrategy.create();
  }

  createStrategy(): Result<
    TemplateResolutionStrategy,
    DomainError & { message: string }
  > {
    return TemplateResolutionStrategy.create();
  }
}

export class TemplateResolutionStrategy {
  static create(): Result<
    TemplateResolutionStrategy,
    DomainError & { message: string }
  > {
    return ok(new TemplateResolutionStrategy());
  }

  /**
   * Resolve template configuration from schema
   */
  resolve(
    schema: Schema,
    _schemaPath?: string,
    _templatePathResolver?: unknown,
  ): Result<ResolvedTemplatePaths, DomainError & { message: string }> {
    try {
      const rawSchema = schema.getRawSchema();

      // Extract x-template directives
      const mainTemplate = this.findDirectiveInSchema(rawSchema, "x-template");
      const itemsTemplate = this.findDirectiveInSchema(
        rawSchema,
        "x-template-items",
      );
      const outputFormat = this.findDirectiveInSchema(
        rawSchema,
        "x-template-format",
      );

      // Build config object immutably
      const config: TemplateResolutionConfig = {
        kind: "explicit",
        mainTemplate: typeof mainTemplate === "string"
          ? mainTemplate
          : undefined,
        itemsTemplate: typeof itemsTemplate === "string"
          ? itemsTemplate
          : undefined,
        outputFormat: typeof outputFormat === "string" ? outputFormat : "json",
      };

      // Convert to ResolvedTemplatePaths format
      const resolvedPaths: ResolvedTemplatePaths = {
        templatePath: config.mainTemplate || "",
        itemsTemplate: config.itemsTemplate
          ? { kind: "defined", path: config.itemsTemplate }
          : { kind: "not-defined" },
        outputFormat:
          config.outputFormat === "json" || config.outputFormat === "yaml" ||
            config.outputFormat === "markdown"
            ? { kind: "specified", format: config.outputFormat }
            : { kind: "default" },
        // Backward compatibility
        itemsTemplatePath: config.itemsTemplate,
      };

      return ok(resolvedPaths);
    } catch (error) {
      return err(createError({
        kind: "ConfigurationError",
        message: `Template resolution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }

  /**
   * Find directive in schema recursively
   */
  private findDirectiveInSchema(obj: unknown, directiveName: string): unknown {
    if (typeof obj !== "object" || obj === null) {
      return undefined;
    }

    const record = obj as Record<string, unknown>;

    // Check direct property
    if (directiveName in record) {
      return record[directiveName];
    }

    // Search recursively
    for (const value of Object.values(record)) {
      const found = this.findDirectiveInSchema(value, directiveName);
      if (found !== undefined) {
        return found;
      }
    }

    return undefined;
  }
}
