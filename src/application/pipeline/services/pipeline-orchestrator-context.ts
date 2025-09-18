import { err, ok, Result } from "../../../domain/shared/types/result.ts";
import {
  createError,
  DomainError,
} from "../../../domain/shared/types/errors.ts";
import { CommandExecutionContext } from "../commands/pipeline-command.ts";
import { Schema } from "../../../domain/schema/entities/schema.ts";
import { PipelineConfigAccessor } from "../../shared/utils/pipeline-config-accessor.ts";
import { SafePropertyAccess } from "../../../domain/shared/utils/safe-property-access.ts";
import { SchemaProcessingService } from "../../../domain/schema/services/schema-processing-service.ts";
import { FrontmatterTransformationService } from "../../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { TemplatePathResolver } from "../../../domain/template/services/template-path-resolver.ts";
import { OutputRenderingService } from "../../../domain/template/services/output-rendering-service.ts";
import { SchemaPath } from "../../../domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../../domain/schema/value-objects/schema-definition.ts";
import { SchemaCache } from "../../../infrastructure/caching/schema-cache.ts";
import { VerbosityMode } from "../../../domain/template/value-objects/processing-context.ts";
import { FileSystem } from "../../services/pipeline-orchestrator.ts";
import { TemplatePathConfig } from "../../../domain/template/services/template-path-resolver.ts";
import { FrontmatterData } from "../../../domain/frontmatter/value-objects/frontmatter-data.ts";

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
      // Extract template config from pipeline config using safe accessor
      const templateConfigResult = PipelineConfigAccessor.getTemplateConfig(
        config,
      );
      if (!templateConfigResult.ok) {
        return err(templateConfigResult.error);
      }
      const rawTemplateConfig = templateConfigResult.data;

      // Convert to TemplatePathConfig safely
      const templateConfigConvertResult = this.convertToTemplatePathConfig(
        rawTemplateConfig,
        schema,
      );
      if (!templateConfigConvertResult.ok) {
        return err(templateConfigConvertResult.error);
      }
      const templateConfig = templateConfigConvertResult.data;

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
        templatePath: PipelineConfigAccessor.extractPath(
          resolvedPaths.templatePath,
        ),
        itemsTemplatePath: resolvedPaths.itemsTemplatePath
          ? PipelineConfigAccessor.extractPath(resolvedPaths.itemsTemplatePath)
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
      const processedData = frontmatterDataArray.map((frontmatterData) =>
        this.extractDataFromFrontmatterData(frontmatterData)
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
        const docObjResult = SafePropertyAccess.asRecord(document);
        if (docObjResult.ok) {
          const docObj = docObjResult.data;
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
      const frontmatterDataResult = this.createFrontmatterData(aggregatedData);
      if (!frontmatterDataResult.ok) {
        return err(frontmatterDataResult.error);
      }
      const frontmatterData = frontmatterDataResult.data;

      // Convert verbosity mode
      const verbosity: VerbosityMode = verbosityMode === "verbose"
        ? { kind: "verbose" }
        : { kind: "normal" };

      // Convert itemsData to FrontmatterData array if needed
      let convertedItemsData: FrontmatterData[] | undefined;
      if (itemsData) {
        const itemsConversionResults = await Promise.all(
          itemsData.map((item) => this.createFrontmatterData(item)),
        );

        // Check if any conversion failed
        for (const result of itemsConversionResults) {
          if (!result.ok) {
            return err(result.error);
          }
        }

        // All results are successful, extract data safely
        convertedItemsData = itemsConversionResults.map((result) => {
          if (result.ok) {
            return result.data;
          }
          throw new Error(
            "This should never happen - all results were checked to be ok",
          );
        });
      }

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

  /**
   * Creates a proper FrontmatterData object from unknown data
   * Replaces `as any` patterns for mock creation
   */
  private createFrontmatterData(
    data: unknown,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const result = FrontmatterData.create(data);
    if (!result.ok) {
      // Convert FrontmatterError to DomainError
      return err(createError({
        kind: "PipelineExecutionError",
        content: `Failed to create FrontmatterData: ${result.error.message}`,
      }));
    }
    return ok(result.data);
  }

  /**
   * Safely extracts data from FrontmatterData objects
   * Replaces `(frontmatterData: any) => frontmatterData.getData()` patterns
   */
  private extractDataFromFrontmatterData(frontmatterData: unknown): unknown {
    if (frontmatterData && typeof frontmatterData === "object") {
      const objResult = SafePropertyAccess.asRecord(frontmatterData);
      if (objResult.ok) {
        const obj = objResult.data;
        if (typeof obj.getData === "function") {
          try {
            return obj.getData();
          } catch {
            // Fall through to return the object itself
          }
        }
      }
    }
    return frontmatterData;
  }

  /**
   * Converts raw template config to TemplatePathConfig
   * Provides type-safe conversion with fallback to schema path
   */
  private convertToTemplatePathConfig(
    rawConfig: unknown,
    schema: Schema,
  ): Result<TemplatePathConfig, DomainError & { message: string }> {
    // Get schema path as fallback
    const schemaPathObj = schema.getPath();
    const schemaPath = schemaPathObj.getValue();

    // If rawConfig is null/undefined, use default
    if (rawConfig == null) {
      return ok({
        schemaPath,
      });
    }

    // Try to access as record
    const configResult = SafePropertyAccess.asRecord(rawConfig);
    if (!configResult.ok) {
      // If not an object, use default
      return ok({
        schemaPath,
      });
    }

    const configRecord = configResult.data;

    // Extract explicit template path if available
    const explicitTemplatePath =
      typeof configRecord.explicitTemplatePath === "string"
        ? configRecord.explicitTemplatePath
        : undefined;

    return ok({
      schemaPath,
      explicitTemplatePath,
    });
  }
}
