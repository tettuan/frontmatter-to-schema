import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import {
  ResolvedTemplatePaths,
  TemplatePathResolver,
} from "../../domain/template/services/template-path-resolver.ts";

/**
 * Template configuration using discriminated unions (Totality principle)
 */
export type TemplateConfig =
  | { readonly kind: "explicit"; readonly templatePath: string }
  | { readonly kind: "schema-derived" };

/**
 * Template path configuration for template path resolver
 */
export interface TemplatePathConfig {
  readonly schemaPath: string;
  readonly explicitTemplatePath?: string;
}

/**
 * Template Resolution Strategy Interface
 * Following DDD principles - domain service for template path resolution
 * Following Totality principles - total function returning Result<T,E>
 */
export interface TemplateResolutionStrategy {
  resolve(
    schema: Schema,
    schemaPath: string,
    templatePathResolver: TemplatePathResolver,
  ): Result<ResolvedTemplatePaths, DomainError & { message: string }>;
}

/**
 * Explicit Template Resolution Strategy
 * Handles explicit template path configuration
 */
export class ExplicitTemplateStrategy implements TemplateResolutionStrategy {
  constructor(private readonly templatePath: string) {}

  /**
   * Smart Constructor for ExplicitTemplateStrategy
   * Following Totality principles
   */
  static create(
    templatePath: string,
  ): Result<ExplicitTemplateStrategy, DomainError & { message: string }> {
    if (!templatePath || templatePath.trim() === "") {
      return err(createError({
        kind: "ConfigurationError",
        message: "Template path cannot be empty for explicit template strategy",
      }));
    }

    return ok(new ExplicitTemplateStrategy(templatePath));
  }

  resolve(
    schema: Schema,
    schemaPath: string,
    templatePathResolver: TemplatePathResolver,
  ): Result<ResolvedTemplatePaths, DomainError & { message: string }> {
    const templatePathConfig: TemplatePathConfig = {
      schemaPath,
      explicitTemplatePath: this.templatePath,
    };

    return templatePathResolver.resolveTemplatePaths(
      schema,
      templatePathConfig,
    );
  }
}

/**
 * Schema-Derived Template Resolution Strategy
 * Handles schema-derived template path configuration
 */
export class SchemaDerivedTemplateStrategy
  implements TemplateResolutionStrategy {
  /**
   * Smart Constructor for SchemaDerivedTemplateStrategy
   * Following Totality principles
   */
  static create(): Result<
    SchemaDerivedTemplateStrategy,
    DomainError & { message: string }
  > {
    return ok(new SchemaDerivedTemplateStrategy());
  }

  resolve(
    schema: Schema,
    schemaPath: string,
    templatePathResolver: TemplatePathResolver,
  ): Result<ResolvedTemplatePaths, DomainError & { message: string }> {
    const templatePathConfig: TemplatePathConfig = {
      schemaPath,
      // No explicit template path - derive from schema
      explicitTemplatePath: undefined,
    };

    return templatePathResolver.resolveTemplatePaths(
      schema,
      templatePathConfig,
    );
  }
}

/**
 * Template Resolution Strategy Factory
 * Following DDD Factory pattern and Totality principles
 * Eliminates hardcoded if/else branches through strategy pattern
 */
export class TemplateResolutionStrategyFactory {
  /**
   * Create strategy based on template configuration
   * Following Totality principles - exhaustive pattern matching
   */
  static createStrategy(
    config: TemplateConfig,
  ): Result<TemplateResolutionStrategy, DomainError & { message: string }> {
    // Exhaustive switch on discriminated union - no default case needed
    switch (config.kind) {
      case "explicit":
        return ExplicitTemplateStrategy.create(config.templatePath);

      case "schema-derived":
        return SchemaDerivedTemplateStrategy.create();
    }
  }
}
