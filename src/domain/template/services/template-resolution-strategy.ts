import { Result } from "../../shared/types/result.ts";
import { defaultSchemaExtensionRegistry } from "../../schema/value-objects/schema-extension-registry.ts";

/**
 * Template Resolution Context using discriminated union pattern
 * Eliminates optional explicitTemplatePath in favor of explicit context types
 */
export type TemplateResolutionContext =
  | {
    kind: "schema-based";
    schemaPath: string;
    schemaDefinition: Record<string, unknown>;
    baseDirectory: string;
  }
  | {
    kind: "explicit-path";
    schemaPath: string;
    explicitTemplatePath: string;
    schemaDefinition: Record<string, unknown>;
    baseDirectory: string;
  };

/**
 * Resolved Template Information using discriminated union pattern
 * Eliminates optional itemsTemplatePath in favor of explicit template types
 */
export type ResolvedTemplate =
  | {
    kind: "single";
    templatePath: string;
    resolutionStrategy: string;
  }
  | {
    kind: "dual";
    mainTemplatePath: string;
    itemsTemplatePath: string;
    resolutionStrategy: string;
  };

/**
 * Template Resolution Strategy Interface (New discriminated union version)
 * Defines contract for different template resolution approaches
 * Follows Strategy Pattern for extensible resolution logic
 */
export interface TemplateResolutionStrategy {
  readonly name: string;
  canResolve(context: TemplateResolutionContext): boolean;
  resolve(context: TemplateResolutionContext): Result<ResolvedTemplate, string>;
}

/**
 * Explicit Path Resolution Strategy (Updated for discriminated union)
 * Handles cases where template path is explicitly provided
 */
export class ExplicitPathResolution implements TemplateResolutionStrategy {
  readonly name = "explicit-path";

  canResolve(context: TemplateResolutionContext): boolean {
    return context.kind === "explicit-path";
  }

  resolve(
    context: TemplateResolutionContext,
  ): Result<ResolvedTemplate, string> {
    if (context.kind !== "explicit-path") {
      return { ok: false, error: "Context is not explicit-path type" };
    }

    return {
      ok: true,
      data: {
        kind: "single",
        templatePath: context.explicitTemplatePath,
        resolutionStrategy: this.name,
      },
    };
  }
}

/**
 * Schema-Based Resolution Strategy
 * Derives template paths from schema x-template properties
 */
export class SchemaBasedResolution implements TemplateResolutionStrategy {
  readonly name = "schema-derived";

  canResolve(context: TemplateResolutionContext): boolean {
    if (context.kind !== "schema-based") return false;

    const templateKey = defaultSchemaExtensionRegistry.getTemplateKey()
      .getValue();
    return !!context.schemaDefinition[templateKey];
  }

  resolve(
    context: TemplateResolutionContext,
  ): Result<ResolvedTemplate, string> {
    if (context.kind !== "schema-based") {
      return { ok: false, error: "Context is not schema-based type" };
    }

    const templateKey = defaultSchemaExtensionRegistry.getTemplateKey()
      .getValue();
    const mainTemplate = context.schemaDefinition[templateKey];
    if (!mainTemplate || typeof mainTemplate !== "string") {
      return {
        ok: false,
        error: `Schema does not contain valid ${templateKey} property`,
      };
    }

    // Resolve main template path relative to schema location
    const mainTemplatePath = this.resolvePath(
      mainTemplate,
      context.baseDirectory,
    );

    // Check for items template
    const templateItemsKey = defaultSchemaExtensionRegistry
      .getTemplateItemsKey().getValue();
    const itemsTemplate = context.schemaDefinition[templateItemsKey];

    if (itemsTemplate && typeof itemsTemplate === "string") {
      // Dual template case
      const itemsTemplatePath = this.resolvePath(
        itemsTemplate,
        context.baseDirectory,
      );
      return {
        ok: true,
        data: {
          kind: "dual",
          mainTemplatePath,
          itemsTemplatePath,
          resolutionStrategy: this.name,
        },
      };
    } else {
      // Single template case
      return {
        ok: true,
        data: {
          kind: "single",
          templatePath: mainTemplatePath,
          resolutionStrategy: this.name,
        },
      };
    }
  }

  private resolvePath(templatePath: string, baseDirectory: string): string {
    // If template path is absolute, use as-is
    if (templatePath.startsWith("/") || templatePath.match(/^[A-Za-z]:/)) {
      return templatePath;
    }

    // Resolve relative to base directory
    return `${baseDirectory}/${templatePath}`;
  }
}

/**
 * Auto-Detection Resolution Strategy
 * Attempts to find templates using naming conventions
 */
export class AutoDetectResolution implements TemplateResolutionStrategy {
  readonly name = "auto-detect";

  canResolve(_context: TemplateResolutionContext): boolean {
    // Auto-detection is always possible as fallback
    return true;
  }

  resolve(
    context: TemplateResolutionContext,
  ): Result<ResolvedTemplate, string> {
    const schemaBaseName = this.extractBaseName(context.schemaPath);
    const baseDirectory = context.baseDirectory;

    // Try common template naming patterns
    const candidatePaths = [
      `${baseDirectory}/${schemaBaseName}_template.json`,
      `${baseDirectory}/template.json`,
      `${baseDirectory}/${schemaBaseName}.template.json`,
      `${baseDirectory}/default_template.json`,
    ];

    // For now, use the first candidate
    // In a real implementation, we would check file existence
    const templatePath = candidatePaths[0];

    return {
      ok: true,
      data: {
        kind: "single",
        templatePath,
        resolutionStrategy: this.name,
      },
    };
  }

  private extractBaseName(filePath: string): string {
    const fileName = filePath.split("/").pop() || filePath;
    return fileName.replace(/\.[^.]+$/, ""); // Remove extension
  }
}

/**
 * Template Resolution Orchestrator
 * Coordinates multiple resolution strategies using Chain of Responsibility pattern
 */
export class TemplateResolutionOrchestrator {
  private strategies: TemplateResolutionStrategy[];

  constructor() {
    // Order matters: more specific strategies first
    this.strategies = [
      new ExplicitPathResolution(),
      new SchemaBasedResolution(),
      new AutoDetectResolution(), // Fallback strategy
    ];
  }

  /**
   * Resolves template paths using the first applicable strategy
   */
  resolve(
    context: TemplateResolutionContext,
  ): Result<ResolvedTemplate, string> {
    for (const strategy of this.strategies) {
      if (strategy.canResolve(context)) {
        const result = strategy.resolve(context);
        if (result.ok) {
          return result;
        }
        // Continue to next strategy if this one fails
      }
    }

    return {
      ok: false,
      error: "No template resolution strategy could resolve the template paths",
    };
  }

  /**
   * Adds a custom resolution strategy
   * Useful for extending resolution logic without modifying core code
   */
  addStrategy(strategy: TemplateResolutionStrategy, position = 0): void {
    this.strategies.splice(position, 0, strategy);
  }

  /**
   * Gets list of available strategy names
   */
  getAvailableStrategies(): string[] {
    return this.strategies.map((s) => s.name);
  }
}
