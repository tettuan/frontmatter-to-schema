import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { Schema } from "../../schema/entities/schema.ts";
import {
  Decision,
  ErrorContextFactory,
  ProcessingProgress,
} from "../../shared/types/error-context.ts";

/**
 * Template path resolution configuration
 */
export interface TemplatePathConfig {
  readonly schemaPath: string;
  readonly explicitTemplatePath?: string;
}

/**
 * Items template path state using discriminated union for Totality
 */
export type ItemsTemplateState =
  | { readonly kind: "defined"; readonly path: string }
  | { readonly kind: "not-defined" };

/**
 * Output format state using discriminated union for Totality
 */
export type OutputFormatState =
  | {
    readonly kind: "specified";
    readonly format: "json" | "yaml" | "markdown";
  }
  | { readonly kind: "default" };

/**
 * Resolved template paths using Totality principles
 */
export interface ResolvedTemplatePaths {
  readonly templatePath: string;
  readonly itemsTemplate: ItemsTemplateState;
  readonly outputFormat: OutputFormatState;
  // Backward compatibility - will be removed in next major version
  readonly itemsTemplatePath?: string;
}

/**
 * Service responsible for extracting and resolving template paths from schema.
 * Handles both x-template and x-template-items extraction and path resolution.
 *
 * This service separates the template path resolution concern from PipelineOrchestrator,
 * making it testable and reusable across different contexts.
 */
export class TemplatePathResolver {
  /**
   * Resolve all template paths (main and items) from schema and configuration.
   *
   * @param schema - Schema entity containing template path information
   * @param config - Configuration containing schema path and optional explicit template path
   * @returns Result containing resolved template paths or error
   */
  resolveTemplatePaths(
    schema: Schema,
    config: TemplatePathConfig,
  ): Result<ResolvedTemplatePaths, DomainError & { message: string }> {
    // Create ErrorContext for template path resolution operation
    const contextResult = ErrorContextFactory.forDomainService(
      "TemplatePathResolver",
      "Resolve template paths",
      "resolveTemplatePaths",
    );
    if (!contextResult.ok) {
      return contextResult;
    }

    const context = contextResult.data
      .withInput("schemaPath", config.schemaPath)
      .withInput("explicitTemplatePath", config.explicitTemplatePath);

    // Create processing progress tracker
    const progressResult = ProcessingProgress.create(
      "Template Path Resolution",
      "Resolving main template path",
      [],
      3,
    );
    if (!progressResult.ok) {
      return progressResult;
    }

    let currentContext = context.withProgress(progressResult.data);

    // Resolve main template path
    const mainTemplateResult = this.resolveMainTemplatePath(schema, config);
    if (!mainTemplateResult.ok) {
      return mainTemplateResult;
    }

    // Update progress: Main template resolved
    const progressAfterMain = ProcessingProgress.create(
      "Template Path Resolution",
      "Resolving items template path",
      ["Resolving main template path"],
      3,
    );
    if (progressAfterMain.ok) {
      currentContext = currentContext.withProgress(progressAfterMain.data);
    }

    // Resolve items template path (optional)
    const itemsTemplateResult = this.resolveItemsTemplatePath(schema, config);
    if (!itemsTemplateResult.ok) {
      return itemsTemplateResult;
    }

    // Update progress: Items template resolved
    const progressAfterItems = ProcessingProgress.create(
      "Template Path Resolution",
      "Determining output format",
      ["Resolving main template path", "Resolving items template path"],
      3,
    );
    if (progressAfterItems.ok) {
      currentContext = currentContext.withProgress(progressAfterItems.data);
    }

    // Stage 3: Extract output format using Schema entity or detect from template extension
    const outputFormatResult = schema.getTemplateFormat();
    let outputFormat: "json" | "yaml" | "markdown";

    // Create decision tracking for format determination
    const formatDecisionResult = Decision.create(
      "Output format determination",
      ["schema-defined", "auto-detected"],
      outputFormatResult.ok
        ? "Schema contains x-template-format attribute"
        : "Auto-detecting format from template file extension",
    );

    if (formatDecisionResult.ok) {
      currentContext = currentContext.withDecision(formatDecisionResult.data);
    }

    if (outputFormatResult.ok) {
      outputFormat = outputFormatResult.data;
    } else {
      // Auto-detect format from template file extension
      outputFormat = this.detectFormatFromExtension(mainTemplateResult.data);
    }

    // Items template state is already in the correct format from the method
    const itemsTemplate = itemsTemplateResult.data;

    // Create OutputFormatState based on output format
    const outputFormatState: OutputFormatState =
      outputFormat === "json" || outputFormat === "yaml" ||
        outputFormat === "markdown"
        ? { kind: "specified", format: outputFormat }
        : { kind: "default" };

    // Extract backward compatible path for legacy support
    const backwardCompatiblePath = itemsTemplate.kind === "defined"
      ? itemsTemplate.path
      : undefined;

    return ok({
      templatePath: mainTemplateResult.data,
      itemsTemplate,
      outputFormat: outputFormatState,
      // Backward compatibility - provide the old property
      itemsTemplatePath: backwardCompatiblePath,
    });
  }

  /**
   * Resolve main template path from config or schema's x-template.
   *
   * @param schema - Schema entity
   * @param config - Template path configuration
   * @returns Result containing resolved main template path or error
   */
  resolveMainTemplatePath(
    schema: Schema,
    config: TemplatePathConfig,
  ): Result<string, DomainError & { message: string }> {
    // Prefer explicit template path from config
    if (config.explicitTemplatePath) {
      return ok(config.explicitTemplatePath);
    }

    // Try to get template path from schema's x-template attribute
    const schemaTemplateResult = schema.getTemplatePath();
    if (schemaTemplateResult.ok) {
      return this.resolveRelativePath(
        schemaTemplateResult.data,
        config.schemaPath,
      );
    }

    return ErrorHandler.schema({
      operation: "resolveMainTemplatePath",
      method: "validateTemplatePath",
    }).templateNotDefined();
  }

  /**
   * Resolve items template path from schema's x-template-items.
   * Follows Totality principle - uses discriminated union instead of undefined
   *
   * @param schema - Schema entity
   * @param config - Template path configuration
   * @returns Result containing items template state (defined or not-defined) or error
   */
  resolveItemsTemplatePath(
    schema: Schema,
    config: TemplatePathConfig,
  ): Result<ItemsTemplateState, DomainError & { message: string }> {
    // Get x-template-items from schema using proper method
    const templateItemsResult = schema.getDefinition().getTemplateItems();

    if (!templateItemsResult.ok) {
      // If x-template-items is not defined, return not-defined state (not an error)
      return ok({ kind: "not-defined" });
    }

    const resolvedPathResult = this.resolveRelativePath(
      templateItemsResult.data,
      config.schemaPath,
    );

    if (!resolvedPathResult.ok) {
      return resolvedPathResult;
    }

    return ok({ kind: "defined", path: resolvedPathResult.data });
  }

  /**
   * Resolve relative template paths relative to schema directory.
   *
   * @param templatePath - Template path (may be relative)
   * @param schemaPath - Schema file path for relative resolution
   * @returns Result containing resolved absolute path
   */
  private resolveRelativePath(
    templatePath: string,
    schemaPath: string,
  ): Result<string, DomainError & { message: string }> {
    // If path starts with "./" it's relative to schema directory
    if (templatePath.startsWith("./")) {
      const lastSlash = schemaPath.lastIndexOf("/");
      const schemaDir = lastSlash > -1
        ? schemaPath.substring(0, lastSlash)
        : "."; // Use current directory if no path separator

      const resolvedPath = schemaDir === "."
        ? templatePath.substring(2)
        : `${schemaDir}/${templatePath.substring(2)}`;

      return ok(resolvedPath);
    }

    // If path starts with "/" it's absolute, return as-is
    if (templatePath.startsWith("/")) {
      return ok(templatePath);
    }

    // For relative paths that don't start with "./", resolve relative to schema directory
    // This matches the old PipelineOrchestrator behavior
    const lastSlash = schemaPath.lastIndexOf("/");
    const schemaDir = lastSlash > -1 ? schemaPath.substring(0, lastSlash) : "."; // Use current directory if no path separator

    const resolvedPath = schemaDir === "."
      ? templatePath
      : `${schemaDir}/${templatePath}`;

    return ok(resolvedPath);
  }

  /**
   * Auto-detect output format from template file extension.
   *
   * @param templatePath - Template file path
   * @returns Detected output format
   */
  private detectFormatFromExtension(
    templatePath: string,
  ): "json" | "yaml" | "markdown" {
    const lowercasePath = templatePath.toLowerCase();

    if (lowercasePath.endsWith(".yml") || lowercasePath.endsWith(".yaml")) {
      return "yaml";
    }

    if (lowercasePath.endsWith(".md") || lowercasePath.endsWith(".markdown")) {
      return "markdown";
    }

    // Default to JSON for .json files or unrecognized extensions
    return "json";
  }
}
