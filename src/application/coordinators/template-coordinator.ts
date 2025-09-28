import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { Template } from "../../domain/template/entities/template.ts";
import { TemplatePath } from "../../domain/template/value-objects/template-path.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import {
  ResolvedTemplatePaths,
  TemplatePathResolver,
} from "../../domain/template/services/template-path-resolver.ts";
import { OutputRenderingService } from "../../domain/template/services/output-rendering-service.ts";
import { VerbosityMode } from "../../domain/template/value-objects/processing-context.ts";
import {
  ProcessingHints,
  SchemaStructureDetector,
} from "../../domain/schema/services/schema-structure-detector.ts";
import { StructureType } from "../../domain/schema/value-objects/structure-type.ts";
import {
  ExplicitTemplateStrategy,
  TemplateConfig,
  TemplateResolutionStrategyFactory,
} from "../strategies/template-resolution-strategy.ts";

/**
 * Template format using discriminated unions (Totality principle)
 */
export type TemplateFormat =
  | { readonly kind: "json" }
  | { readonly kind: "yaml" }
  | { readonly kind: "markdown" };

/**
 * File system interface for template operations
 * Following DDD principles - infrastructure abstraction
 */
export interface TemplateFileSystem {
  read(
    path: string,
  ):
    | Promise<Result<string, DomainError & { message: string }>>
    | Result<string, DomainError & { message: string }>;
}

/**
 * Template Coordinator - Application Service
 *
 * Responsible for orchestrating template-related operations
 * Following DDD principles:
 * - Single responsibility: Template loading and rendering coordination
 * - Clean boundaries: Uses domain services and infrastructure adapters
 * - Totality: All methods return Result<T,E>
 */
export class TemplateCoordinator {
  constructor(
    private readonly templatePathResolver: TemplatePathResolver,
    private readonly outputRenderingService: OutputRenderingService,
    private readonly fileSystem: TemplateFileSystem,
  ) {}

  /**
   * Smart Constructor for TemplateCoordinator
   * Following Totality principles by returning Result<T,E>
   */
  static create(
    templatePathResolver: TemplatePathResolver,
    outputRenderingService: OutputRenderingService,
    fileSystem: TemplateFileSystem,
  ): Result<TemplateCoordinator, DomainError & { message: string }> {
    if (!templatePathResolver) {
      return err(createError({
        kind: "InitializationError",
        message: "TemplatePathResolver is required",
      }));
    }
    if (!outputRenderingService) {
      return err(createError({
        kind: "InitializationError",
        message: "OutputRenderingService is required",
      }));
    }
    if (!fileSystem) {
      return err(createError({
        kind: "InitializationError",
        message: "TemplateFileSystem is required",
      }));
    }

    return ok(
      new TemplateCoordinator(
        templatePathResolver,
        outputRenderingService,
        fileSystem,
      ),
    );
  }

  /**
   * Resolve template paths based on schema and configuration
   * Following Strategy Pattern to eliminate hardcoded if/else branches
   * Following Totality principles - total function returning Result<T,E>
   */
  resolveTemplatePaths(
    schema: Schema,
    templateConfig: TemplateConfig,
    schemaPath: string,
  ): Result<ResolvedTemplatePaths, DomainError & { message: string }> {
    // Create strategy based on template configuration
    const strategyResult = TemplateResolutionStrategyFactory.createStrategy(
      templateConfig,
    );
    if (!strategyResult.ok) {
      return strategyResult;
    }

    // Use strategy to resolve template paths - eliminates hardcoded branches
    return strategyResult.data.resolve(
      schema,
      schemaPath,
      this.templatePathResolver,
    );
  }

  /**
   * Load template from file system
   * Extracted from PipelineOrchestrator.loadTemplate()
   * Following Totality principles - total function returning Result<T,E>
   */
  async loadTemplate(
    templatePath: string,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    // Read template file
    const contentResult = await Promise.resolve(
      this.fileSystem.read(templatePath),
    );
    if (!contentResult.ok) {
      return contentResult;
    }

    // Determine format from extension using total function
    const formatResult = this.getTemplateFormat(templatePath);
    if (!formatResult.ok) {
      return formatResult;
    }

    const format = formatResult.data;

    // Create template path using smart constructor
    const pathResult = TemplatePath.create(templatePath);
    if (!pathResult.ok) {
      return pathResult;
    }

    // Parse template content based on format
    let templateData: unknown;
    try {
      switch (format.kind) {
        case "json":
          templateData = JSON.parse(contentResult.data);
          break;
        case "yaml":
          // For YAML, keep as string for now (would need YAML parser)
          templateData = contentResult.data;
          break;
        case "markdown":
          templateData = contentResult.data;
          break;
      }
    } catch (error) {
      return err(createError({
        kind: "InvalidTemplate",
        message: `Failed to parse template: ${error}`,
      }));
    }

    // Create template entity using smart constructor with default configuration
    return Template.createWithDefaultConfig(pathResult.data, templateData);
  }

  /**
   * Render output using the output rendering service
   * Extracted from PipelineOrchestrator rendering logic
   * Following DDD - coordination of domain operations
   */
  renderOutput(
    templatePath: string,
    itemsTemplatePath: string | undefined,
    mainData: FrontmatterData,
    itemsData: FrontmatterData[] | undefined,
    outputPath: string,
    outputFormat: "json" | "yaml" | "markdown",
    verbosityMode: VerbosityMode,
  ): Result<void, DomainError & { message: string }> {
    return this.outputRenderingService.renderOutput(
      templatePath,
      itemsTemplatePath,
      mainData,
      itemsData,
      outputPath,
      outputFormat,
      verbosityMode,
    );
  }

  /**
   * Resolve template paths with StructureType awareness
   * Enhances template selection based on detected structure type
   * Following DDD - coordination with structure intelligence
   */
  resolveTemplatePathsWithStructureType(
    schema: Schema,
    structureType: StructureType,
    templateConfig: TemplateConfig,
    schemaPath: string,
  ): Result<ResolvedTemplatePaths, DomainError & { message: string }> {
    // Get processing hints for structure-specific handling
    const hints = SchemaStructureDetector.getProcessingHints(structureType);

    // Adjust template configuration based on structure type
    const adjustedConfig = this.adjustTemplateConfigForStructure(
      templateConfig,
      structureType,
      hints,
    );

    return this.resolveTemplatePaths(schema, adjustedConfig, schemaPath);
  }

  /**
   * Adjust template configuration based on structure type and processing hints
   * Following Totality principles - exhaustive pattern matching
   */
  private adjustTemplateConfigForStructure(
    config: TemplateConfig,
    structureType: StructureType,
    _hints: ProcessingHints,
  ): TemplateConfig {
    // Use strategy pattern to determine if template is explicit
    const strategyResult = TemplateResolutionStrategyFactory.createStrategy(
      config,
    );
    if (!strategyResult.ok) {
      // If strategy creation fails, return original config
      return config;
    }

    if (strategyResult.data instanceof ExplicitTemplateStrategy) {
      // For explicit templates, no adjustment needed
      return config;
    }

    // For schema-derived templates, consider structure type
    switch (structureType.kind) {
      case "registry":
        // Registry structures typically use JSON templates for structured output
        return config; // Keep schema-derived behavior for now
      case "collection":
        // Collection structures may benefit from auto-format selection
        return config; // Keep schema-derived behavior for now
      case "custom":
        // Custom structures use schema-derived approach
        return config;
    }
  }

  /**
   * Process template with StructureType awareness
   * Enhanced workflow combining structure detection with template processing
   * Following DDD - coordination of domain operations with structure intelligence
   */
  processTemplateWithStructureAwareness(
    schema: Schema,
    structureType: StructureType,
    templateConfig: TemplateConfig,
    schemaPath: string,
    mainData: FrontmatterData,
    itemsData: FrontmatterData[] | undefined,
    outputPath: string,
    verbosityMode: VerbosityMode,
  ): Result<void, DomainError & { message: string }> {
    // Resolve template paths with structure awareness
    const pathsResult = this.resolveTemplatePathsWithStructureType(
      schema,
      structureType,
      templateConfig,
      schemaPath,
    );
    if (!pathsResult.ok) {
      return pathsResult;
    }

    const resolvedPaths = pathsResult.data;
    const processingHints = SchemaStructureDetector.getProcessingHints(
      structureType,
    );

    // Use backward compatibility property if available, otherwise extract from ItemsTemplateState
    const itemsTemplatePath = resolvedPaths.itemsTemplatePath !== undefined
      ? resolvedPaths.itemsTemplatePath
      : resolvedPaths.itemsTemplate &&
          resolvedPaths.itemsTemplate.kind === "defined"
      ? resolvedPaths.itemsTemplate.path
      : undefined;

    // Extract output format with structure type awareness
    let outputFormat = resolvedPaths.outputFormat &&
        resolvedPaths.outputFormat.kind === "specified"
      ? resolvedPaths.outputFormat.format
      : "json";

    // Apply structure-specific format preferences
    if (processingHints.templateFormat !== "auto") {
      outputFormat = processingHints.templateFormat;
    }

    // Render output with structure-aware configuration
    return this.renderOutput(
      resolvedPaths.templatePath,
      itemsTemplatePath,
      mainData,
      itemsData,
      outputPath,
      outputFormat,
      verbosityMode,
    );
  }

  /**
   * Complete template processing workflow
   * Common coordination pattern combining resolution, loading, and rendering
   */
  processTemplate(
    schema: Schema,
    templateConfig: TemplateConfig,
    schemaPath: string,
    mainData: FrontmatterData,
    itemsData: FrontmatterData[] | undefined,
    outputPath: string,
    verbosityMode: VerbosityMode,
  ): Result<void, DomainError & { message: string }> {
    // Resolve template paths
    const pathsResult = this.resolveTemplatePaths(
      schema,
      templateConfig,
      schemaPath,
    );
    if (!pathsResult.ok) {
      return pathsResult;
    }

    const resolvedPaths = pathsResult.data;

    // Use backward compatibility property if available, otherwise extract from ItemsTemplateState
    const itemsTemplatePath = resolvedPaths.itemsTemplatePath !== undefined
      ? resolvedPaths.itemsTemplatePath
      : resolvedPaths.itemsTemplate &&
          resolvedPaths.itemsTemplate.kind === "defined"
      ? resolvedPaths.itemsTemplate.path
      : undefined;

    // Extract output format from OutputFormatState
    const outputFormat = resolvedPaths.outputFormat &&
        resolvedPaths.outputFormat.kind === "specified"
      ? resolvedPaths.outputFormat.format
      : "json";

    // Render output directly (OutputRenderingService handles template loading)
    return this.renderOutput(
      resolvedPaths.templatePath,
      itemsTemplatePath,
      mainData,
      itemsData,
      outputPath,
      outputFormat,
      verbosityMode,
    );
  }

  /**
   * Determine template format from file extension
   * Following Totality principles - total function with Result<T,E>
   * Replaces partial function from PipelineOrchestrator
   */
  private getTemplateFormat(
    path: string,
  ): Result<TemplateFormat, DomainError & { message: string }> {
    if (path.endsWith(".json")) {
      return ok({ kind: "json" });
    }
    if (path.endsWith(".yml") || path.endsWith(".yaml")) {
      return ok({ kind: "yaml" });
    }
    if (path.endsWith(".md") || path.endsWith(".markdown")) {
      return ok({ kind: "markdown" });
    }

    return err(createError({
      kind: "InvalidFormat",
      format: path,
    }));
  }
}
