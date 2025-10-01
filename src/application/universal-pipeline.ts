import { Result } from "../domain/shared/types/result.ts";
import { ProcessingError } from "../domain/shared/types/errors.ts";
import { Schema } from "../domain/schema/index.ts";
import { Template } from "../domain/template/index.ts";
import { MarkdownDocument } from "../domain/frontmatter/entities/markdown-document.ts";
import { FileSystemPort } from "../infrastructure/ports/file-system-port.ts";
import {
  ConfigurableDocumentFilter,
  DocumentLoader,
  InputProcessingStrategy,
  InputProcessingStrategyFactory,
} from "./strategies/input-processing-strategy.ts";
import { ConfigurationManager } from "./strategies/configuration-strategy.ts";

/**
 * Universal Pipeline Configuration
 */
export interface UniversalPipelineConfig {
  readonly schemaPath: string;
  readonly templatePath: string;
  readonly inputPath: string;
  readonly outputPath: string;
  readonly outputFormat?: string;
  readonly customConfiguration?: ConfigurationManager;
  readonly inputStrategies?: InputProcessingStrategy[];
}

/**
 * Pipeline execution context containing all processing state
 */
export interface PipelineContext {
  readonly config: UniversalPipelineConfig;
  readonly fileSystem: FileSystemPort;
  readonly configManager: ConfigurationManager;
  readonly inputStrategies: InputProcessingStrategy[];
  readonly documentLoader: DocumentLoader;
}

/**
 * Pipeline stage interface for configurable processing stages
 */
export interface PipelineStage<TInput, TOutput> {
  readonly stageName: string;
  execute(
    input: TInput,
    context: PipelineContext,
  ): Promise<Result<TOutput, ProcessingError>>;
}

/**
 * Schema loading stage
 */
export class SchemaLoadingStage implements PipelineStage<string, Schema> {
  readonly stageName = "schema-loading";

  async execute(
    schemaPath: string,
    context: PipelineContext,
  ): Promise<Result<Schema, ProcessingError>> {
    // Use existing schema loading logic but in a separated stage
    const { SchemaPath } = await import("../domain/schema/index.ts");
    const { SchemaId } = await import("../domain/schema/entities/schema.ts");
    const { createFileError } = await import(
      "../domain/shared/types/file-errors.ts"
    );

    // Create schema path
    const pathResult = SchemaPath.create(schemaPath);
    if (pathResult.isError()) {
      const errorMessagesResult = context.configManager.getObjectDefault(
        "errorMessages",
      );
      const errorMessages = errorMessagesResult.isOk()
        ? errorMessagesResult.unwrap() as Record<string, string>
        : {};
      return Result.error(
        new ProcessingError(
          `${
            errorMessages["SCHEMA_READ_ERROR"] || "Schema read error"
          }: ${pathResult.unwrapError().message}`,
          "INVALID_SCHEMA_PATH",
          { schemaPath },
        ),
      );
    }

    // Read schema file
    const contentResult = await context.fileSystem.readTextFile(schemaPath);
    if (contentResult.isError()) {
      const errorMessagesResult = context.configManager.getObjectDefault(
        "errorMessages",
      );
      const errorMessages = errorMessagesResult.isOk()
        ? errorMessagesResult.unwrap() as Record<string, string>
        : {};
      return Result.error(
        new ProcessingError(
          `${errorMessages["SCHEMA_READ_ERROR"] || "Schema read error"}: ${
            createFileError(contentResult.unwrapError()).message
          }`,
          "SCHEMA_READ_ERROR",
          { schemaPath, error: contentResult.unwrapError() },
        ),
      );
    }

    // Parse JSON
    try {
      JSON.parse(contentResult.unwrap());
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Invalid JSON in schema file: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "SCHEMA_PARSE_ERROR",
          { schemaPath, error },
        ),
      );
    }

    // Create schema entity
    const schemaIdResult = SchemaId.create(pathResult.unwrap().getSchemaName());
    if (schemaIdResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Invalid schema ID: ${schemaIdResult.unwrapError().message}`,
          "INVALID_SCHEMA_ID",
          { schemaPath },
        ),
      );
    }

    const schema = Schema.create(schemaIdResult.unwrap(), pathResult.unwrap());
    return Result.ok(schema);
  }
}

/**
 * Template loading stage
 */
export class TemplateLoadingStage implements PipelineStage<string, Template> {
  readonly stageName = "template-loading";

  async execute(
    templatePath: string,
    context: PipelineContext,
  ): Promise<Result<Template, ProcessingError>> {
    const { TemplatePath, TemplateLoader } = await import(
      "../domain/template/index.ts"
    );
    const { createFileError } = await import(
      "../domain/shared/types/file-errors.ts"
    );

    // Create template path
    const pathResult = TemplatePath.create(templatePath);
    if (pathResult.isError()) {
      const errorMessagesResult = context.configManager.getObjectDefault(
        "errorMessages",
      );
      const errorMessages = errorMessagesResult.isOk()
        ? errorMessagesResult.unwrap() as Record<string, string>
        : {};
      return Result.error(
        new ProcessingError(
          `${
            errorMessages["TEMPLATE_LOAD_ERROR"] || "Template load error"
          }: ${pathResult.unwrapError().message}`,
          "INVALID_TEMPLATE_PATH",
          { templatePath },
        ),
      );
    }

    // Create template loader with Result-based adapter
    const templateLoader = TemplateLoader.create({
      async readTextFile(path: string): Promise<Result<string, Error>> {
        const result = await context.fileSystem.readTextFile(path);
        if (result.isError()) {
          const fileError = createFileError(result.unwrapError());
          return Result.error(new Error(fileError.message));
        }
        return Result.ok(result.unwrap());
      },
      async exists(path: string): Promise<Result<boolean, Error>> {
        const result = await context.fileSystem.exists(path);
        if (result.isError()) {
          const fileError = createFileError(result.unwrapError());
          return Result.error(new Error(fileError.message));
        }
        return Result.ok(result.unwrap());
      },
    });

    // Load template
    const templateResult = await templateLoader.loadTemplate(
      pathResult.unwrap(),
    );
    if (templateResult.isError()) {
      const errorMessagesResult = context.configManager.getObjectDefault(
        "errorMessages",
      );
      const errorMessages = errorMessagesResult.isOk()
        ? errorMessagesResult.unwrap() as Record<string, string>
        : {};
      return Result.error(
        new ProcessingError(
          `${
            errorMessages["TEMPLATE_LOAD_ERROR"] || "Template load error"
          }: ${templateResult.unwrapError().message}`,
          "TEMPLATE_LOAD_ERROR",
          { templatePath, error: templateResult.unwrapError() },
        ),
      );
    }

    return Result.ok(templateResult.unwrap());
  }
}

/**
 * Input processing stage using strategies
 */
export class InputProcessingStage
  implements PipelineStage<string, MarkdownDocument[]> {
  readonly stageName = "input-processing";

  async execute(
    inputPath: string,
    context: PipelineContext,
  ): Promise<Result<MarkdownDocument[], ProcessingError>> {
    // Select appropriate strategy
    const strategyResult = await InputProcessingStrategyFactory.selectStrategy(
      context.inputStrategies,
      inputPath,
      context.fileSystem,
    );

    if (strategyResult.isError()) {
      return Result.error(strategyResult.unwrapError());
    }

    const strategy = strategyResult.unwrap();

    // Process input using selected strategy
    return await strategy.processInput(
      inputPath,
      context.fileSystem,
      context.documentLoader,
    );
  }
}

/**
 * Universal Pipeline that coordinates all processing stages
 */
export class UniversalPipeline {
  private readonly stages: PipelineStage<any, any>[] = [];

  constructor(
    private readonly context: PipelineContext,
  ) {
    this.initializeDefaultStages();
  }

  static create(
    config: UniversalPipelineConfig,
    fileSystem: FileSystemPort,
    documentLoader: DocumentLoader,
  ): Result<UniversalPipeline, ProcessingError> {
    const configManager = config.customConfiguration ||
      new ConfigurationManager();

    // Get default extensions from configuration
    const extensionsResult = configManager.getArrayDefault<string>(
      "inputExtensions",
    );
    const extensions = extensionsResult.isOk()
      ? extensionsResult.unwrap()
      : [".md", ".markdown"];
    const documentFilter = new ConfigurableDocumentFilter(new Set(extensions));

    const inputStrategies = config.inputStrategies ||
      InputProcessingStrategyFactory.createDefaultStrategies(documentFilter);

    const context: PipelineContext = {
      config,
      fileSystem,
      configManager,
      inputStrategies,
      documentLoader,
    };

    return Result.ok(new UniversalPipeline(context));
  }

  addStage<TInput, TOutput>(stage: PipelineStage<TInput, TOutput>): void {
    this.stages.push(stage);
  }

  async execute(): Promise<Result<UniversalPipelineResult, ProcessingError>> {
    const startTime = performance.now();

    // Stage 1: Load Schema
    const schemaStageResult = this.getStage<string, Schema>("schema-loading");
    if (schemaStageResult.isError()) {
      return Result.error(schemaStageResult.unwrapError());
    }
    const schemaResult = await schemaStageResult.unwrap().execute(
      this.context.config.schemaPath,
      this.context,
    );
    if (schemaResult.isError()) {
      return Result.error(schemaResult.unwrapError());
    }

    // Stage 2: Load Template
    const templateStageResult = this.getStage<string, Template>(
      "template-loading",
    );
    if (templateStageResult.isError()) {
      return Result.error(templateStageResult.unwrapError());
    }
    const templateResult = await templateStageResult.unwrap().execute(
      this.context.config.templatePath,
      this.context,
    );
    if (templateResult.isError()) {
      return Result.error(templateResult.unwrapError());
    }

    // Stage 3: Process Input
    const inputStageResult = this.getStage<string, MarkdownDocument[]>(
      "input-processing",
    );
    if (inputStageResult.isError()) {
      return Result.error(inputStageResult.unwrapError());
    }
    const documentsResult = await inputStageResult.unwrap().execute(
      this.context.config.inputPath,
      this.context,
    );
    if (documentsResult.isError()) {
      return Result.error(documentsResult.unwrapError());
    }

    // Use configuration strategy for output format instead of hardcoded default
    const outputFormatResult = this.context.configManager.getStringDefault(
      "outputFormat",
    );
    const outputFormat = this.context.config.outputFormat ||
      (outputFormatResult.isOk() ? outputFormatResult.unwrap() : "json");

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    return Result.ok({
      schema: schemaResult.unwrap(),
      template: templateResult.unwrap(),
      documents: documentsResult.unwrap(),
      outputFormat,
      executionTime,
      metadata: {
        schemaPath: this.context.config.schemaPath,
        templatePath: this.context.config.templatePath,
        inputPath: this.context.config.inputPath,
        outputPath: this.context.config.outputPath,
        processedDocuments: documentsResult.unwrap().length,
      },
    });
  }

  private initializeDefaultStages(): void {
    this.addStage(new SchemaLoadingStage());
    this.addStage(new TemplateLoadingStage());
    this.addStage(new InputProcessingStage());
  }

  private getStage<TInput, TOutput>(
    stageName: string,
  ): Result<PipelineStage<TInput, TOutput>, ProcessingError> {
    const stage = this.stages.find((s) => s.stageName === stageName);
    if (!stage) {
      return Result.error(
        new ProcessingError(
          `Stage not found: ${stageName}`,
          "STAGE_NOT_FOUND",
          { stageName, availableStages: this.stages.map((s) => s.stageName) },
        ),
      );
    }
    return Result.ok(stage as PipelineStage<TInput, TOutput>);
  }
}

/**
 * Result of Universal Pipeline execution
 */
export interface UniversalPipelineResult {
  readonly schema: Schema;
  readonly template: Template;
  readonly documents: MarkdownDocument[];
  readonly outputFormat: string;
  readonly executionTime: number;
  readonly metadata: {
    readonly schemaPath: string;
    readonly templatePath: string;
    readonly inputPath: string;
    readonly outputPath: string;
    readonly processedDocuments: number;
  };
}
