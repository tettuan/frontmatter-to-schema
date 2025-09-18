import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { CommandExecutionContext } from "../commands/pipeline-command.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { SchemaProcessingService } from "../../schema/services/schema-processing-service.ts";
import { FrontmatterTransformationService } from "../../frontmatter/services/frontmatter-transformation-service.ts";
import { TemplatePathResolver } from "../../template/services/template-path-resolver.ts";
import { OutputRenderingService } from "../../template/services/output-rendering-service.ts";
import { SchemaPath } from "../../schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../schema/value-objects/schema-definition.ts";
import { SchemaCache } from "../../../infrastructure/caching/schema-cache.ts";
import { VerbosityMode } from "../../template/value-objects/processing-context.ts";
import { FileSystem } from "../../../application/services/pipeline-orchestrator.ts";

/**
 * Context implementation that adapts existing services to the pipeline command interface
 * Bridges the gap between legacy service orchestration and new command-based pipeline
 */
export class PipelineOrchestratorContext implements CommandExecutionContext {
  constructor(
    private readonly schemaProcessor: SchemaProcessingService,
    private readonly frontmatterTransformer: FrontmatterTransformationService,
    private readonly templatePathResolver: TemplatePathResolver,
    private readonly outputRenderingService: OutputRenderingService,
    private readonly fileSystem: FileSystem,
    private readonly schemaCache: SchemaCache,
  ) {}

  async loadSchema(
    schemaPath: string,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    try {
      // Load schema content from file system
      const contentResult = await Promise.resolve(
        this.fileSystem.read(schemaPath),
      );
      if (!contentResult.ok) {
        return err(contentResult.error);
      }

      // Parse JSON content
      const schemaData = JSON.parse(contentResult.data);

      // Create schema path
      const pathResult = SchemaPath.create(schemaPath);
      if (!pathResult.ok) {
        return err(pathResult.error);
      }

      // Create schema definition
      const definitionResult = SchemaDefinition.create(schemaData);
      if (!definitionResult.ok) {
        return err(definitionResult.error);
      }

      // Create schema entity
      const schemaResult = Schema.create(
        pathResult.data,
        definitionResult.data,
      );
      if (!schemaResult.ok) {
        return err(schemaResult.error);
      }

      return ok(schemaResult.data);
    } catch (_error) {
      return err(createError({
        kind: "SchemaNotFound",
        path: schemaPath,
      }));
    }
  }

  resolveTemplatePaths(
    schema: Schema,
    config: unknown,
  ): Result<
    {
      templatePath: string;
      itemsTemplatePath?: string;
      outputFormat: string;
    },
    DomainError & { message: string }
  > {
    try {
      // Extract template config from pipeline config
      const typedConfig = config as any;
      const templateConfig = typedConfig.templateConfig;

      // Resolve template paths using template path resolver
      const resolveResult = this.templatePathResolver.resolveTemplatePaths(
        schema,
        templateConfig,
      );

      if (!resolveResult.ok) {
        return err(resolveResult.error);
      }

      const resolvedPaths = resolveResult.data;

      return ok({
        templatePath: (resolvedPaths.templatePath as any)?.getPath?.() ||
          String(resolvedPaths.templatePath),
        itemsTemplatePath: resolvedPaths.itemsTemplatePath
          ? ((resolvedPaths.itemsTemplatePath as any)?.getPath?.() ||
            String(resolvedPaths.itemsTemplatePath))
          : undefined,
        outputFormat: resolvedPaths.outputFormat || "json",
      });
    } catch (error) {
      return err(createError({
        kind: "ConfigurationError",
        message: `Template path resolution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }

  async transformDocuments(
    inputPattern: string,
    _validationRules: unknown[],
    schema: Schema,
    _options?: unknown,
  ): Promise<Result<unknown[], DomainError & { message: string }>> {
    try {
      // Get validation rules from schema
      const schemaValidationRulesResult = schema.getValidationRules();
      if (!schemaValidationRulesResult.ok) {
        return err(schemaValidationRulesResult.error);
      }

      const actualValidationRules = schemaValidationRulesResult.data;

      // Transform documents using frontmatter transformer
      const transformResult = await this.frontmatterTransformer
        .transformDocuments(
          inputPattern,
          actualValidationRules,
          schema,
          undefined, // processingBounds - using default
          {
            parallel: false, // Use sequential processing for simplicity
            maxWorkers: 1,
          },
        );

      if (!transformResult.ok) {
        return err(transformResult.error);
      }

      // Check if transformResult.data is an array or single FrontmatterData
      const frontmatterDataArray = Array.isArray(transformResult.data)
        ? transformResult.data
        : [transformResult.data];

      // Extract data from FrontmatterData array
      const processedData = frontmatterDataArray.map((frontmatterData: any) =>
        frontmatterData.getData()
      );

      return ok(processedData);
    } catch (error) {
      return err(createError({
        kind: "PipelineExecutionError",
        content: `Document transformation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }

  async extractItemsData(
    schema: Schema,
    processedData: unknown[],
  ): Promise<Result<unknown[], DomainError & { message: string }>> {
    try {
      // Check if schema has frontmatter-part path
      const frontmatterPartPathResult = schema.findFrontmatterPartPath();
      if (!frontmatterPartPathResult.ok) {
        // No frontmatter-part, return empty array
        return await Promise.resolve(ok([]));
      }

      // Extract items data from processed documents
      // This is a simplified implementation - in reality, this would need
      // to extract specific frontmatter-part data based on the schema
      const itemsData: unknown[] = [];

      for (const document of processedData) {
        if (document && typeof document === "object") {
          const docObj = document as Record<string, unknown>;
          // Look for array properties that might be items data
          for (const [_key, value] of Object.entries(docObj)) {
            if (Array.isArray(value)) {
              itemsData.push(...value);
            }
          }
        }
      }

      return ok(itemsData);
    } catch (error) {
      return err(createError({
        kind: "PipelineExecutionError",
        content: `Items data extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }

  async renderOutput(
    templatePath: string,
    itemsTemplatePath: string | undefined,
    mainData: unknown[],
    itemsData: unknown[] | undefined,
    outputPath: string,
    outputFormat: string,
    verbosityMode: unknown,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      // Convert mainData array to single FrontmatterData object
      // The renderOutput method expects a single aggregated FrontmatterData object
      const aggregatedData = mainData.length > 0 ? mainData[0] : {};
      const frontmatterData = { getData: () => aggregatedData } as any;

      // Convert verbosity mode
      const verbosity: VerbosityMode = verbosityMode === "verbose"
        ? { kind: "verbose" }
        : { kind: "normal" };

      // Convert itemsData to FrontmatterData array if needed
      const convertedItemsData = itemsData?.map((item: any) => ({
        getData: () => item,
      })) as any;

      // Render output using output rendering service
      const validOutputFormat =
        outputFormat === "json" || outputFormat === "yaml" ||
          outputFormat === "markdown"
          ? outputFormat
          : "json";

      const renderResult = await this.outputRenderingService.renderOutput(
        templatePath,
        itemsTemplatePath,
        frontmatterData,
        convertedItemsData,
        outputPath,
        validOutputFormat,
        verbosity,
      );

      if (!renderResult.ok) {
        return err(renderResult.error);
      }

      return ok(void 0);
    } catch (error) {
      return err(createError({
        kind: "PipelineExecutionError",
        content: `Output rendering failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }
}
