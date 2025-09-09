/**
 * Process Documents Orchestrator
 *
 * Coordinates the execution of multiple use cases to process documents
 * Part of the Application Layer orchestrating Domain Services
 * Follows Totality principles with Result types
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { LoadSchemaUseCase } from "../use-cases/load-schema/load-schema.usecase.ts";
import { DiscoverFilesUseCase } from "../use-cases/discover-files/discover-files.usecase.ts";
import { ExtractFrontmatterUseCase } from "../use-cases/extract-frontmatter/extract-frontmatter.usecase.ts";
import { ValidateFrontmatterUseCase } from "../use-cases/validate-frontmatter/validate-frontmatter.usecase.ts";
import { AggregateResultsUseCase } from "../use-cases/aggregate-results/aggregate-results.usecase.ts";
import { WriteOutputUseCase } from "../use-cases/write-output/write-output.usecase.ts";
import type { FileSystemRepository } from "../../domain/repositories/file-system-repository.ts";
import type { Logger } from "../../domain/shared/logger.ts";

/**
 * Input for document processing orchestration
 */
export interface ProcessDocumentsInput {
  schemaPath: string;
  sourcePath: string;
  outputPath?: string;
  format?: "json" | "yaml" | "toml";
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Output from document processing orchestration
 */
export interface ProcessDocumentsOutput {
  filesProcessed: number;
  outputPath?: string;
  result: unknown;
}

/**
 * Process Documents Orchestrator Implementation
 * Coordinates the execution of all document processing use cases
 */
export class ProcessDocumentsOrchestrator {
  private readonly loadSchema: LoadSchemaUseCase;
  private readonly discoverFiles: DiscoverFilesUseCase;
  private readonly extractFrontmatter: ExtractFrontmatterUseCase;
  private readonly validateFrontmatter: ValidateFrontmatterUseCase;
  private readonly aggregateResults: AggregateResultsUseCase;
  private readonly writeOutput: WriteOutputUseCase;

  constructor(
    fileSystem: FileSystemRepository,
    private readonly logger: Logger,
  ) {
    this.loadSchema = new LoadSchemaUseCase(fileSystem);
    this.discoverFiles = new DiscoverFilesUseCase();
    this.extractFrontmatter = new ExtractFrontmatterUseCase();
    this.validateFrontmatter = new ValidateFrontmatterUseCase();
    this.aggregateResults = new AggregateResultsUseCase();
    this.writeOutput = new WriteOutputUseCase();
  }

  async execute(
    input: ProcessDocumentsInput,
  ): Promise<
    Result<ProcessDocumentsOutput, DomainError & { message: string }>
  > {
    // Step 1: Load and resolve schema
    if (input.verbose) {
      this.logger.info(`Loading schema from: ${input.schemaPath}`);
    }

    const schemaResult = await this.loadSchema.execute({
      schemaPath: input.schemaPath,
    });

    if (!schemaResult.ok) {
      return schemaResult;
    }

    // Step 2: Discover files
    if (input.verbose) {
      this.logger.info(`Discovering files from: ${input.sourcePath}`);
    }

    const filesResult = await this.discoverFiles.execute({
      pattern: input.sourcePath,
    });

    if (!filesResult.ok) {
      return filesResult;
    }

    // Step 3: Process each file
    const processedData: unknown[] = [];

    // Read file contents for each discovered file
    for (const filePath of filesResult.data.files) {
      if (input.verbose) {
        this.logger.info(`Processing: ${filePath}`);
      }

      // Read file content (should be handled by infrastructure)
      let content: string;
      try {
        content = await Deno.readTextFile(filePath);
      } catch (error) {
        this.logger.error(
          `Failed to read ${filePath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }

      // Extract frontmatter
      const extractResult = await this.extractFrontmatter.execute({
        filePath: filePath,
        content: content,
      });

      if (!extractResult.ok) {
        this.logger.error(
          `Failed to extract from ${filePath}: ${extractResult.error.message}`,
        );
        continue;
      }

      // Validate frontmatter
      const validateResult = await this.validateFrontmatter.execute({
        data: extractResult.data.data,
        schema: schemaResult.data.schema,
        filePath: filePath,
      });

      if (!validateResult.ok) {
        this.logger.error(
          `Validation failed for ${filePath}: ${validateResult.error.message}`,
        );
        continue;
      }

      if (!validateResult.data.valid && validateResult.data.validationErrors) {
        this.logger.warn(
          `Validation errors in ${filePath}: ${
            validateResult.data.validationErrors.join(", ")
          }`,
        );
      }

      processedData.push(extractResult.data.data);
    }

    // Step 4: Aggregate results
    const aggregateResult = await this.aggregateResults.execute({
      data: processedData,
      templateInfo: schemaResult.data.templateInfo,
      schema: schemaResult.data.schema,
    });

    if (!aggregateResult.ok) {
      return aggregateResult;
    }

    // Step 5: Write output if path provided
    let outputPath: string | undefined;

    if (input.outputPath) {
      const writeResult = await this.writeOutput.execute({
        data: aggregateResult.data.aggregated,
        outputPath: input.outputPath,
        format: input.format || "json",
        dryRun: input.dryRun,
      });

      if (!writeResult.ok) {
        return writeResult;
      }

      outputPath = input.outputPath;
    }

    return {
      ok: true,
      data: {
        filesProcessed: filesResult.data.files.length,
        outputPath,
        result: aggregateResult.data.aggregated,
      },
    };
  }
}
