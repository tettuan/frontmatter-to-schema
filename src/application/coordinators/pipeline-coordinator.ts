import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { VerbosityMode } from "../../domain/template/value-objects/processing-context.ts";
import { FrontmatterTransformationService } from "../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { TemplatePathResolver } from "../../domain/template/services/template-path-resolver.ts";
import { OutputRenderingService } from "../../domain/template/services/output-rendering-service.ts";
import { SchemaCache } from "../../infrastructure/caching/schema-cache.ts";
import { FileSystemSchemaRepository } from "../../infrastructure/adapters/schema-loader.ts";
import { SchemaCoordinator } from "./schema-coordinator.ts";
import { ProcessingCoordinator } from "./processing-coordinator.ts";
import { ProcessingOptions } from "../../domain/pipeline/interfaces/document-processing-coordinator.ts";
import {
  TemplateCoordinator,
  TemplateFileSystem,
} from "./template-coordinator.ts";
import { TemplateConfig } from "../strategies/template-resolution-strategy.ts";
import { TemplateManagementDomainService } from "../../domain/template/services/template-management-domain-service.ts";
import { DomainFileReaderAdapter } from "../../infrastructure/adapters/domain-file-reader-adapter.ts";
import { DenoFileReader } from "../../infrastructure/file-system/file-reader.ts";

/**
 * Verbosity configuration using discriminated unions (Totality principle)
 */
export type VerbosityConfig =
  | { readonly kind: "verbose"; readonly enabled: true }
  | { readonly kind: "quiet"; readonly enabled: false };

/**
 * Pipeline configuration following Totality principles
 * Replaces the config from monolithic PipelineOrchestrator
 */
export interface PipelineConfig {
  readonly inputPattern: string;
  readonly schemaPath: string;
  readonly outputPath: string;
  readonly templateConfig: TemplateConfig;
  readonly verbosityConfig: VerbosityConfig;
  readonly processingOptions?: ProcessingOptions;
}

/**
 * Pipeline Coordinator - Application Service
 *
 * Replaces the monolithic PipelineOrchestrator with clean DDD architecture
 * Following DDD principles:
 * - Single responsibility: High-level pipeline coordination
 * - Clean boundaries: Delegates to specialized coordinators
 * - Totality: All methods return Result<T,E>
 * - No infrastructure coupling: Uses abstracted file systems
 */
export class PipelineCoordinator {
  constructor(
    private readonly schemaCoordinator: SchemaCoordinator,
    private readonly processingCoordinator: ProcessingCoordinator,
    private readonly templateCoordinator: TemplateCoordinator,
  ) {}

  /**
   * Smart Constructor for PipelineCoordinator
   * Following Totality principles by returning Result<T,E>
   */
  static create(
    templateFileSystem: TemplateFileSystem,
    frontmatterTransformationService: FrontmatterTransformationService,
    templatePathResolver: TemplatePathResolver,
    outputRenderingService: OutputRenderingService,
    schemaCache: SchemaCache,
  ): Result<PipelineCoordinator, DomainError & { message: string }> {
    // Create schema repository for schema loading with reference resolution
    const schemaRepository = new FileSystemSchemaRepository();

    // Create schema coordinator
    const schemaCoordinatorResult = SchemaCoordinator.create(
      schemaRepository,
      schemaCache,
    );
    if (!schemaCoordinatorResult.ok) {
      return schemaCoordinatorResult;
    }

    // Create processing coordinator with optimized performance
    const processingCoordinatorResult = ProcessingCoordinator.createOptimized(
      frontmatterTransformationService,
    );
    if (!processingCoordinatorResult.ok) {
      return processingCoordinatorResult;
    }

    // Create Template Management Domain Service for DDD compliance
    const fileReader = new DenoFileReader();
    const domainFileReader = DomainFileReaderAdapter.create(fileReader);
    const templateManagementDomainResult = TemplateManagementDomainService
      .create(
        domainFileReader,
      );
    if (!templateManagementDomainResult.ok) {
      return templateManagementDomainResult;
    }

    // Create template coordinator
    const templateCoordinatorResult = TemplateCoordinator.create(
      templateManagementDomainResult.data,
      templatePathResolver,
      outputRenderingService,
      templateFileSystem,
    );
    if (!templateCoordinatorResult.ok) {
      return templateCoordinatorResult;
    }

    return ok(
      new PipelineCoordinator(
        schemaCoordinatorResult.data,
        processingCoordinatorResult.data,
        templateCoordinatorResult.data,
      ),
    );
  }

  /**
   * Execute the complete pipeline processing
   * Replaces PipelineOrchestrator.execute() with clean DDD architecture
   * Following Totality principles - total function returning Result<T,E>
   */
  async execute(
    config: PipelineConfig,
  ): Promise<Result<void, DomainError & { message: string }>> {
    // Step 1: Load schema and get validation rules
    const schemaResult = await this.schemaCoordinator
      .loadSchemaAndGetValidationRules(config.schemaPath);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    const { schema, validationRules } = schemaResult.data;

    // Step 2: Resolve template paths
    const templatePathsResult = await this.templateCoordinator
      .resolveTemplatePaths(
        schema,
        config.templateConfig,
        config.schemaPath,
      );
    if (!templatePathsResult.ok) {
      return err(templatePathsResult.error);
    }

    // Step 3: Process documents with optional items extraction
    const processingOptions = config.processingOptions ||
      { parallel: false, maxWorkers: 1, batchSize: 10 };
    const processResult = await this.processingCoordinator
      .processDocuments(
        config.inputPattern,
        validationRules,
        schema,
        processingOptions,
      );
    if (!processResult.ok) {
      return processResult;
    }

    const mainData = processResult.data;

    // Extract items data if schema has frontmatter part
    let itemsData: FrontmatterData[] | undefined;
    const frontmatterPartResult = schema.findFrontmatterPartPath();
    if (frontmatterPartResult.ok) {
      const itemsResult = this.processingCoordinator.extractFrontmatterPartData(
        mainData,
        schema,
      );
      if (itemsResult.ok) {
        itemsData = itemsResult.data;
      }
    }

    // Step 4: Convert verbosity config to mode
    const verbosityMode = this.convertVerbosityConfigToMode(
      config.verbosityConfig,
    );

    // Step 5: Render output
    const renderResult = this.templateCoordinator.processTemplate(
      schema,
      config.templateConfig,
      config.schemaPath,
      mainData,
      itemsData,
      config.outputPath,
      verbosityMode,
    );

    return renderResult;
  }

  /**
   * Convert VerbosityConfig to VerbosityMode
   * Following Totality principles - exhaustive pattern matching
   */
  private convertVerbosityConfigToMode(
    config: VerbosityConfig,
  ): VerbosityMode {
    switch (config.kind) {
      case "verbose":
        return { kind: "verbose" };
      case "quiet":
        return { kind: "normal" };
    }
  }

  /**
   * Execute with new architecture compatibility
   * Provides compatibility with the state machine architecture
   * This bridges the gap between old and new architectures during migration
   */
  executeWithNewArchitecture(
    config: PipelineConfig,
  ): Promise<Result<void, DomainError & { message: string }>> {
    // For now, delegate to the main execute method
    // In the future, this could use the state machine pattern
    return this.execute(config);
  }
}
