import { Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";

import { SchemaRepository } from "../../domain/schema/index.ts";
import { FrontmatterProcessor } from "../../domain/frontmatter/index.ts";
import { TemplateRenderer } from "../../domain/template/index.ts";
import { Aggregator } from "../../domain/aggregation/index.ts";
import { BasePropertyPopulator } from "../../domain/schema/services/base-property-populator.ts";
import { ProcessOrchestrator } from "../orchestrators/process-orchestrator.ts";
import { SchemaProcessingService } from "../../domain/schema/services/schema-processing-service.ts";
import { DocumentProcessingService } from "../../domain/frontmatter/services/document-processing-service.ts";
import { OutputRenderingService } from "../../domain/template/services/output-rendering-service.ts";

export interface FileReader {
  read(path: string): Result<string, DomainError & { message: string }>;
}

export interface FileWriter {
  write(
    path: string,
    content: string,
  ): Result<void, DomainError & { message: string }>;
}

export interface FileLister {
  list(pattern: string): Result<string[], DomainError & { message: string }>;
}

/**
 * Legacy ProcessCoordinator maintained for backward compatibility.
 * Now delegates to the new ProcessOrchestrator with proper DDD architecture.
 */
export class ProcessCoordinator {
  private readonly processOrchestrator: ProcessOrchestrator;

  constructor(
    private readonly schemaRepo: SchemaRepository,
    private readonly frontmatterProcessor: FrontmatterProcessor,
    private readonly templateRenderer: TemplateRenderer,
    private readonly aggregator: Aggregator,
    private readonly fileReader: FileReader,
    private readonly fileWriter: FileWriter,
    private readonly fileLister: FileLister,
  ) {
    const basePropertyPopulator = new BasePropertyPopulator();

    // Create the 3 specialized domain services
    const schemaProcessingService = new SchemaProcessingService(
      schemaRepo,
      basePropertyPopulator,
    );

    const documentProcessingService = new DocumentProcessingService(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
    );

    const outputRenderingService = new OutputRenderingService(
      templateRenderer,
      fileReader,
      fileWriter,
    );

    // Create the orchestrator that coordinates the services
    this.processOrchestrator = new ProcessOrchestrator(
      schemaProcessingService,
      documentProcessingService,
      outputRenderingService,
    );
  }

  processDocuments(
    schemaPath: string,
    outputPath: string,
    inputPattern: string,
  ): Result<void, DomainError & { message: string }> {
    // Delegate to the new ProcessOrchestrator with proper DDD architecture
    return this.processOrchestrator.processDocuments(
      schemaPath,
      outputPath,
      inputPattern,
    );
  }
}
